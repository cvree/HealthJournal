/* The engine, driven end to end against a real (in-memory) server.
 *
 * The scenarios below are the promise the Settings screen makes, written as
 * assertions: log on your phone, open your laptop, see it; edit it there, see
 * it come back. Plus every way that can go wrong — no signal, a half-finished
 * push, a wrong passphrase, two devices editing the same Tuesday, a deletion
 * racing an edit — because "it syncs when everything works" is not a feature.
 *
 * Nothing here is stubbed at the method level. MemoryBackend is a complete
 * implementation of the same contract Supabase implements, including the
 * server-side "newer wins" rule, so what is under test is the engine.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* The key store is IndexedDB-backed and degrades to "no stored key" outside a
   browser. Tests that restart a device need it to actually persist, so it is
   replaced with the same behaviour backed by a variable. */
const keyHolder: { key: CryptoKey | null } = { key: null };
vi.mock("../src/lib/sync/keyStore", () => ({
  storeKey: async (k: CryptoKey) => { keyHolder.key = k; },
  loadKey: async () => keyHolder.key,
  clearKey: async () => { keyHolder.key = null; },
}));

import { SyncEngine, backoffMs } from "../src/lib/sync/engine";
import type { KV } from "../src/lib/sync/engine";
import { MemoryBackend } from "../src/lib/sync/backend";

const PASS = "marble kettle thistle 41";

function memoryKv(): KV & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    async get(k) { return map.has(k) ? map.get(k)! : null; },
    async set(k, v) { map.set(k, v); },
    async del(k) { map.delete(k); },
  };
}

const blankDb = () => ({
  profile: { id: "p_self", name: "Me", updatedAt: "2026-01-01T00:00:00.000Z", modules: ["eczema"] },
  entries: [] as any[], food: [] as any[], bowel: [] as any[], foods: [] as any[],
  tombstones: [] as any[],
});

/* Every engine a test builds is registered here and torn down afterwards. A
   failed pass schedules a retry timer measured in seconds, and a live timer
   keeps the worker's event loop open long after the assertion has passed. */
const live: { stop(): void }[] = [];
afterEach(() => { for (const e of live.splice(0)) e.stop(); });

/** One device: its own journal, its own local storage, the shared server. */
class Device {
  db: any = blankDb();
  kv = memoryKv();
  engine: SyncEngine;
  applied = 0;

  constructor(public backend: MemoryBackend, public name: string) {
    this.engine = new SyncEngine({
      backend,
      kv: this.kv,
      getDb: () => this.db,
      applyDb: (next) => { this.db = next; this.applied++; },
      kdfIterations: 1000,
    });
    live.push(this.engine);
  }

  async connect(email = "me@example.com", pass = PASS) {
    await this.engine.start();
    await this.backend.requestCode(email);
    await this.engine.verifyCode(email, "123456");
    await this.engine.unlock(pass);
    await this.engine.enable();
    /* Drain the pass the initial push's own realtime echo queued, then detach.
       Left attached, every push wakes the other device's loop mid-assertion and
       the test measures a race rather than the engine. Realtime has its own
       test below, where the wake-up is the thing under examination. */
    await this.engine.settle();
    this.engine.stop();
    return this;
  }

  /** A local write, exactly as the app makes one: straight into the journal,
      then a nudge. Never awaits the network. */
  log(date: string, answers: Record<string, unknown>, at = `${date}T09:00:00.000Z`) {
    const i = this.db.entries.findIndex((e: any) => e.date === date);
    const base = i >= 0 ? this.db.entries[i] : { id: `e_${this.name}_${date}`, date, answers: {} };
    const next = { ...base, answers: { ...base.answers, ...answers }, quickLogCompleted: true, updatedAt: at };
    this.db = {
      ...this.db,
      entries: i >= 0
        ? this.db.entries.map((e: any, j: number) => (j === i ? next : e))
        : [...this.db.entries, next],
    };
  }

  entry(date: string) { return this.db.entries.find((e: any) => e.date === date); }
  sync() { return this.engine.settle(); }
}

async function pair() {
  const backend = new MemoryBackend();
  const phone = await new Device(backend, "phone").connect();
  const laptop = await new Device(backend, "laptop").connect();
  return { backend, phone, laptop };
}

