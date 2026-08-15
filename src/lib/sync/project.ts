/* Turning the journal into records, and back.

   The app stores one blob and syncs many rows, so something has to translate.
   Doing that translation *here*, purely, rather than inside the engine is what
   lets the interesting question — "does a phone and a laptop editing the same
   Tuesday converge?" — be answered by a unit test in a millisecond.

   Two rules govern what crosses the wire.

   **Identity is semantic.** An entry's sync id is its date. The local `id`
   field is a random string minted on whichever device happened to create the
   day first, so two devices that both log Tuesday mint two different ones. Sync
   on those and Tuesday exists twice, forever. Sync on the date and it exists
   once, which is what the user believes.

   **Some things are about the device, not about the person.** Sound and haptic
   preferences, the AI provider connection, whether this browser has been
   granted notification permission, when *this* device last downloaded a backup
   — those describe a machine, and pushing them would mean turning sound on for
   someone's laptop because they turned it on for their phone. They stay home.
   Everything that describes the *journal* — the survey, the questions, the
   reminders, the goals — travels. */

import type { RecordKind, SyncRecord, Tombstone } from "./types";
import { tombstoneRecords } from "./merge";

/* ---------- what stays on the device ---------- */

/** Profile fields that describe this machine rather than this journal. */
export const DEVICE_LOCAL_PROFILE_KEYS = [
  "prefs",          // sound, haptics, strength — per device by definition
  "lastBackupAt",   // "has *this* device downloaded a backup" — per device
  "cameraTimer",    // a camera setting for the camera that is here
] as const;

/** Top-level database keys that are never pushed. `ai` in particular holds a
    standing per-device decision about sending data to a third party; inheriting
    that from another machine would be exactly the wrong default. */
export const DEVICE_LOCAL_DB_KEYS = ["ai", "ack", "onboarded", "reports", "sync"] as const;

/* ---------- ids ---------- */

export function syncIdOf(kind: RecordKind, item: any): string {
  if (kind === "entry") return String(item?.date || "");
  if (kind === "profile") return "self";
  return String(item?.id || "");
}

/* ---------- db -> records ---------- */

interface Db {
  profile?: any;
  entries?: any[];
  food?: any[];
  bowel?: any[];
  foods?: any[];
  tombstones?: Tombstone[];
  [k: string]: unknown;
}

const COLLECTIONS: [RecordKind, string][] = [
  ["entry", "entries"],
  ["food", "food"],
  ["bowel", "bowel"],
  ["foodItem", "foods"],
];

function stripDeviceLocal(profile: any) {
  const out = { ...(profile || {}) };
  for (const k of DEVICE_LOCAL_PROFILE_KEYS) delete out[k];
  return out;
}

/** The version stamp for a record that has never been edited since sync was
    turned on. Falling back to `createdAt` and then to the epoch keeps ordering
    total even for a journal restored from a very old backup. */
function stampOf(item: any): string {
  return String(item?.updatedAt || item?.createdAt || "1970-01-01T00:00:00.000Z");
}

/**
 * Project the whole journal into records, tombstones included.
 *
 * `rev` is a single per-device counter rather than a per-record one. It exists
 * only to order two writes that landed in the same millisecond on the same
 * device; across devices it is meaningless, and `deviceId` finishes the job.
 * Pretending it is a vector clock would be more impressive and less true.
 */
export function projectDb(db: Db, deviceId: string, rev = 0): SyncRecord[] {
  const out: SyncRecord[] = [];

  if (db.profile) {
    out.push({
      kind: "profile", id: "self",
      updatedAt: stampOf(db.profile), rev, deviceId,
      payload: stripDeviceLocal(db.profile),
    });
  }

  for (const [kind, field] of COLLECTIONS) {
    const list = (db as any)[field];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const id = syncIdOf(kind, item);
      if (!id) continue;
      /* Imported wearable days are not journal entries the person wrote — they
         are a copy of a file they can re-import anywhere. Pushing them would
         multiply the journal's size for no gain. */
      if (kind === "entry" && item.auto && !item.quickLogCompleted && !item.detailedLogCompleted) continue;
      out.push({ kind, id, updatedAt: stampOf(item), rev, deviceId, payload: item });
    }
  }

  out.push(...tombstoneRecords(db.tombstones || []));
  return out;
}

/* ---------- records -> db ---------- */

const FIELD_OF: Record<string, string> = {
  entry: "entries", food: "food", bowel: "bowel", foodItem: "foods",
};

export interface ApplyResult {
  db: Db;
  /** How many records actually changed something. Zero means the pull was a
      no-op, which is the normal case and must not raise a notification. */
  changed: number;
}

/**
 * Fold incoming records into the journal.
 *
 * Deliberately does not re-run merge logic: by the time a record reaches here
 * it has already been resolved against whatever this device holds (see
 * merge.ts). This is the write, not the decision — which is what keeps "who
 * decided this?" answerable in one place.
 */
export function applyRecords(db: Db, records: SyncRecord[]): ApplyResult {
  if (!records.length) return { db, changed: 0 };
  const next: Db = { ...db };
  let changed = 0;
  const tombstones: Tombstone[] = [...(db.tombstones || [])];

  // Clone only the collections that are actually touched.
  const touched = new Set(records.map((r) => FIELD_OF[r.kind]).filter(Boolean));
  for (const field of touched) next[field] = [...((db as any)[field] || [])];

  for (const rec of records) {
    if (rec.kind === "profile") {
      if (rec.deleted || !rec.payload) continue;
      next.profile = {
        ...(db.profile || {}),
        ...stripDeviceLocal(rec.payload),
        /* The incoming profile has had this device's own settings stripped out
           of it, so they are put back from what is already here — otherwise
           every pull would silently reset sound and haptics. */
        prefs: (db.profile as any)?.prefs,
        lastBackupAt: (db.profile as any)?.lastBackupAt,
        cameraTimer: (db.profile as any)?.cameraTimer,
      };
      changed++;
      continue;
    }

    const field = FIELD_OF[rec.kind];
    if (!field) continue;
    const list = next[field] as any[];
    const i = list.findIndex((item) => syncIdOf(rec.kind, item) === rec.id);

    if (rec.deleted) {
      if (i >= 0) { list.splice(i, 1); changed++; }
      if (!tombstones.some((t) => t.kind === rec.kind && t.id === rec.id)) {
        tombstones.push({
          kind: rec.kind, id: rec.id, deletedAt: rec.updatedAt,
          rev: rec.rev, deviceId: rec.deviceId,
        });
      }
      continue;
    }
    if (!rec.payload) continue;
    if (i >= 0) list[i] = rec.payload;
    else list.push(rec.payload);
    changed++;
    /* An edit that is newer than a tombstone brings the row back, and the
       tombstone has to go with it or the next sweep would delete it again. */
    const ti = tombstones.findIndex((t) => t.kind === rec.kind && t.id === rec.id);
    if (ti >= 0 && Date.parse(rec.updatedAt) >= Date.parse(tombstones[ti].deletedAt)) {
      tombstones.splice(ti, 1);
    }
  }

  next.tombstones = tombstones;
  return { db: next, changed };
}

/** Record a deletion so it can travel. Called on the same paths that remove a
    row locally — a delete that is not written down here is a delete the next
    pull undoes. */
export function addTombstone(
  db: Db,
  kind: RecordKind,
  id: string,
  deviceId: string,
  rev = 0,
  at: string = new Date().toISOString()
): Db {
  const rest = (db.tombstones || []).filter((t) => !(t.kind === kind && t.id === id));
  return { ...db, tombstones: [...rest, { kind, id, deletedAt: at, rev, deviceId }] };
}
