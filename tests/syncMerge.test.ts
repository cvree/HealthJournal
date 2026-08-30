/* Conflict resolution, in isolation.
 *
 * This is the part of sync that quietly ruins a journal if it is subtly wrong,
 * and it is also the only part that can be tested exhaustively — no network, no
 * database, no clock. Every case below is one that a real pair of devices will
 * hit within a week of use.
 */

import { describe, it, expect } from "vitest";
import {
  compareVersions, isNewer, resolve, mergeSets, mergeEntries,
  sweepTombstones, tombstoneRecords, recordKey,
} from "../src/lib/sync/merge";
import { projectDb, applyRecords, addTombstone, syncIdOf } from "../src/lib/sync/project";
import type { SyncRecord } from "../src/lib/sync/types";

const rec = (o: Partial<SyncRecord> & { id: string }): SyncRecord => ({
  kind: "entry", updatedAt: "2026-01-01T00:00:00.000Z", rev: 0, deviceId: "d1",
  payload: {}, ...o,
} as SyncRecord);

describe("ordering two versions", () => {
  it("puts the later edit first", () => {
    const a = rec({ id: "x", updatedAt: "2026-01-02T00:00:00.000Z" });
    const b = rec({ id: "x", updatedAt: "2026-01-01T00:00:00.000Z" });
    expect(isNewer(a, b)).toBe(true);
    expect(isNewer(b, a)).toBe(false);
  });

  it("resolves a same-millisecond tie the same way on both devices", () => {
    /* The whole point of the tiebreak. If two devices comparing the same pair
       reach different answers they push at each other forever, and the journal
       never settles. */
    const a = rec({ id: "x", deviceId: "aaa" });
    const b = rec({ id: "x", deviceId: "bbb" });
    expect(Math.sign(compareVersions(a, b))).toBe(-Math.sign(compareVersions(b, a)));
    expect(compareVersions(a, b)).not.toBe(0);
  });

  it("treats an unparseable timestamp as the beginning of time rather than throwing", () => {
    const broken = rec({ id: "x", updatedAt: "not a date" });
    const real = rec({ id: "x", updatedAt: "1971-01-01T00:00:00.000Z" });
    expect(isNewer(real, broken)).toBe(true);
  });
});

describe("merging one day that two devices both edited", () => {
  it("keeps both halves rather than throwing one away", () => {
    /* The case last-write-wins gets wrong, and the reason this app does field
       merging at all: the phone recorded pain at breakfast, the laptop recorded
       sleep at midnight. Neither is an edit of the other. */
    const phone = rec({
      id: "2026-03-04", updatedAt: "2026-03-04T08:00:00.000Z", deviceId: "phone",
      payload: { date: "2026-03-04", answers: { pain: 6 } },
    });
    const laptop = rec({
      id: "2026-03-04", updatedAt: "2026-03-04T23:00:00.000Z", deviceId: "laptop",
      payload: { date: "2026-03-04", answers: { sleep: 7 } },
    });
    const out = resolve(phone, laptop);
    expect((out.payload as any).answers).toEqual({ pain: 6, sleep: 7 });
  });

  it("lets the later edit win the one answer they disagree about", () => {
    const early = rec({
      id: "d", updatedAt: "2026-03-04T08:00:00.000Z",
      payload: { answers: { pain: 6, sleep: 5 } },
    });
    const late = rec({
      id: "d", updatedAt: "2026-03-04T20:00:00.000Z", deviceId: "d2",
      payload: { answers: { pain: 3 } },
    });
    const out = resolve(early, late);
    expect((out.payload as any).answers).toEqual({ pain: 3, sleep: 5 });
  });

  it("never un-finishes a log that was finished on either device", () => {
    const a = { quickLogCompleted: true, answers: {} };
    const b = { quickLogCompleted: false, answers: {}, updatedAt: "2026-03-05T00:00:00Z" };
    expect(mergeEntries(a, b).quickLogCompleted).toBe(true);
    expect(mergeEntries(b, a).quickLogCompleted).toBe(true);
  });

  it("does not let an untouched notes field erase a written one", () => {
    const written = { notes: "Flared after the run", answers: {} };
    const blank = { notes: "", answers: {} };
    expect(mergeEntries(written, blank).notes).toBe("Flared after the run");
  });

  it("settles on the same entry id from either direction", () => {
    // Two devices minted different local ids for the same Tuesday. They have to
    // agree on one without talking to each other.
    const a = { id: "zzz", answers: {} };
    const b = { id: "aaa", answers: {} };
    expect(mergeEntries(a, b).id).toBe(mergeEntries(b, a).id);
  });

  it("merges photos and sources the same way as answers", () => {
    const a = { photos: { skin: { photoId: "p1" } }, sources: { steps: "fitbit" }, answers: {} };
    const b = { photos: { rash: { photoId: "p2" } }, sources: { weight: "fitbit" }, answers: {} };
    const out = mergeEntries(a, b);
    expect(Object.keys(out.photos!)).toEqual(["skin", "rash"]);
    expect(out.sources).toEqual({ steps: "fitbit", weight: "fitbit" });
  });

  it("leaves a meal alone — it is one thing, not a bag of fields", () => {
    const a = rec({ kind: "food", id: "f1", updatedAt: "2026-03-01T08:00:00Z", payload: { description: "Eggs" } });
    const b = rec({ kind: "food", id: "f1", updatedAt: "2026-03-01T09:00:00Z", payload: { description: "Eggs and toast" } });
    expect((resolve(a, b).payload as any).description).toBe("Eggs and toast");
  });

  it("is commutative — the answer does not depend on argument order", () => {
    const a = rec({ id: "d", updatedAt: "2026-03-04T08:00:00Z", payload: { answers: { pain: 6 } } });
    const b = rec({ id: "d", updatedAt: "2026-03-04T09:00:00Z", deviceId: "d2", payload: { answers: { sleep: 7 } } });
    expect(resolve(a, b).payload).toEqual(resolve(b, a).payload);
  });
});

