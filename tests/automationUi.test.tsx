/* Automation, driven through the real app.

   The unit tests next door prove the arithmetic. What has to be proved here is
   the part that only exists once the pieces are wired together: that a session
   genuinely outlives the screen it was started on, that it is still there after
   the app is closed and reopened, and that when the app ends one by itself it
   says so somewhere a person will actually look. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import App, { __internals as I } from "../src/App";
import { LIVE_SESSION_KEY, MAX_SESSION_MINUTES, startSession, addSample } from "../src/lib/sun";

beforeAll(() => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = ((q: string) => ({
    matches: q.includes("reduce"), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  } as any)) as any;
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.confirm = () => true;
});

let kv: Map<string, string>;
const pad = (n: number) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const HERE = { lat: 51.51, lon: -0.13 };

async function mount(mutate?: (db: any) => void) {
  const db: any = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  mutate?.(db);
  kv = new Map([["fhj_v1", JSON.stringify(db)]]);
  (window as any).storage = {
    async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
    async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
    async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
    async list() { return { keys: [...kv.keys()] }; },
  };
  render(<App />);
  await screen.findAllByRole("button", { name: /out of 10/ }, { timeout: 10000 });
  return db;
}

const saved = () => JSON.parse(kv.get("fhj_v1")!);

const withPlace = (db: any) => {
  db.profile.context = { enabled: true, location: "manual", place: HERE, units: "metric" };
  db.profile.sun = { skin: 2, exposure: "arms" };
};

async function goHistory() {
  fireEvent.click(screen.getByRole("button", { name: "History" }));
  await screen.findByText(/on the record/);
}

async function goSun() {
  await goHistory();
  fireEvent.click(await screen.findByRole("button", { name: /^Sun/ }));
  await screen.findByText("Today's sun");
}

/** A session already running on this device when the app starts, `minutesAgo`
    minutes old — the thing that used to be impossible. */
function stashRunning(minutesAgo: number, over: Record<string, unknown> = {}) {
  const startedAt = new Date(Date.now() - minutesAgo * 60000);
  let live = startSession(startedAt, { coords: HERE, skin: 2, exposure: "arms", ...over });
  for (let t = 0; t <= Math.min(minutesAgo, 120); t += 5) {
    live = addSample(live, new Date(startedAt.getTime() + t * 60000));
  }
  localStorage.setItem(LIVE_SESSION_KEY, JSON.stringify({
    live, date: today(), savedAt: new Date().toISOString(),
  }));
  return live;
}

beforeEach(() => {
  cleanup();
  localStorage.removeItem(LIVE_SESSION_KEY);
});
afterEach(() => { vi.restoreAllMocks(); });

/* ---------- a session that outlives its screen ---------- */

