/* The analytics foundation.

   Every number Insights shows — an average, a change since last month, a
   rolling line, a distribution bar — is computed here, by a pure function that
   takes plain values and returns plain values. Nothing in this file reads the
   clock on its own (callers pass "today"), touches storage, or knows what a
   React component is, which is what makes each figure testable and what keeps
   `App.tsx` from growing a third statistics implementation.

   Three rules hold everywhere below, and they are the reason the module
   exists rather than a handful of inline `reduce` calls:

   1. **A missing day is missing, never zero.** A day nobody logged carries
      `null` through every function here. It is excluded from means, medians
      and distributions; it leaves a visible gap in a rolling series; and it
      makes the coverage figure smaller rather than dragging an average down.
      A journal is honest about what it does not know, or it is not worth
      keeping.
   2. **Not enough data returns `null`, not a fabricated answer.** An empty
      mean is `null`. A percentage change against a period with no logged days
      is `null`. Callers decide how to say "not enough yet"; they are never
      handed a plausible-looking zero to render.
   3. **Direction is explicit.** A 9 is terrible for "itch severity" and
      excellent for "sleep quality". Anything that ranks values — best, worst,
      hard days, whether a change is an improvement — takes the field's
      `FieldDirection` and converts to a single internal "badness" scale, the
      same 11-minus-value flip the severity colour ramp already uses. */

import type { DailyEntry, FieldDirection } from "../types/models";

/* ---------- shared shapes ---------- */

/** A local calendar date, `YYYY-MM-DD`. Never a UTC timestamp: the journal is
    lived in local time and an 11pm entry belongs to the day it was written. */
export type IsoDate = string;

/** An inclusive span of calendar days. `start` and `end` are both logged
    days' worth of range — a single-day range has `start === end`. */
export interface DateRange {
  start: IsoDate;
  end: IsoDate;
}

/** One day of one metric. `value === null` means "nothing was logged", which
    is a fact about the journal, not a zero. */
export interface DayPoint {
  date: IsoDate;
  value: number | null;
}

/** The user-facing time windows. `All` needs the journal's earliest date to
    resolve, so it is the one key `rangeFor` can answer `null` for. */
export type RangeKey = "7D" | "30D" | "90D" | "1Y" | "All";

export const RANGE_KEYS: RangeKey[] = ["7D", "30D", "90D", "1Y", "All"];

/** Short labels for the range control. Kept next to the keys so a new range
    can never ship with a missing label. */
export const RANGE_LABELS: Record<RangeKey, string> = {
  "7D": "7D",
  "30D": "30D",
  "90D": "90D",
  "1Y": "1Y",
  All: "All",
};

/** How many days each fixed range covers, counting today. `All` has no fixed
    length — it is measured from the data. */
export const RANGE_DAYS: Record<Exclude<RangeKey, "All">, number> = {
  "7D": 7,
  "30D": 30,
  "90D": 90,
  "1Y": 365,
};

export const isRangeKey = (k: unknown): k is RangeKey =>
  typeof k === "string" && (RANGE_KEYS as string[]).includes(k);

/** The 1–10 rating scale every user-facing score in this app uses. */
export const SCALE_MIN = 1;
export const SCALE_MAX = 10;

/** A day counts as "hard" when its badness reaches this, i.e. severity 7+ on a
    symptom metric or 4 and below on a positive one. Chosen to line up with the
    third step of the severity colour ramp so the count and the colours in the
    charts always agree. */
export const HARD_DAY_THRESHOLD = 7;

/* ---------- dates ----------

   All date maths goes through the Y/M/D constructor rather than
   `Date.parse` + millisecond arithmetic. `new Date(y, m - 1, d + n)`
   normalises overflow *and* survives daylight-saving transitions, where
   "add 86,400,000 milliseconds" quietly lands on the same calendar day twice
   a year. */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Is this a well-formed `YYYY-MM-DD` naming a real calendar day? */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** A `Date` at local midnight, or `null` when the string is not a date. */