describe("merging two whole journals", () => {
  it("keeps everything from both sides — nothing is silently dropped", () => {
    const local = [rec({ id: "2026-01-01" }), rec({ id: "2026-01-02" })];
    const remote = [rec({ id: "2026-01-02" }), rec({ id: "2026-01-03" })];
    const { merged } = mergeSets(local, remote);
    expect(merged.map((r) => r.id).sort()).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });

  it("tells each side exactly what it is missing", () => {
    const local = [rec({ id: "only-here" })];
    const remote = [rec({ id: "only-there" })];
    const { toPush, toApply } = mergeSets(local, remote);
    expect(toPush.map((r) => r.id)).toEqual(["only-here"]);
    expect(toApply.map((r) => r.id)).toEqual(["only-there"]);
  });

  it("says nothing needs moving when the two sides already agree", () => {
    const same = [rec({ id: "x" })];
    const { toPush, toApply } = mergeSets(same, [rec({ id: "x" })]);
    expect(toPush).toEqual([]);
    expect(toApply).toEqual([]);
  });

  it("gives a three-way merge back to both sides", () => {
    const local = [rec({ id: "d", updatedAt: "2026-03-04T08:00:00Z", payload: { answers: { pain: 6 } } })];
    const remote = [rec({ id: "d", updatedAt: "2026-03-04T09:00:00Z", deviceId: "d2", payload: { answers: { sleep: 7 } } })];
    const { toPush, toApply } = mergeSets(local, remote);
    // Neither side holds the merged version, so both have to be told.
    expect(toPush).toHaveLength(1);
    expect(toApply).toHaveLength(1);
    expect((toPush[0].payload as any).answers).toEqual({ pain: 6, sleep: 7 });
  });

  it("reaches the same result whichever device merges first", () => {
    const a = [rec({ id: "d", updatedAt: "2026-03-04T08:00:00Z", payload: { answers: { pain: 6 } } })];
    const b = [rec({ id: "d", updatedAt: "2026-03-04T09:00:00Z", deviceId: "d2", payload: { answers: { sleep: 7 } } })];
    expect(mergeSets(a, b).merged[0].payload).toEqual(mergeSets(b, a).merged[0].payload);
  });
});