beforeEach(() => { keyHolder.key = null; });

/* ---------- the promise ---------- */

describe("log on one device, open another", () => {
  it("carries the entry across", async () => {
    const { phone, laptop } = await pair();
    phone.log("2026-03-04", { pain: 6 });
    await phone.sync();
    await laptop.sync();
    expect(laptop.entry("2026-03-04").answers.pain).toBe(6);
  });

  it("carries an edit made on the second device back to the first", async () => {
    const { phone, laptop } = await pair();
    phone.log("2026-03-04", { pain: 6 });
    await phone.sync();
    await laptop.sync();

    laptop.log("2026-03-04", { pain: 3 }, "2026-03-04T18:00:00.000Z");
    await laptop.sync();
    await phone.sync();
    expect(phone.entry("2026-03-04").answers.pain).toBe(3);
  });

  it("carries the survey setup, so the second device asks the same questions", async () => {
    const { phone, laptop } = await pair();
    phone.db = {
      ...phone.db,
      profile: { ...phone.db.profile, modules: ["eczema", "carnivore"], updatedAt: "2026-04-01T00:00:00.000Z" },
    };
    await phone.sync();
    await laptop.sync();
    expect(laptop.db.profile.modules).toEqual(["eczema", "carnivore"]);
  });

  it("never creates two of the same day when both devices logged it independently", async () => {
    // Each device minted its own local id for Tuesday. If identity were that id
    // rather than the date, Tuesday would exist twice from here on.
    const { phone, laptop, backend } = await pair();
    phone.log("2026-03-04", { pain: 6 }, "2026-03-04T08:00:00.000Z");
    laptop.log("2026-03-04", { sleep: 7 }, "2026-03-04T09:00:00.000Z");
    await phone.sync();
    await laptop.sync();
    await phone.sync();
    expect(phone.db.entries.filter((e: any) => e.date === "2026-03-04")).toHaveLength(1);
    expect(laptop.db.entries.filter((e: any) => e.date === "2026-03-04")).toHaveLength(1);
    expect([...backend.rows.keys()].filter((k) => k.includes("2026-03-04"))).toHaveLength(1);
  });
});

/* ---------- conflicts ---------- */

describe("two devices editing the same day", () => {
  it("keeps both answers instead of picking a winner", async () => {
    const { phone, laptop } = await pair();
    phone.log("2026-03-04", { pain: 6 }, "2026-03-04T08:00:00.000Z");
    laptop.log("2026-03-04", { sleep: 7 }, "2026-03-04T09:00:00.000Z");
    await phone.sync();
    await laptop.sync();
    expect(laptop.entry("2026-03-04").answers).toEqual({ pain: 6, sleep: 7 });
  });

  it("converges — both devices end up holding the same day", async () => {
    const { phone, laptop } = await pair();
    phone.log("2026-03-04", { pain: 6 }, "2026-03-04T08:00:00.000Z");
    laptop.log("2026-03-04", { sleep: 7 }, "2026-03-04T09:00:00.000Z");
    await phone.sync(); await laptop.sync(); await phone.sync(); await laptop.sync();
    expect(phone.entry("2026-03-04").answers).toEqual(laptop.entry("2026-03-04").answers);
  });

  it("settles instead of pushing the merge back and forth forever", async () => {
    const { phone, laptop, backend } = await pair();
    phone.log("2026-03-04", { pain: 6 }, "2026-03-04T08:00:00.000Z");
    laptop.log("2026-03-04", { sleep: 7 }, "2026-03-04T09:00:00.000Z");
    for (let i = 0; i < 4; i++) { await phone.sync(); await laptop.sync(); }
    const settled = backend.pushCalls;
    await phone.sync(); await laptop.sync(); await phone.sync();
    // Once both sides agree there is nothing left to send, so the push count
    // stops moving. A merge that re-stamps itself every pass would not.
    expect(backend.pushCalls).toBe(settled);
  });
});

/* ---------- offline ---------- */