export function toDate(date: IsoDate): Date | null {
  if (!isIsoDate(date)) return null;
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Local `YYYY-MM-DD` for a `Date`. Deliberately not `toISOString()`, which is
    UTC and files a late-evening entry under tomorrow east of Greenwich. */
export function toIso(d: Date): IsoDate {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Today, in local time. The only function here that reads the clock — every
    other date function takes the day it should treat as "today", so tests and
    exports can pin it. */
export const todayIso = (now: Date = new Date()): IsoDate => toIso(now);

/** `date` shifted by `n` days (negative goes back). Returns `date` unchanged
    when it is not a valid date, so a bad value can never become `NaN-NaN-NaN`
    halfway down a chart. */
export function addDays(date: IsoDate, n: number): IsoDate {
  const dt = toDate(date);
  if (!dt || !Number.isFinite(n)) return date;
  return toIso(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + Math.trunc(n)));
}

/** Signed whole days from `a` to `b` (`b - a`). `null` if either is invalid. */
export function dayDiff(a: IsoDate, b: IsoDate): number | null {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return null;
  // Compare at UTC noon of each local calendar day: the noon offset absorbs
  // the ±1h a DST boundary would otherwise introduce into the division.
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate(), 12);
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate(), 12);
  return Math.round((ub - ua) / 86400000);
}

/** How many calendar days a range covers, counting both ends. `0` when the
    range is invalid or inverted — an inverted range is not a negative span,
    it is not a span at all. */
export function rangeLength(range: DateRange): number {
  const diff = dayDiff(range.start, range.end);
  if (diff == null || diff < 0) return 0;
  return diff + 1;
}

/** Is `date` inside the range (inclusive on both ends)? */
export function inRange(date: IsoDate, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

/** Every day in the range, oldest first. Empty for an invalid or inverted
    range. This is what turns a sparse list of entries into a dense series with
    visible holes in it. */
export function eachDay(range: DateRange): IsoDate[] {
  const n = rangeLength(range);
  const out: IsoDate[] = [];
  for (let i = 0; i < n; i++) out.push(addDays(range.start, i));
  return out;
}

/** A range of `days` ending on `end`, inclusive — `days: 7` ending today is
    today and the six days before it, which is what "7D" means to a person. */
export function rangeEndingOn(end: IsoDate, days: number): DateRange {
  const n = Math.max(1, Math.trunc(days));
  return { start: addDays(end, -(n - 1)), end };
}

/** Resolve a range key against a reference day.

    `All` needs the journal's own earliest logged day and returns `null`
    without one — an empty journal has no all-time range, and inventing one
    that starts today would make "All" quietly mean "1D". */
export function rangeFor(
  key: RangeKey,
  today: IsoDate,
  earliest?: IsoDate | null
): DateRange | null {
  if (!isIsoDate(today)) return null;
  if (key === "All") {
    if (!earliest || !isIsoDate(earliest)) return null;
    return earliest <= today ? { start: earliest, end: today } : { start: today, end: today };
  }
  return rangeEndingOn(today, RANGE_DAYS[key]);
}

/** The equal-length period immediately before `range`, so "30D" is always
    compared with the 30 days before it and never with a shorter tail of the
    journal. `null` when the range is invalid. */
export function priorRange(range: DateRange): DateRange | null {
  const len = rangeLength(range);
  if (len === 0) return null;
  const end = addDays(range.start, -1);
  return { start: addDays(end, -(len - 1)), end };
}

/** The full calendar month containing `date` (or built from a year/month). */
export function monthRange(year: number, month1to12: number): DateRange | null {
  if (!Number.isInteger(year) || !Number.isInteger(month1to12)) return null;
  if (month1to12 < 1 || month1to12 > 12) return null;
  const start = new Date(year, month1to12 - 1, 1);
  const end = new Date(year, month1to12, 0); // day 0 of next month = last of this
  return { start: toIso(start), end: toIso(end) };
}

/** The calendar month a date falls in. */
export function monthOf(date: IsoDate): DateRange | null {
  const dt = toDate(date);
  if (!dt) return null;
  return monthRange(dt.getFullYear(), dt.getMonth() + 1);
}

/** `YYYY-MM` for a date — the key monthly summaries group by. */
export function monthKey(date: IsoDate): string {
  return isIsoDate(date) ? date.slice(0, 7) : "";
}

/** The month before the one containing `date`, as a full range. */
export function previousMonth(date: IsoDate): DateRange | null {
  const dt = toDate(date);
  if (!dt) return null;
  const prev = new Date(dt.getFullYear(), dt.getMonth() - 1, 1);
  return monthRange(prev.getFullYear(), prev.getMonth() + 1);
}

/** Trim a range to the journal's own bounds, so an "All" view of three logged
    days does not report 340 missing ones. `null` when they do not overlap. */
export function clampRange(range: DateRange, bounds: DateRange): DateRange | null {
  const start = range.start > bounds.start ? range.start : bounds.start;
  const end = range.end < bounds.end ? range.end : bounds.end;
  return start <= end ? { start, end } : null;
}

/** The span actually covered by a set of dates, ignoring anything malformed.
    `null` for an empty journal — there is no "all time" yet. */
export function boundsOf(dates: readonly IsoDate[]): DateRange | null {
  let min: IsoDate | null = null;
  let max: IsoDate | null = null;
  for (const d of dates) {
    if (!isIsoDate(d)) continue;
    if (min == null || d < min) min = d;
    if (max == null || d > max) max = d;
  }
  return min && max ? { start: min, end: max } : null;
}

/* ---------- building a series ----------

   Charts and statistics both want the same thing: one slot per calendar day
   in the range, holding either a number or `null`. Entries are sparse and can
   in principle repeat a date (a restored backup merged badly), so the map is
   built explicitly and the later entry wins — the same rule the journal uses
   when two devices disagree. */

/** The minimum an entry has to look like for a series to be read off it. */
export interface EntryLike {
  date: string;
  answers?: Record<string, unknown> | null;
}

export interface SeriesOptions {
  /** Reject values below this (e.g. `SCALE_MIN` for a 1–10 question). */
  min?: number;
  /** Reject values above this. Out-of-range values read as *missing* rather
      than being clamped: a 14 in a 1–10 column is corrupt data, and quietly
      turning it into a 10 would launder it into the average. */
  max?: number;
}

/** Is this a usable numeric reading for the given bounds? */
export function isNumericValue(value: unknown, opts: SeriesOptions = {}): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (opts.min != null && value < opts.min) return false;
  if (opts.max != null && value > opts.max) return false;
  return true;
}