describe("deletions", () => {
  it("removes the row when the deletion is the later edit", () => {
    const edit = rec({ id: "f1", kind: "food", updatedAt: "2026-02-01T10:00:00Z" });
    const gone = rec({ id: "f1", kind: "food", updatedAt: "2026-02-01T11:00:00Z", deleted: true, payload: null });
    expect(resolve(edit, gone).deleted).toBe(true);
  });

  it("brings the row back when someone edits it after the deletion", () => {
    /* Not a bug — it is what the person's own two actions say. The delete came
       first, the edit came second, and the edit is what they did last. */
    const gone = rec({ id: "f1", kind: "food", updatedAt: "2026-02-01T10:00:00Z", deleted: true, payload: null });
    const edit = rec({ id: "f1", kind: "food", updatedAt: "2026-02-01T11:00:00Z", payload: { description: "Soup" } });
    expect(resolve(gone, edit).deleted).toBeFalsy();
  });

  it("never merges fields into a tombstone", () => {
    const a = rec({ id: "d", payload: { answers: { pain: 1 } } });
    const gone = rec({ id: "d", updatedAt: "2027-01-01T00:00:00Z", deleted: true, payload: null });
    expect(resolve(a, gone).payload).toBe(null);
  });

  it("sweeps tombstones older than the window and keeps the rest", () => {
    const now = new Date("2026-08-01T00:00:00Z");
    const kept = { kind: "food" as const, id: "a", deletedAt: "2026-07-01T00:00:00Z", rev: 0, deviceId: "d" };
    const old = { kind: "food" as const, id: "b", deletedAt: "2025-01-01T00:00:00Z", rev: 0, deviceId: "d" };
    expect(sweepTombstones([kept, old], now).map((t) => t.id)).toEqual(["a"]);
  });

  it("turns tombstones into records that travel like anything else", () => {
    const out = tombstoneRecords([{ kind: "bowel", id: "b1", deletedAt: "2026-01-01T00:00:00Z", rev: 2, deviceId: "d" }]);
    expect(out[0]).toMatchObject({ kind: "bowel", id: "b1", deleted: true, payload: null, rev: 2 });
  });
});

/* ---------- projection ---------- */

const sampleDb = () => ({
  profile: {
    id: "p_self", name: "Me", updatedAt: "2026-01-01T00:00:00Z",
    prefs: { sound: false, haptics: true }, lastBackupAt: "2026-01-01T00:00:00Z",
    modules: ["eczema"],
  },
  entries: [
    { id: "e1", date: "2026-01-01", answers: { pain: 3 }, updatedAt: "2026-01-01T09:00:00Z" },
    { id: "e2", date: "2026-01-02", answers: { pain: 5 }, updatedAt: "2026-01-02T09:00:00Z" },
  ],
  food: [{ id: "f1", date: "2026-01-01", description: "Eggs", updatedAt: "2026-01-01T08:00:00Z" }],
  bowel: [],
  foods: [],
  ai: { enabled: true, apiKeyRef: "secret" },
  tombstones: [],
});

/* The same journal, plus one row of every collection that arrived after sync
   was first written. */
const richDb = () => ({
  ...sampleDb(),
  rituals: [{
    id: "r1", name: "Morning", icon: "drop", steps: [{ id: "s1", label: "Cream" }],
    days: [], reviewDay: 3, createdAt: "2026-03-01T07:00:00.000Z",
    updatedAt: "2026-03-01T07:00:00.000Z",
  }],
  ritualRuns: [{
    id: "run1", ritualId: "r1", date: "2026-03-04", time: "07:10", name: "Morning",
    total: 1, done: ["s1"], createdAt: "2026-03-04T07:10:00.000Z",
    updatedAt: "2026-03-04T07:10:00.000Z",
  }],
  ritualReviews: [{
    id: "rev1", ritualId: "r1", date: "2026-03-04", felt: 4,
    createdAt: "2026-03-04T20:00:00.000Z",
  }],
  sun: [{
    id: "sun1", date: "2026-03-04", createdAt: "2026-03-04T12:00:00.000Z",
    updatedAt: "2026-03-04T12:30:00.000Z",
  }],
  labs: [{
    id: "lab1", date: "2026-03-02", value: 12, createdAt: "2026-03-02T09:00:00.000Z",
    updatedAt: "2026-03-02T09:00:00.000Z",
  }],
  experiments: [{
    id: "exp1", title: "Dairy", createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-03-01T09:00:00.000Z",
  }],
  context: [{ date: "2026-03-04", coords: { lat: 51.5, lon: -0.1 }, capturedAt: "2026-03-04T06:00:00.000Z", tempMean: 9 }],
});