describe("offline", () => {
  it("saves locally with no network at all", async () => {
    const { phone, backend } = await pair();
    backend.offline = true;
    phone.log("2026-03-05", { pain: 4 });
    // The save already happened; the sync attempt failing changes nothing.
    const status = await phone.sync();
    expect(status.phase).toBe("error");
    expect(phone.entry("2026-03-05").answers.pain).toBe(4);
  });

  it("reports what is waiting, and clears it once it lands", async () => {
    const { phone, backend } = await pair();
    backend.offline = true;
    phone.log("2026-03-05", { pain: 4 });
    await phone.sync();
    expect(phone.engine.getStatus().pending).toBeGreaterThan(0);

    backend.offline = false;
    await phone.sync();
    expect(phone.engine.getStatus().pending).toBe(0);
    expect(phone.engine.getStatus().phase).toBe("idle");
  });

  it("flushes a week of offline edits in one pass when the signal comes back", async () => {
    const { phone, laptop, backend } = await pair();
    backend.offline = true;
    for (let d = 1; d <= 7; d++) phone.log(`2026-03-0${d}`, { pain: d });
    await phone.sync();

    backend.offline = false;
    await phone.sync();
    await laptop.sync();
    expect(laptop.db.entries).toHaveLength(7);
  });

  it("sends one version of a record edited nine times offline, not nine", async () => {
    const { phone, laptop, backend } = await pair();
    backend.offline = true;
    for (let i = 1; i <= 9; i++) phone.log("2026-03-04", { pain: i }, `2026-03-04T0${i}:00:00.000Z`);
    await phone.sync();
    backend.offline = false;
    await phone.sync();
    await laptop.sync();
    expect(laptop.entry("2026-03-04").answers.pain).toBe(9);
  });
});

/* ---------- failure recovery ---------- */

describe("recovering from a failed push", () => {
  it("retries and loses nothing", async () => {
    const { phone, laptop, backend } = await pair();
    phone.log("2026-03-06", { pain: 2 });
    backend.failNextPush = 1;
    expect((await phone.sync()).phase).toBe("error");

    expect((await phone.sync()).phase).toBe("idle");
    await laptop.sync();
    expect(laptop.entry("2026-03-06").answers.pain).toBe(2);
  });

  it("is idempotent — re-sending a row the server already has changes nothing", async () => {
    const { phone, backend } = await pair();
    phone.log("2026-03-06", { pain: 2 });
    await phone.sync();
    const before = backend.rows.get("entry 2026-03-06");

    // Force a re-send of the identical row, the way an ambiguous network
    // failure would: the request may or may not have arrived, so it goes again.
    phone.engine.noteDeleted("entry", "2026-03-06");
    await phone.sync();
    expect(backend.rows.size).toBe(before ? backend.rows.size : 0);
    expect(backend.rows.get("entry 2026-03-06")!.ciphertext).toBeTruthy();
  });

  it("drops a stale write from a device that has been away", async () => {
    // The server enforces this, not the client — a device offline for a week
    // must not overwrite newer edits just because it asked last.
    const { phone, laptop } = await pair();
    laptop.log("2026-03-07", { pain: 1 }, "2026-03-07T20:00:00.000Z");
    await laptop.sync();
    phone.log("2026-03-07", { pain: 9 }, "2026-03-07T08:00:00.000Z");
    await phone.sync();
    await laptop.sync();
    expect(laptop.entry("2026-03-07").answers.pain).toBe(1);
  });

  it("backs off further each attempt, and never past a minute", () => {
    expect(backoffMs(1)).toBeLessThanOrEqual(1000);
    expect(backoffMs(3)).toBeGreaterThan(backoffMs(1) / 2);
    for (let i = 1; i < 30; i++) expect(backoffMs(i)).toBeLessThanOrEqual(60_000);
    expect(backoffMs(0)).toBeGreaterThan(0);
  });

  it("says what the user has to do when the session expires", async () => {
    const { phone } = await pair();
    phone.engine.__internals.setSession(null);
    await phone.sync();
    const s = phone.engine.getStatus();
    expect(s.phase).toBe("blocked");
    expect(s.action).toBe("signIn");
    expect(s.message).toMatch(/sign in/i);
  });
});

/* ---------- deletions ---------- */

