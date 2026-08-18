/* Insights view models.

   analytics.ts is tested as arithmetic; this file tests the *claims* built on
   top of it — "April average 4.37", "0.63 lower than March", "12 of 30 days
   logged · 40%". Those are sentences a person will repeat to a clinician, so
   they are pinned here rather than left to whichever component last rendered
   them: two decimals always, coverage always, movement never described as
   cause, and nothing invented for a day that was never logged. */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  // wording
  monthName, monthNameShort, shortDate, longDate, rangeDates,
  // the selected range
  RANGE_STORAGE_KEY, DEFAULT_RANGE, readRangePreference, saveRangePreference, resolveRange,
  // pieces
  severityStep, changeLine, coverageLine, coverageShort, metricSeries,
  // view models
  buildRangeInsights, buildMonthSummary, monthOptions, buildTrendRows, describeTrend,
  bucketAverages, bucketModeFor, buildBuckets, buildMetricChanges,
  type MetricInfo,
} from "../src/lib/insights";
import { comparePoints, type DateRange, type EntryLike } from "../src/lib/analytics";

/* ---------- fixtures ---------- */

const KEY = "itch";
const SYM: MetricInfo = { k: KEY, label: "Itch severity", dir: "sym", scale: true };
const POS: MetricInfo = { k: "sleep", label: "Sleep quality", dir: "pos", scale: true };

const entry = (date: string, value: number | null, notes?: string): EntryLike & { notes?: string } => ({
  date,
  answers: value == null ? {} : { [KEY]: value },
  ...(notes ? { notes } : {}),
});

const day = (n: number) => `2026-04-${String(n).padStart(2, "0")}`;

/** April 2026, fully logged: nineteen 4s then eleven 5s. Sum 131 over 30 days
    is a mean of 4.3666…, which is the case two decimals exist for — one
    decimal would round it to "4.4" and lose the distinction from 4.35. */
const APRIL: EntryLike[] = Array.from({ length: 30 }, (_, i) => entry(day(i + 1), i < 19 ? 4 : 5));
/** March 2026: ten days at 6, twenty-one days unlogged. */
const MARCH: EntryLike[] = Array.from({ length: 10 }, (_, i) => entry(`2026-03-${String(i + 1).padStart(2, "0")}`, 6));

describe("dates as words", () => {
  it("names months and days without depending on the device's locale", () => {
    expect(monthName("2026-04")).toBe("April 2026");
    expect(monthName("2026-04-17")).toBe("April 2026");
    expect(monthNameShort("2026-12")).toBe("December");
    expect(shortDate("2026-04-03")).toBe("Apr 3");
    expect(longDate("2026-04-03")).toBe("Fri, Apr 3");
    expect(rangeDates({ start: "2026-04-03", end: "2026-05-02" })).toBe("Apr 3 – May 2");
    expect(rangeDates({ start: "2026-04-03", end: "2026-04-03" })).toBe("Apr 3");
    // a year-long range must not read as a single day's worth of dates
    expect(rangeDates({ start: "2025-08-19", end: "2026-08-18" })).toBe("Aug 19 2025 – Aug 18 2026");
  });

  it("returns an empty string rather than an Invalid Date for junk", () => {
    expect(monthName("nope")).toBe("");
    expect(shortDate("nope")).toBe("");
    expect(longDate("nope")).toBe("");
  });
});

describe("the remembered range", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("defaults to 30 days and round-trips a choice", () => {
    expect(readRangePreference()).toBe(DEFAULT_RANGE);
    saveRangePreference("90D");
    expect(store.get(RANGE_STORAGE_KEY)).toBe("90D");
    expect(readRangePreference()).toBe("90D");
  });

  it("ignores a value that isn't a range", () => {
    store.set(RANGE_STORAGE_KEY, "14D");
    expect(readRangePreference()).toBe(DEFAULT_RANGE);
    store.set(RANGE_STORAGE_KEY, "");
    expect(readRangePreference()).toBe(DEFAULT_RANGE);
  });

  it("survives a storage that throws, in either direction", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    });
    expect(readRangePreference()).toBe(DEFAULT_RANGE);
    expect(() => saveRangePreference("7D")).not.toThrow();
  });
});