describe("what crosses the wire", () => {
  it("identifies a day by its date, not by the random id the device minted", () => {
    // Two devices mint different local ids for the same Tuesday. Sync on those
    // and Tuesday exists twice, forever.
    expect(syncIdOf("entry", { id: "abc123", date: "2026-03-04" })).toBe("2026-03-04");
  });

  it("sends the survey but not this device's sound and haptic settings", () => {
    const recs = projectDb(sampleDb(), "d1");
    const profile = recs.find((r) => r.kind === "profile")!;
    expect((profile.payload as any).modules).toEqual(["eczema"]);
    expect((profile.payload as any).prefs).toBeUndefined();
    expect((profile.payload as any).lastBackupAt).toBeUndefined();
  });

  it("never sends the AI connection — that is a standing per-device decision", () => {
    const recs = projectDb(sampleDb(), "d1");
    expect(JSON.stringify(recs)).not.toContain("apiKeyRef");
  });

  it("skips imported wearable days that were never actually logged", () => {
    const db = { ...sampleDb(), entries: [{ id: "x", date: "2026-02-02", auto: true, answers: { steps: 900 } }] };
    expect(projectDb(db, "d1").filter((r) => r.kind === "entry")).toHaveLength(0);
  });

  it("still sends an imported day once the person edits it", () => {
    const db = { ...sampleDb(), entries: [{ id: "x", date: "2026-02-02", auto: true, quickLogCompleted: true, answers: {} }] };
    expect(projectDb(db, "d1").filter((r) => r.kind === "entry")).toHaveLength(1);
  });

  /* The 1.21 features shipped without a seam into this file, and nothing said
     so: `projectDb` walked a fixed list of collections, a kind it did not know
     fell through `FIELD_OF` and hit a bare `continue`, and the whole of
     somebody's rituals, sun sessions, lab results and experiments stayed on the
     device that made them. The delete path was the loud version of the same
     bug — App.tsx wrote tombstones of kind "ritual", "sun" and "lab" that this
     side had never heard of, so a deletion was recorded and then ignored. */
  it("sends every collection the journal holds, not just the ones sync shipped with", () => {
    const kinds = new Set(projectDb(richDb(), "d1").map((r) => r.kind));
    for (const k of ["ritual", "ritualRun", "ritualReview", "sun", "lab", "experiment", "context"]) {
      expect(kinds.has(k as any)).toBe(true);
    }
  });

  it("brings a ritual, its runs and its weekly reviews to a device that has none", () => {
    const recs = projectDb(richDb(), "d1");
    const { db } = applyRecords({ profile: {}, entries: [], tombstones: [] } as any, recs);
    expect((db as any).rituals).toHaveLength(1);
    expect((db as any).ritualRuns).toHaveLength(1);
    expect((db as any).ritualReviews).toHaveLength(1);
    expect((db as any).labs[0].id).toBe("lab1");
    expect((db as any).sun[0].id).toBe("sun1");
    expect((db as any).experiments[0].id).toBe("exp1");
  });

  it("identifies a ritual run by its ritual and its day, not by the id a device minted", () => {
    /* `newRun` mints a uid on whichever device is asked first. Two devices both
       ticking this morning's shower mint two, and syncing on those would make
       one week read as fourteen days — doubling the streak and handing the
       weekly tune-up a report on a week nobody lived. */
    const phone = { id: "run_aaa", ritualId: "r1", date: "2026-03-04", done: ["s1"] };
    const tablet = { id: "run_zzz", ritualId: "r1", date: "2026-03-04", done: ["s2"] };
    expect(syncIdOf("ritualRun", phone)).toBe(syncIdOf("ritualRun", tablet));
    expect(syncIdOf("ritualRun", { ...phone, date: "2026-03-05" }))
      .not.toBe(syncIdOf("ritualRun", tablet));
  });

  it("carries a deletion of a ritual across, instead of writing a tombstone nothing reads", () => {
    const gone = addTombstone(richDb() as any, "ritual", "r1", "d1", 0, "2026-03-10T00:00:00Z");
    const tomb = projectDb(gone as any, "d1").find((r) => r.kind === "ritual" && r.deleted);
    expect(tomb).toBeTruthy();
    const { db } = applyRecords(richDb() as any, [tomb!]);
    expect((db as any).rituals).toHaveLength(0);
  });

  /* A weather row has never been edited by a person, so `updatedAt` and
     `createdAt` are both absent and every row would tie at the epoch — which
     means the newest reading could never win. */
  it("orders a context row by when it was fetched", () => {
    const r = projectDb(richDb(), "d1").find((x) => x.kind === "context")!;
    expect(r.updatedAt).toBe("2026-03-04T06:00:00.000Z");
    expect(r.id).toBe("2026-03-04");
  });

  it("gives a record with no timestamp an ordering rather than dropping it", () => {
    const db = { ...sampleDb(), food: [{ id: "f9", description: "Toast" }] };
    const r = projectDb(db, "d1").find((x) => x.id === "f9")!;
    expect(Number.isNaN(Date.parse(r.updatedAt))).toBe(false);
  });
});