describe("a running session", () => {
  it("is still running after you leave the sun screen, and Today says so", async () => {
    await mount(withPlace);
    await goSun();
    fireEvent.click(await screen.findByRole("button", { name: /Start sun session/ }));
    await screen.findByRole("timer");

    /* Walk away, the way somebody does when they put the phone in a pocket and
       come back to check a meal. */
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    const row = await screen.findByRole("button", { name: /Return to your running sun session/ });
    expect(within(row).getByText(/^Outside —/)).toBeTruthy();

    /* And one tap gets back to it, still counting, still unwritten. */
    fireEvent.click(row);
    expect(await screen.findByRole("timer")).toBeTruthy();
    expect(saved().sun?.length ?? 0).toBe(0);
  });

  it("is written to this device, so a reload does not lose it", async () => {
    await mount(withPlace);
    await goSun();
    fireEvent.click(await screen.findByRole("button", { name: /Start sun session/ }));
    await screen.findByRole("timer");
    await waitFor(() => expect(localStorage.getItem(LIVE_SESSION_KEY)).toBeTruthy());
    const stored = JSON.parse(localStorage.getItem(LIVE_SESSION_KEY)!);
    expect(stored.date).toBe(today());
    expect(stored.live.skin).toBe(2);
  });

  it("is picked up on the next launch, however long the app was closed", async () => {
    stashRunning(95);
    await mount(withPlace);
    /* Ninety-five minutes later and the session is simply still going. This is
       the whole feature: leaving the app is not ending the session. */
    const row = await screen.findByRole("button", { name: /Return to your running sun session/ });
    expect(row).toBeTruthy();
    expect(saved().sun?.length ?? 0).toBe(0);
  });

  it("is forgotten once it has been finished", async () => {
    await mount(withPlace);
    await goSun();
    fireEvent.click(await screen.findByRole("button", { name: /Start sun session/ }));
    await screen.findByRole("timer");
    fireEvent.click(screen.getByRole("button", { name: /^Finish$/ }));
    const sheet = await screen.findByRole("dialog", { name: /Finish sun session/ });
    fireEvent.click(within(sheet).getByRole("button", { name: /Save session/ }));
    await waitFor(() => expect(saved().sun.length).toBe(1));
    expect(localStorage.getItem(LIVE_SESSION_KEY)).toBeNull();
    expect(saved().sun[0].confirmed).toBe(true);
    expect(saved().sun[0].estimated).toBe(false);
  });

  it("is forgotten when it is discarded, and nothing is written", async () => {
    await mount(withPlace);
    await goSun();
    fireEvent.click(await screen.findByRole("button", { name: /Start sun session/ }));
    await screen.findByRole("timer");
    fireEvent.click(screen.getByRole("button", { name: /^Discard$/ }));
    await screen.findByText("Today's sun");
    expect(localStorage.getItem(LIVE_SESSION_KEY)).toBeNull();
    expect(saved().sun?.length ?? 0).toBe(0);
  });
});

/* ---------- one that was forgotten ---------- */

