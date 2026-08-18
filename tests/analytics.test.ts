/* The analytics foundation.

   The promise being pinned here is the one every Insights card makes: a day
   nobody logged is *missing*, not a zero, and a figure with nothing behind it
   is `null` rather than a confident-looking number. Almost every test below is
   really a test of that — the arithmetic itself is short, but the difference
   between "averaged 4.37 over 12 logged days" and "averaged 1.75 because
   eighteen days counted as nothing" is the whole product. */
import { describe, it, expect } from "vitest";
import {
  // dates
  isIsoDate, toDate, toIso, todayIso, addDays, dayDiff, rangeLength, inRange,
  eachDay, rangeEndingOn, rangeFor, priorRange, monthRange, monthOf, monthKey,
  previousMonth, clampRange, boundsOf, entryDates, journalBounds,
  // series
  isNumericValue, buildSeries, buildScaleSeries, seriesFromMap, loggedValues,
  pointsInRange,
  // statistics
  mean, median, minimum, maximum, standardDeviation, mostCommon, round,
  formatAverage, formatDelta, percent,
  // direction
  badness, bestValue, worstValue, hardDayCount,
  // coverage & summaries
  coverage, hasEnoughData, summarize, summarizeMetric,
  // distribution, rolling, comparison, grouping
  distribution, rollingAverage, trendSeries, comparePoints, compareWithPriorPeriod,
  compareRanges, monthlyBreakdown,
  RANGE_KEYS, RANGE_DAYS, RANGE_LABELS, isRangeKey, SCALE_MIN, SCALE_MAX,
  HARD_DAY_THRESHOLD,
} from "../src/lib/analytics";
import type { DateRange, DayPoint, EntryLike } from "../src/lib/analytics";
import { __internals as I } from "../src/App";
import type { AppDatabase, DailyEntry } from "../src/types/models";

/* ---------- fixtures ---------- */

/** Entries from a list of `[date, value]` pairs; `null` writes an entry that
    exists but answers nothing, which is a different thing from no entry. */
const entriesOf = (rows: [string, number | null][], key = "itch"): EntryLike[] =>
  rows.map(([date, value]) => ({ date, answers: value == null ? {} : { [key]: value } }));

const points = (rows: [string, number | null][]): DayPoint[] =>
  rows.map(([date, value]) => ({ date, value }));

/** Ten consecutive days, every other one unlogged. */
const SPARSE: [string, number | null][] = [
  ["2026-04-01", 6],
  ["2026-04-02", null],
  ["2026-04-03", 8],
  ["2026-04-04", null],
  ["2026-04-05", 4],
  ["2026-04-06", null],
  ["2026-04-07", 4],
  ["2026-04-08", null],
  ["2026-04-09", 9],
  ["2026-04-10", null],
];

