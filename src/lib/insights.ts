/* Insights view models.

   `analytics.ts` computes numbers. This file turns those numbers into the
   handful of small, fully-formed objects the Insights screen renders — a
   headline, a change line, a row of tiles, a coverage sentence, a month's
   summary, a chart's rows. Components below `src/components` read these
   objects and lay them out; they do no arithmetic and no string building of
   their own, which is what keeps every figure on screen under test.

   Why formatted strings live here rather than in the components: "April
   average 4.37" is a *claim*, and a claim is worth a test. `formatAverage`
   fixing two decimals, a change line that never says one thing caused
   another, a coverage sentence that appears even when it is unflattering —
   those are product decisions, and product decisions belong somewhere a test
   can hold them still.

   The rules inherited from `analytics.ts` hold throughout: a missing day is
   missing rather than zero, an absent figure is `null` rather than a
   confident-looking number, and nothing here ranks a value without being told
   the metric's direction. */

import type { FieldDirection } from "../types/models";
import {
  type ChangeVerdict,
  type Coverage,
  type DateRange,
  type DayPoint,
  type EntryLike,
  type IsoDate,
  type PeriodComparison,
  type RangeKey,
  type SeriesSummary,
  addDays,
  boundsOf,
  buildScaleSeries,
  buildSeries,
  comparePoints,
  distribution,
  entryDates,
  eachDay,
  formatAverage,
  formatDelta,
  hardDayCount,
  isIsoDate,
  isRangeKey,
  monthKey,
  monthOf,
  monthRange,
  monthlyBreakdown,
  percent,
  priorRange,
  rangeFor,
  rangeLength,
  round,
  summarize,
  todayIso,
  trendSeries,
} from "./analytics";

/* ---------- dates as words ----------

   Deliberately not `toLocaleDateString`: these strings are asserted in tests
   and printed into an appointment pack, and a figure that reads "April
   average 4.37" on one device and "avril" on another is a figure two people
   cannot discuss. English, like the rest of the app's copy. */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "April 2026" for a `YYYY-MM` key or any date inside the month. */
export function monthName(month: string): string {
  const key = month.length > 7 ? monthKey(month) : month;
  const [y, m] = key.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return "";
  return `${MONTHS[m - 1]} ${y}`;
}

/** "April" — used where the year is already established by its neighbour. */
export function monthNameShort(month: string): string {
  const key = month.length > 7 ? monthKey(month) : month;
  const m = Number(key.split("-")[1]);
  return m >= 1 && m <= 12 ? MONTHS[m - 1] : "";
}