describe("folding remote changes back into the journal", () => {
  it("adds a day this device has never seen", () => {
    const { db, changed } = applyRecords(sampleDb(), [
      rec({ id: "2026-01-03", payload: { id: "e3", date: "2026-01-03", answers: { pain: 2 } } }),
    ]);
    expect(changed).toBe(1);
    expect(db.entries).toHaveLength(3);
  });

  it("replaces the matching day rather than appending a second copy of it", () => {
    const { db } = applyRecords(sampleDb(), [
      rec({ id: "2026-01-01", payload: { id: "e1", date: "2026-01-01", answers: { pain: 9 } } }),
    ]);
    expect(db.entries).toHaveLength(2);
    expect(db.entries!.find((e: any) => e.date === "2026-01-01").answers.pain).toBe(9);
  });

  it("keeps this device's own sound settings when the profile arrives", () => {
    const { db } = applyRecords(sampleDb(), [
      rec({ kind: "profile", id: "self", payload: { id: "p_self", name: "Me", modules: ["carnivore"] } }),
    ]);
    expect(db.profile.modules).toEqual(["carnivore"]);
    expect(db.profile.prefs).toEqual({ sound: false, haptics: true });
  });

  it("removes a row on a tombstone and remembers the deletion", () => {
    const { db } = applyRecords(sampleDb(), [
      rec({ kind: "food", id: "f1", deleted: true, payload: null, updatedAt: "2026-02-01T00:00:00Z" }),
    ]);
    expect(db.food).toHaveLength(0);
    expect(db.tombstones).toHaveLength(1);
  });

  it("drops the tombstone when a later edit resurrects the row", () => {
    let db: any = addTombstone(sampleDb(), "food", "f1", "d1", 0, "2026-02-01T00:00:00Z");
    db = applyRecords(db, [
      rec({ kind: "food", id: "f1", updatedAt: "2026-02-02T00:00:00Z", payload: { id: "f1", description: "Soup" } }),
    ]).db;
    expect(db.tombstones).toHaveLength(0);
    expect(db.food.find((f: any) => f.id === "f1").description).toBe("Soup");
  });

  it("leaves the journal object untouched when there is nothing to apply", () => {
    const before = sampleDb();
    const { db, changed } = applyRecords(before, []);
    expect(changed).toBe(0);
    expect(db).toBe(before);
  });

  it("round-trips: project, apply to an empty journal, and get the same records back", () => {
    const source = sampleDb();
    const recs = projectDb(source, "d1");
    const empty = { profile: {}, entries: [], food: [], bowel: [], foods: [], tombstones: [] };
    const { db } = applyRecords(empty, recs);
    const again = projectDb(db, "d1");
    const key = (r: any) => recordKey(r.kind, r.id);
    expect(again.map(key).sort()).toEqual(recs.map(key).sort());
  });
});