/** One metric across every day of a range, holes included. */
export function buildSeries(
  entries: readonly EntryLike[],
  key: string,
  range: DateRange,
  opts: SeriesOptions = {}
): DayPoint[] {
  const byDate = new Map<string, number | null>();
  for (const e of entries) {
    if (!e || !isIsoDate(e.date) || !inRange(e.date, range)) continue;
    const raw = e.answers ? e.answers[key] : undefined;
    byDate.set(e.date, isNumericValue(raw, opts) ? (raw as number) : null);
  }
  return eachDay(range).map((date) => ({ date, value: byDate.get(date) ?? null }));
}

/** Same, for a 1–10 question: anything outside the scale is treated as
    missing rather than trusted. */
export const buildScaleSeries = (
  entries: readonly EntryLike[],
  key: string,
  range: DateRange
): DayPoint[] => buildSeries(entries, key, range, { min: SCALE_MIN, max: SCALE_MAX });

/** A series from an already-derived `date -> value` map (food, bowel and
    routine metrics arrive this way, not as survey answers). */
export function seriesFromMap(
  values: ReadonlyMap<string, number | null> | Record<string, number | null>,
  range: DateRange,
  opts: SeriesOptions = {}
): DayPoint[] {
  const get = (d: string): number | null | undefined =>
    values instanceof Map ? values.get(d) : (values as Record<string, number | null>)[d];
  return eachDay(range).map((date) => {
    const raw = get(date);
    return { date, value: isNumericValue(raw, opts) ? (raw as number) : null };
  });
}

/** Only the days that were actually logged. The one place the rest of this
    file goes through to drop holes, so "missing is not zero" is enforced once
    instead of remembered in a dozen `filter` calls. */
export function loggedValues(points: readonly DayPoint[]): number[] {
  const out: number[] = [];
  for (const p of points) if (p && typeof p.value === "number" && Number.isFinite(p.value)) out.push(p.value);
  return out;
}

