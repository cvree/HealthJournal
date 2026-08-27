/* Learned ordering, and the things worth offering as one tap.

   Two rules carry this module and both are easy to break by accident: a
   manual arrangement is never re-sorted, and the score is frequency *decayed
   by recency* — "what I did a hundred times last spring" and "what I did twice
   yesterday" are different kinds of relevant, and only the second predicts the
   next tap. */
import { describe, it, expect } from "vitest";
import {
  HALF_LIFE_DAYS, noteUse, rankIds, recencyWeight, repeatSuggestions,
  sanitizeActionStats, scoreOf, type ActionStats,
} from "../src/lib/quickActions";

const TODAY = "2026-08-19";
const ago = (n: number) => {
  const d = new Date(Date.UTC(2026, 7, 19) - n * 86400000);
  return d.toISOString().slice(0, 10);
};

describe("the score", () => {
  it("halves every ten days, and never reaches zero", () => {
    expect(recencyWeight(TODAY, TODAY)).toBe(1);
    expect(recencyWeight(ago(HALF_LIFE_DAYS), TODAY)).toBeCloseTo(0.5, 5);
    expect(recencyWeight(ago(20), TODAY)).toBeCloseTo(0.25, 5);
    expect(recencyWeight(ago(400), TODAY)).toBeGreaterThan(0);
  });

  it("lets two recent uses beat a hundred old ones", () => {
    const recent = scoreOf({ n: 2, at: TODAY }, TODAY);
    const stale = scoreOf({ n: 100, at: ago(120) }, TODAY);
    expect(recent).toBeGreaterThan(stale);
  });

  it("treats a use with no date as stale rather than as never", () => {
    expect(scoreOf({ n: 4 }, TODAY)).toBeGreaterThan(0);
    expect(scoreOf({ n: 4 }, TODAY)).toBeLessThan(scoreOf({ n: 4, at: TODAY }, TODAY));
    expect(scoreOf(undefined, TODAY)).toBe(0);
  });
});

describe("ordering the tiles", () => {
  const ids = ["checkin", "food", "bowel", "photo"];

  it("puts what somebody actually taps first", () => {
    const stats: ActionStats = { bowel: { n: 9, at: TODAY }, food: { n: 4, at: TODAY } };
    expect(rankIds(ids, stats, TODAY)).toEqual(["bowel", "food", "checkin", "photo"]);
  });

  it("keeps the catalogue's order for anything never used — no shuffling", () => {
    expect(rankIds(ids, {}, TODAY)).toEqual(ids);
    expect(rankIds(ids, { food: { n: 1, at: TODAY } }, TODAY)).toEqual(["food", "checkin", "bowel", "photo"]);
  });

  it("never re-sorts an arrangement somebody made by hand", () => {
    const stats: ActionStats = { bowel: { n: 99, at: TODAY } };
    expect(rankIds(ids, stats, TODAY, "manual")).toEqual(ids);
  });

  it("counts a use, including a second one on the same day", () => {
    let stats = noteUse({}, "food", TODAY);
    stats = noteUse(stats, "food", TODAY);
    expect(stats.food).toEqual({ n: 2, at: TODAY });
  });
});

describe("the stats map", () => {
  it("repairs whatever a hand-edited backup contains", () => {
    const stats = sanitizeActionStats({
      food: { n: 3, at: "2026-08-01" },
      bad1: { n: "many" }, bad2: null, bad3: { n: 0 },
      bowel: { n: 2, at: "not-a-date" },
    });
    expect(stats.food).toEqual({ n: 3, at: "2026-08-01" });
    expect(stats.bowel).toEqual({ n: 2, at: undefined });
    expect(Object.keys(stats).sort()).toEqual(["bowel", "food"]);
    expect(sanitizeActionStats(null)).toEqual({});
  });

  it("stays bounded — one key per food ever logged would grow without end", () => {
    const huge: Record<string, unknown> = {};
    for (let i = 0; i < 200; i++) huge[`food:${i}`] = { n: i + 1, at: TODAY };
    const stats = sanitizeActionStats(huge);
    expect(Object.keys(stats).length).toBeLessThanOrEqual(60);
    // What it keeps is what it would have ranked highest.
    expect(stats["food:199"]).toBeTruthy();
    expect(stats["food:0"]).toBeUndefined();
  });
});

