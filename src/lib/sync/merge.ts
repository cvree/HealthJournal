/* Deciding what is true when two devices disagree.

   Everything in this file is pure. That is deliberate: conflict resolution is
   the one part of sync that quietly corrupts a journal if it is subtly wrong,
   and the only way to know it is right is to be able to run it thousands of
   times in a test without a network, a database, or a clock.

   The rules, in the order they are applied:

   1. **Union first.** A record one side has never seen is simply taken. Most
      "conflicts" are not conflicts at all — they are two devices holding
      disjoint halves of the same week.

   2. **Field-level merge where the shape allows it.** A daily entry is a bag of
      independent answers. If the phone recorded `pain: 6` at breakfast and the
      laptop recorded `sleep: 7` at midnight, last-write-wins throws one of them
      away for no reason — both are true, both were typed by the same person,
      and neither is an edit of the other. So entries merge answer-by-answer and
      photo-by-photo, and only the genuinely ambiguous fields (free text, a
      single scalar written on both sides) fall through to the clock.

   3. **Then the clock.** For everything that cannot be merged — a food log, a
      note, the same answer key edited twice — the later `updatedAt` wins.

   4. **Ties resolve identically everywhere.** Two edits in the same millisecond
      break to `rev`, then to `deviceId` as a string. Neither is meaningful as
      an ordering; both are *total* and *deterministic*, which is the only
      property a tiebreak needs. Without it two devices can settle on different
      answers and then push them at each other forever.

   5. **A tombstone is an edit like any other.** It wins if it is later and
      loses if it is earlier — so deleting on the phone removes the row
      everywhere, and editing the same row afterwards on the laptop brings it
      back, which is what the person's own actions say should happen. */

import type { RecordKind, SyncRecord, Tombstone } from "./types";
import { TOMBSTONE_TTL_DAYS } from "./types";

/* ---------- ordering ---------- */

/** Negative when `a` is older than `b`, positive when newer, 0 only for two
    versions that are indistinguishable in every ordering field. */
export function compareVersions(a: SyncRecord, b: SyncRecord): number {
  const ta = Date.parse(a.updatedAt), tb = Date.parse(b.updatedAt);
  const va = Number.isNaN(ta) ? 0 : ta;
  const vb = Number.isNaN(tb) ? 0 : tb;
  if (va !== vb) return va < vb ? -1 : 1;
  if (a.rev !== b.rev) return a.rev < b.rev ? -1 : 1;
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? -1 : 1;
  return 0;
}

export const isNewer = (a: SyncRecord, b: SyncRecord) => compareVersions(a, b) > 0;

/* A separator that cannot appear inside a kind or an id, so two different
   records can never collide onto one map key. */
export const recordKey = (kind: RecordKind, id: string) => `${kind}\u0000${id}`;

/* ---------- entry field merge ----------

   The one shape in the journal worth merging properly. Everything here is
   additive except where two devices wrote the *same* key, which is the only
   real conflict a day can contain. */

interface EntryLike {
  id?: string;
  date?: string;
  answers?: Record<string, unknown>;
  photos?: Record<string, unknown>;
  sources?: Record<string, string>;
  notes?: string;
  quickLogCompleted?: boolean;
  detailedLogCompleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: unknown;
}