describe("a session nobody ever finished", () => {
  it("is closed on the next launch and asks about the time it chose", async () => {
    stashRunning(MAX_SESSION_MINUTES + 90);
    await mount(withPlace);
    await waitFor(() => expect(saved().sun?.length).toBe(1));

    const row = saved().sun[0];
    expect(row.endSource).toBe("auto-cap");
    expect(row.estimated).toBe(true);
    expect(row.confirmed).toBe(false);
    /* Nothing is left running, and nothing is lost. */
    expect(localStorage.getItem(LIVE_SESSION_KEY)).toBeNull();

    await goSun();
    expect(await screen.findByText("One thing to check")).toBeTruthy();
    expect(screen.getByText(/Is that about right\?/)).toBeTruthy();
  });

  it("is confirmed with one tap, and stops asking", async () => {
    stashRunning(MAX_SESSION_MINUTES + 90);
    await mount(withPlace);
    await waitFor(() => expect(saved().sun?.length).toBe(1));
    await goSun();
    fireEvent.click(await screen.findByRole("button", { name: /That's right/ }));
    await waitFor(() => expect(saved().sun[0].confirmed).toBe(true));
    /* Confirmed is not the same as measured — the label survives. */
    expect(saved().sun[0].estimated).toBe(true);
    await waitFor(() => expect(screen.queryByText("One thing to check")).toBeNull());
  });

  it("can be corrected, and the dose moves with the duration", async () => {
    stashRunning(MAX_SESSION_MINUTES + 90);
    await mount(withPlace);
    await waitFor(() => expect(saved().sun?.length).toBe(1));
    const before = saved().sun[0];

    await goSun();
    fireEvent.click(await screen.findByRole("button", { name: /Change the time/ }));
    const slider = await screen.findByRole("slider", { name: /How long you were outside/ });
    fireEvent.change(slider, { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save 25 min$/ }));

    await waitFor(() => expect(saved().sun[0].minutes).toBe(25));
    const after = saved().sun[0];
    expect(after.id).toBe(before.id);
    expect(after.confirmed).toBe(true);
    expect(after.sed).toBeLessThanOrEqual(before.sed);
  });

  it("is left alone entirely when it belongs to a previous day", async () => {
    const startedAt = new Date(Date.now() - 30 * 60 * 60 * 1000);
    localStorage.setItem(LIVE_SESSION_KEY, JSON.stringify({
      live: startSession(startedAt, { coords: HERE }),
      date: "2020-01-01",
      savedAt: startedAt.toISOString(),
    }));
    await mount(withPlace);
    /* No invented end time lands in the journal for a session the app has no
       honest guess about. */
    await waitFor(() => expect(localStorage.getItem(LIVE_SESSION_KEY)).toBeNull());
    expect(saved().sun?.length ?? 0).toBe(0);
  });
});

/* ---------- the offer, and the switches ---------- */

describe("being asked about auto-end", () => {
  it("is offered once on a live session, in the place it makes sense", async () => {
    await mount(withPlace);
    await goSun();
    fireEvent.click(await screen.findByRole("button", { name: /Start sun session/ }));
    expect(await screen.findByText(/End this by itself when you head in\?/)).toBeTruthy();
    /* And it says what it reads, in the offer itself, rather than in a policy
       nobody opens. */
    expect(screen.getByText(/not where you are/)).toBeTruthy();
  });

  it("is not offered at all with no position to read", async () => {
    await mount();
    await goSun();
    fireEvent.click(await screen.findByRole("button", { name: /Start sun session/ }));
    await screen.findByRole("timer");
    expect(screen.queryByText(/End this by itself when you head in\?/)).toBeNull();
  });

  it("remembers a no, and never asks again", async () => {
    await mount(withPlace);
    await goSun();
    fireEvent.click(await screen.findByRole("button", { name: /Start sun session/ }));
    fireEvent.click(await screen.findByRole("button", { name: /No, I'll finish it/ }));
    await waitFor(() => expect(saved().profile.automations["sun-auto-end"]).toBe(false));
    expect(screen.queryByText(/End this by itself when you head in\?/)).toBeNull();
  });

  it("remembers a yes, and then says what it is doing", async () => {
    await mount(withPlace);
    await goSun();
    fireEvent.click(await screen.findByRole("button", { name: /Start sun session/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Yes, do that/ }));
    await waitFor(() => expect(saved().profile.automations["sun-auto-end"]).toBe(true));
    /* An automation whose reasoning is invisible feels like a malfunction the
       first time it is wrong, so the live screen keeps reporting it — including
       here, where the platform (jsdom, with no geolocation at all) has refused.
       A refusal must not read as a change of mind: the automation stays wanted
       and the screen says what is stopping it. */
    expect(await screen.findByText(/Can't watch for that on this device/)).toBeTruthy();
    expect(screen.getByText(/finish this one yourself/)).toBeTruthy();
  });
});

describe("the automations list in Settings", () => {
  it("names every automation and what each one watches, writes and how to undo it", async () => {
    await mount(withPlace);
    fireEvent.click(screen.getByRole("button", { name: "settings" }));
    expect(await screen.findByText("Automations")).toBeTruthy();
    expect(screen.getByText(/End sun sessions when you head in/)).toBeTruthy();
    expect(screen.getAllByText("Watches").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Writes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Undo").length).toBeGreaterThan(0);
  });

  it("switches one on from there, and stores the decision on the journal", async () => {
    await mount(withPlace);
    fireEvent.click(screen.getByRole("button", { name: "settings" }));
    await screen.findByText("Automations");
    const sw = screen.getByRole("switch", { name: /End sun sessions when you head in/ });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    await waitFor(() => expect(saved().profile.automations["sun-auto-end"]).toBe(true));
  });

  it("says why one is not running rather than leaving it on and silent", async () => {
    await mount((db) => { db.profile.automations = { "sun-auto-end": true }; });
    fireEvent.click(screen.getByRole("button", { name: "settings" }));
    await screen.findByText("Automations");
    expect(screen.getByText(/Not running yet/)).toBeTruthy();
  });
});