describe("date helpers", () => {
  it("accepts real calendar days and rejects everything else", () => {
    expect(isIsoDate("2026-04-01")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true); // leap year
    expect(isIsoDate("2026-02-29")).toBe(false); // not one
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-4-1")).toBe(false);
    expect(isIsoDate("")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(20260401)).toBe(false);
  });

  it("round-trips a local date without drifting into UTC", () => {
    // 11pm on the 9th is still the 9th, which toISOString() gets wrong east of
    // Greenwich — the same bug lib/tracking's localDate exists to avoid.
    expect(toIso(new Date(2026, 7, 9, 23, 30))).toBe("2026-08-09");
    expect(toIso(toDate("2026-08-09") as Date)).toBe("2026-08-09");
    expect(toDate("nope")).toBeNull();
    expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("adds days across months, years and leap days", () => {
    expect(addDays("2026-04-01", -1)).toBe("2026-03-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-04-10", 0)).toBe("2026-04-10");
  });

  it("leaves an invalid date alone instead of producing NaN-NaN-NaN", () => {
    expect(addDays("garbage", 3)).toBe("garbage");
    expect(dayDiff("garbage", "2026-04-01")).toBeNull();
  });

  it("counts whole days between dates, signed", () => {
    expect(dayDiff("2026-04-01", "2026-04-10")).toBe(9);
    expect(dayDiff("2026-04-10", "2026-04-01")).toBe(-9);
    expect(dayDiff("2026-04-01", "2026-04-01")).toBe(0);
    // across a spring-forward boundary in most northern-hemisphere zones
    expect(dayDiff("2026-03-01", "2026-04-01")).toBe(31);
  });

  it("measures an inclusive range and refuses an inverted one", () => {
    expect(rangeLength({ start: "2026-04-01", end: "2026-04-07" })).toBe(7);
    expect(rangeLength({ start: "2026-04-01", end: "2026-04-01" })).toBe(1);
    expect(rangeLength({ start: "2026-04-07", end: "2026-04-01" })).toBe(0);
    expect(eachDay({ start: "2026-04-07", end: "2026-04-01" })).toEqual([]);
  });

  it("expands a range into every day it covers, oldest first", () => {
    const days = eachDay({ start: "2026-04-28", end: "2026-05-02" });
    expect(days).toEqual(["2026-04-28", "2026-04-29", "2026-04-30", "2026-05-01", "2026-05-02"]);
    expect(inRange("2026-04-30", { start: "2026-04-28", end: "2026-05-02" })).toBe(true);
    expect(inRange("2026-05-03", { start: "2026-04-28", end: "2026-05-02" })).toBe(false);
  });

  it("counts today as one of the N days in an N-day range", () => {
    // "7D" means today and the six before it — not today plus seven.
    expect(rangeEndingOn("2026-04-10", 7)).toEqual({ start: "2026-04-04", end: "2026-04-10" });
    expect(rangeLength(rangeEndingOn("2026-04-10", 7))).toBe(7);
    expect(rangeEndingOn("2026-04-10", 0)).toEqual({ start: "2026-04-10", end: "2026-04-10" });
  });
});

describe("range keys", () => {
  it("resolves every fixed key to its own length", () => {
    for (const key of RANGE_KEYS) {
      if (key === "All") continue;
      const r = rangeFor(key, "2026-04-10") as DateRange;
      expect(rangeLength(r)).toBe(RANGE_DAYS[key]);
      expect(r.end).toBe("2026-04-10");
      expect(RANGE_LABELS[key]).toBeTruthy();
    }
  });

  it("only resolves All when the journal has an earliest day", () => {
    expect(rangeFor("All", "2026-04-10")).toBeNull();
    expect(rangeFor("All", "2026-04-10", null)).toBeNull();
    expect(rangeFor("All", "2026-04-10", "2025-01-01")).toEqual({
      start: "2025-01-01", end: "2026-04-10",
    });
    // an earliest date in the future (clock skew, imported data) never yields
    // an inverted range
    expect(rangeFor("All", "2026-04-10", "2026-06-01")).toEqual({
      start: "2026-04-10", end: "2026-04-10",
    });
    expect(rangeFor("30D", "garbage")).toBeNull();
  });

  it("recognises its own keys", () => {
    expect(isRangeKey("30D")).toBe(true);
    expect(isRangeKey("14D")).toBe(false);
    expect(isRangeKey(30)).toBe(false);
  });

  it("puts the prior period immediately before, at equal length", () => {
    const cur = rangeFor("30D", "2026-04-30") as DateRange;
    const prev = priorRange(cur) as DateRange;
    expect(rangeLength(prev)).toBe(rangeLength(cur));
    expect(addDays(prev.end, 1)).toBe(cur.start);
    expect(prev).toEqual({ start: "2026-03-02", end: "2026-03-31" });
    expect(priorRange({ start: "2026-04-07", end: "2026-04-01" })).toBeNull();
  });
});

describe("month helpers", () => {
  it("builds whole calendar months, including short and leap ones", () => {
    expect(monthRange(2026, 4)).toEqual({ start: "2026-04-01", end: "2026-04-30" });
    expect(monthRange(2026, 2)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(monthRange(2024, 2)).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(monthRange(2026, 12)).toEqual({ start: "2026-12-01", end: "2026-12-31" });
    expect(monthRange(2026, 13)).toBeNull();
    expect(monthRange(2026, 0)).toBeNull();
  });

  it("finds the month a day belongs to, and the one before it", () => {
    expect(monthOf("2026-04-17")).toEqual({ start: "2026-04-01", end: "2026-04-30" });
    expect(monthKey("2026-04-17")).toBe("2026-04");
    expect(monthKey("nope")).toBe("");
    expect(previousMonth("2026-04-17")).toEqual({ start: "2026-03-01", end: "2026-03-31" });
    expect(previousMonth("2026-01-09")).toEqual({ start: "2025-12-01", end: "2025-12-31" });
    expect(previousMonth("2026-03-15")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
});

describe("bounds & clamping", () => {
  it("finds the span a set of dates covers, ignoring junk", () => {
    expect(boundsOf(["2026-04-05", "2026-01-02", "oops", "2026-02-20"])).toEqual({
      start: "2026-01-02", end: "2026-04-05",
    });
    expect(boundsOf([])).toBeNull();
    expect(boundsOf(["nope"])).toBeNull();
  });

  it("trims a range to the journal's own bounds", () => {
    const bounds = { start: "2026-03-20", end: "2026-04-10" };
    expect(clampRange({ start: "2026-01-01", end: "2026-12-31" }, bounds)).toEqual(bounds);
    expect(clampRange({ start: "2026-04-01", end: "2026-04-05" }, bounds)).toEqual({
      start: "2026-04-01", end: "2026-04-05",
    });
    expect(clampRange({ start: "2026-01-01", end: "2026-02-01" }, bounds)).toBeNull();
  });

  it("reads a journal's dates and bounds off its entries", () => {
    const entries = entriesOf([["2026-04-03", 5], ["2026-04-01", 7], ["2026-04-03", 6]]);
    expect(entryDates(entries)).toEqual(["2026-04-01", "2026-04-03"]);
    expect(journalBounds(entries)).toEqual({ start: "2026-04-01", end: "2026-04-03" });
    expect(journalBounds([])).toBeNull();
  });
});

describe("building a series", () => {
  const range: DateRange = { start: "2026-04-01", end: "2026-04-05" };

  it("gives every day in the range a slot, and unlogged days a null", () => {
    const series = buildScaleSeries(entriesOf([["2026-04-01", 6], ["2026-04-04", 3]]), "itch", range);
    expect(series.map((p) => p.date)).toEqual([
      "2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05",
    ]);
    expect(series.map((p) => p.value)).toEqual([6, null, null, 3, null]);
  });

  it("never lets a missing day become a zero", () => {
    const series = buildScaleSeries(entriesOf([["2026-04-01", 6], ["2026-04-04", 3]]), "itch", range);
    expect(series.some((p) => p.value === 0)).toBe(false);
    expect(mean(loggedValues(series))).toBe(4.5); // (6+3)/2, not (6+3)/5
  });

  it("treats an unanswered question, a wrong type and an out-of-scale number as missing", () => {
    const entries: EntryLike[] = [
      { date: "2026-04-01", answers: { itch: 6 } },
      { date: "2026-04-02", answers: {} },
      { date: "2026-04-03", answers: { itch: "8" } },
      { date: "2026-04-04", answers: { itch: 14 } },
      { date: "2026-04-05", answers: { itch: Number.NaN } },
    ];
    expect(buildScaleSeries(entries, "itch", range).map((p) => p.value)).toEqual([6, null, null, null, null]);
  });

  it("keeps out-of-scale numbers when no bounds are given, for weight and steps", () => {
    const entries: EntryLike[] = [{ date: "2026-04-01", answers: { weight: 182.4 } }];
    expect(buildSeries(entries, "weight", range)[0].value).toBe(182.4);
    expect(isNumericValue(182.4)).toBe(true);
    expect(isNumericValue(182.4, { min: SCALE_MIN, max: SCALE_MAX })).toBe(false);
    expect(isNumericValue(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("ignores entries outside the range and resolves a duplicated date to the later one", () => {
    const entries = entriesOf([
      ["2026-03-30", 10],
      ["2026-04-02", 5],
      ["2026-04-02", 7], // a badly merged restore: last write wins
      ["2026-05-01", 1],
    ]);
    expect(buildScaleSeries(entries, "itch", range).map((p) => p.value)).toEqual([
      null, 7, null, null, null,
    ]);
  });

  it("builds the same shape from a derived date -> value map", () => {
    const fromMap = seriesFromMap({ "2026-04-02": 3, "2026-04-05": null }, range);
    expect(fromMap.map((p) => p.value)).toEqual([null, 3, null, null, null]);
    expect(seriesFromMap(new Map([["2026-04-01", 9]]), range)[0].value).toBe(9);
  });

  it("slices an existing series without rebuilding it", () => {
    const series = buildScaleSeries(entriesOf(SPARSE), "itch", { start: "2026-04-01", end: "2026-04-10" });
    const week = pointsInRange(series, { start: "2026-04-03", end: "2026-04-05" });
    expect(week.map((p) => p.date)).toEqual(["2026-04-03", "2026-04-04", "2026-04-05"]);
  });
});

describe("statistics", () => {
  it("computes the ordinary figures", () => {
    const v = [4, 8, 6, 2, 6];
    expect(mean(v)).toBe(5.2);
    expect(median(v)).toBe(6);
    expect(minimum(v)).toBe(2);
    expect(maximum(v)).toBe(8);
    expect(mostCommon(v)).toBe(6);
  });

  it("averages the two middle values for an even count", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([5])).toBe(5);
  });

  it("returns null rather than zero when there is nothing to compute", () => {
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
    expect(minimum([])).toBeNull();
    expect(maximum([])).toBeNull();
    expect(standardDeviation([])).toBeNull();
    expect(mostCommon([])).toBeNull();
    expect(round(null)).toBeNull();
    expect(formatAverage(null)).toBeNull();
    expect(formatDelta(null)).toBeNull();
    expect(percent(null)).toBeNull();
  });

  it("measures spread, and calls a single reading spreadless", () => {
    expect(standardDeviation([5, 5, 5, 5])).toBe(0);
    expect(standardDeviation([7])).toBe(0);
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2); // textbook population sd
    expect(round(standardDeviation([1, 10]) as number, 2)).toBe(4.5);
  });

  it("breaks a tie for most common toward the lower score, every time", () => {
    // Two scores logged three times each: the answer must not depend on input
    // order, or the card changes on every re-render.
    expect(mostCommon([3, 3, 3, 8, 8, 8])).toBe(3);
    expect(mostCommon([8, 8, 8, 3, 3, 3])).toBe(3);
  });

  it("rounds half away from zero and survives binary fringes", () => {
    expect(round(4.365, 2)).toBe(4.37);
    expect(round(-4.365, 2)).toBe(-4.37);
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(2.5, 0)).toBe(3);
    expect(round(-2.5, 0)).toBe(-3);
    expect(round(0.1 + 0.2, 2)).toBe(0.3);
  });

  it("formats averages to a fixed two decimals and deltas with their sign", () => {
    expect(formatAverage(4.3666)).toBe("4.37");
    expect(formatAverage(5)).toBe("5.00");
    expect(formatAverage(4.3666, 1)).toBe("4.4");
    expect(formatDelta(0.42)).toBe("+0.42");
    expect(formatDelta(-1.1)).toBe("-1.10");
    expect(formatDelta(0)).toBe("0.00");
    expect(percent(0.6363)).toBe(64);
    expect(percent(0.6363, 1)).toBe(63.6);
  });
});

describe("direction", () => {
  it("flips a positive metric onto the same badness scale", () => {
    expect(badness(9, "sym")).toBe(9);
    expect(badness(9, "pos")).toBe(2);
    expect(badness(2, "pos")).toBe(9);
    expect(badness(5, "sym")).toBe(5);
  });

  it("ranks best and worst by the metric's own direction", () => {
    const v = [2, 5, 9];
    expect(bestValue(v, "sym")).toBe(2);
    expect(worstValue(v, "sym")).toBe(9);
    expect(bestValue(v, "pos")).toBe(9);
    expect(worstValue(v, "pos")).toBe(2);
    // a neutral metric has no better end, and says so
    expect(bestValue(v, "neutral")).toBeNull();
    expect(worstValue(v, "neutral")).toBeNull();
    expect(bestValue([], "sym")).toBeNull();
  });

  it("counts hard days from badness, not from the raw score", () => {
    const p = points([
      ["2026-04-01", 9], ["2026-04-02", 7], ["2026-04-03", 6],
      ["2026-04-04", null], ["2026-04-05", 2],
    ]);
    expect(HARD_DAY_THRESHOLD).toBe(7);
    expect(hardDayCount(p, "sym")).toBe(2); // 9 and 7
    expect(hardDayCount(p, "pos")).toBe(1); // only the 2, which flips to badness 9
    expect(hardDayCount(p, "sym", 9)).toBe(1);
    expect(hardDayCount(p, "neutral")).toBeNull();
  });

  it("never counts an unlogged day as a hard one", () => {
    const p = points([["2026-04-01", null], ["2026-04-02", null]]);
    expect(hardDayCount(p, "sym")).toBe(0);
    expect(hardDayCount(p, "pos")).toBe(0);
  });
});

describe("coverage", () => {
  it("reports logged days against calendar days, with the longest run", () => {
    const c = coverage(points([
      ["2026-04-01", 5], ["2026-04-02", 6], ["2026-04-03", null],
      ["2026-04-04", 7], ["2026-04-05", 4], ["2026-04-06", 4], ["2026-04-07", null],
    ]));
    expect(c.totalDays).toBe(7);
    expect(c.loggedDays).toBe(5);
    expect(round(c.ratio as number, 2)).toBe(0.71);
    expect(c.longestStreak).toBe(3);
    expect(c.lastLogged).toBe("2026-04-06");
  });

  it("has no ratio and no last day for an empty range", () => {
    const c = coverage([]);
    expect(c).toEqual({ totalDays: 0, loggedDays: 0, ratio: null, longestStreak: 0, lastLogged: null });
  });

  it("reports zero coverage — not null — for a range nobody logged in", () => {
    const c = coverage(points([["2026-04-01", null], ["2026-04-02", null]]));
    expect(c.loggedDays).toBe(0);
    expect(c.ratio).toBe(0);
    expect(hasEnoughData(points(SPARSE), 3)).toBe(true);
    expect(hasEnoughData(points(SPARSE), 6)).toBe(false);
  });
});

describe("summaries", () => {
  const range: DateRange = { start: "2026-04-01", end: "2026-04-10" };

  it("describes a sparse month honestly", () => {
    const s = summarize(points(SPARSE), range, "sym");
    expect(s.coverage.totalDays).toBe(10);
    expect(s.coverage.loggedDays).toBe(5);
    expect(s.mean).toBe(6.2); // (6+8+4+4+9)/5 — five days, not ten
    expect(s.median).toBe(6);
    expect(s.min).toBe(4);
    expect(s.max).toBe(9);
    expect(s.mostCommon).toBe(4);
    expect(s.best).toBe(4);
    expect(s.worst).toBe(9);
    expect(s.hardDays).toBe(2); // 8 and 9
    expect(s.first).toEqual({ date: "2026-04-01", value: 6 });
    expect(s.last).toEqual({ date: "2026-04-09", value: 9 });
    expect(s.range).toEqual(range);
  });

  it("flips best/worst for a positive metric without touching the average", () => {
    const s = summarize(points(SPARSE), range, "pos");
    expect(s.mean).toBe(6.2);
    expect(s.best).toBe(9);
    expect(s.worst).toBe(4);
    expect(s.hardDays).toBe(2); // the two 4s flip to badness 7; the 6 only reaches 5
  });

  it("returns nulls, not zeros, for a range with nothing in it", () => {
    const s = summarize(points([["2026-04-01", null], ["2026-04-02", null]]), range);
    expect(s.mean).toBeNull();
    expect(s.median).toBeNull();
    expect(s.min).toBeNull();
    expect(s.max).toBeNull();
    expect(s.stdDev).toBeNull();
    expect(s.mostCommon).toBeNull();
    expect(s.best).toBeNull();
    expect(s.worst).toBeNull();
    expect(s.first).toBeNull();
    expect(s.last).toBeNull();
    expect(s.hardDays).toBe(0);
  });

  it("summarizes straight from entries", () => {
    const s = summarizeMetric(entriesOf(SPARSE), "itch", range, "sym");
    expect(s.mean).toBe(6.2);
    expect(s.coverage.loggedDays).toBe(5);
  });

  it("is deterministic — the same input gives a byte-identical summary", () => {
    const a = summarize(points(SPARSE), range, "sym");
    const b = summarize(points([...SPARSE].reverse().reverse()), range, "sym");
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});

describe("distribution", () => {
  it("always returns all ten bins, in order", () => {
    const d = distribution(points(SPARSE));
    expect(d.bins).toHaveLength(10);
    expect(d.bins.map((b) => b.score)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(d.bins[3].days).toBe(2); // score 4, twice
    expect(d.bins[0].days).toBe(0); // score 1, never — a real zero-height bar
    expect(d.loggedDays).toBe(5);
    expect(d.peakDays).toBe(2);
    expect(d.mostCommon).toBe(4);
  });

  it("takes shares of logged days, never of calendar days", () => {
    const d = distribution(points(SPARSE));
    expect(d.bins[3].share).toBe(0.4); // 2 of 5 logged, not 2 of 10 days
    const total = d.bins.reduce((sum, b) => sum + (b.share ?? 0), 0);
    expect(round(total, 6)).toBe(1);
  });

  it("has no shares at all when nothing was logged", () => {
    const d = distribution(points([["2026-04-01", null]]));
    expect(d.loggedDays).toBe(0);
    expect(d.peakDays).toBe(0);
    expect(d.mostCommon).toBeNull();
    expect(d.bins.every((b) => b.days === 0 && b.share === null)).toBe(true);
  });

  it("ignores values outside the scale", () => {
    const d = distribution(points([["2026-04-01", 11], ["2026-04-02", 0], ["2026-04-03", 5]]));
    expect(d.loggedDays).toBe(1);
    expect(d.bins[4].days).toBe(1);
  });
});

describe("rolling averages", () => {
  const flat = points([
    ["2026-04-01", 2], ["2026-04-02", 4], ["2026-04-03", 6],
    ["2026-04-04", 8], ["2026-04-05", 10],
  ]);

  it("averages the window's logged days and aligns to the same dates", () => {
    const r = rollingAverage(flat, 3);
    expect(r.map((p) => p.date)).toEqual(flat.map((p) => p.date));
    expect(r.map((p) => p.value)).toEqual([null, 3, 4, 6, 8]);
  });

  it("waits for the minimum number of readings instead of drawing a lone value", () => {
    // The first day has one reading behind it; an "average" of one point is
    // just the raw value pretending to be a trend.
    expect(rollingAverage(flat, { window: 7, minPoints: 2 })[0].value).toBeNull();
    expect(rollingAverage(flat, { window: 7, minPoints: 1 })[0].value).toBe(2);
    expect(rollingAverage(flat, { window: 3, minPoints: 3 }).map((p) => p.value))
      .toEqual([null, null, 4, 6, 8]);
  });

  it("skips gaps rather than counting them as zeros", () => {
    const gappy = points([
      ["2026-04-01", 6], ["2026-04-02", null], ["2026-04-03", 8],
    ]);
    expect(rollingAverage(gappy, 3).map((p) => p.value)).toEqual([null, null, 7]);
  });

  it("stays null while a stretch of days has too little behind it", () => {
    const quiet = points([["2026-04-01", 5], ["2026-04-02", null], ["2026-04-03", null]]);
    expect(rollingAverage(quiet, { window: 2, minPoints: 2 }).every((p) => p.value === null)).toBe(true);
  });

  it("pairs the daily value with its 7- and 30-day companions", () => {
    const long = points(
      Array.from({ length: 40 }, (_, i) => [addDays("2026-03-01", i), 5] as [string, number])
    );
    const t = trendSeries(long);
    expect(t).toHaveLength(40);
    expect(t[0]).toEqual({ date: "2026-03-01", value: 5, rolling7: null, rolling30: null });
    expect(t[1].rolling7).toBe(5);
    expect(t[3].rolling30).toBeNull(); // needs 5 readings
    expect(t[4].rolling30).toBe(5);
    expect(t[39].rolling7).toBe(5);
  });
});

describe("period comparison", () => {
  const cur: DateRange = { start: "2026-04-08", end: "2026-04-14" };
  const prev: DateRange = { start: "2026-04-01", end: "2026-04-07" };
  const build = (range: DateRange, value: number) =>
    eachDay(range).map((date) => ({ date, value }));

  it("reads a fall in a symptom as an improvement, and a rise as the opposite", () => {
    const better = comparePoints(build(cur, 3), cur, build(prev, 7), prev, { dir: "sym" });
    expect(better.delta).toBe(-4);
    expect(round(better.percentChange as number, 4)).toBe(-0.5714);
    expect(better.verdict).toBe("improving");
    expect(better.reliable).toBe(true);

    const worse = comparePoints(build(cur, 8), cur, build(prev, 4), prev, { dir: "sym" });
    expect(worse.verdict).toBe("worsening");
  });

  it("reads the same fall in a positive metric the other way round", () => {
    const c = comparePoints(build(cur, 3), cur, build(prev, 7), prev, { dir: "pos" });
    expect(c.delta).toBe(-4);
    expect(c.verdict).toBe("worsening");
  });

  it("calls a small movement steady, and a neutral metric merely changed", () => {
    const cp = comparePoints(build(cur, 5.2), cur, build(prev, 5), prev, { dir: "sym" });
    expect(cp.verdict).toBe("steady");
    expect(comparePoints(build(cur, 8), cur, build(prev, 4), prev, { dir: "neutral" }).verdict)
      .toBe("changed");
    expect(comparePoints(build(cur, 6), cur, build(prev, 5), prev, { dir: "sym", steadyThreshold: 2 }).verdict)
      .toBe("steady");
  });

  it("refuses to compare against a period with nothing in it", () => {
    const c = comparePoints(build(cur, 5), cur, [], prev, { dir: "sym" });
    expect(c.delta).toBeNull();
    expect(c.percentChange).toBeNull();
    expect(c.verdict).toBe("insufficient");
    expect(c.reliable).toBe(false);
    expect(c.previous.mean).toBeNull();
    expect(c.previous.coverage.loggedDays).toBe(0);
  });

  it("marks a comparison built on a couple of days as unreliable", () => {
    const thin = [{ date: "2026-04-08", value: 3 }, { date: "2026-04-09", value: 3 }];
    const c = comparePoints(thin, cur, build(prev, 7), prev, { dir: "sym" });
    expect(c.verdict).toBe("improving");
    expect(c.reliable).toBe(false);
    expect(comparePoints(thin, cur, build(prev, 7), prev, { dir: "sym", minDays: 2 }).reliable).toBe(true);
  });

  it("compares a range with the equal-length period before it, off raw entries", () => {
    const entries = entriesOf([
      ...eachDay(prev).map((d) => [d, 8] as [string, number]),
      ...eachDay(cur).map((d) => [d, 4] as [string, number]),
    ]);
    const c = compareWithPriorPeriod(entries, "itch", cur, { dir: "sym" });
    expect(c.previous.range).toEqual(prev);
    expect(c.current.mean).toBe(4);
    expect(c.previous.mean).toBe(8);
    expect(c.delta).toBe(-4);
    expect(c.verdict).toBe("improving");
  });

  it("compares any two ranges, e.g. this month against the same month last year", () => {
    const entries = entriesOf([
      ["2025-04-10", 8], ["2025-04-11", 6],
      ["2026-04-10", 4], ["2026-04-11", 2],
    ]);
    const c = compareRanges(
      entries, "itch",
      monthRange(2026, 4) as DateRange,
      monthRange(2025, 4) as DateRange,
      { dir: "sym", minDays: 2 }
    );
    expect(c.current.mean).toBe(3);
    expect(c.previous.mean).toBe(7);
    expect(c.delta).toBe(-4);
    expect(c.reliable).toBe(true);
    // coverage stays honest: two logged days out of a 30-day month
    expect(c.current.coverage.totalDays).toBe(30);
    expect(c.current.coverage.loggedDays).toBe(2);
  });

  it("has no percentage change when the previous average is zero", () => {
    const zeroed = eachDay(prev).map((date) => ({ date, value: 0 }));
    const c = comparePoints(build(cur, 2), cur, zeroed, prev, { dir: "sym" });
    expect(c.delta).toBe(2);
    expect(c.percentChange).toBeNull();
  });
});

describe("monthly breakdown", () => {
  it("summarizes each month and keeps the empty ones", () => {
    const range: DateRange = { start: "2026-03-01", end: "2026-05-31" };
    const entries = entriesOf([
      ["2026-03-05", 8], ["2026-03-06", 6],
      // nothing at all in April
      ["2026-05-02", 4], ["2026-05-03", 2], ["2026-05-04", 3],
    ]);
    const months = monthlyBreakdown(buildScaleSeries(entries, "itch", range), "sym");
    expect(months.map((m) => m.month)).toEqual(["2026-03", "2026-04", "2026-05"]);
    expect(months[0].summary.mean).toBe(7);
    expect(months[1].summary.mean).toBeNull(); // a gap in the year stays visible
    expect(months[1].summary.coverage.loggedDays).toBe(0);
    expect(months[1].summary.coverage.totalDays).toBe(30);
    expect(months[2].summary.mean).toBe(3);
    expect(months[2].summary.hardDays).toBe(0);
  });

  it("gives a partial month its own calendar bounds for coverage", () => {
    const months = monthlyBreakdown(
      buildScaleSeries(entriesOf([["2026-04-20", 5]]), "itch", { start: "2026-04-15", end: "2026-04-25" }),
      "sym"
    );
    expect(months).toHaveLength(1);
    expect(months[0].range).toEqual({ start: "2026-04-15", end: "2026-04-25" });
    expect(months[0].summary.coverage.totalDays).toBe(11); // the days actually examined
  });
});

describe("the missing-is-not-zero rule, end to end", () => {
  it("holds across every figure a card can show", () => {
    const range: DateRange = { start: "2026-04-01", end: "2026-04-30" };
    // three logged days in a thirty-day month
    const entries = entriesOf([["2026-04-05", 9], ["2026-04-06", 9], ["2026-04-20", 3]]);
    const series = buildScaleSeries(entries, "itch", range);
    const s = summarize(series, range, "sym");

    expect(s.mean).toBe(7); // (9+9+3)/3
    expect(s.coverage.loggedDays).toBe(3);
    expect(s.coverage.totalDays).toBe(30);
    expect(percent(s.coverage.ratio)).toBe(10);
    expect(distribution(series).loggedDays).toBe(3);
    expect(distribution(series).bins[8].share).toBeCloseTo(2 / 3, 10);
    const r7 = rollingAverage(series, 7);
    expect(r7[r7.length - 1].value).toBeNull(); // nothing logged in the last week
    expect(s.hardDays).toBe(2);
    expect(SCALE_MIN).toBe(1);
    expect(SCALE_MAX).toBe(10);
  });
});

/* The module is only worth anything if it reads the journal the app actually
   writes, so the last block runs it over the live Connor demo data rather than
   over hand-made fixtures. If DailyEntry ever drifts from what buildSeries
   expects, this fails before a chart does. */
describe("against the live Connor demo journal", () => {
  const db: AppDatabase = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  const entries: DailyEntry[] = db.entries;
  const key: string = I.getProfileTemplate(db.profile).keyMetric;

  it("reads real entries with no adaptation, and reports honest coverage", () => {
    const bounds = journalBounds(entries) as DateRange;
    expect(bounds).toBeTruthy();
    expect(isIsoDate(bounds.start)).toBe(true);

    const range = rangeFor("30D", bounds.end) as DateRange;
    const series = buildScaleSeries(entries, key, range);
    expect(series).toHaveLength(30);
    expect(series.every((p) => p.value === null || (p.value >= SCALE_MIN && p.value <= SCALE_MAX))).toBe(true);

    const s = summarize(series, range, "sym");
    expect(s.coverage.loggedDays).toBeGreaterThan(0);
    expect(s.coverage.loggedDays).toBeLessThanOrEqual(30);
    expect(s.mean).not.toBeNull();
    expect(s.mean as number).toBeGreaterThanOrEqual(SCALE_MIN);
    expect(s.mean as number).toBeLessThanOrEqual(SCALE_MAX);
    // the average is taken over logged days only
    expect(s.mean).toBe(mean(loggedValues(series)));
  });

  it("compares the demo journal's last 30 days with the 30 before them", () => {
    const bounds = journalBounds(entries) as DateRange;
    const range = rangeFor("30D", bounds.end) as DateRange;
    const c = compareWithPriorPeriod(entries, key, range, { dir: "sym" });
    expect(c.current.range).toEqual(range);
    expect(rangeLength(c.previous.range)).toBe(30);
    expect(["improving", "worsening", "steady", "changed", "insufficient"]).toContain(c.verdict);
    if (c.delta != null) expect(c.delta).toBe((c.current.mean as number) - (c.previous.mean as number));
  });

  it("distributes and rolls the demo journal without inventing days", () => {
    const bounds = journalBounds(entries) as DateRange;
    const series = buildScaleSeries(entries, key, bounds);
    const d = distribution(series);
    expect(d.loggedDays).toBe(loggedValues(series).length);
    expect(d.bins.reduce((n, b) => n + b.days, 0)).toBe(d.loggedDays);
    const r7 = rollingAverage(series, { window: 7, minPoints: 2 });
    expect(r7).toHaveLength(series.length);
    expect(r7.every((p, i) => p.date === series[i].date)).toBe(true);
  });
});