/** "Apr 3" — chart axes and tile subtitles. */
export function shortDate(date: IsoDate): string {
  if (!isIsoDate(date)) return "";
  const [, m, d] = date.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${d}`;
}

/** "Fri, Apr 3" — the tooltip's first line, where the weekday is the thing
    that makes a date mean something ("oh, that was the weekend"). */
export function longDate(date: IsoDate): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!isIsoDate(date)) return "";
  const wd = new Date(y, m - 1, d).getDay();
  return `${WEEKDAYS_SHORT[wd]}, ${MONTHS_SHORT[m - 1]} ${d}`;
}

/** "Apr 3 – May 2", collapsing to one date for a single day and carrying the
    years when the range crosses one — "Aug 19 – Aug 18" is a year of data
    wearing the costume of a day. */
export function rangeDates(range: DateRange): string {
  if (range.start === range.end) return shortDate(range.start);
  const sameYear = range.start.slice(0, 4) === range.end.slice(0, 4);
  return sameYear
    ? `${shortDate(range.start)} – ${shortDate(range.end)}`
    : `${shortDate(range.start)} ${range.start.slice(0, 4)} – ${shortDate(range.end)} ${range.end.slice(0, 4)}`;
}

/* ---------- the selected range ---------- */

/** Where the chosen range is remembered. Same `fhj_*_v1` shape as the theme
    keys, and read the same defensive way: a blocked or corrupted store falls
    back to the default rather than throwing on a screen the user asked for. */
export const RANGE_STORAGE_KEY = "fhj_insights_range_v1";

/** 30 days: long enough to have a shape, short enough that a person can
    remember the days in it. */
export const DEFAULT_RANGE: RangeKey = "30D";

export function readRangePreference(): RangeKey {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(RANGE_STORAGE_KEY);
    if (isRangeKey(raw)) return raw;
  } catch {
    /* storage blocked (private mode, embedded frame) — the default still works */
  }
  return DEFAULT_RANGE;
}

export function saveRangePreference(key: RangeKey): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(RANGE_STORAGE_KEY, key);
  } catch {
    /* a choice we can't remember is still a choice we can honour this session */
  }
}

/** The chosen window, resolved against the journal that actually exists. */
export interface RangeSelection {
  key: RangeKey;
  range: DateRange;
  /** The equal-length window immediately before `range`. `null` only when the
      range itself is degenerate. */
  prior: DateRange | null;
  /** "Last 30 days" / "All time". */
  label: string;
  /** "Apr 3 – May 2". */
  dates: string;
  /** Calendar days in the range. */
  days: number;
  /** What this range is compared against, as a sentence fragment: "the
      previous 30 days". Written once here so the change chip, the metric grid
      and the section heading cannot word it three different ways. */
  subject: string;
  /** True when `All` was asked for but the journal is empty, so the range had
      to fall back to a single day. Lets the caller show the empty state rather
      than a confident chart of one blank column. */
  empty: boolean;
}

const RANGE_LABEL: Record<RangeKey, string> = {
  "7D": "Last 7 days",
  "30D": "Last 30 days",
  "90D": "Last 90 days",
  "1Y": "Last 12 months",
  All: "All time",
};

/** Resolve a range key against the journal. `All` spans from the first logged
    day to today; every other key is a fixed window ending today, whether or
    not the journal reaches back that far — "the last 30 days" means thirty
    days, and pretending otherwise would hide exactly the gaps this app exists
    to show. */
export function resolveRange(
  key: RangeKey,
  entries: readonly EntryLike[],
  today: IsoDate = todayIso()
): RangeSelection {
  const bounds = boundsOf(entryDates(entries));
  const resolved =
    rangeFor(key, today, bounds?.start ?? null) ?? { start: today, end: today };
  const days = rangeLength(resolved);
  return {
    key,
    range: resolved,
    prior: priorRange(resolved),
    label: RANGE_LABEL[key],
    dates: rangeDates(resolved),
    days,
    subject: key === "All" ? "the period before" : `the previous ${days} day${days === 1 ? "" : "s"}`,
    empty: key === "All" && !bounds,
  };
}

/* ---------- the pieces a card is made of ---------- */

export type Tone = "good" | "bad" | "neutral";

/** One figure with its name, ready to render. `value` is `null` when there is
    nothing to show, and the component prints the placeholder — the model never
    invents an em-dash-shaped number. */
export interface StatTile {
  id: string;
  label: string;
  value: string | null;
  /** The line under the figure: what it is counted from. */
  sub?: string;
  tone?: Tone;
}

/** A change, stated as movement rather than as cause. `text` never says one
    thing made another happen; `tone` carries whether the movement is welcome,
    which is the only part that needs the metric's direction. */
export interface ChangeLine {
  verdict: ChangeVerdict;
  /** "up" / "down" / "flat" — the arrow to draw. */
  direction: "up" | "down" | "flat";
  /** "0.63", unsigned; the arrow carries the sign. */
  magnitude: string | null;
  /** "0.63 lower than the previous 30 days". */
  text: string;
  tone: Tone;
  /** False when either side was too thin to lean on. */
  reliable: boolean;
}

const toneFor = (verdict: ChangeVerdict): Tone =>
  verdict === "improving" ? "good" : verdict === "worsening" ? "bad" : "neutral";

/** Say what moved, and by how much, without saying why.

    `subject` names what the current period is being compared with — "the
    previous 30 days", "March". Reads as a sentence fragment under a figure. */
export function changeLine(cmp: PeriodComparison, subject: string): ChangeLine {
  const delta = cmp.delta;
  if (delta == null) {
    return {
      verdict: "insufficient",
      direction: "flat",
      magnitude: null,
      text: `Not enough logged in ${subject} to compare`,
      tone: "neutral",
      reliable: false,
    };
  }
  const magnitude = formatAverage(Math.abs(delta)) as string;
  if (cmp.verdict === "steady") {
    return {
      verdict: cmp.verdict,
      direction: "flat",
      magnitude,
      text: `About the same as ${subject}`,
      tone: "neutral",
      reliable: cmp.reliable,
    };
  }
  const direction = delta > 0 ? "up" : "down";
  return {
    verdict: cmp.verdict,
    direction,
    magnitude,
    text: `${magnitude} ${direction === "up" ? "higher" : "lower"} than ${subject}`,
    tone: toneFor(cmp.verdict),
    reliable: cmp.reliable,
  };
}

/** "12 of 30 days logged · 40%". Always rendered, including — especially —
    when it is unflattering: an average over four days and an average over
    thirty are different claims, and the number alone cannot tell them apart. */
export function coverageLine(cov: Coverage): string {
  if (!cov.totalDays) return "No days in this range";
  const pct = percent(cov.ratio);
  return `${cov.loggedDays} of ${cov.totalDays} day${cov.totalDays === 1 ? "" : "s"} logged · ${pct}%`;
}

/** The short version, for a chip beside a headline. */
export const coverageShort = (cov: Coverage): string =>
  `${cov.loggedDays}/${cov.totalDays} days`;

/* ---------- the metric being looked at ---------- */

/** What Insights needs to know about the metric it is drawing. Survey
    questions and derived daily metrics both reduce to this. */
export interface MetricInfo {
  k: string;
  label: string;
  dir: FieldDirection;
  unit?: string;
  /** True for a 1–10 question, which is the default. Weight, steps and the
      derived daily metrics are not on that scale, and bounding them to it
      would quietly drop every reading. */
  scale?: boolean;
}

/** One metric across a range, bounded to 1–10 only when the metric is on that
    scale. The single place the scale question is asked. */
export function metricSeries(
  entries: readonly EntryLike[],
  metric: MetricInfo,
  range: DateRange
): DayPoint[] {
  return metric.scale === false
    ? buildSeries(entries, metric.k, range)
    : buildScaleSeries(entries, metric.k, range);
}

/* ---------- severity colour, decided once ----------

   The four-step ramp the app already paints scores with, expressed as a value
   the typed layer can compute and a test can assert. Components map the step
   to a colour; nothing outside this function decides what "bad" means. */

export type SeverityStep = "good" | "warn" | "alert" | "bad";

/** Which step of the severity ramp a score sits on, by the metric's own
    direction. `null` for a missing value or an unranked metric — a neutral
    metric has no severity, and painting one would invent a judgement. */
export function severityStep(value: number | null, dir: FieldDirection): SeverityStep | null {
  if (value == null || !Number.isFinite(value) || dir === "neutral") return null;
  const bad = dir === "pos" ? 11 - value : value;
  if (bad <= 3) return "good";
  if (bad <= 5) return "warn";
  if (bad <= 7) return "alert";
  return "bad";
}

/* ---------- the range summary (the top of Insights) ---------- */

export interface RangeInsights {
  selection: RangeSelection;
  metric: MetricInfo;
  points: DayPoint[];
  summary: SeriesSummary;
  comparison: PeriodComparison;
  /** The one big number: the range's average, to two decimals. */
  headline: string | null;
  /** What the big number is. "Average over 12 logged days". */
  headlineCaption: string;
  change: ChangeLine;
  coverage: string;
  tiles: StatTile[];
  /** False when the range holds no logged day at all. */
  hasData: boolean;
}

const dayWord = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/** Everything the top of Insights shows for one metric over one range,
    including the comparison with the equal-length period before it. */
export function buildRangeInsights(
  entries: readonly EntryLike[],
  metric: MetricInfo,
  selection: RangeSelection
): RangeInsights {
  const points = metricSeries(entries, metric, selection.range);
  const priorPoints = selection.prior ? metricSeries(entries, metric, selection.prior) : [];
  const comparison = comparePoints(
    points,
    selection.range,
    priorPoints,
    selection.prior ?? selection.range,
    { dir: metric.dir }
  );
  const summary = comparison.current;
  const cov = summary.coverage;
  const dist = distribution(points);
  const tiles: StatTile[] = [
    {
      id: "median",
      label: "Median",
      value: formatAverage(summary.median, summary.median != null && Number.isInteger(summary.median) ? 0 : 1),
      sub: "middle score",
    },
    {
      id: "best",
      label: metric.dir === "pos" ? "Highest" : "Best day",
      value: summary.best != null ? String(summary.best) : null,
      sub: metric.dir === "neutral" ? "not ranked" : "lowest severity",
      tone: "good",
    },
    {
      id: "worst",
      label: metric.dir === "pos" ? "Lowest" : "Hardest day",
      value: summary.worst != null ? String(summary.worst) : null,
      sub: metric.dir === "neutral" ? "not ranked" : "highest severity",
      tone: "bad",
    },
    {
      id: "hard",
      label: "Hard days",
      value: summary.hardDays != null ? String(summary.hardDays) : null,
      sub: summary.hardDays != null ? `of ${dayWord(cov.loggedDays)} logged` : "not ranked",
      tone: summary.hardDays ? "bad" : "neutral",
    },
  ];
  if (metric.dir === "neutral") {
    tiles[1] = { id: "high", label: "Highest", value: summary.max != null ? String(summary.max) : null, sub: "in this range" };
    tiles[2] = { id: "low", label: "Lowest", value: summary.min != null ? String(summary.min) : null, sub: "in this range" };
    tiles[3] = {
      id: "common",
      label: "Most common",
      value: dist.mostCommon != null ? String(dist.mostCommon) : null,
      sub: dist.mostCommon != null ? `${dist.bins[dist.mostCommon - 1]?.days ?? 0} days` : "no days logged",
    };
  }

  return {
    selection,
    metric,
    points,
    summary,
    comparison,
    headline: formatAverage(summary.mean),
    headlineCaption:
      cov.loggedDays > 0
        ? `Average over ${dayWord(cov.loggedDays)} logged`
        : `Nothing logged in these ${dayWord(cov.totalDays)}`,
    change: changeLine(comparison, selection.subject),
    coverage: coverageLine(cov),
    tiles,
    hasData: cov.loggedDays > 0,
  };
}

/* ---------- the monthly summary ---------- */

export interface MonthOption {
  /** `YYYY-MM`. */
  month: string;
  /** "April 2026". */
  label: string;
  /** Days logged for the metric in that month — the selector greys out a
      month with nothing in it rather than hiding it, so a gap stays visible. */
  loggedDays: number;
}

/** Every month from the journal's first entry to the month containing `today`,
    oldest first. Months with nothing logged are included: a year with a hole
    in it is the truth, and a selector that skipped March would quietly close
    the hole up. */
export function monthOptions(
  entries: readonly EntryLike[],
  metricKey: string,
  today: IsoDate = todayIso()
): MonthOption[] {
  const bounds = boundsOf(entryDates(entries));
  if (!bounds) return [];
  const first = monthOf(bounds.start) as DateRange;
  const lastMonth = monthOf(today > bounds.end ? today : bounds.end) as DateRange;
  const out: MonthOption[] = [];
  let cursor = first.start;
  // Guard the loop with a hard bound: 100 years of months is more than any
  // journal, and an unbounded while over date strings is a hang waiting for a
  // corrupted entry.
  for (let i = 0; i < 1200 && cursor <= lastMonth.start; i++) {
    const range = monthOf(cursor) as DateRange;
    const cov = summarize(buildScaleSeries(entries, metricKey, range), range).coverage;
    out.push({ month: monthKey(cursor), label: monthName(monthKey(cursor)), loggedDays: cov.loggedDays });
    cursor = addDays(range.end, 1);
  }
  return out;
}

/** What counts as a hard day, in the metric's own terms. Printed under the
    count so the number is never a bare assertion. */
const SCALE_HARD_COPY: Record<FieldDirection, string> = {
  sym: "scored 7 or above",
  pos: "scored 4 or below",
  neutral: "not ranked",
};

export interface MonthSummary {
  /** `YYYY-MM`. */
  month: string;
  /** "April 2026". */
  label: string;
  range: DateRange;
  points: DayPoint[];
  summary: SeriesSummary;
  /** Against the calendar month before, whatever its length. */
  comparison: PeriodComparison;
  /** "April average 4.37" — or the honest version when nothing was logged. */
  headline: string;
  /** Just the figure, for a large display: "4.37". */
  average: string | null;
  change: ChangeLine;
  coverage: string;
  tiles: StatTile[];
  hasData: boolean;
}

/** One calendar month, summarized the way a person asks about it: what was the
    average, what did a typical day look like, how many days were hard, how
    many days do I actually have — and how does that compare with last month. */
export function buildMonthSummary(
  entries: readonly EntryLike[],
  metric: MetricInfo,
  month: string,
  today: IsoDate = todayIso()
): MonthSummary {
  const key = month.length > 7 ? monthKey(month) : month;
  const [y, m] = key.split("-").map(Number);
  const range = monthRange(y, m) ?? (monthOf(today) as DateRange);
  const prevRange = monthRange(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1) as DateRange;

  const points = metricSeries(entries, metric, range);
  const prevPoints = metricSeries(entries, metric, prevRange);
  const comparison = comparePoints(points, range, prevPoints, prevRange, { dir: metric.dir });
  const summary = comparison.current;
  const cov = summary.coverage;
  const dist = distribution(points);
  const average = formatAverage(summary.mean);
  const label = monthName(key);

  const tiles: StatTile[] = [
    { id: "median", label: "Median", value: summary.median != null ? formatAverage(summary.median, Number.isInteger(summary.median) ? 0 : 1) : null, sub: "middle score" },
    { id: "lowest", label: "Lowest", value: summary.min != null ? String(summary.min) : null, sub: "best score logged" },
    { id: "highest", label: "Highest", value: summary.max != null ? String(summary.max) : null, sub: "hardest score logged" },
    {
      id: "common",
      label: "Most common",
      value: dist.mostCommon != null ? String(dist.mostCommon) : null,
      sub: dist.mostCommon != null ? `${dayWord(dist.bins[dist.mostCommon - 1]?.days ?? 0)}` : "no days logged",
    },
    { id: "logged", label: "Logged days", value: String(cov.loggedDays), sub: `of ${cov.totalDays} in ${monthNameShort(key)}` },
    {
      id: "hard",
      label: "Hard days",
      value: summary.hardDays != null ? String(summary.hardDays) : null,
      sub: metric.dir === "neutral" ? "not ranked" : `${SCALE_HARD_COPY[metric.dir]}`,
      tone: summary.hardDays ? "bad" : "neutral",
    },
  ];

  return {
    month: key,
    label,
    range,
    points,
    summary,
    comparison,
    headline: average
      ? `${monthNameShort(key)} average ${average}`
      : `Nothing logged in ${monthNameShort(key)}`,
    average,
    change: changeLine(comparison, monthNameShort(monthKey(prevRange.start))),
    coverage: coverageLine(cov),
    tiles,
    hasData: cov.loggedDays > 0,
  };
}

/* ---------- the trend chart's rows ---------- */

export interface TrendRow {
  date: IsoDate;
  /** The day's own value — `null` on a day nobody logged, which the chart
      draws as a gap rather than joining across. */
  value: number | null;
  rolling7: number | null;
  rolling30: number | null;
  /** "Apr 3", for the axis. */
  label: string;
  /** "Fri, Apr 3", for the tooltip. */
  longLabel: string;
  /** The day's note, if it wrote one. Shown in the tooltip because "why was
      that day an 8" is usually answered right there. */
  note?: string;
}

/** The dense per-day rows the trend chart reads: value, both rolling
    averages, labels, and the day's note. */
export function buildTrendRows(
  entries: readonly EntryLike[],
  metric: MetricInfo,
  range: DateRange
): TrendRow[] {
  const notes = new Map<string, string>();
  for (const e of entries as readonly (EntryLike & { notes?: string })[]) {
    if (!e || !isIsoDate(e.date)) continue;
    const note = typeof e.notes === "string" ? e.notes.trim() : "";
    if (note) notes.set(e.date, note);
  }
  return trendSeries(metricSeries(entries, metric, range)).map((p) => {
    const note = notes.get(p.date);
    return {
      date: p.date,
      value: p.value,
      rolling7: p.rolling7,
      rolling30: p.rolling30,
      label: shortDate(p.date),
      longLabel: longDate(p.date),
      ...(note ? { note } : {}),
    };
  });
}

/** A sentence a screen reader can hear instead of the chart. Same figures the
    chart draws, in the order a person would say them. */
export function describeTrend(rows: readonly TrendRow[], metric: MetricInfo): string {
  const points: DayPoint[] = rows.map((r) => ({ date: r.date, value: r.value }));
  const s = summarize(points, { start: rows[0]?.date ?? "", end: rows[rows.length - 1]?.date ?? "" }, metric.dir);
  if (!s.coverage.loggedDays) return `${metric.label}: nothing logged in this range.`;
  const parts = [
    `${metric.label} from ${shortDate(rows[0].date)} to ${shortDate(rows[rows.length - 1].date)}:`,
    `${s.coverage.loggedDays} of ${s.coverage.totalDays} days logged,`,
    `average ${formatAverage(s.mean)},`,
    `lowest ${s.min}, highest ${s.max}.`,
  ];
  const last = rows[rows.length - 1];
  if (last.rolling7 != null) parts.push(`Latest 7-day average ${formatAverage(last.rolling7)}.`);
  return parts.join(" ");
}

/* ---------- bucketed averages (the bars under the chart) ---------- */

export type BucketMode = "week" | "month";

export interface Bucket {
  /** First day of the bucket. */
  start: IsoDate;
  end: IsoDate;
  /** "Apr 3" for a week, "Apr" for a month. */
  label: string;
  /** The bucket's average, or `null` when nothing in it was logged — the bar
      is then absent rather than sitting on the floor at zero. */
  value: number | null;
  loggedDays: number;
  totalDays: number;
}

/** Which bucket size a range deserves. Weeks stay readable up to about a
    quarter; past that the bars are thinner than the gaps between them and a
    month is the honest unit. */
export const bucketModeFor = (key: RangeKey): BucketMode =>
  key === "1Y" || key === "All" ? "month" : "week";

/** Averages bucketed by week or month across a series. Buckets with nothing
    logged are kept, carrying `null`, so a quiet fortnight reads as a gap
    rather than as two weeks that never existed. */
export function bucketAverages(points: readonly DayPoint[], mode: BucketMode): Bucket[] {
  if (!points.length) return [];
  if (mode === "month") {
    return monthlyBreakdown(points).map((m) => ({
      start: m.range.start,
      end: m.range.end,
      label: MONTHS_SHORT[Number(m.month.split("-")[1]) - 1] ?? m.month,
      value: m.summary.mean,
      loggedDays: m.summary.coverage.loggedDays,
      totalDays: m.summary.coverage.totalDays,
    }));
  }
  /* Weeks are counted back from the newest day rather than from a Monday: the
     last bar has to be "the week just gone", or the most recent figure on the
     screen is a partial week that looks like a drop. */
  const out: Bucket[] = [];
  for (let end = points.length - 1; end >= 0; end -= 7) {
    const slice = points.slice(Math.max(0, end - 6), end + 1);
    const s = summarize(slice, { start: slice[0].date, end: slice[slice.length - 1].date });
    out.unshift({
      start: slice[0].date,
      end: slice[slice.length - 1].date,
      label: shortDate(slice[0].date),
      value: s.mean,
      loggedDays: s.coverage.loggedDays,
      totalDays: s.coverage.totalDays,
    });
  }
  return out;
}

/** The bars under the trend chart: weekly averages for a short range, monthly
    ones for a long one, bucketed from the same series the chart draws. */
export function buildBuckets(
  entries: readonly EntryLike[],
  metric: MetricInfo,
  selection: RangeSelection
): Bucket[] {
  return bucketAverages(metricSeries(entries, metric, selection.range), bucketModeFor(selection.key));
}

/* ---------- comparison tiles for the other tracked metrics ---------- */

export interface MetricChange {
  metric: MetricInfo;
  summary: SeriesSummary;
  comparison: PeriodComparison;
  /** The range's average, two decimals. */
  value: string | null;
  change: ChangeLine;
  coverage: string;
}

/** Each dashboard metric over the selected range, with its own comparison
    against the equal-length period before. Metrics with nothing logged in the
    range are kept — a card that says "nothing logged" is more useful than a
    card that quietly vanished. */
export function buildMetricChanges(
  entries: readonly EntryLike[],
  metrics: readonly MetricInfo[],
  selection: RangeSelection
): MetricChange[] {
  return metrics.map((metric) => {
    const points = metricSeries(entries, metric, selection.range);
    const prior = selection.prior ? metricSeries(entries, metric, selection.prior) : [];
    const comparison = comparePoints(
      points, selection.range, prior, selection.prior ?? selection.range, { dir: metric.dir }
    );
    return {
      metric,
      summary: comparison.current,
      comparison,
      value: formatAverage(comparison.current.mean),
      change: changeLine(comparison, selection.subject),
      coverage: coverageLine(comparison.current.coverage),
    };
  });
}

/* Re-exported so a component needs one import, not two, for the common case. */
export { formatAverage, formatDelta, round, hardDayCount, eachDay };
export type { DateRange, DayPoint, RangeKey, SeriesSummary, PeriodComparison, Coverage, EntryLike };