/** Union two maps, letting `winner`'s values decide any key both sides hold. */
function unionMap<T>(
  loser: Record<string, T> | undefined,
  winner: Record<string, T> | undefined
): Record<string, T> {
  const out: Record<string, T> = { ...(loser || {}) };
  for (const [k, v] of Object.entries(winner || {})) {
    // A key explicitly cleared on the winning side clears it here too, but a
    // key that is simply absent never deletes the other device's answer.
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Merge two versions of one day. `newer`/`older` are already ordered by
 * compareVersions, so the newer side arbitrates every genuine collision while
 * the older side still contributes everything the newer one never saw.
 */
export function mergeEntries(older: EntryLike, newer: EntryLike): EntryLike {
  return {
    ...older,
    ...newer,
    /* Keep the id the two sides can agree on without coordinating. Lowest
       string wins purely so both devices pick the same one. */
    id: older.id && newer.id ? (older.id < newer.id ? older.id : newer.id) : (newer.id || older.id),
    answers: unionMap(older.answers, newer.answers),
    photos: unionMap(older.photos, newer.photos),
    sources: unionMap(older.sources, newer.sources),
    /* Free text cannot be merged without inventing sentences the user never
       wrote, so it takes the later one — unless the later one is empty and the
       earlier one is not, which is almost always a field that was never
       touched on that device rather than a note someone deleted. */
    notes: (newer.notes && newer.notes.trim()) ? newer.notes : (older.notes || newer.notes || ""),
    /* "Finished" is monotonic. Having completed today's log on the phone is not
       undone by the laptop not knowing about it. */
    quickLogCompleted: !!(older.quickLogCompleted || newer.quickLogCompleted),
    detailedLogCompleted: !!(older.detailedLogCompleted || newer.detailedLogCompleted),
    createdAt: [older.createdAt, newer.createdAt].filter(Boolean).sort()[0] || newer.createdAt,
    updatedAt: newer.updatedAt || older.updatedAt,
  };
}

/** Which kinds get the field-level treatment. Everything else is atomic: a meal
    is one thing a person logged once, not a bag of independently-edited parts. */
const FIELD_MERGED: Partial<Record<RecordKind, true>> = { entry: true };

/**
 * Resolve two versions of the same record into one.
 *
 * Returns the winning record, with the losing side's non-conflicting fields
 * folded in where the kind allows it. A tombstone on either side is atomic —
 * there is nothing to merge into a record that no longer exists — so it simply
 * competes on the clock.
 */
export function resolve<T>(a: SyncRecord<T>, b: SyncRecord<T>): SyncRecord<T> {
  const cmp = compareVersions(a, b);
  /* Identical versions are the same write seen twice, not a conflict. Merging
     them would mint a third object neither side holds, and the two devices
     would then push it at each other forever over a difference that does not
     exist. */
  if (cmp === 0) return a;
  const newer = cmp > 0 ? a : b;
  const older = cmp > 0 ? b : a;
  if (newer.deleted || older.deleted) return newer;
  if (!FIELD_MERGED[newer.kind] || !newer.payload || !older.payload) return newer;
  const payload = mergeEntries(older.payload as EntryLike, newer.payload as EntryLike);
  /* When the older side contributed nothing the newer side did not already
     have, this is not a merge — it is just the newer record, and saying so
     keeps it out of both the push list and the apply list. */
  if (canonical(payload) === canonical(newer.payload)) return newer;
  return { ...newer, payload: payload as unknown as T };
}

/** Key-order-independent JSON, for "did this actually change?". Object spread
    reorders keys freely, so a plain stringify comparison reports differences
    that do not exist. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v).sort(([x], [y]) => (x < y ? -1 : 1)));
    }
    return v;
  });
}

/* ---------- set merge ---------- */

export interface MergeResult<T> {
  /** Every record, resolved. */
  merged: SyncRecord<T>[];
  /** Records whose resolved version differs from what the *remote* side holds —
      i.e. what this device still owes the server. */
  toPush: SyncRecord<T>[];
  /** Records whose resolved version differs from what the *local* side holds —
      i.e. what this device has to write down. */
  toApply: SyncRecord<T>[];
}

/**
 * Merge two whole sets of records. This is the operation behind "you already
 * had a journal here and a journal there" — the moment where a careless
 * implementation silently picks one and drops the other.
 *
 * Nothing is dropped. Every id from either side appears in `merged`, and the
 * two output lists say exactly which side has to be told what.
 */
export function mergeSets<T>(
  local: SyncRecord<T>[],
  remote: SyncRecord<T>[]
): MergeResult<T> {
  const localBy = new Map<string, SyncRecord<T>>();
  for (const r of local) localBy.set(recordKey(r.kind, r.id), r);
  const remoteBy = new Map<string, SyncRecord<T>>();
  for (const r of remote) remoteBy.set(recordKey(r.kind, r.id), r);

  const merged: SyncRecord<T>[] = [];
  const toPush: SyncRecord<T>[] = [];
  const toApply: SyncRecord<T>[] = [];

  const keys = new Set([...localBy.keys(), ...remoteBy.keys()]);
  for (const key of keys) {
    const l = localBy.get(key);
    const r = remoteBy.get(key);
    if (l && r) {
      const winner = resolve(l, r);
      merged.push(winner);
      /* Three outcomes, and they are not all distinguishable by version alone.

         A field merge produces a record *neither* side holds while carrying the
         winning side's version stamp — so "same version" would wrongly say the
         remote already has it. `resolve` returns one of its arguments unchanged
         in every other case, which is what makes the identity check below an
         exact test for "a merge happened". */
      const isMerge = winner !== l && winner !== r;
      if (isMerge || compareVersions(winner, r) !== 0) toPush.push(winner);
      if (isMerge || compareVersions(winner, l) !== 0) toApply.push(winner);
    } else if (l) {
      merged.push(l);
      toPush.push(l);
    } else if (r) {
      merged.push(r);
      toApply.push(r);
    }
  }
  return { merged, toPush, toApply };
}

/* ---------- tombstones ---------- */

/** Drop tombstones older than the window. Pure, so the sweep is testable
    without waiting six months. */
export function sweepTombstones(
  tombstones: Tombstone[],
  now: Date = new Date(),
  ttlDays: number = TOMBSTONE_TTL_DAYS
): Tombstone[] {
  const cutoff = now.getTime() - ttlDays * 86400000;
  return (tombstones || []).filter((t) => {
    const at = Date.parse(t.deletedAt);
    return Number.isNaN(at) ? false : at >= cutoff;
  });
}

/** Fold a tombstone list into a record list, so a deleted row is expressed the
    same way whether it came from disk or off the wire. */
export function tombstoneRecords(tombstones: Tombstone[]): SyncRecord[] {
  return (tombstones || []).map((t) => ({
    kind: t.kind,
    id: t.id,
    updatedAt: t.deletedAt,
    rev: t.rev,
    deviceId: t.deviceId,
    deleted: true,
    payload: null,
  }));
}
