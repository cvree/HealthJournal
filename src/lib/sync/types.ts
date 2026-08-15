/* The shapes cross-device sync is built on.

   The journal on disk is one JSON blob — that is what makes local saves
   instant, and it is not changing. Sync needs the opposite: the smallest unit
   that two devices can disagree about. So the blob is *projected* into records
   on the way out and folded back in on the way in, and this file is the
   contract between those two views.

   Three decisions are pinned down here, and everything else follows from them.

   1. **Identity is semantic, not accidental.** A daily entry's sync id is its
      date. Two phones that both log Tuesday produce one Tuesday, not two —
      without that, "no duplicate entries" is unachievable, because the local
      `id` field is a random string minted independently on each device.
   2. **Deletion is a record.** A row that vanishes is indistinguishable from a
      row that has not arrived yet, so deletions are written down as tombstones
      and travel like any other change. Anything less loses the delete the next
      time the other device pushes.
   3. **The clock is honest about being a clock.** `updatedAt` is wall time from
      whichever device made the edit, and devices disagree about wall time. So
      ordering is (updatedAt, rev, deviceId) — the last two exist purely to make
      ties resolve to the *same* answer everywhere, rather than to a different
      one on each device. */

/** The collections that sync.

    Photo blobs are not on this list and never will be: they are two or three
    orders of magnitude larger than everything else here, they are optional, and
    they travel on their own path (see engine.syncPhotos). Reports are absent
    for the opposite reason — they are derived from entries, so syncing them
    would be syncing the same facts twice. */
export type RecordKind = "entry" | "food" | "bowel" | "foodItem" | "profile";

/** One syncable thing, in the form both sides agree on. `payload` is the
    plaintext record; it is encrypted before it ever reaches the network. */
export interface SyncRecord<T = unknown> {
  kind: RecordKind;
  /** Stable across devices. Dates for entries, uids for everything else. */
  id: string;
  /** ISO wall time of the edit that produced this version. */
  updatedAt: string;
  /** Per-record write counter. Monotonic on the device that owns the edit;
      used only to break `updatedAt` ties. */
  rev: number;
  /** Which device wrote this version — the final, deterministic tiebreak. */
  deviceId: string;
  /** True when this is a tombstone. `payload` is null. */
  deleted?: boolean;
  payload: T | null;
}

/** A record as it exists on the server: metadata in the clear (so the server
    can order and filter without reading anything), contents sealed. */
export interface RemoteRow {
  kind: RecordKind;
  id: string;
  updated_at: string;
  rev: number;
  device_id: string;
  deleted: boolean;
  /** base64 AES-GCM ciphertext. Null on a tombstone — there is nothing to hide
      about a row that no longer has contents. */
  ciphertext: string | null;
  /** base64 96-bit nonce, unique per write. Null on a tombstone. */
  iv: string | null;
  /** Server-assigned, strictly increasing. The pull cursor — see engine.ts for
      why a timestamp cursor is not safe here. */
  server_seq: number;
}

/** What the server knows about a user's encryption, none of which is secret.
    The salt is public by design; the verifier proves a passphrase is right
    without the server being able to derive it. */
export interface RemoteMeta {
  /** base64, 16 bytes. */
  salt: string;
  /** PBKDF2 iterations used to derive this user's key. Stored so the number can
      be raised for new users without stranding existing ones. */
  iterations: number;
  /** base64 ciphertext of a fixed probe string, and its nonce. */
  verifier: string;
  verifier_iv: string;
  /** Bumped if the payload projection ever changes shape. */
  schema: number;
}

export type SyncPhase =
  /** Sync has never been turned on. The default, and a complete product. */
  | "off"
  /** On, and everything local has reached the server. */
  | "idle"
  /** Talking to the server right now. */
  | "syncing"
  /** On, but there is no network. Edits are queued and nothing is lost. */
  | "offline"
  /** On, but something needs the user: expired session, wrong passphrase. */
  | "blocked"
  /** A transient failure. Retrying on a backoff; still nothing is lost. */
  | "error";

export interface SyncStatus {
  phase: SyncPhase;
  /** Records written locally that the server has not confirmed. */
  pending: number;
  /** ISO time of the last successful round trip. */
  lastSyncedAt: string | null;
  /** Set when `phase` is "blocked" or "error" — already user-readable. */
  message?: string;
  /** What the user has to do about it, when there is something to do. */
  action?: "signIn" | "passphrase" | "retry" | null;
  email?: string | null;
  /** True once a session and a usable key are both in hand. */
  ready: boolean;
}

export const IDLE_STATUS: SyncStatus = {
  phase: "off", pending: 0, lastSyncedAt: null, ready: false, action: null,
};

/** A local record of something the user removed. Kept in the journal itself so
    it survives a reload, an export, and a restore — a deletion that only lived
    in memory would be undone by the next pull from another device. */
export interface Tombstone {
  kind: RecordKind;
  id: string;
  /** ISO. Also the `updatedAt` of the tombstone record when it is pushed. */
  deletedAt: string;
  rev: number;
  deviceId: string;
}

/** How long a tombstone is kept before it is swept. Long enough that a device
    left in a drawer for a season still learns about the deletion; short enough
    that the list does not grow without bound. A device offline for longer than
    this and then reconnecting would resurrect the deleted row — which is why
    the window is generous rather than tidy. */
export const TOMBSTONE_TTL_DAYS = 180;

/** Bumped only if the projection in project.ts changes meaning. */
export const SYNC_SCHEMA = 1;