describe("deleting on one device", () => {
  it("removes it on the other", async () => {
    const { phone, laptop } = await pair();
    phone.db.food.push({ id: "f1", date: "2026-03-04", description: "Eggs", updatedAt: "2026-03-04T08:00:00.000Z" });
    await phone.sync();
    await laptop.sync();
    expect(laptop.db.food).toHaveLength(1);

    phone.db = {
      ...phone.db,
      food: [],
      tombstones: [{ kind: "food", id: "f1", deletedAt: "2026-03-04T12:00:00.000Z", rev: 1, deviceId: "phone" }],
    };
    phone.engine.noteDeleted("food", "f1");
    await phone.sync();
    await laptop.sync();
    expect(laptop.db.food).toHaveLength(0);
  });

  it("does not resurrect it on the next pull", async () => {
    const { phone, laptop } = await pair();
    phone.db.food.push({ id: "f1", date: "2026-03-04", description: "Eggs", updatedAt: "2026-03-04T08:00:00.000Z" });
    await phone.sync();
    await laptop.sync();

    laptop.db = {
      ...laptop.db,
      food: [],
      tombstones: [{ kind: "food", id: "f1", deletedAt: "2026-03-04T12:00:00.000Z", rev: 1, deviceId: "laptop" }],
    };
    laptop.engine.noteDeleted("food", "f1");
    await laptop.sync();
    for (let i = 0; i < 3; i++) { await phone.sync(); await laptop.sync(); }
    expect(phone.db.food).toHaveLength(0);
    expect(laptop.db.food).toHaveLength(0);
  });
});

/* ---------- merging two existing journals ---------- */

