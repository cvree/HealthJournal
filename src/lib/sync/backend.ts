/* The seam between the sync engine and whatever is holding the rows.

   The engine is the part that can lose data, so it is the part that has to be
   testable exhaustively — offline, reconnecting, half-pushed, two devices
   racing, a passphrase typed wrong on the third try. None of that is testable
   against a live Postgres in a unit test, and mocking a Supabase client is
   mocking someone else's API surface rather than the one contract that matters.

   So the contract is here, in eleven methods, and there are two implementations
   of it: Supabase (src/lib/sync/supabase.ts) and an in-memory one (below) that
   the tests drive. The engine has never heard of Supabase. */

import type { RemoteMeta, RemoteRow, RecordKind } from "./types";

export interface Session {
  userId: string;
  email: string | null;
}

/** One record on its way to the server. Metadata clear, contents sealed. */
export interface PushRow {
  kind: RecordKind;
  id: string;
  updated_at: string;
  rev: number;
  device_id: string;
  deleted: boolean;
  ciphertext: string | null;
  iv: string | null;
}

export interface PullPage {
  rows: RemoteRow[];
  /** Highest server_seq in this page; the next pull starts after it. */
  seq: number;
  /** True when the server has more waiting. */
  more: boolean;
}

/** Everything the engine is allowed to know about a server.

    Note what is *not* here: no notion of tables, buckets, JWTs, or realtime
    channels. Those are implementation details of one backend, and letting them
    leak up would put infrastructure in the UI — which is the exact thing this
    product promises the user will never happen. */
export interface SyncBackend {
  /** Whether this build has a server configured at all. */
  isConfigured(): boolean;

  /** The signed-in session, or null. Never throws for "not signed in". */
  getSession(): Promise<Session | null>;
  /** Mail a one-time code. */
  requestCode(email: string): Promise<void>;
  /** Exchange a code for a session. */
  verifyCode(email: string, code: string): Promise<Session>;
  signOut(): Promise<void>;
  /** Fires whenever the session changes underneath us — token refresh failure,
      sign-out in another tab. Returns an unsubscribe. */
  onSessionChange(fn: (s: Session | null) => void): () => void;

  /** The user's KDF parameters and verifier, or null on a brand-new account. */
  getMeta(): Promise<RemoteMeta | null>;
  /** Write them, exactly once. Rejects if a row already exists, so two devices
      racing to set up cannot end up with two different salts. */
  putMeta(meta: RemoteMeta): Promise<RemoteMeta>;

  /** Rows with server_seq greater than `afterSeq`, oldest first. */
  pull(afterSeq: number, limit: number): Promise<PullPage>;
  /** Upsert. The server keeps whichever version is newer, so re-sending a row
      that already landed is a no-op — which is what makes retries safe. */
  push(rows: PushRow[]): Promise<void>;

  /** Call `fn` when a write lands, passing the device that made it where the
      backend knows. That argument is not decoration: every backend echoes your
      own writes back to you, and waking up to fetch a row you just sent is a
      wasted round trip after every single save. Returns an unsubscribe.
      Backends without a live channel may return a no-op — the engine still
      wakes on reconnect and on focus. */
  subscribe(fn: (deviceId?: string | null) => void): () => void;

  /** Optional photo blobs. */
  putPhoto(id: string, dataUrl: string): Promise<void>;
  getPhoto(id: string): Promise<string | null>;
  deletePhoto(id: string): Promise<void>;

  /** Remove everything this user has on the server. Used by "stop syncing and
      delete the cloud copy", which has to actually do that. */
  purge(): Promise<void>;
}

/* ---------- in-memory backend ----------

   Not a mock: a real, complete implementation of the contract, with the same
   ordering guarantees the SQL one has. Tests drive failures through it by
   flipping `offline` and `failNextPush` rather than by stubbing methods, so
   what is being tested is the engine's behaviour and not a stub's. */

export interface MemoryBackendOptions {
  configured?: boolean;
  session?: Session | null;
}

