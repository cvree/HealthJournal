/* Twelve months of one metric, as a block the eye can take in at once.

   The trend chart answers "what happened lately" over thirty days. Nothing in
   the app answered "what did this year look like" — and that is the question
   somebody brings to an appointment, or asks themselves in a bad week when the
   last month is the least representative month there is.

   The shape is one row per month, one square per day-of-month. That is not the
   usual contribution-graph layout (weeks as columns, weekdays as rows), and the
   reason is arithmetic: a phone gives a card about 330px of width, so 53 week
   columns leave 5px per day — unreadable and untappable — while 31 day columns
   leave about 9px, the largest square a full year can have on this screen. It
   also happens to be the layout people already own: "each row is a month" needs
   no key. Weekday alignment is what it costs, and the month Calendar screen is
   where weekday questions belong anyway.

   Everything here is pure and date-string based (YYYY-MM-DD, local), so the
   grid, the colour ramp and the month summaries can be tested without a DOM and
   without a clock. */

import { localDate } from "./tracking";

/** Which way "good" points. Mirrors FieldDirection in ../types/models. */
export type HeatDirection = "sym" | "pos" | "neutral" | undefined;

export interface HeatDay {
  /** YYYY-MM-DD, local. */
  date: string;
  /** 1–31. */
  day: number;
  /** The metric's value for this day, or null when it has none. */
  value: number | null;
  /** The day has an entry at all — which is a different thing from having a
      value for *this* metric, and the grid draws the two differently. */
  logged: boolean;
  /** Later than the last day of the range. Drawn as nothing, never tappable. */
  future: boolean;
}

export interface HeatMonth {
  /** "2026-03" — stable React key and sort key. */
  key: string;
  year: number;
  /** 0–11, as Date uses. */
  month: number;
  /** "Mar" — the row label. */
  label: string;
  /** "March 2026" — the accessible name and the fallback table's row header. */
  full: string;
  /** Exactly 31 slots so every row lines up by day-of-month; the tail of a
      short month is null rather than a zero-width cell. */
  days: (HeatDay | null)[];
}

export interface HeatExtreme {
  date: string;
  value: number;
}

export interface HeatMonthSummary {
  key: string;
  label: string;
  full: string;
  year: number;
  /** Days of this month inside the range and not in the future. */
  days: number;
  /** Of those, how many carry a value for this metric. */
  logged: number;
  average: number | null;
  best: HeatExtreme | null;
  hardest: HeatExtreme | null;
}