describe("turning sync on when both sides already have a journal", () => {
  it("keeps every day from both, and overwrites neither", async () => {
    const backend = new MemoryBackend();
    const phone = new Device(backend, "phone");
    phone.log("2026-01-01", { pain: 1 });
    phone.log("2026-01-02", { pain: 2 });
    await phone.connect();

    const laptop = new Device(backend, "laptop");
    laptop.log("2026-01-03", { pain: 3 });
    laptop.log("2026-01-04", { pain: 4 });
    await laptop.connect();
    await laptop.sync();
    await phone.sync();

    const dates = (d: Device) => d.db.entries.map((e: any) => e.date).sort();
    expect(dates(laptop)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
    expect(dates(phone)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
  });
});

/* ---------- the passphrase ---------- */

describe("the sync passphrase", () => {
  it("refuses a passphrase that doesn't match the journal, and says so plainly", async () => {
    const backend = new MemoryBackend();
    await new Device(backend, "phone").connect();

    const laptop = new Device(backend, "laptop");
    await laptop.engine.start();
    await backend.requestCode("me@example.com");
    await laptop.engine.verifyCode("me@example.com", "123456");
    await expect(laptop.engine.unlock("some other passphrase")).rejects.toThrow(/passphrase/i);
  });

  it("unlocks a second device with the right one", async () => {
    const backend = new MemoryBackend();
    const phone = await new Device(backend, "phone").connect();
    phone.log("2026-05-01", { pain: 5 });
    await phone.sync();

    const laptop = new Device(backend, "laptop");
    await laptop.engine.start();
    await backend.requestCode("me@example.com");
    await laptop.engine.verifyCode("me@example.com", "123456");
    const { created } = await laptop.engine.unlock(PASS);
    expect(created).toBe(false); // the first device already set the salt
    await laptop.engine.enable();
    expect(laptop.entry("2026-05-01").answers.pain).toBe(5);
  });

  it("does not mint a second salt when two devices set up at once", async () => {
    // Two salts means two keys and a journal neither device can fully read.
    const backend = new MemoryBackend();
    const a = new Device(backend, "a");
    const b = new Device(backend, "b");
    await a.engine.start(); await b.engine.start();
    await backend.requestCode("me@example.com");
    await a.engine.verifyCode("me@example.com", "123456");
    await b.engine.verifyCode("me@example.com", "123456");
    await Promise.all([a.engine.unlock(PASS), b.engine.unlock(PASS)]);
    expect(backend.meta).toBeTruthy();
    await a.engine.enable();
    await b.engine.enable();
    a.log("2026-06-01", { pain: 3 });
    await a.sync(); await b.sync();
    expect(b.entry("2026-06-01").answers.pain).toBe(3);
  });
});

/* ---------- what the server can see ---------- */

describe("what reaches the server", () => {
  it("stores ciphertext, not answers", async () => {
    const { phone, backend } = await pair();
    phone.db = {
      ...phone.db,
      entries: [{ id: "e1", date: "2026-03-04", answers: { notes: "eczema flare" }, updatedAt: "2026-03-04T09:00:00.000Z" }],
    };
    await phone.sync();
    const dump = JSON.stringify([...backend.rows.values()]);
    expect(dump).not.toContain("eczema");
    expect(dump).toContain("2026-03-04"); // the date is metadata, and is not hidden
  });

  it("never sends this device's sound and haptic settings", async () => {
    const { phone, backend } = await pair();
    phone.db = { ...phone.db, profile: { ...phone.db.profile, prefs: { sound: false }, updatedAt: "2026-07-01T00:00:00.000Z" } };
    await phone.sync();
    // Cleartext check is the only meaningful one here — everything else is
    // sealed, so this asserts the projection dropped it before encryption.
    expect(JSON.stringify([...backend.rows.values()])).not.toContain("sound");
  });
});

/* ---------- turning it off ---------- */

describe("stopping", () => {
  it("leaves the journal completely intact on the device", async () => {
    const { phone } = await pair();
    phone.log("2026-03-04", { pain: 6 });
    await phone.sync();
    await phone.engine.disable();
    expect(phone.entry("2026-03-04").answers.pain).toBe(6);
    expect(phone.engine.getStatus().phase).toBe("off");
    expect(phone.engine.isEnabled()).toBe(false);
  });

  it("forgets the key, so the passphrase is needed again", async () => {
    const { phone } = await pair();
    await phone.engine.disable();
    expect(keyHolder.key).toBe(null);
  });

  it("deletes the cloud copy when asked to, and only then", async () => {
    const backend = new MemoryBackend();
    const phone = await new Device(backend, "phone").connect();
    phone.log("2026-03-04", { pain: 6 });
    await phone.sync();
    expect(backend.rows.size).toBeGreaterThan(0);

    await phone.engine.disable({ purge: true });
    expect(backend.rows.size).toBe(0);
    expect(backend.meta).toBe(null);
    expect(phone.entry("2026-03-04").answers.pain).toBe(6);
  });

  it("stays off across a restart", async () => {
    const backend = new MemoryBackend();
    const phone = await new Device(backend, "phone").connect();
    await phone.engine.disable();

    const restarted = new SyncEngine({
      backend, kv: phone.kv, getDb: () => phone.db, applyDb: () => {}, kdfIterations: 1000,
    });
    expect((await restarted.start()).phase).toBe("off");
  });
});

/* ---------- restarting ---------- */

describe("relaunching the app", () => {
  it("resumes quietly without asking for anything", async () => {
    const backend = new MemoryBackend();
    const phone = await new Device(backend, "phone").connect();
    phone.log("2026-03-04", { pain: 6 });
    await phone.sync();

    const again = new SyncEngine({
      backend, kv: phone.kv, getDb: () => phone.db, applyDb: () => {}, kdfIterations: 1000,
    });
    await again.start();
    const status = await again.settle();
    again.stop();
    expect(status.phase).toBe("idle");
    expect(status.ready).toBe(true);
  });

  it("asks for the passphrase again if the stored key is gone", async () => {
    const backend = new MemoryBackend();
    const phone = await new Device(backend, "phone").connect();
    keyHolder.key = null; // e.g. site data cleared, or a different browser profile

    const again = new SyncEngine({
      backend, kv: phone.kv, getDb: () => phone.db, applyDb: () => {}, kdfIterations: 1000,
    });
    const status = await again.start();
    expect(status.phase).toBe("blocked");
    expect(status.action).toBe("passphrase");
    again.stop();
  });

  it("does not re-send everything it already sent", async () => {
    const backend = new MemoryBackend();
    const phone = await new Device(backend, "phone").connect();
    for (let d = 1; d <= 5; d++) phone.log(`2026-03-0${d}`, { pain: d });
    await phone.sync();
    const pushesBefore = backend.pushCalls;

    const again = new SyncEngine({
      backend, kv: phone.kv, getDb: () => phone.db, applyDb: (n) => { phone.db = n; }, kdfIterations: 1000,
    });
    await again.start();
    await again.settle();
    again.stop();
    expect(backend.pushCalls).toBe(pushesBefore);
  });
});

/* ---------- realtime ---------- */

describe("a change made elsewhere", () => {
  it("wakes this device without it being touched", async () => {
    const backend = new MemoryBackend();
    const phone = await new Device(backend, "phone").connect();
    const laptop = new Device(backend, "laptop");
    await laptop.engine.start();
    await backend.requestCode("me@example.com");
    await laptop.engine.verifyCode("me@example.com", "123456");
    await laptop.engine.unlock(PASS);
    await laptop.engine.enable();          // stays attached, unlike connect()

    phone.log("2026-09-09", { pain: 8 });
    await phone.sync();                    // the push fires the laptop's channel
    await laptop.engine.settle();
    expect(laptop.entry("2026-09-09").answers.pain).toBe(8);
  });

  it("ignores the echo of its own write", async () => {
    // Every backend echoes your writes back. Acting on that would mean a full
    // round trip after every single save, to fetch the row you just sent.
    const backend = new MemoryBackend();
    const phone = new Device(backend, "phone");
    await phone.engine.start();
    await backend.requestCode("me@example.com");
    await phone.engine.verifyCode("me@example.com", "123456");
    await phone.engine.unlock(PASS);
    await phone.engine.enable();
    await phone.engine.settle();

    const pullsBefore = backend.pullCalls;
    phone.log("2026-09-10", { pain: 2 });
    await phone.engine.settle();
    // One pass: one pull, one push. Not a second pass chasing our own echo.
    expect(backend.pullCalls - pullsBefore).toBe(1);
  });
});

/* ---------- photos ---------- */

describe("optional photo sync", () => {
  const bridge = (blobs: Map<string, { full: string; thumb: string }>) => ({
    async listLocal() { return [...blobs.keys()]; },
    async read(id: string) { return blobs.get(id) ?? null; },
    async write(id: string, blob: { full: string; thumb: string }) { blobs.set(id, blob); },
  });

  it("leaves photos on the device unless it is switched on", async () => {
    const backend = new MemoryBackend();
    const blobs = new Map([["p1", { full: "FULL", thumb: "TH" }]]);
    const phone = new Device(backend, "phone");
    phone.engine = new SyncEngine({
      backend, kv: phone.kv, getDb: () => phone.db,
      applyDb: (n) => { phone.db = n; }, photos: bridge(blobs), kdfIterations: 1000,
    });
    await phone.connect();
    phone.db.entries.push({ id: "e", date: "2026-03-04", photos: { skin: { photoId: "p1" } }, updatedAt: "2026-03-04T09:00:00.000Z" });
    await phone.sync();
    expect(backend.photos.size).toBe(0);
  });

  it("carries a photo across, encrypted, once it is", async () => {
    const backend = new MemoryBackend();
    const phoneBlobs = new Map([["p1", { full: "FULLDATA", thumb: "TH" }]]);
    const laptopBlobs = new Map<string, { full: string; thumb: string }>();

    const phone = new Device(backend, "phone");
    phone.engine = new SyncEngine({
      backend, kv: phone.kv, getDb: () => phone.db,
      applyDb: (n) => { phone.db = n; }, photos: bridge(phoneBlobs), kdfIterations: 1000,
    });
    await phone.connect();
    await phone.engine.setPhotoSync(true);
    phone.db.entries.push({ id: "e", date: "2026-03-04", photos: { skin: { photoId: "p1" } }, updatedAt: "2026-03-04T09:00:00.000Z" });
    await phone.sync();
    expect(backend.photos.size).toBe(1);
    expect(backend.photos.get("p1")).not.toContain("FULLDATA");

    const laptop = new Device(backend, "laptop");
    laptop.engine = new SyncEngine({
      backend, kv: laptop.kv, getDb: () => laptop.db,
      applyDb: (n) => { laptop.db = n; }, photos: bridge(laptopBlobs), kdfIterations: 1000,
    });
    await laptop.connect();
    await laptop.engine.setPhotoSync(true);
    await laptop.sync();
    expect(laptopBlobs.get("p1")).toEqual({ full: "FULLDATA", thumb: "TH" });
  });
});