export class MemoryBackend implements SyncBackend {
  rows = new Map<string, RemoteRow>();
  meta: RemoteMeta | null = null;
  photos = new Map<string, string>();
  session: Session | null;
  configured: boolean;
  /** Every network method rejects while this is true. */
  offline = false;
  /** Counts down: each push while positive fails and decrements. */
  failNextPush = 0;
  pushCalls = 0;
  pullCalls = 0;
  private seq = 0;
  private listeners = new Set<(deviceId?: string | null) => void>();
  private sessionListeners = new Set<(s: Session | null) => void>();
  private codes = new Map<string, string>();

  constructor(opts: MemoryBackendOptions = {}) {
    this.configured = opts.configured !== false;
    this.session = opts.session ?? null;
  }

  private net() {
    if (this.offline) throw new Error("Network request failed");
  }

  isConfigured() { return this.configured; }

  async getSession() { return this.session; }

  async requestCode(email: string) {
    this.net();
    this.codes.set(email, "123456");
  }

  async verifyCode(email: string, code: string) {
    this.net();
    if (this.codes.get(email) !== code) throw new Error("That code didn't work. Check it and try again.");
    this.session = { userId: `u_${email}`, email };
    for (const fn of this.sessionListeners) fn(this.session);
    return this.session;
  }

  async signOut() {
    this.session = null;
    for (const fn of this.sessionListeners) fn(null);
  }

  onSessionChange(fn: (s: Session | null) => void) {
    this.sessionListeners.add(fn);
    return () => { this.sessionListeners.delete(fn); };
  }

  async getMeta() { this.net(); return this.meta; }

  async putMeta(meta: RemoteMeta) {
    this.net();
    // Same race guard the SQL insert has: first writer wins, everyone else
    // reads back what is already there rather than overwriting a live salt.
    if (this.meta) return this.meta;
    this.meta = meta;
    return meta;
  }

  async pull(afterSeq: number, limit: number): Promise<PullPage> {
    this.net();
    this.pullCalls++;
    const all = [...this.rows.values()]
      .filter((r) => r.server_seq > afterSeq)
      .sort((a, b) => a.server_seq - b.server_seq);
    const rows = all.slice(0, limit);
    return {
      rows,
      seq: rows.length ? rows[rows.length - 1].server_seq : afterSeq,
      more: all.length > rows.length,
    };
  }

  async push(rows: PushRow[]) {
    this.net();
    this.pushCalls++;
    if (this.failNextPush > 0) { this.failNextPush--; throw new Error("Network request failed"); }
    for (const row of rows) {
      const key = `${row.kind} ${row.id}`;
      const prev = this.rows.get(key);
      // The server-side conflict rule, mirrored exactly: a stale write is
      // dropped, not applied. This is what makes a retry idempotent.
      if (prev && !isNewerRow(row, prev)) continue;
      this.rows.set(key, { ...row, server_seq: ++this.seq });
    }
    for (const fn of this.listeners) fn(rows[0]?.device_id ?? null);
  }

  subscribe(fn: (deviceId?: string | null) => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  async putPhoto(id: string, dataUrl: string) { this.net(); this.photos.set(id, dataUrl); }
  async getPhoto(id: string) { this.net(); return this.photos.get(id) ?? null; }
  async deletePhoto(id: string) { this.net(); this.photos.delete(id); }

  async purge() {
    this.net();
    this.rows.clear();
    this.photos.clear();
    this.meta = null;
    this.seq = 0;
  }
}

/** The comparison the server does. Kept beside the memory backend so the two
    implementations of "which write wins" are visibly the same rule. */
export function isNewerRow(next: PushRow, prev: { updated_at: string; rev: number; device_id: string }) {
  const a = Date.parse(next.updated_at) || 0;
  const b = Date.parse(prev.updated_at) || 0;
  if (a !== b) return a > b;
  if (next.rev !== prev.rev) return next.rev > prev.rev;
  return next.device_id > prev.device_id;
}