describe("one-tap repeats", () => {
  const src = () => ({
    today: TODAY,
    foods: [
      { id: "f1", name: "Oats", serving: "1 bowl", useCount: 12, lastUsedAt: `${TODAY}T08:00:00Z` },
      { id: "f2", name: "Steak", serving: "200 g", useCount: 3, lastUsedAt: `${ago(30)}T18:00:00Z` },
      { id: "f3", name: "Never logged", serving: "1", useCount: 0 },
    ],
    photoFields: [{ k: "p_neck", label: "Neck", lastAt: ago(9) }],
    numberFields: [{ k: "weight", label: "Weight", unit: "lb", lastValue: 178, lastAt: ago(2) }],
    hasEverNoted: true,
    hasNoteToday: false,
  });

  it("offers the things the journal already knows, ranked together", () => {
    const out = repeatSuggestions(src());
    const kinds = out.map((r) => r.kind);
    expect(kinds).toContain("food");
    expect(kinds).toContain("photo");
    expect(kinds).toContain("measurement");
    expect(kinds).toContain("note");
    expect(out[0].label).toBe("Oats");
  });

  /* The rule the whole row turns on. Ranking by frequency puts the most-logged
     things first, and the most-logged things anybody has are the doses they
     take daily — so this used to open with the same medications the Routine
     checklist shows a couple of inches below on the same screen, and pushed
     everything with no other home on Today off the edge of it. There is no
     `routineItems` input any more, and no ranked item may claim to be one. */
  it("never offers a dose — the routine has its own checklist on that screen", () => {
    const out = repeatSuggestions({
      ...src(),
      /* Passed anyway, the way a caller that had not read the change would. */
      routineItems: [
        { id: "r1", name: "CeraVe", dose: "2 pumps", useCount: 200, lastUsedAt: `${TODAY}T07:00:00Z` },
      ],
    } as Parameters<typeof repeatSuggestions>[0]);
    expect(out.some((r) => r.label === "CeraVe")).toBe(false);
    expect(out.map((r) => r.kind)).not.toContain("routine");
    expect(out.some((r) => r.id.startsWith("routine:"))).toBe(false);
  });

  it("never offers something that has never been done", () => {
    const out = repeatSuggestions(src());
    expect(out.some((r) => r.label === "Never logged")).toBe(false);
  });

  it("drops the offers already answered today", () => {
    const out = repeatSuggestions({
      ...src(),
      hasNoteToday: true,
      photoFields: [{ k: "p_neck", label: "Neck", lastAt: TODAY }],
      numberFields: [{ k: "weight", label: "Weight", lastValue: 178, lastAt: TODAY }],
    });
    expect(out.some((r) => r.kind === "note")).toBe(false);
    expect(out.some((r) => r.kind === "photo")).toBe(false);
    expect(out.some((r) => r.kind === "measurement")).toBe(false);
  });

  it("makes a photo *more* worth offering the longer it has been", () => {
    const near = repeatSuggestions({ ...src(), photoFields: [{ k: "p", label: "Neck", lastAt: ago(1) }] })
      .find((r) => r.kind === "photo")!;
    const far = repeatSuggestions({ ...src(), photoFields: [{ k: "p", label: "Neck", lastAt: ago(21) }] })
      .find((r) => r.kind === "photo")!;
    expect(far.score).toBeGreaterThan(near.score);
    expect(far.sub).toBe("21 days since the last");
  });

  it("gives a favourite a deliberate thumb on the scale", () => {
    const plain = repeatSuggestions(src()).find((r) => r.label === "Steak")!;
    const faved = repeatSuggestions({
      ...src(),
      foods: src().foods.map((f) => (f.id === "f2" ? { ...f, favorite: true } : f)),
    }).find((r) => r.label === "Steak")!;
    expect(faved.score).toBeGreaterThan(plain.score);
  });

  it("says nothing at all for a journal with no habits yet", () => {
    expect(repeatSuggestions({ today: TODAY })).toEqual([]);
  });
});
