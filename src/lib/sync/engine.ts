/* The sync engine.

   One sentence governs every line of this file: **a local save never waits for
   anything.** The journal is written to disk the instant the user taps, exactly
   as it was before sync existed, and this engine finds out afterwards. If the
   network is gone, if the session expired, if the server is down, if the laptop
   lid closed mid-push — none of it can reach the save path, because the save
   path does not call into here at all. It calls `nudge()`, which sets a flag.

   The shape that falls out of that:

   - **A pushed-version map, not an operation log.** For every record the engine
     remembers the version string it last got the server to acknowledge. What is
     owed is whatever differs from that, computed fresh from the journal. A
     record edited nine times offline pushes once, with its final value; a crash
     between the write and the push loses nothing, because the diff is
     recomputed from disk rather than replayed from a queue that may itself be
     half-written.
   - **Idempotent by construction.** The server keeps the newer of two versions
     and drops the older (see backend.isNewerRow). Re-sending a row that already
     landed changes nothing. So a retry after an ambiguous failure — the request
     that may or may not have arrived — is always safe, which is the property
     that lets the engine retry aggressively instead of carefully.
   - **A sequence cursor, not a timestamp cursor.** Two rows written in the same
     millisecond, or by a server whose clock stepped, will silently skip a
     `updated_at > cursor` pull. The server assigns a strictly increasing
     `server_seq` and the cursor rides on that. This is the difference between
     "usually syncs" and "syncs".
   - **Merge before write.** Everything arriving from the server is resolved
     against what is here (merge.ts) before a single byte is applied, and the
     resolution can produce a record neither side had. That record is stamped as
     a new local write and pushed back, so the two devices converge rather than
     alternating.
   - **Failure is a state, not an exception.** Every phase the engine can be in
     is something the UI can say in one short sentence, and none of them mean
     "your data is gone" — because none of them can. */

import {
  deriveKey, seal, open, makeVerifier, checkVerifier, newSalt,
  KDF_ITERATIONS, DecryptError,
} from "./crypto";
import { storeKey, loadKey, clearKey } from "./keyStore";
import { mergeSets, sweepTombstones, isNewer, recordKey } from "./merge";
import { projectDb, applyRecords, syncIdOf } from "./project";
import type { PushRow, Session, SyncBackend } from "./backend";
import type {
  RemoteRow, SyncRecord, SyncStatus, SyncPhase, RecordKind,
} from "./types";
import { IDLE_STATUS, SYNC_SCHEMA } from "./types";

/* ---------- local persistence ---------- */

/** The narrow slice of storage the engine needs. App.tsx already has exactly
    this shape (IndexedDB-backed); tests hand it a Map. */
export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

const K_STATE = "fhj_sync_state_v1";
const K_PUSHED = "fhj_sync_pushed_v1";

interface PersistedState {
  enabled: boolean;
  deviceId: string;
  email: string | null;
  seq: number;
  lastSyncedAt: string | null;
  rev: number;
  photos: boolean;
  /** Photo ids deleted here that the server has not been told about yet.
      Persisted, because a deletion that only survives until the tab closes is
      not a deletion — see `notePhotoDeleted`. */
  photoTrash: string[];
}

const blankState = (): PersistedState => ({
  enabled: false, deviceId: "", email: null, seq: 0,
  lastSyncedAt: null, rev: 0, photos: false, photoTrash: [],
});