/** Restrict a series to a sub-range without rebuilding it from entries. */
export const pointsInRange = (points: readonly DayPoint[], range: DateRange): DayPoint[] =>
  points.filter((p) => inRange(p.date, range));

/* ---------- statistics ----------

   Each of these takes raw numbers and returns `null` rather than `NaN`, `0`
   or `-Infinity` when there is nothing to compute from. That single choice is
   what lets the UI say "not enough logged yet" truthfully instead of drawing
   a confident zero. */

/** Arithmetic mean, or `null` for an empty list. */
export function mean(values: readonly number[]): number | null {
  if (!values.length) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Middle value; the average of the two middles for an even count. */
export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function minimum(values: readonly number[]): number | null {
  if (!values.length) return null;
  let m = values[0];
  for (const v of values) if (v < m) m = v;
  return m;
}

export function maximum(values: readonly number[]): number | null {
  if (!values.length) return null;
  let m = values[0];
  for (const v of values) if (v > m) m = v;
  return m;
}

/** Population standard deviation of the days that were logged.

    Population, not sample: these *are* all the days there are — the journal is
    not a sample drawn from some larger set of unobserved days it is trying to
    infer. A single logged day has no spread, so it is `0`, and no logged days
    at all is `null`. */
export function standardDeviation(values: readonly number[]): number | null {
  if (!values.length) return null;
  if (values.length === 1) return 0;
  const m = mean(values) as number;
  let acc = 0;
  for (const v of values) acc += (v - m) * (v - m);
  return Math.sqrt(acc / values.length);
}

/** The most frequent value. Ties break toward the lower score so the answer
    is stable across re-renders and re-sorts — an arbitrary winner that moves
    between two equally common scores reads as a bug. */
export function mostCommon(values: readonly number[]): number | null {
  if (!values.length) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best: number | null = null;
  let bestN = 0;
  for (const [value, n] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    if (n > bestN) {
      best = value;
      bestN = n;
    }
  }
  return best;
}

/** Round to `dp` decimals, half away from zero, correcting for the
    floating-point fringe: a mean that is *exactly* 4.365 in decimal is stored
    as 4.3649999… in binary, and a naive `Math.round` would show it as 4.36.
    Half away from zero rather than JavaScript's half-up so a drop of 0.365 and
    a rise of 0.365 are displayed with the same magnitude. `null` passes
    straight through, because a missing figure has no rounding. */
export function round(value: number | null, dp = 2): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const f = Math.pow(10, Math.max(0, Math.trunc(dp)));
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * f * (1 + Number.EPSILON))) / f;
}

/** A mean formatted the way the summaries show it — two decimals, and an
    em-dash-free placeholder decided by the caller when there is nothing to
    show. Kept here so "4.37" never becomes "4.4" in one card and "4.370" in
    another. */
export const formatAverage = (value: number | null, dp = 2): string | null => {
  const r = round(value, dp);
  return r == null ? null : r.toFixed(Math.max(0, Math.trunc(dp)));
};

/** A change with its sign kept, e.g. `+0.42` / `-1.10`. `null` when there is
    no change to state. */
export const formatDelta = (value: number | null, dp = 2): string | null => {
  const r = round(value, dp);
  if (r == null) return null;
  const body = Math.abs(r).toFixed(Math.max(0, Math.trunc(dp)));
  return `${r > 0 ? "+" : r < 0 ? "-" : ""}${body}`;
};

/** Coverage as a whole-number percentage, or `null` for an empty range. */
export const percent = (ratio: number | null, dp = 0): number | null => round(ratio == null ? null : ratio * 100, dp);

/* ---------- direction ----------

   One conversion, used by everything that ranks: "badness". On a symptom
   metric badness is the score; on a positive metric it is the score flipped
   about the scale, so 2 hours of great sleep and an itch of 9 are both bad.
   Neutral metrics have no better or worse end and are never ranked. */

/** Score → badness, on the same 1–10 scale. */
export const badness = (value: number, dir: FieldDirection = "sym"): number =>
  dir === "pos" ? SCALE_MAX + SCALE_MIN - value : value;

