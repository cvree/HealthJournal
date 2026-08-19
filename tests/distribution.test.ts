/* Score distribution: buckets, the three middles, and direction-aware
   thresholds. */
import { describe, it, expect } from "vitest";
import {
  badness, CALM_AT, calmLabel, distribution, HARD_AT, hardLabel, median,
  pct, scoresIn, variabilityOf,
} from "../src/lib/distribution";

const day = (date: string, v: number | null) =>
  ({ date, answers: v == null ? {} : { itch: v } });

const journal = (values: number[]) =>
  values.map((v, i) => day(`2026-03-${String(i + 1).padStart(2, "0")}`, v));

describe("badness", () => {
  it("reads a symptom straight and a positive metric backwards", () => {
    expect(badness(8, "sym")).toBe(8);
    expect(badness(8, "pos")).toBe(3);
    expect(badness(8, undefined)).toBe(8);
  });
});

describe("scoresIn", () => {
  it("takes only numbers, only in range, in date order", () => {
    const entries = [
      day("2026-03-05", 5), day("2026-03-01", 1),
      { date: "2026-03-02", answers: { itch: "seven" as unknown as number } },
      day("2026-03-03", 3), day("2026-02-27", 9),
    ];
    expect(scoresIn({ entries, key: "itch" })).toEqual([9, 1, 3, 5]);
    expect(scoresIn({ entries, key: "itch", start: "2026-03-01" })).toEqual([1, 3, 5]);
    expect(scoresIn({ entries, key: "itch", start: "2026-03-01", end: "2026-03-03" }))
      .toEqual([1, 3]);
  });
});

describe("median", () => {
  it("takes the middle, or the mean of the two middles", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("distribution", () => {
  it("returns ten buckets including the empty ones", () => {
    const d = distribution({ entries: journal([5, 5, 7]), key: "itch", dir: "sym" });
    expect(d.buckets).toHaveLength(10);
    expect(d.buckets.map((b) => b.score)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(d.buckets[4].days).toBe(2);
    expect(d.buckets[4].share).toBeCloseTo(2 / 3, 6);
    expect(d.buckets[0].days).toBe(0);
  });

  it("counts hard and calm days in the metric's own direction", () => {
    const values = [1, 2, 3, 5, 7, 8, 10];
    const sym = distribution({ entries: journal(values), key: "itch", dir: "sym" });
    expect(sym.hardDays).toBe(3);   // 7, 8, 10
    expect(sym.calmDays).toBe(3);   // 1, 2, 3
    expect(sym.best).toBe(1);
    expect(sym.worst).toBe(10);

    const pos = distribution({ entries: journal(values), key: "itch", dir: "pos" });
    expect(pos.hardDays).toBe(3);   // 1, 2, 3 → badness 10, 9, 8
    expect(pos.calmDays).toBe(2);   // 8, 10 → badness 3 and 1
    expect(pos.best).toBe(10);
    expect(pos.worst).toBe(1);
  });

  it("names the most common score, breaking ties toward the middle day", () => {
    // 2 and 8 both appear twice; the median is 5, so neither is nearer —
    // 8 wins only if it is genuinely more common.
    const d = distribution({ entries: journal([2, 2, 8, 8, 8, 5]), key: "itch", dir: "sym" });
    expect(d.mode).toBe(8);
    expect(d.modeDays).toBe(3);
    expect(d.modeShare).toBeCloseTo(0.5, 6);
  });

  it("prefers the score nearer the middle when two are equally common", () => {
    const d = distribution({ entries: journal([1, 1, 9, 9, 5, 5, 5, 4]), key: "itch", dir: "sym" });
    expect(d.mode).toBe(5);
  });

  it("computes mean, median and spread over the same days", () => {
    const d = distribution({ entries: journal([2, 4, 6, 8]), key: "itch", dir: "sym" });
    expect(d.total).toBe(4);
    expect(d.mean).toBeCloseTo(5, 6);
    expect(d.median).toBeCloseTo(5, 6);
    expect(d.sd).toBeCloseTo(Math.sqrt(5), 6);
    expect(d.variability).toBe("swinging");
  });

  it("calls a metric that repeats itself steady", () => {
    const d = distribution({ entries: journal([5, 5, 5, 6, 5, 4]), key: "itch", dir: "sym" });
    expect(d.variability).toBe("steady");
  });

  it("rounds and clamps values from outside the scale rather than dropping them", () => {
    const d = distribution({ entries: journal([0, 11, 4.4]), key: "itch", dir: "sym" });
    expect(d.total).toBe(3);
    expect(d.buckets[0].days).toBe(1);
    expect(d.buckets[9].days).toBe(1);
    expect(d.buckets[3].days).toBe(1);
  });

  it("stays whole and null-safe with nothing logged", () => {
    const d = distribution({ entries: [], key: "itch", dir: "sym" });
    expect(d.total).toBe(0);
    expect(d.buckets).toHaveLength(10);
    expect(d.mean).toBeNull();
    expect(d.median).toBeNull();
    expect(d.mode).toBeNull();
    expect(d.variability).toBeNull();
    expect(d.hardShare).toBe(0);
  });
});

describe("wording", () => {
  it("states the hard threshold from the reader's end of the scale", () => {
    expect(hardLabel("sym")).toBe(`${HARD_AT} or higher`);
    expect(hardLabel("pos")).toBe(`${11 - HARD_AT} or lower`);
    expect(calmLabel("sym")).toBe(`${CALM_AT} or lower`);
    expect(calmLabel("pos")).toBe(`${11 - CALM_AT} or higher`);
  });
  it("has a word for every spread and none for no data", () => {
    expect(variabilityOf(0.4)).toBe("steady");
    expect(variabilityOf(1.5)).toBe("mixed");
    expect(variabilityOf(2.5)).toBe("swinging");
    expect(variabilityOf(null)).toBeNull();
  });
  it("rounds percentages to whole numbers", () => {
    expect(pct(0.333)).toBe("33%");
    expect(pct(1)).toBe("100%");
  });
});
