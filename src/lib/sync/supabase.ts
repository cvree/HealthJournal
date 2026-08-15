/* The Supabase implementation of SyncBackend.

   Everything Supabase-shaped is confined to this file. The engine, the merge
   rules, the crypto and the UI have never heard of it, which is what keeps the
   product's promise honest: the person using the app is never asked to
   understand a database, a bucket, or a token, because nothing above this line
   knows those exist either.

   Three things worth being explicit about.

   **The anon key is meant to be public.** It identifies the project and grants
   nothing on its own; every table is behind row-level security keyed on
   `auth.uid()`, so a signed-out holder of the key can read and write exactly
   nothing. The key that *would* be dangerous — the service role key — is not in
   this repo, is not in the build, and must never be. See supabase/schema.sql
   for the policies this relies on.

   **Auth is an emailed code, not a password.** A second password is a second
   thing to lose, and the sync passphrase is already the one secret that
   genuinely cannot be reset. A six-digit code to an inbox the user already has
   is the shortest honest path onto a second device.

   **The client is loaded on demand.** A local-only journal — the default, and
   what most people will run — should not pay for a realtime websocket library
   it never opens. The import happens the first time sync is actually used. */

import type { PullPage, PushRow, Session, SyncBackend } from "./backend";
import type { RemoteMeta, RemoteRow } from "./types";
import { syncConfig } from "./config";

const TABLE = "sync_records";
const META_TABLE = "sync_meta";
const BUCKET = "journal-photos";

type Client = any;

let clientPromise: Promise<Client | null> | null = null;

async function getClient(): Promise<Client | null> {
  const cfg = syncConfig();
  if (!cfg) return null;
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js")
      .then(({ createClient }) =>
        createClient(cfg.url, cfg.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            /* Nothing about the journal ever appears in a URL, and the app is
               also served inside a native shell where URL-based session
               detection is meaningless. */
            detectSessionInUrl: false,
            storageKey: "fhj-sync-auth",
          },
          realtime: { params: { eventsPerSecond: 5 } },
        })
      )
      .catch(() => null);
  }
  return clientPromise;
}

/** Reset between tests, and after a configuration change. */
export function __resetClient() { clientPromise = null; }

function toSession(user: any): Session | null {
  return user ? { userId: user.id, email: user.email ?? null } : null;
}

/**
 * Turn whatever came back into a sentence a person can act on.
 *
 * Two rewrites matter here, and both are the difference between a screen that
 * helps and one that shows an implementation detail:
 *
 * - Auth failures keep a `session:` prefix, which is how the engine recognises
 *   "you need to sign in again" as distinct from "the network is flaky" and
 *   offers the right single button.
 * - "Failed to fetch" is what a *browser* says. It is also the most likely
 *   thing to appear here — no signal, a paused project, a mistyped address —
 *   and all three have the same answer, so they get one sentence containing it,
 *   including the part the user most needs to hear.
 */
export function describeBackendError(error: any, fallback = "Something went wrong."): string {
  /* Read the message, never the object. `String(new Error(""))` is the literal
     word "Error", which is worse than the fallback it would have shadowed. */
  const raw = typeof error?.message === "string" ? error.message
    : typeof error === "string" ? error : "";
  const msg = raw.trim() || fallback;
  if (/expired|invalid.*token|jwt/i.test(msg)) return `session: ${msg}`;
  if (/failed to fetch|networkerror|load failed|network request failed|ERR_[A-Z_]+/i.test(msg)) {
    return "Couldn't reach the sync server. Check your connection and try again — nothing has been lost.";
  }
  return msg;
}

/** Supabase surfaces failures as a value, not a throw, so every call site
    funnels through here and the engine only ever sees ordinary Errors. */
function raise(error: any, fallback: string): never {
  throw new Error(describeBackendError(error, fallback));
}

export class SupabaseBackend implements SyncBackend {
  isConfigured() { return !!syncConfig(); }

  private async client(): Promise<Client> {
    const c = await getClient();
    if (!c) throw new Error("Sync isn't configured in this build.");
    return c;
  }

  async getSession(): Promise<Session | null> {
    const c = await getClient();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    return toSession(data?.session?.user);
  }

  async requestCode(email: string) {
    const c = await this.client();
    const { error } = await c.auth.signInWithOtp({
      email,
      // A code the user reads and types, rather than a link they have to open
      // on the device they are setting up. Links break the "phone to laptop"
      // path this whole feature exists for.
      options: { shouldCreateUser: true },
    });
    if (error) raise(error, "Couldn't send that code.");
  }