/** The best score present, by the metric's own direction. */
export function bestValue(values: readonly number[], dir: FieldDirection = "sym"): number | null {
  if (!values.length || dir === "neutral") return null;
  return dir === "pos" ? maximum(values) : minimum(values);
}

/** The hardest score present, by the metric's own direction. */
export function worstValue(values: readonly number[], dir: FieldDirection = "sym"): number | null {
  if (!values.length || dir === "neutral") return null;
  return dir === "pos" ? minimum(values) : maximum(values);
}

/** How many logged days were hard ones — badness at or above the threshold.
    Neutral metrics have no hard days and return `null` rather than `0`, which
    would read as "none were hard" when the truth is "the question does not
    apply". */
export function hardDayCount(
  points: readonly DayPoint[],
  dir: FieldDirection = "sym",
  threshold: number = HARD_DAY_THRESHOLD
): number | null {
  if (dir === "neutral") return null;
  let n = 0;
  for (const v of loggedValues(points)) if (badness(v, dir) >= threshold) n += 1;
  return n;
}

/* ---------- coverage ----------

   Every figure in Insights is only as good as the days behind it, so coverage
   travels with the numbers rather than being computed separately wherever
   someone remembers to. */

export interface Coverage {
  /** Calendar days in the range. */
  totalDays: number;
  /** Days with a real value for this metric. */
  loggedDays: number;
  /** `loggedDays / totalDays`, or `null` when the range is empty. */
  ratio: number | null;
  /** Longest run of consecutive logged days inside the range. */
  longestStreak: number;
  /** The most recent logged day, or `null`. */
  lastLogged: IsoDate | null;
}

export function coverage(points: readonly DayPoint[]): Coverage {
  let loggedDays = 0;
  let streak = 0;
  let longestStreak = 0;
  let lastLogged: IsoDate | null = null;
  for (const p of points) {
    const has = typeof p.value === "number" && Number.isFinite(p.value);
    if (has) {
      loggedDays += 1;
      streak += 1;
      if (streak > longestStreak) longestStreak = streak;
      lastLogged = p.date;
    } else {
      streak = 0;
    }
  }
  const totalDays = points.length;
  return {
    totalDays,
    loggedDays,
    ratio: totalDays ? loggedDays / totalDays : null,
    longestStreak,
    lastLogged,
  };
}

/** Is there enough here to say anything? The gate the UI uses before drawing a
    comparison, so "not enough yet" is one decision made in one place. */
export function hasEnoughData(points: readonly DayPoint[], minDays = 3): boolean {
  return coverage(points).loggedDays >= Math.max(1, minDays);
}

/* ---------- summaries ---------- */

/** Everything a summary card needs about one metric over one range. Values are
    unrounded — presentation decides how many decimals to show. */
export interface SeriesSummary {
  range: DateRange;
  coverage: Coverage;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  stdDev: number | null;
  mostCommon: number | null;
  /** Ranked by the metric's direction; `null` for neutral metrics. */
  best: number | null;
  worst: number | null;
  hardDays: number | null;
  /** Oldest and newest logged readings in the range. */
  first: DayPoint | null;
  last: DayPoint | null;
}

export function summarize(
  points: readonly DayPoint[],
  range: DateRange,
  dir: FieldDirection = "sym"
): SeriesSummary {
  const values = loggedValues(points);
  const logged = points.filter((p) => typeof p.value === "number" && Number.isFinite(p.value));
  return {
    range,
    coverage: coverage(points),
    mean: mean(values),
    median: median(values),
    min: minimum(values),
    max: maximum(values),
    stdDev: standardDeviation(values),
    mostCommon: mostCommon(values),
    best: bestValue(values, dir),
    worst: worstValue(values, dir),
    hardDays: hardDayCount(points, dir),
    first: logged.length ? logged[0] : null,
    last: logged.length ? logged[logged.length - 1] : null,
  };
}

/** Summarize straight from entries, for the common survey-question case. */
export function summarizeMetric(
  entries: readonly EntryLike[],
  key: string,
  range: DateRange,
  dir: FieldDirection = "sym"
): SeriesSummary {
  return summarize(buildScaleSeries(entries, key, range), range, dir);
}