export interface HeatSummary {
  days: number;
  logged: number;
  /** logged / days, 0–1. Zero when the range is empty. */
  coverage: number;
  average: number | null;
  best: HeatExtreme | null;
  hardest: HeatExtreme | null;
  /** Chronological, one per row of the grid. */
  months: HeatMonthSummary[];
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Days in a month. `month` is 0-based. */
export const daysInMonth = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate();

/** The `count` calendar months ending with the one `today` falls in, oldest
    first. Reading the grid top to bottom is then reading time forwards. */
export function monthsEnding(today: string, count = 12): { year: number; month: number }[] {
  const [y, m] = today.split("-").map(Number);
  const out: { year: number; month: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return out;
}

export interface HeatmapInput {
  /** Last day of the range, YYYY-MM-DD. Defaults to the local today. */
  today?: string;
  /** How many month rows. Twelve is the point of the thing. */
  months?: number;
  /** The metric's value on a date, or null. */
  valueOn: (date: string) => number | null;
  /** Whether the journal has an entry for that date at all. */
  loggedOn?: (date: string) => boolean;
}

/** The grid. One row per month, 31 day-of-month slots per row. */
export function buildHeatmap(input: HeatmapInput): HeatMonth[] {
  const today = input.today || localDate();
  const loggedOn = input.loggedOn || (() => false);
  return monthsEnding(today, input.months ?? 12).map(({ year, month }) => {
    const n = daysInMonth(year, month);
    const days: (HeatDay | null)[] = [];
    for (let d = 1; d <= 31; d++) {
      if (d > n) { days.push(null); continue; }
      const date = `${year}-${pad2(month + 1)}-${pad2(d)}`;
      const future = date > today;
      const value = future ? null : input.valueOn(date);
      days.push({
        date,
        day: d,
        value: typeof value === "number" && Number.isFinite(value) ? value : null,
        logged: future ? false : !!loggedOn(date),
        future,
      });
    }
    return {
      key: `${year}-${pad2(month + 1)}`,
      year,
      month,
      label: MONTH_SHORT[month],
      full: `${MONTH_FULL[month]} ${year}`,
      days,
    };
  });
}

/** Is `a` a better score than `b` for this metric? "Better" is the whole reason
    direction exists: a 2 is a good day for a symptom and a poor one for sleep. */
const better = (a: number, b: number, dir: HeatDirection) =>
  dir === "pos" ? a > b : a < b;

/** Counts, averages and extremes — for the summary line, and for the
    month-by-month list that stands in for the grid when colour is not an
    option. Pure over the grid, so the two can never disagree. */
export function heatSummary(months: HeatMonth[], dir: HeatDirection): HeatSummary {
  let days = 0, logged = 0, total = 0;
  let best: HeatExtreme | null = null, hardest: HeatExtreme | null = null;
  const rows: HeatMonthSummary[] = months.map((m) => {
    let mDays = 0, mLogged = 0, mTotal = 0;
    let mBest: HeatExtreme | null = null, mHardest: HeatExtreme | null = null;
    for (const d of m.days) {
      if (!d || d.future) continue;
      mDays += 1;
      if (d.value == null) continue;
      mLogged += 1;
      mTotal += d.value;
      const hit = { date: d.date, value: d.value };
      if (!mBest || better(d.value, mBest.value, dir)) mBest = hit;
      if (!mHardest || better(mHardest.value, d.value, dir)) mHardest = hit;
    }
    days += mDays; logged += mLogged; total += mTotal;
    if (mBest && (!best || better(mBest.value, best.value, dir))) best = mBest;
    if (mHardest && (!hardest || better(hardest.value, mHardest.value, dir))) hardest = mHardest;
    return {
      key: m.key, label: m.label, full: m.full, year: m.year,
      days: mDays, logged: mLogged,
      average: mLogged ? mTotal / mLogged : null,
      best: mBest, hardest: mHardest,
    };
  });
  return {
    days, logged,
    coverage: days ? logged / days : 0,
    average: logged ? total / logged : null,
    best, hardest,
    months: rows,
  };
}

/* ---------- colour ---------- */

const hex = (s: string): [number, number, number] => {
  const h = s.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
};

/** Blend two hex colours. `t` 0 returns `a`, 1 returns `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const k = Math.min(1, Math.max(0, t));
  const [r1, g1, b1] = hex(a), [r2, g2, b2] = hex(b);
  const ch = (x: number, y: number) =>
    Math.round(x + (y - x) * k).toString(16).padStart(2, "0");
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`.toUpperCase();
}

/** Spread anchor colours evenly over `steps` shades, ends included. */
export function rampBetween(anchors: string[], steps = 10): string[] {
  if (anchors.length === 0) return [];
  if (anchors.length === 1) return Array.from({ length: steps }, () => anchors[0]);
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : (i / (steps - 1)) * (anchors.length - 1);
    const lo = Math.min(anchors.length - 2, Math.floor(t));
    out.push(mixHex(anchors[lo], anchors[lo + 1], t - lo));
  }
  return out;
}

/** The four severity colours the rest of the app already uses, plus the accent
    for metrics that have no better or worse. Passed in rather than imported so
    the ramp is pure, and so a test can assert on colours it chose itself. */
export interface HeatTokens {
  good: string; warn: string; alert: string; bad: string;
  accent: string; faint: string;
}

/** Ten shades, index 0 = a score of 1, index 9 = a score of 10.

    Ten, not the app's usual four buckets: at four steps a 3 and a 5 are the
    same square, which is exactly the distinction a year view exists to show.
    The four bucket colours stay the anchors, so a red day here is the same red
    the dashboard used this morning. */
export function heatRamp(dir: HeatDirection, t: HeatTokens): string[] {
  if (dir === "neutral") return rampBetween([mixHex(t.faint, t.accent, 0.25), t.accent], 10);
  const severe = [t.good, t.warn, t.alert, t.bad];
  return rampBetween(dir === "pos" ? [...severe].reverse() : severe, 10);
}

/** The shade for one score. Anything outside 1–10 is clamped rather than
    dropped: a 0 or an 11 from an older journal should still draw. */
export function heatColor(value: number | null | undefined, ramp: string[]): string | null {
  if (value == null || !Number.isFinite(value) || !ramp.length) return null;
  const i = Math.min(ramp.length - 1, Math.max(0, Math.round(value) - 1));
  return ramp[i];
}

/* ---------- words ---------- */

/** What the two ends of the legend mean, in this metric's direction. Said in
    the user's terms ("mild"/"severe"), never "low"/"high", which asks the
    reader to hold the direction in their head. */
export function heatLegendEnds(dir: HeatDirection): { low: string; high: string } {
  if (dir === "pos") return { low: "1 · poor", high: "10 · great" };
  if (dir === "neutral") return { low: "1 · low", high: "10 · high" };
  return { low: "1 · mild", high: "10 · severe" };
}

/** "best"/"hardest" only make sense when there is a direction. */
export const heatExtremeLabels = (dir: HeatDirection): { best: string; hardest: string } =>
  dir === "neutral"
    ? { best: "Lowest", hardest: "Highest" }
    : { best: "Best", hardest: "Hardest" };