const newDeviceId = () =>
  `d_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

/** The version string a record is identified by in the pushed map. Exactly the
    three fields the conflict rule orders on, so "already pushed" and "already
    won" are the same question. */
const versionOf = (r: SyncRecord) => `${r.updatedAt}|${r.rev}|${r.deviceId}`;

/* ---------- engine ---------- */

export interface EngineOptions {
  backend: SyncBackend;
  kv: KV;
  /** The journal, right now. Called rather than held, so the engine can never
      be looking at a stale copy of the thing it is syncing. */
  getDb: () => any;
  /** Hand back a journal with remote changes folded in. Must be the same path a
      user edit takes, so the normal debounced save persists it. */
  applyDb: (next: any) => void;
  onStatus?: (s: SyncStatus) => void;
  /** Optional photo blobs. Absent means photos stay on the device. */
  photos?: PhotoBridge;
  /** Wall clock, injectable for tests. */
  now?: () => number;
  /** PBKDF2 rounds. Only ever lowered in tests — six hundred thousand rounds
      is the point of the thing, and a test suite that pays for them twenty
      times over tells you nothing extra. */
  kdfIterations?: number;
}

export interface PhotoBridge {
  /** Ids of every blob held on this device. */
  listLocal(): Promise<string[]>;
  read(id: string): Promise<{ full: string; thumb: string } | null>;
  write(id: string, blob: { full: string; thumb: string }): Promise<void>;
}

/** How long to wait before retry n. Exponential with a ceiling, because a
    server that is down stays down for minutes, not milliseconds — and a client
    that retries every second while it is down is part of the problem. */
export function backoffMs(attempt: number): number {
  const base = Math.min(60_000, 1000 * Math.pow(2, Math.max(0, attempt - 1)));
  /* Jitter, so a thousand phones coming back onto wifi at 7am don't arrive in
     lockstep. Full jitter rather than a small wobble: it is the variant that
     actually spreads a thundering herd. */
  return Math.round(base / 2 + Math.random() * (base / 2));
}

const PULL_PAGE = 500;
const PUSH_BATCH = 100;

export class SyncEngine {
  private o: EngineOptions;
  private backend: SyncBackend;
  private state: PersistedState = blankState();
  private pushed = new Map<string, string>();
  private key: CryptoKey | null = null;
  private session: Session | null = null;
  private status: SyncStatus = { ...IDLE_STATUS };
  /** The pass currently in flight, if any. Holding the promise rather than a
      boolean is what lets a second caller *wait for the real answer* instead of
      being told "busy" and spinning. */
  private inflight: Promise<boolean> | null = null;
  private loopActive = false;
  /** The background loop a nudge started, so `settle` can wait for it rather
      than race it. */
  private loopPromise: Promise<void> | null = null;
  private wanted = false;
  private attempt = 0;
  private retryTimer: any = null;
  private unsubs: (() => void)[] = [];
  private booted = false;

  constructor(options: EngineOptions) {
    this.o = options;
    this.backend = options.backend;
  }

  /* ---------- lifecycle ---------- */

  /** Read local state and, if sync was on, quietly resume. Safe to call twice. */
  async start(): Promise<SyncStatus> {
    if (this.booted) return this.status;
    this.booted = true;
    this.state = await this.readState();
    this.pushed = await this.readPushed();
    if (!this.state.enabled || !this.backend.isConfigured()) {
      return this.emit({ phase: "off", ready: false });
    }
    this.session = await this.backend.getSession().catch(() => null);
    this.key = await loadKey();
    if (!this.session) {
      return this.emit({ phase: "blocked", action: "signIn", ready: false,
        message: "Sign in again to keep this device in sync." });
    }
    if (!this.key) {
      return this.emit({ phase: "blocked", action: "passphrase", ready: false,
        email: this.session.email,
        message: "Enter your sync passphrase to unlock the synced journal on this device." });
    }
    this.attach();
    this.emit({ phase: "idle", ready: true, email: this.session.email, action: null, message: undefined });
    this.nudge();
    return this.status;
  }

  /** Detach listeners. The journal is untouched — this is "stop watching", not
      "stop syncing". */
  stop() {
    for (const u of this.unsubs.splice(0)) { try { u(); } catch { /* already gone */ } }
    clearTimeout(this.retryTimer);
    /* Don't start anything new. A pass already in flight is left to finish —
       tearing its state out from underneath it is how a half-applied pull
       happens — but the follow-up pass a realtime ping queued is dropped. */
    this.wanted = false;
  }

  private attach() {
    if (this.unsubs.length) return;
    this.unsubs.push(
      this.backend.subscribe((deviceId) => {
        // Our own write, echoed back. Acting on it would mean a full round trip
        // after every save to fetch the row we just sent.
        if (deviceId && deviceId === this.state.deviceId) return;
        this.nudge();
      })
    );
    this.unsubs.push(
      this.backend.onSessionChange((s) => {
        this.session = s;
        if (!s) {
          this.emit({ phase: "blocked", action: "signIn", ready: false,
            message: "Signed out. Your journal is still here on this device." });
        } else {
          this.emit({ email: s.email });
          this.nudge();
        }
      })
    );
    if (typeof window !== "undefined") {
      /* Three wake-ups, because no single one of them is reliable: `online`
         lies on captive portals, `visibilitychange` misses a desktop tab that
         never went away, and a realtime channel silently dies on a laptop that
         slept. Together they cover the ways a device comes back. */
      const wake = () => this.nudge();
      window.addEventListener("online", wake);
      document.addEventListener("visibilitychange", wake);
      window.addEventListener("focus", wake);
      this.unsubs.push(() => {
        window.removeEventListener("online", wake);
        document.removeEventListener("visibilitychange", wake);
        window.removeEventListener("focus", wake);
      });
    }
  }

  /* ---------- status ---------- */

  getStatus(): SyncStatus { return this.status; }
  isEnabled() { return this.state.enabled; }
  getEmail() { return this.state.email; }
  getDeviceId() { return this.state.deviceId; }
  photosEnabled() { return this.state.photos; }

  private emit(patch: Partial<SyncStatus>): SyncStatus {
    const next = { ...this.status, ...patch };
    next.pending = this.pendingCount();
    next.lastSyncedAt = patch.lastSyncedAt !== undefined ? patch.lastSyncedAt : this.state.lastSyncedAt;
    if (this.session?.email && next.email === undefined) next.email = this.session.email;
    const changed = JSON.stringify(next) !== JSON.stringify(this.status);
    this.status = next;
    if (changed) this.o.onStatus?.(next);
    return next;
  }

  /** How many records this device holds that the server has not confirmed.
      Computed, never counted up and down — a counter drifts, and this number is
      the one the UI uses to say "everything is safely on both sides". */
  private pendingCount(): number {
    if (!this.state.enabled) return 0;
    try {
      const recs = this.project();
      let n = 0;
      for (const r of recs) if (this.pushed.get(recordKey(r.kind, r.id)) !== versionOf(r)) n++;
      return n;
    } catch {
      return 0;
    }
  }

  /** How many records this device is holding, for the "your journals were
      merged" line at the end of setup. Counting records rather than days keeps
      it honest when the two sides overlap. */
  countLocal(): number {
    try { return this.project().filter((r) => !r.deleted).length; } catch { return 0; }
  }

  private project(): SyncRecord[] {
    return projectDb(this.o.getDb() || {}, this.state.deviceId, this.state.rev);
  }

  /* ---------- setup ---------- */

  /** Step 2 of the guided flow: mail a code. */
  async requestCode(email: string) {
    await this.backend.requestCode(email.trim());
  }

  /** Step 2b: exchange it for a session. Does not turn sync on by itself — the
      passphrase step still has to happen, and until it does nothing is sent. */
  async verifyCode(email: string, code: string): Promise<Session> {
    const s = await this.backend.verifyCode(email.trim(), code.trim());
    this.session = s;
    this.state.email = s.email;
    await this.writeState();
    return s;
  }

  /** Whether this account has been set up before, which is what decides between
      "choose a passphrase" and "enter your passphrase". */
  async hasRemoteMeta(): Promise<boolean> {
    return !!(await this.backend.getMeta());
  }

  /**
   * Step 3: turn the passphrase into a key, and prove it is the right one.
   *
   * On a new account this mints the salt and the verifier. On an existing one it
   * checks the passphrase against the stored verifier and refuses politely
   * rather than decrypting the journal into garbage — the distinction between
   * "you typed it wrong" and "something is broken" is one the user deserves.
   */
  async unlock(passphrase: string): Promise<{ created: boolean }> {
    if (!this.session) throw new Error("Sign in first.");
    let meta = await this.backend.getMeta();
    let created = false;
    if (!meta) {
      const iterations = this.o.kdfIterations ?? KDF_ITERATIONS;
      const salt = newSalt();
      const derived = await deriveKey(passphrase, salt, iterations);
      const v = await makeVerifier(derived.key);
      meta = await this.backend.putMeta({
        salt, iterations,
        verifier: v.ciphertext, verifier_iv: v.iv, schema: SYNC_SCHEMA,
      });
      created = true;
      /* putMeta is first-writer-wins, so a second device racing through setup
         gets the *existing* salt back and has to re-derive against it. Skipping
         this check would leave two devices with two keys and a journal only one
         of them can read. */
      if (meta.salt !== salt) created = false;
    }
    const derived = await deriveKey(passphrase, meta.salt, meta.iterations || KDF_ITERATIONS);
    const ok = await checkVerifier(derived.key, { ciphertext: meta.verifier, iv: meta.verifier_iv });
    if (!ok) {
      throw new Error("That passphrase doesn't match the one this journal was encrypted with.");
    }
    this.key = derived.key;
    await storeKey(derived.key);
    return { created };
  }

  /** Step 4: switch it on. From here the engine owns keeping the two sides
      equal, and the first pass is the one that merges an existing local journal
      with an existing cloud one. */
  async enable(opts: { photos?: boolean } = {}): Promise<SyncStatus> {
    if (!this.session || !this.key) throw new Error("Finish signing in first.");
    if (!this.state.deviceId) this.state.deviceId = newDeviceId();
    this.state.enabled = true;
    this.state.email = this.session.email;
    this.state.photos = !!opts.photos;
    await this.writeState();
    this.attach();
    this.emit({ phase: "syncing", ready: true, action: null, message: undefined, email: this.session.email });
    await this.runOnce();
    return this.status;
  }

  async setPhotoSync(on: boolean) {
    this.state.photos = !!on;
    await this.writeState();
    this.nudge();
  }

  /**
   * Turn sync off on this device.
   *
   * The journal stays exactly where it is. That is the whole contract of a
   * local-first app and the reason signing out is safe to offer without a
   * warning dialog: nothing here is a cache of something else.
   *
   * `purge` additionally deletes the server's copy, for someone who wants the
   * cloud side gone rather than just disconnected.
   */
  async disable(opts: { purge?: boolean } = {}) {
    if (opts.purge) {
      try { await this.backend.purge(); } catch { /* reported below via status */ }
    }
    try { await this.backend.signOut(); } catch { /* local teardown proceeds regardless */ }
    this.stop();
    this.unsubs = [];
    this.key = null;
    this.session = null;
    this.pushed.clear();
    this.state = { ...blankState(), deviceId: this.state.deviceId };
    await this.writeState();
    await this.o.kv.del(K_PUSHED);
    await clearKey();
    this.emit({ phase: "off", ready: false, pending: 0, action: null, message: undefined, email: null, lastSyncedAt: null });
  }

  /* ---------- the loop ---------- */

  /** "Something changed" — a local edit, a realtime ping, a reconnect. Cheap,
      synchronous, and safe to call on every keystroke: it coalesces. */
  nudge() {
    if (!this.state.enabled) return;
    this.wanted = true;
    this.emit({});
    if (this.loopActive) return;
    this.loopPromise = this.loop();
  }

  private async loop() {
    if (this.loopActive) return;
    this.loopActive = true;
    try {
      while (this.wanted) {
        this.wanted = false;
        const ok = await this.runOnce();
        if (!ok) break; // runOnce has already scheduled its own retry
      }
    } finally {
      this.loopActive = false;
      this.loopPromise = null;
    }
  }

  /**
   * Run to quiescence: finish whatever is in flight, then keep going while
   * anything is still owed.
   *
   * One pass is not always enough. Folding in a remote change can produce a
   * merged record that this device now has to send, so "pull, apply, push"
   * legitimately leaves work behind. This is what the Sync now button and the
   * tests wait on when they need the final answer rather than the next step.
   */
  async settle(maxPasses = 10): Promise<SyncStatus> {
    /* Drain whatever a nudge already started. Racing it instead would mean
       reporting "done" while a background pass is still mid-flight, and then
       having the status flip back to "syncing" a moment later. */
    for (let i = 0; i < maxPasses && this.loopPromise; i++) {
      try { await this.loopPromise; } catch { /* the loop reports its own failures */ }
    }
    for (let i = 0; i < maxPasses; i++) {
      /* Joining a pass that was already running is not the same as having run.
         It may have read the journal before the change this caller is waiting
         on, so a join always earns one more pass of its own. */
      const joined = !!this.inflight;
      const ok = await this.runOnce();
      if (!ok) break;
      if (!joined && !this.wanted) break;
    }
    return this.status;
  }

  /**
   * One full round trip: pull, merge, apply, push.
   *
   * Concurrent callers do not start a second pass and do not get an early
   * "busy" answer either — they join the one already running. That distinction
   * matters: an early return that reports success is indistinguishable from a
   * finished sync, and anything waiting on it (the loop, a Sync now button, a
   * test) then proceeds on a lie.
   */
  async runOnce(): Promise<boolean> {
    if (this.inflight) { this.wanted = true; return this.inflight; }
    this.inflight = this.pass();
    try { return await this.inflight; } finally { this.inflight = null; }
  }

  private async pass(): Promise<boolean> {
    if (!this.state.enabled) return false;
    if (!this.session || !this.key) {
      this.emit({
        phase: "blocked", ready: false,
        action: this.session ? "passphrase" : "signIn",
        message: this.session
          ? "Enter your sync passphrase to unlock the synced journal on this device."
          : "Sign in again to keep this device in sync.",
      });
      return false;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.emit({ phase: "offline", message: "Offline — your changes are saved here and will sync when you're back." });
      return false;
    }
    this.emit({ phase: "syncing", message: undefined });
    try {
      await this.pull();
      await this.push();
      /* Before uploading anything: get rid of what the user deleted. This runs
         whether or not photo sync is currently on, because the blobs that need
         removing are the ones uploaded while it *was*. */
      await this.emptyPhotoTrash();
      if (this.state.photos && this.o.photos) await this.syncPhotos();
      this.attempt = 0;
      this.state.lastSyncedAt = new Date(this.o.now?.() ?? Date.now()).toISOString();
      await this.writeState();
      this.emit({ phase: "idle", action: null, message: undefined, lastSyncedAt: this.state.lastSyncedAt });
      return true;
    } catch (err: any) {
      this.onFailure(err);
      return false;
    }
  }

  private onFailure(err: any) {
    const msg = String(err?.message || err || "");
    /* Three failure families, three different things for the user to do — and
       one of them (offline) is not a failure at all, which is why it is never
       shown in the failure register. */
    if (/JWT|401|session|Unauthorized|not authenticated/i.test(msg)) {
      this.emit({ phase: "blocked", action: "signIn", ready: false,
        message: "Your sign-in expired. Sign in again to resume syncing." });
      return;
    }
    if (err instanceof DecryptError || /passphrase/i.test(msg)) {
      this.emit({ phase: "blocked", action: "passphrase", ready: false,
        message: "This journal was encrypted with a different passphrase. Enter it to continue." });
      return;
    }
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    this.attempt++;
    const wait = backoffMs(this.attempt);
    this.emit({
      phase: offline ? "offline" : "error",
      action: offline ? null : "retry",
      message: offline
        ? "Offline — your changes are saved here and will sync when you're back."
        : "Couldn't reach the sync server. Your journal is safe on this device; retrying automatically.",
    });
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.nudge(), wait);
  }

  /* ---------- pull ---------- */

  private async pull() {
    let guard = 0;
    for (;;) {
      const page = await this.backend.pull(this.state.seq, PULL_PAGE);
      if (page.rows.length) await this.applyRemote(page.rows);
      this.state.seq = Math.max(this.state.seq, page.seq);
      await this.writeState();
      if (!page.more) break;
      /* A server that always says "more" would spin here forever. Ten thousand
         pages is far past any real journal and still finishes. */
      if (++guard > 20) break;
    }
  }

  private async applyRemote(rows: RemoteRow[]) {
    const remote: SyncRecord[] = [];
    for (const row of rows) {
      if (row.deleted) {
        remote.push({
          kind: row.kind, id: row.id, updatedAt: row.updated_at, rev: row.rev,
          deviceId: row.device_id, deleted: true, payload: null,
        });
        continue;
      }
      if (!row.ciphertext || !row.iv) continue;
      const payload = await open(this.key!, row.kind, row.id, { ciphertext: row.ciphertext, iv: row.iv });
      remote.push({
        kind: row.kind, id: row.id, updatedAt: row.updated_at, rev: row.rev,
        deviceId: row.device_id, payload,
      });
    }
    if (!remote.length) return;

    /* Only the records this page is actually about.
     *
     * A pull is a delta, not a snapshot. Handing mergeSets the whole journal
     * would make every local record the page happens not to mention look like
     * something the server has never seen — and the engine would re-upload the
     * entire journal after every incremental pull, forever. What this device
     * genuinely still owes is decided by the pushed-version diff in push(),
     * which compares against what the server acknowledged rather than against
     * one page of it. */
    const inPage = new Set(remote.map((r) => recordKey(r.kind, r.id)));
    const local = this.project().filter((r) => inPage.has(recordKey(r.kind, r.id)));
    const { toApply, toPush } = mergeSets(local, remote);

    /* A three-way merge produced a record neither side holds, so it is a new
       write by this device — stamped now, and pushed. Without the re-stamp it
       would carry the remote version string, look "already pushed", and the two
       devices would sit on different journals forever. */
    const applySet = new Set(toApply);
    const stamped: SyncRecord[] = [];
    const push: SyncRecord[] = [];
    for (const rec of toPush) {
      if (applySet.has(rec)) {
        this.state.rev++;
        const fresh: SyncRecord = {
          ...rec,
          updatedAt: new Date(this.o.now?.() ?? Date.now()).toISOString(),
          rev: this.state.rev,
          deviceId: this.state.deviceId,
        };
        applySet.delete(rec);
        stamped.push(fresh);
        push.push(fresh);
      } else {
        push.push(rec);
      }
    }

    const incoming = [...applySet, ...stamped];
    if (incoming.length) {
      const db = this.o.getDb() || {};
      const { db: next, changed } = applyRecords(db, incoming);
      if (changed) {
        next.tombstones = sweepTombstones(next.tombstones || [], new Date(this.o.now?.() ?? Date.now()));
        this.o.applyDb(next);
      }
    }

    /* Everything that arrived and won is, by definition, already on the server
       in exactly this form — recording that prevents a pointless echo push. */
    for (const rec of remote) {
      const key = recordKey(rec.kind, rec.id);
      const local1 = local.find((l) => recordKey(l.kind, l.id) === key);
      if (!local1 || !isNewer(local1, rec)) this.pushed.set(key, versionOf(rec));
    }
    for (const rec of push) this.pushed.delete(recordKey(rec.kind, rec.id));
    await this.writePushed();
  }

  /* ---------- push ---------- */

  private async push() {
    const records = this.project();
    const owed = records.filter((r) => this.pushed.get(recordKey(r.kind, r.id)) !== versionOf(r));
    if (!owed.length) return;

    for (let i = 0; i < owed.length; i += PUSH_BATCH) {
      const batch = owed.slice(i, i + PUSH_BATCH);
      const rows: PushRow[] = [];
      for (const rec of batch) {
        const base = {
          kind: rec.kind, id: rec.id, updated_at: rec.updatedAt,
          rev: rec.rev, device_id: rec.deviceId, deleted: !!rec.deleted,
        };
        if (rec.deleted) { rows.push({ ...base, ciphertext: null, iv: null }); continue; }
        const sealed = await seal(this.key!, rec.kind, rec.id, rec.payload);
        rows.push({ ...base, ciphertext: sealed.ciphertext, iv: sealed.iv });
      }
      await this.backend.push(rows);
      /* Marked only after the server has acknowledged the batch. A push that
         fails halfway leaves the rest owed, and the next pass re-sends them —
         harmlessly, because the server keeps the newer of two identical rows. */
      for (const rec of batch) this.pushed.set(recordKey(rec.kind, rec.id), versionOf(rec));
      await this.writePushed();
    }
  }

  /* ---------- photos ----------

     Opt-in, and separate from records for one reason: a journal with a year of
     daily photos is three orders of magnitude larger than the journal itself,
     and someone on a metered connection should get to say no to that without
     giving up sync entirely. The blobs are sealed with the same key. */

  /**
   * Tell the server about photos the user removed here.
   *
   * The mirror of "no silent data loss", and the one that matters more for a
   * health journal: no silent data *retention*. Deleting a photo has to mean
   * deleting it, not deleting the reference and leaving the picture in a bucket
   * indefinitely. It cannot be inferred from a missing local blob either —
   * "deleted" and "not downloaded yet" look identical from there — so the
   * deletion is recorded explicitly and retried until the server confirms it.
   */
  private async emptyPhotoTrash() {
    if (!this.state.photoTrash.length) return;
    const remaining: string[] = [];
    for (const id of this.state.photoTrash) {
      try {
        await this.backend.deletePhoto(id);
        this.pushed.delete(`photo ${id}`);
      } catch {
        remaining.push(id); // try again next pass
      }
    }
    this.state.photoTrash = remaining;
    await this.writeState();
    await this.writePushed();
  }

  /** Called on every local photo deletion. Cheap and safe when sync is off —
      the list is only ever read while a session and a key are in hand. */
  notePhotoDeleted(ids: string[]) {
    if (!this.state.enabled || !ids.length) return;
    const set = new Set([...this.state.photoTrash, ...ids]);
    this.state.photoTrash = [...set];
    void this.writeState();
    this.nudge();
  }

  private async syncPhotos() {
    const bridge = this.o.photos;
    if (!bridge) return;
    const db = this.o.getDb() || {};
    const wanted = new Set<string>();
    for (const e of db.entries || []) {
      for (const meta of Object.values<any>(e.photos || {})) {
        if (meta?.photoId) wanted.add(meta.photoId);
      }
    }
    for (const log of [...(db.food || []), ...(db.bowel || [])]) {
      if (log?.photoId) wanted.add(log.photoId);
    }
    const local = new Set(await bridge.listLocal());

    for (const id of wanted) {
      if (!local.has(id)) {
        const raw = await this.backend.getPhoto(id).catch(() => null);
        if (!raw) continue;
        try {
          const blob = await open<{ full: string; thumb: string }>(this.key!, "photo", id, JSON.parse(raw));
          await bridge.write(id, blob);
        } catch { /* a photo that won't decrypt must not stop the journal syncing */ }
        continue;
      }
      const key = `photo ${id}`;
      if (this.pushed.get(key) === "1") continue;
      const blob = await bridge.read(id);
      if (!blob) continue;
      const sealed = await seal(this.key!, "photo", id, blob);
      await this.backend.putPhoto(id, JSON.stringify(sealed));
      this.pushed.set(key, "1");
      await this.writePushed();
    }
  }

  /* ---------- deletions ---------- */

  /** Tell the engine a record is gone. The journal's own tombstone list is what
      actually carries this (see project.addTombstone); this only wakes the
      loop. */
  noteDeleted(kind: RecordKind, id: string) {
    this.pushed.delete(recordKey(kind, id));
    this.nudge();
  }

  /* ---------- persistence ---------- */

  private async readState(): Promise<PersistedState> {
    try {
      const raw = await this.o.kv.get(K_STATE);
      const parsed = raw ? { ...blankState(), ...JSON.parse(raw) } : blankState();
      if (!parsed.deviceId) parsed.deviceId = newDeviceId();
      return parsed;
    } catch {
      return { ...blankState(), deviceId: newDeviceId() };
    }
  }

  private async writeState() {
    try { await this.o.kv.set(K_STATE, JSON.stringify(this.state)); } catch { /* best effort */ }
  }

  private async readPushed(): Promise<Map<string, string>> {
    try {
      const raw = await this.o.kv.get(K_PUSHED);
      return new Map(raw ? Object.entries(JSON.parse(raw)) as [string, string][] : []);
    } catch {
      return new Map();
    }
  }

  private async writePushed() {
    try {
      await this.o.kv.set(K_PUSHED, JSON.stringify(Object.fromEntries(this.pushed)));
    } catch { /* the worst case is re-pushing rows the server already has */ }
  }

  /** Test seam. */
  get __internals() {
    return {
      state: this.state, pushed: this.pushed,
      setKey: (k: CryptoKey | null) => { this.key = k; },
      setSession: (s: Session | null) => { this.session = s; },
      project: () => this.project(),
      syncIdOf,
      phase: (): SyncPhase => this.status.phase,
    };
  }
}