/* ---------- distribution ---------- */

export interface DistributionBin {
  /** The score, 1–10. */
  score: number;
  /** Days logged at this score. */
  days: number;
  /** Share of *logged* days, 0–1. `null` when nothing was logged — a share of
      an empty set is undefined, not zero. */
  share: number | null;
}

export interface Distribution {
  bins: DistributionBin[];
  loggedDays: number;
  mostCommon: number | null;
  /** Tallest bar, for scaling a chart's axis. `0` when nothing is logged. */
  peakDays: number;
}

/** How often each score on the 1–10 scale was logged. Always returns all ten
    bins, in order, so a chart's shape is comparable between metrics and
    between months — an absent score is a real, visible zero-height bar, which
    is different from an absent *day*. */
export function distribution(
  points: readonly DayPoint[],
  min = SCALE_MIN,
  max = SCALE_MAX
): Distribution {
  const counts = new Map<number, number>();
  let loggedDays = 0;
  for (const v of loggedValues(points)) {
    const score = Math.round(v);
    if (score < min || score > max) continue;
    counts.set(score, (counts.get(score) || 0) + 1);
    loggedDays += 1;
  }
  const bins: DistributionBin[] = [];
  let peakDays = 0;
  for (let score = min; score <= max; score++) {
    const days = counts.get(score) || 0;
    if (days > peakDays) peakDays = days;
    bins.push({ score, days, share: loggedDays ? days / loggedDays : null });
  }
  const values: number[] = [];
  for (const b of bins) for (let i = 0; i < b.days; i++) values.push(b.score);
  return { bins, loggedDays, mostCommon: mostCommon(values), peakDays };
}

/* ---------- rolling averages ---------- */

export interface RollingOptions {
  /** How many days the window spans, counted in calendar days rather than
      logged ones — a 7-day average is the last seven *days*, whether five or
      seven of them were logged. */
  window: number;
  /** Fewest logged days inside the window before an average is drawn at all.
      Defaults to two, or the window if it is shorter: one lonely reading is a
      raw value wearing an average's clothes. */
  minPoints?: number;
}

/** A rolling average over a dense series, aligned to the same dates.

    Days without enough data behind them are `null`, which is what leaves the
    honest gap at the start of a chart instead of a line that appears to begin
    at whatever the first reading happened to be. */
export function rollingAverage(
  points: readonly DayPoint[],
  options: RollingOptions | number
): DayPoint[] {
  const opts: RollingOptions = typeof options === "number" ? { window: options } : options;
  const window = Math.max(1, Math.trunc(opts.window));
  const minPoints = Math.max(1, Math.min(opts.minPoints ?? 2, window));
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - (window - 1)), i + 1);
    const values = loggedValues(slice);
    return { date: p.date, value: values.length >= minPoints ? (mean(values) as number) : null };
  });
}

/** Daily values with their rolling companions on the same row — the shape the
    trend chart and its tooltip both read. */
export interface TrendPoint extends DayPoint {
  rolling7: number | null;
  rolling30: number | null;
}

export function trendSeries(points: readonly DayPoint[]): TrendPoint[] {
  const r7 = rollingAverage(points, { window: 7, minPoints: 2 });
  const r30 = rollingAverage(points, { window: 30, minPoints: 5 });
  return points.map((p, i) => ({
    date: p.date,
    value: p.value,
    rolling7: r7[i].value,
    rolling30: r30[i].value,
  }));
}

/* ---------- period comparison ---------- */

/** What a change means once direction is taken into account. `insufficient`
    is a first-class answer: one of the two periods had nothing in it. */
export type ChangeVerdict = "improving" | "worsening" | "steady" | "changed" | "insufficient";

export interface PeriodComparison {
  current: SeriesSummary;
  previous: SeriesSummary;
  /** `current.mean - previous.mean`, in scale points. `null` when either side
      has no logged days. */
  delta: number | null;
  /** Change as a share of the previous mean. `null` when the previous mean is
      missing or zero — "up 40%" from nothing is not a fact. */
  percentChange: number | null;
  verdict: ChangeVerdict;
  /** True when both periods cleared `minDays`; the UI hides or softens a
      comparison drawn from too few days rather than stating it flatly. */
  reliable: boolean;
}