describe("resolving the range", () => {
  it("resolves each key against today, with the phrase it is compared against", () => {
    const r30 = resolveRange("30D", APRIL, "2026-04-30");
    expect(r30.range).toEqual({ start: "2026-04-01", end: "2026-04-30" });
    expect(r30.prior).toEqual({ start: "2026-03-02", end: "2026-03-31" });
    expect(r30.label).toBe("Last 30 days");
    expect(r30.dates).toBe("Apr 1 – Apr 30");
    expect(r30.days).toBe(30);
    expect(r30.subject).toBe("the previous 30 days");
    expect(r30.empty).toBe(false);

    expect(resolveRange("7D", APRIL, "2026-04-30").range).toEqual({ start: "2026-04-24", end: "2026-04-30" });
    expect(resolveRange("7D", APRIL, "2026-04-30").subject).toBe("the previous 7 days");
  });

  it("stretches All from the journal's first day to today", () => {
    const all = resolveRange("All", [...MARCH, ...APRIL], "2026-05-10");
    expect(all.range).toEqual({ start: "2026-03-01", end: "2026-05-10" });
    expect(all.label).toBe("All time");
    expect(all.subject).toBe("the period before");
    expect(all.empty).toBe(false);
  });

  it("says so when All is asked of an empty journal instead of inventing a span", () => {
    const all = resolveRange("All", [], "2026-04-30");
    expect(all.empty).toBe(true);
    expect(all.range).toEqual({ start: "2026-04-30", end: "2026-04-30" });
  });

  it("keeps a fixed range fixed even when the journal is shorter than it", () => {
    // "The last 90 days" means ninety days. Shrinking it to the journal would
    // hide exactly the gaps this screen exists to show.
    const r = resolveRange("90D", [entry("2026-04-29", 5)], "2026-04-30");
    expect(r.days).toBe(90);
    expect(r.range.start).toBe("2026-01-31");
  });
});

describe("severity steps", () => {
  it("walks the four-step ramp for a symptom", () => {
    expect(severityStep(1, "sym")).toBe("good");
    expect(severityStep(3, "sym")).toBe("good");
    expect(severityStep(5, "sym")).toBe("warn");
    expect(severityStep(7, "sym")).toBe("alert");
    expect(severityStep(8, "sym")).toBe("bad");
  });

  it("flips the ramp for a positive metric", () => {
    expect(severityStep(9, "pos")).toBe("good");
    expect(severityStep(2, "pos")).toBe("bad");
  });

  it("paints nothing for a missing value or an unranked metric", () => {
    expect(severityStep(null, "sym")).toBeNull();
    expect(severityStep(5, "neutral")).toBeNull();
  });
});

