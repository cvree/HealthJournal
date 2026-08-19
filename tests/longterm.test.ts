/* Monthly averages, year-over-year, the longest calm stretch and seasons —
   including the floors that keep a thin month out of a comparison. */
import { describe, it, expect } from "vitest";
import {
  extremeMonths, historySpan, longestStableRun, MIN_DAYS_PER_MONTH,
  MIN_YEARS_FOR_SEASON, monthlyAverages, sameMonthLastYear, seasonalAverages,
  seasonsWorthShowing, yearLines,
} from "../src/lib/longterm";

/** n days of a month at one value, starting on the 1st. */
const month = (key: string, value: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    date: `${key}-${String(i + 1).padStart(2, "0")}`,
    answers: { itch: value },
  }));

describe("monthlyAverages", () => {
  it("gives one point per calendar month, gaps included", () => {
    const out = monthlyAverages([...month("2026-01", 4, 10), ...month("2026-04", 6, 10)], "itch");
    expect(out.map((p) => p.key)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(out[1].average).toBeNull();
    expect(out[1].logged).toBe(0);
    expect(out[1].solid).toBe(false);
  });
  it("averages, and marks a thin month as not solid", () => {
    const out = monthlyAverages([
      ...month("2026-01", 4, MIN_DAYS_PER_MONTH),
      ...month("2026-02", 8, MIN_DAYS_PER_MONTH - 1),
    ], "itch");
    expect(out[0].average).toBeCloseTo(4, 6);
    expect(out[0].solid).toBe(true);
    expect(out[1].solid).toBe(false);
  });
  it("reads best and worst through the metric's direction", () => {
    const entries = [
      { date: "2026-01-01", answers: { itch: 2 } },
      { date: "2026-01-02", answers: { itch: 9 } },
    ];
    expect(monthlyAverages(entries, "itch", "sym")[0]).toMatchObject({ best: 2, worst: 9 });
    expect(monthlyAverages(entries, "itch", "pos")[0]).toMatchObject({ best: 9, worst: 2 });
  });
  it("returns nothing at all for a journal with no scores", () => {
    expect(monthlyAverages([{ date: "2026-01-01", answers: {} }], "itch")).toEqual([]);
  });
  it("spans years without losing months in between", () => {
    const out = monthlyAverages([...month("2025-11", 5, 8), ...month("2026-02", 5, 8)], "itch");
    expect(out.map((p) => p.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("yearLines", () => {
  it("lays each year out over twelve slots and skips the thin months", () => {
    const months = monthlyAverages([
      ...month("2025-03", 7, 10),
      ...month("2026-03", 4, 10),
      ...month("2026-04", 3, 2),        // too thin to plot
    ], "itch");
    const lines = yearLines(months);
    expect(lines.map((l) => l.year)).toEqual([2025, 2026]);
    expect(lines[0].points).toHaveLength(12);
    expect(lines[0].points[2]).toBe(7);
    expect(lines[1].points[2]).toBe(4);
    expect(lines[1].points[3]).toBeNull();
    expect(lines[1].solidMonths).toBe(1);
  });
});

describe("this month versus the same month last year", () => {
  const solid = (key: string, v: number) => month(key, v, 12);
  it("compares when both sides are solid, and says which way is better", () => {
    const months = monthlyAverages([...solid("2025-08", 7), ...solid("2026-08", 4)], "itch");
    const sym = sameMonthLastYear(months, "2026-08-18", "sym");
    expect(sym.enough).toBe(true);
    expect(sym.delta).toBeCloseTo(-3, 6);
    expect(sym.improving).toBe(true);

    const pos = sameMonthLastYear(months, "2026-08-18", "pos");
    expect(pos.improving).toBe(false);
  });
  it("refuses the comparison when either side is thin", () => {
    const months = monthlyAverages([...month("2025-08", 7, 2), ...solid("2026-08", 4)], "itch");
    const c = sameMonthLastYear(months, "2026-08-18", "sym");
    expect(c.enough).toBe(false);
    expect(c.prev!.solid).toBe(false);
  });
  it("refuses it when last year has no such month at all", () => {
    const c = sameMonthLastYear(monthlyAverages(solid("2026-08", 4), "itch"), "2026-08-18", "sym");
    expect(c.prev).toBeNull();
    expect(c.enough).toBe(false);
  });
});

describe("best and hardest month", () => {
  it("ignores thin months on both ends", () => {
    const months = monthlyAverages([
      ...month("2026-01", 2, 2),    // thin: would be the best
      ...month("2026-02", 4, 10),
      ...month("2026-03", 8, 10),
      ...month("2026-04", 10, 3),   // thin: would be the worst
    ], "itch");
    const { best, worst } = extremeMonths(months, "sym");
    expect(best!.key).toBe("2026-02");
    expect(worst!.key).toBe("2026-03");
  });
  it("flips for a metric where high is good", () => {
    const months = monthlyAverages([...month("2026-02", 4, 10), ...month("2026-03", 8, 10)], "itch");
    expect(extremeMonths(months, "pos").best!.key).toBe("2026-03");
  });
});

describe("longestStableRun", () => {
  it("finds the longest unbroken run of calm logged days", () => {
    const entries = [
      { date: "2026-01-01", answers: { itch: 2 } },
      { date: "2026-01-02", answers: { itch: 3 } },
      { date: "2026-01-03", answers: { itch: 9 } },   // breaks it
      { date: "2026-01-04", answers: { itch: 2 } },
      { date: "2026-01-05", answers: { itch: 1 } },
      { date: "2026-01-06", answers: { itch: 4 } },
    ];
    const run = longestStableRun(entries, "itch", "sym");
    expect(run).toMatchObject({ start: "2026-01-04", end: "2026-01-06", days: 3 });
    expect(run!.average).toBeCloseTo(7 / 3, 6);
  });
  it("treats an unlogged day as breaking the run, not extending it", () => {
    const entries = [
      { date: "2026-01-01", answers: { itch: 2 } },
      { date: "2026-01-02", answers: { itch: 2 } },
      /* the 3rd is missing */
      { date: "2026-01-04", answers: { itch: 2 } },
    ];
    expect(longestStableRun(entries, "itch", "sym")!.days).toBe(2);
  });
  it("reads calm from the other end for a metric where high is good", () => {
    const entries = [
      { date: "2026-01-01", answers: { itch: 9 } },
      { date: "2026-01-02", answers: { itch: 8 } },
      { date: "2026-01-03", answers: { itch: 2 } },
    ];
    expect(longestStableRun(entries, "itch", "pos")!.days).toBe(2);
  });
  it("has nothing to report when no day was calm", () => {
    expect(longestStableRun([{ date: "2026-01-01", answers: { itch: 9 } }], "itch", "sym"))
      .toBeNull();
  });
});

describe("seasons", () => {
  it("averages each month of the year across every year on record", () => {
    const months = monthlyAverages([
      ...month("2025-03", 8, 10), ...month("2026-03", 6, 10),
      ...month("2026-07", 3, 10),
    ], "itch");
    const season = seasonalAverages(months);
    expect(season).toHaveLength(12);
    expect(season[2].average).toBeCloseTo(7, 6);
    expect(season[2].years).toBe(2);
    expect(season[6].years).toBe(1);
    expect(season[0].average).toBeNull();
  });
  it("stays hidden until most months have more than one year behind them", () => {
    const oneYear = seasonalAverages(monthlyAverages(
      Array.from({ length: 12 }, (_, m) => month(`2026-${String(m + 1).padStart(2, "0")}`, 5, 10)).flat(),
      "itch"));
    expect(oneYear.every((s) => s.years < MIN_YEARS_FOR_SEASON)).toBe(true);
    expect(seasonsWorthShowing(oneYear)).toBe(false);

    const twoYears = seasonalAverages(monthlyAverages(
      [2025, 2026].flatMap((y) =>
        Array.from({ length: 12 }, (_, m) => month(`${y}-${String(m + 1).padStart(2, "0")}`, 5, 10)).flat()),
      "itch"));
    expect(seasonsWorthShowing(twoYears)).toBe(true);
  });
});

describe("historySpan", () => {
  it("names the first and last month with anything in them", () => {
    const months = monthlyAverages([...month("2025-11", 5, 8), ...month("2026-02", 5, 8)], "itch");
    expect(historySpan(months)).toBe("November 2025 – February 2026");
  });
  it("names one month once", () => {
    expect(historySpan(monthlyAverages(month("2026-02", 5, 8), "itch"))).toBe("February 2026");
  });
  it("says nothing about an empty history", () => {
    expect(historySpan([])).toBe("");
  });
});