export interface CompareOptions {
  dir?: FieldDirection;
  /** Movement smaller than this reads as steady rather than as a trend. In
      scale points; 0.4 matches the threshold the dashboard already uses. */
  steadyThreshold?: number;
  /** Logged days each period needs before the comparison is called reliable. */
  minDays?: number;
}

/** Compare two already-built series. Both are summarized so the caller can
    show coverage next to the change without recomputing anything. */
export function comparePoints(
  current: readonly DayPoint[],
  currentRange: DateRange,
  previous: readonly DayPoint[],
  previousRange: DateRange,
  options: CompareOptions = {}
): PeriodComparison {
  const dir = options.dir ?? "sym";
  const steadyThreshold = options.steadyThreshold ?? 0.4;
  const minDays = options.minDays ?? 3;
  const cur = summarize(current, currentRange, dir);
  const prev = summarize(previous, previousRange, dir);

  const delta = cur.mean != null && prev.mean != null ? cur.mean - prev.mean : null;
  const percentChange = delta != null && prev.mean != null && prev.mean !== 0 ? delta / prev.mean : null;

  let verdict: ChangeVerdict;
  if (delta == null) verdict = "insufficient";
  else if (Math.abs(delta) < steadyThreshold) verdict = "steady";
  else if (dir === "neutral") verdict = "changed";
  else verdict = (dir === "pos" ? delta > 0 : delta < 0) ? "improving" : "worsening";

  return {
    current: cur,
    previous: prev,
    delta,
    percentChange,
    verdict,
    reliable: cur.coverage.loggedDays >= minDays && prev.coverage.loggedDays >= minDays,
  };
}

/** Compare a range with the equal-length period immediately before it — the
    comparison every Insights card makes. */
export function compareWithPriorPeriod(
  entries: readonly EntryLike[],
  key: string,
  range: DateRange,
  options: CompareOptions = {}
): PeriodComparison {
  const prior = priorRange(range);
  return comparePoints(
    buildScaleSeries(entries, key, range),
    range,
    prior ? buildScaleSeries(entries, key, prior) : [],
    prior ?? { start: range.start, end: range.start },
    options
  );
}

/** Compare any two ranges of the same metric (this month vs. the same month
    last year, an episode vs. the fortnight before it). */
export function compareRanges(
  entries: readonly EntryLike[],
  key: string,
  current: DateRange,
  previous: DateRange,
  options: CompareOptions = {}
): PeriodComparison {
  return comparePoints(
    buildScaleSeries(entries, key, current),
    current,
    buildScaleSeries(entries, key, previous),
    previous,
    options
  );
}

/* ---------- grouping ---------- */

export interface MonthlyPoint {
  /** `YYYY-MM`. */
  month: string;
  range: DateRange;
  summary: SeriesSummary;
}

/** Monthly summaries across a range, oldest first. Months with nothing logged
    are still present, carrying `mean: null` — a gap in the year is part of the
    picture, and dropping the month would silently close it up. */
export function monthlyBreakdown(
  points: readonly DayPoint[],
  dir: FieldDirection = "sym"
): MonthlyPoint[] {
  const groups = new Map<string, DayPoint[]>();
  for (const p of points) {
    const key = monthKey(p.date);
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, group]) => {
      const range: DateRange = { start: group[0].date, end: group[group.length - 1].date };
      return { month, range, summary: summarize(group, monthOf(group[0].date) ?? range, dir) };
    });
}

/** Entries reduced to the dates they cover, deduplicated and sorted — the
    input `boundsOf` and the "All" range want. */
export function entryDates(entries: readonly EntryLike[]): IsoDate[] {
  const seen = new Set<IsoDate>();
  for (const e of entries) if (e && isIsoDate(e.date)) seen.add(e.date);
  return [...seen].sort();
}

/** The all-time range of a journal, or `null` when nothing is logged. */
export const journalBounds = (entries: readonly (EntryLike | DailyEntry)[]): DateRange | null =>
  boundsOf(entryDates(entries as readonly EntryLike[]));