describe("the change line", () => {
  const cur: DateRange = { start: "2026-04-08", end: "2026-04-14" };
  const prev: DateRange = { start: "2026-04-01", end: "2026-04-07" };
  const flat = (range: DateRange, v: number) =>
    Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${String(Number(range.start.slice(-2)) + i).padStart(2, "0")}`, value: v,
    }));

  it("states movement, never cause, and colours it by direction", () => {
    const better = changeLine(
      comparePoints(flat(cur, 3), cur, flat(prev, 7), prev, { dir: "sym" }),
      "the previous 7 days"
    );
    expect(better.text).toBe("4.00 lower than the previous 7 days");
    expect(better.direction).toBe("down");
    expect(better.tone).toBe("good");
    expect(better.reliable).toBe(true);
    expect(better.text).not.toMatch(/caused|because|due to/i);

    const worse = changeLine(
      comparePoints(flat(cur, 8), cur, flat(prev, 4), prev, { dir: "sym" }),
      "March"
    );
    expect(worse.text).toBe("4.00 higher than March");
    expect(worse.tone).toBe("bad");
  });

  it("says the same fall is worse for a metric where higher is better", () => {
    const c = changeLine(
      comparePoints(flat(cur, 3), cur, flat(prev, 7), prev, { dir: "pos" }),
      "March"
    );
    expect(c.direction).toBe("down");
    expect(c.tone).toBe("bad");
  });

  it("calls a small movement about the same", () => {
    const c = changeLine(
      comparePoints(flat(cur, 5.2), cur, flat(prev, 5), prev, { dir: "sym" }),
      "March"
    );
    expect(c.text).toBe("About the same as March");
    expect(c.direction).toBe("flat");
    expect(c.tone).toBe("neutral");
  });

  it("refuses to compare with a period that has nothing in it", () => {
    const c = changeLine(comparePoints(flat(cur, 5), cur, [], prev, { dir: "sym" }), "March");
    expect(c.text).toBe("Not enough logged in March to compare");
    expect(c.magnitude).toBeNull();
    expect(c.verdict).toBe("insufficient");
    expect(c.reliable).toBe(false);
  });

  it("marks a thin comparison as thin rather than hiding it", () => {
    const thin = [{ date: "2026-04-08", value: 3 }, { date: "2026-04-09", value: 3 }];
    const c = changeLine(comparePoints(thin, cur, flat(prev, 7), prev, { dir: "sym" }), "March");
    expect(c.reliable).toBe(false);
    expect(c.text).toBe("4.00 lower than March");
  });
});

describe("coverage lines", () => {
  it("always states how many days a figure came from", () => {
    expect(coverageLine({ totalDays: 30, loggedDays: 12, ratio: 0.4, longestStreak: 3, lastLogged: "x" }))
      .toBe("12 of 30 days logged · 40%");
    expect(coverageLine({ totalDays: 1, loggedDays: 0, ratio: 0, longestStreak: 0, lastLogged: null }))
      .toBe("0 of 1 day logged · 0%");
    expect(coverageLine({ totalDays: 0, loggedDays: 0, ratio: null, longestStreak: 0, lastLogged: null }))
      .toBe("No days in this range");
    expect(coverageShort({ totalDays: 30, loggedDays: 12, ratio: 0.4, longestStreak: 3, lastLogged: "x" }))
      .toBe("12/30 days");
  });
});

describe("the range summary", () => {
  const selection = resolveRange("30D", [...MARCH, ...APRIL], "2026-04-30");
  const built = buildRangeInsights([...MARCH, ...APRIL], SYM, selection);

  it("leads with a two-decimal average of the logged days", () => {
    expect(built.headline).toBe("4.37");
    expect(built.headlineCaption).toBe("Average over 30 days logged");
    expect(built.hasData).toBe(true);
  });

  it("compares with the equal-length period immediately before", () => {
    // March's ten logged days averaged 6; the prior window is Mar 2–31.
    expect(built.comparison.previous.mean).toBe(6);
    expect(built.change.text).toBe("1.63 lower than the previous 30 days");
    expect(built.change.tone).toBe("good");
  });

  it("always states coverage alongside the figure", () => {
    expect(built.coverage).toBe("30 of 30 days logged · 100%");
  });

  it("fills the tiles from the same range, ranked by direction", () => {
    const byId = Object.fromEntries(built.tiles.map((t) => [t.id, t]));
    expect(built.tiles.map((t) => t.id)).toEqual(["median", "best", "worst", "hard"]);
    expect(byId.median.value).toBe("4");
    expect(byId.best.value).toBe("4");   // lowest severity
    expect(byId.worst.value).toBe("5");  // highest severity
    expect(byId.hard.value).toBe("0");
  });

  it("flips best and worst for a metric where higher is better", () => {
    const entries = [
      { date: "2026-04-01", answers: { sleep: 9 } },
      { date: "2026-04-02", answers: { sleep: 3 } },
    ];
    const b = buildRangeInsights(entries, POS, resolveRange("7D", entries, "2026-04-02"));
    const byId = Object.fromEntries(b.tiles.map((t) => [t.id, t]));
    expect(byId.best.label).toBe("Highest");
    expect(byId.best.value).toBe("9");
    expect(byId.worst.value).toBe("3");
    expect(byId.hard.value).toBe("1"); // a 3 on a positive scale is a hard day
  });

  it("does not rank a neutral metric — it shows range and most common instead", () => {
    const neutral: MetricInfo = { k: "steps", label: "Steps", dir: "neutral", scale: false };
    const entries = [
      { date: "2026-04-01", answers: { steps: 8000 } },
      { date: "2026-04-02", answers: { steps: 12000 } },
    ];
    const b = buildRangeInsights(entries, neutral, resolveRange("7D", entries, "2026-04-02"));
    expect(b.tiles.map((t) => t.id)).toEqual(["median", "high", "low", "common"]);
    expect(b.tiles[1].value).toBe("12000");
    expect(b.tiles[2].value).toBe("8000");
    expect(b.summary.hardDays).toBeNull();
  });

  it("says nothing was logged instead of showing a zero", () => {
    const empty = buildRangeInsights([], SYM, resolveRange("30D", [], "2026-04-30"));
    expect(empty.headline).toBeNull();
    expect(empty.hasData).toBe(false);
    expect(empty.headlineCaption).toBe("Nothing logged in these 30 days");
    expect(empty.coverage).toBe("0 of 30 days logged · 0%");
    expect(empty.change.verdict).toBe("insufficient");
    expect(empty.tiles.every((t) => t.value == null || t.value === "0")).toBe(true);
  });

  it("keeps a non-scale metric's readings instead of dropping them off the scale", () => {
    const weight: MetricInfo = { k: "weight", label: "Weight", dir: "neutral", unit: "lb", scale: false };
    const entries = [{ date: "2026-04-01", answers: { weight: 182.4 } }];
    const series = metricSeries(entries, weight, { start: "2026-04-01", end: "2026-04-01" });
    expect(series[0].value).toBe(182.4);
    // the same metric read as a 1–10 scale would have been thrown away
    expect(metricSeries(entries, { ...weight, scale: true }, { start: "2026-04-01", end: "2026-04-01" })[0].value)
      .toBeNull();
  });
});

describe("the monthly summary", () => {
  const entries = [...MARCH, ...APRIL];
  const april = buildMonthSummary(entries, SYM, "2026-04", "2026-05-02");

  it("says the sentence a person would repeat: April average 4.37", () => {
    expect(april.headline).toBe("April average 4.37");
    expect(april.average).toBe("4.37");
    expect(april.label).toBe("April 2026");
    expect(april.range).toEqual({ start: "2026-04-01", end: "2026-04-30" });
  });

  it("compares with the calendar month before, by name", () => {
    expect(april.comparison.previous.mean).toBe(6);
    expect(april.change.text).toBe("1.63 lower than March");
    expect(april.change.tone).toBe("good");
  });

  it("shows median, lowest, highest, most common, logged days and hard days", () => {
    expect(april.tiles.map((t) => t.id)).toEqual(
      ["median", "lowest", "highest", "common", "logged", "hard"]);
    const byId = Object.fromEntries(april.tiles.map((t) => [t.id, t]));
    expect(byId.median.value).toBe("4");
    expect(byId.lowest.value).toBe("4");
    expect(byId.highest.value).toBe("5");
    expect(byId.common.value).toBe("4");
    expect(byId.common.sub).toBe("19 days");
    expect(byId.logged.value).toBe("30");
    expect(byId.logged.sub).toBe("of 30 in April");
    expect(byId.hard.value).toBe("0");
    expect(byId.hard.sub).toBe("scored 7 or above");
  });

  it("always shows coverage, including when it is unflattering", () => {
    const march = buildMonthSummary(entries, SYM, "2026-03", "2026-05-02");
    expect(march.coverage).toBe("10 of 31 days logged · 32%");
    expect(march.headline).toBe("March average 6.00");
    expect(march.hasData).toBe(true);
  });

  it("crosses the new year when it walks back a month", () => {
    const jan = buildMonthSummary(
      [{ date: "2025-12-30", answers: { itch: 8 } }, { date: "2026-01-05", answers: { itch: 4 } }],
      SYM, "2026-01", "2026-01-31"
    );
    expect(jan.change.text).toBe("4.00 lower than December");
  });

  it("has nothing to say about a month nobody logged, and says that", () => {
    const may = buildMonthSummary(entries, SYM, "2026-05", "2026-05-02");
    expect(may.hasData).toBe(false);
    expect(may.average).toBeNull();
    expect(may.headline).toBe("Nothing logged in May");
    expect(may.coverage).toBe("0 of 31 days logged · 0%");
    expect(may.change.verdict).toBe("insufficient");
  });

  it("offers every month the journal covers, empty ones included", () => {
    const options = monthOptions(entries, KEY, "2026-06-15");
    expect(options.map((o) => o.month)).toEqual(["2026-03", "2026-04", "2026-05", "2026-06"]);
    expect(options.map((o) => o.label)[0]).toBe("March 2026");
    expect(options.map((o) => o.loggedDays)).toEqual([10, 30, 0, 0]);
    expect(monthOptions([], KEY, "2026-06-15")).toEqual([]);
  });
});

describe("the trend chart's rows", () => {
  const entries = [
    entry("2026-04-01", 6, "flare started"),
    entry("2026-04-02", null),
    entry("2026-04-03", 8),
    entry("2026-04-04", 4),
    entry("2026-04-05", 4),
  ];
  const range: DateRange = { start: "2026-04-01", end: "2026-04-05" };
  const rows = buildTrendRows(entries, SYM, range);

  it("gives every day a row and leaves unlogged days null", () => {
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.value)).toEqual([6, null, 8, 4, 4]);
    expect(rows[1].value).not.toBe(0);
  });

  it("carries both rolling averages and the labels the chart draws", () => {
    expect(rows[0].rolling7).toBeNull(); // one reading is not an average
    expect(rows[2].rolling7).toBe(7);    // (6+8)/2
    expect(rows[4].rolling7).toBe(5.5);  // (6+8+4+4)/4 — the gap is skipped
    expect(rows.every((r) => r.rolling30 === null || typeof r.rolling30 === "number")).toBe(true);
    expect(rows[0].label).toBe("Apr 1");
    expect(rows[0].longLabel).toBe("Wed, Apr 1");
  });

  it("attaches the day's note, which is usually why that day was an 8", () => {
    expect(rows[0].note).toBe("flare started");
    expect(rows[2].note).toBeUndefined();
  });

  it("describes itself in a sentence for anyone who can't see the chart", () => {
    const text = describeTrend(rows, SYM);
    expect(text).toContain("Itch severity from Apr 1 to Apr 5");
    expect(text).toContain("4 of 5 days logged");
    expect(text).toContain("average 5.50");
    expect(text).toContain("lowest 4, highest 8");
    expect(describeTrend(buildTrendRows([], SYM, range), SYM))
      .toBe("Itch severity: nothing logged in this range.");
  });
});

describe("bucketed averages", () => {
  it("buckets by week for short ranges and by month for long ones", () => {
    expect(bucketModeFor("7D")).toBe("week");
    expect(bucketModeFor("30D")).toBe("week");
    expect(bucketModeFor("90D")).toBe("week");
    expect(bucketModeFor("1Y")).toBe("month");
    expect(bucketModeFor("All")).toBe("month");
  });

  it("ends the last week on the newest day, not on a calendar Monday", () => {
    // Otherwise the most recent bar is a partial week that reads as a drop.
    const points = Array.from({ length: 14 }, (_, i) => ({ date: day(i + 1), value: i < 7 ? 6 : 4 }));
    const weeks = bucketAverages(points, "week");
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toMatchObject({ start: "2026-04-01", end: "2026-04-07", value: 6, loggedDays: 7 });
    expect(weeks[1]).toMatchObject({ start: "2026-04-08", end: "2026-04-14", value: 4, label: "Apr 8" });
  });

  it("leaves a bucket with nothing logged as null, so it draws no bar", () => {
    const points = Array.from({ length: 14 }, (_, i) => ({ date: day(i + 1), value: i < 7 ? 6 : null }));
    const weeks = bucketAverages(points, "week");
    expect(weeks[1].value).toBeNull();
    expect(weeks[1].loggedDays).toBe(0);
    expect(weeks[1].totalDays).toBe(7);
  });

  it("buckets a year by month, keeping empty months in place", () => {
    const points = [
      ...Array.from({ length: 31 }, (_, i) => ({ date: `2026-03-${String(i + 1).padStart(2, "0")}`, value: 6 as number | null })),
      ...Array.from({ length: 30 }, (_, i) => ({ date: day(i + 1), value: null as number | null })),
      ...Array.from({ length: 31 }, (_, i) => ({ date: `2026-05-${String(i + 1).padStart(2, "0")}`, value: 4 as number | null })),
    ];
    const months = bucketAverages(points, "month");
    expect(months.map((m) => m.label)).toEqual(["Mar", "Apr", "May"]);
    expect(months.map((m) => m.value)).toEqual([6, null, 4]);
  });

  it("builds its buckets from the same series the chart draws", () => {
    const selection = resolveRange("30D", APRIL, "2026-04-30");
    const buckets = buildBuckets(APRIL, SYM, selection);
    expect(buckets.length).toBeGreaterThan(3);
    expect(buckets[buckets.length - 1].end).toBe("2026-04-30");
    expect(buckets.every((b) => b.totalDays <= 7)).toBe(true);
  });
});

describe("the other tracked metrics", () => {
  it("gives each metric its own average and its own comparison, over one range", () => {
    const entries = [
      { date: "2026-04-01", answers: { itch: 8, sleep: 3 } },
      { date: "2026-04-02", answers: { itch: 8, sleep: 3 } },
      { date: "2026-04-03", answers: { itch: 4, sleep: 8 } },
      { date: "2026-04-04", answers: { itch: 4, sleep: 8 } },
    ];
    const selection = resolveRange("7D", entries, "2026-04-07");
    const changes = buildMetricChanges(entries, [SYM, POS], selection);
    expect(changes.map((c) => c.metric.k)).toEqual(["itch", "sleep"]);
    expect(changes[0].value).toBe("6.00");
    expect(changes[1].value).toBe("5.50");
    expect(changes[0].coverage).toBe("4 of 7 days logged · 57%");
    // nothing at all in the seven days before, so no comparison is claimed
    expect(changes[0].change.verdict).toBe("insufficient");
  });

  it("keeps a card for a metric with nothing logged rather than dropping it", () => {
    const selection = resolveRange("7D", APRIL, "2026-04-30");
    const missing: MetricInfo = { k: "never_asked", label: "Never asked", dir: "sym", scale: true };
    const changes = buildMetricChanges(APRIL, [missing], selection);
    expect(changes).toHaveLength(1);
    expect(changes[0].value).toBeNull();
    expect(changes[0].coverage).toBe("0 of 7 days logged · 0%");
  });
});