  async verifyCode(email: string, code: string): Promise<Session> {
    const c = await this.client();
    const { data, error } = await c.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) raise(error, "That code didn't work.");
    const s = toSession(data?.user);
    if (!s) throw new Error("That code didn't work. Check it and try again.");
    return s;
  }

  async signOut() {
    const c = await getClient();
    if (!c) return;
    await c.auth.signOut().catch(() => {});
  }

  onSessionChange(fn: (s: Session | null) => void) {
    let unsub: (() => void) | null = null;
    let dead = false;
    void getClient().then((c) => {
      if (!c || dead) return;
      const { data } = c.auth.onAuthStateChange((_e: string, session: any) => fn(toSession(session?.user)));
      unsub = () => data?.subscription?.unsubscribe?.();
    });
    return () => { dead = true; unsub?.(); };
  }

  async getMeta(): Promise<RemoteMeta | null> {
    const c = await this.client();
    const { data, error } = await c.from(META_TABLE).select("*").maybeSingle();
    if (error) raise(error, "Couldn't read your sync settings.");
    if (!data) return null;
    return {
      salt: data.salt, iterations: data.iterations,
      verifier: data.verifier, verifier_iv: data.verifier_iv, schema: data.schema,
    };
  }

  async putMeta(meta: RemoteMeta): Promise<RemoteMeta> {
    const c = await this.client();
    const { data: { user } } = await c.auth.getUser();
    if (!user) throw new Error("session: not signed in");
    const { error } = await c.from(META_TABLE).insert({ user_id: user.id, ...meta });
    if (error) {
      /* Unique violation: another device finished setup a moment ago. Its salt
         is the real one, so read it back rather than fighting over it —
         two salts means two keys and a journal neither device can fully read. */
      const existing = await this.getMeta();
      if (existing) return existing;
      raise(error, "Couldn't save your sync settings.");
    }
    return meta;
  }

  async pull(afterSeq: number, limit: number): Promise<PullPage> {
    const c = await this.client();
    const { data, error } = await c
      .from(TABLE)
      .select("kind,id,updated_at,rev,device_id,deleted,ciphertext,iv,server_seq")
      .gt("server_seq", afterSeq)
      .order("server_seq", { ascending: true })
      .limit(limit);
    if (error) raise(error, "Couldn't reach the sync server.");
    const rows = (data || []) as RemoteRow[];
    return {
      rows,
      seq: rows.length ? rows[rows.length - 1].server_seq : afterSeq,
      more: rows.length === limit,
    };
  }

  async push(rows: PushRow[]) {
    if (!rows.length) return;
    const c = await this.client();
    const { data: { user } } = await c.auth.getUser();
    if (!user) throw new Error("session: not signed in");
    /* One statement, not one per row. The conflict rule lives in the SQL
       function (see supabase/schema.sql) so a stale write from a device that
       has been offline for a week is dropped by the server rather than trusted
       — the client cannot be the only thing enforcing "newer wins". */
    const { error } = await c.rpc("sync_push", {
      payload: rows.map((r) => ({ ...r, user_id: user.id })),
    });
    if (error) raise(error, "Couldn't send your changes.");
  }

  subscribe(fn: (deviceId?: string | null) => void) {
    let channel: any = null;
    let dead = false;
    void getClient().then(async (c) => {
      if (!c || dead) return;
      const { data: { user } } = await c.auth.getUser();
      if (!user || dead) return;
      channel = c
        .channel(`sync:${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: TABLE, filter: `user_id=eq.${user.id}` },
          (payload: any) => fn(payload?.new?.device_id ?? null)
        )
        .subscribe();
    });
    return () => { dead = true; if (channel) channel.unsubscribe?.(); };
  }

  private async photoPath(id: string) {
    const c = await this.client();
    const { data: { user } } = await c.auth.getUser();
    if (!user) throw new Error("session: not signed in");
    // The folder is the user id, which is exactly what the storage policy keys
    // on — a path outside your own folder is rejected by the server.
    return { c, path: `${user.id}/${id}.json` };
  }

  async putPhoto(id: string, sealed: string) {
    const { c, path } = await this.photoPath(id);
    const { error } = await c.storage.from(BUCKET).upload(path, new Blob([sealed], { type: "application/json" }), {
      upsert: true, contentType: "application/json",
    });
    if (error) raise(error, "Couldn't upload a photo.");
  }

  async getPhoto(id: string): Promise<string | null> {
    const { c, path } = await this.photoPath(id);
    const { data, error } = await c.storage.from(BUCKET).download(path);
    if (error || !data) return null;
    return await data.text();
  }

  async deletePhoto(id: string) {
    const { c, path } = await this.photoPath(id);
    await c.storage.from(BUCKET).remove([path]).catch(() => {});
  }

  async purge() {
    const c = await this.client();
    const { data: { user } } = await c.auth.getUser();
    if (!user) throw new Error("session: not signed in");
    const { error } = await c.rpc("sync_purge");
    if (error) raise(error, "Couldn't delete the synced copy.");
    const { data: files } = await c.storage.from(BUCKET).list(user.id, { limit: 1000 });
    if (files?.length) {
      await c.storage.from(BUCKET).remove(files.map((f: any) => `${user.id}/${f.name}`)).catch(() => {});
    }
  }
}
