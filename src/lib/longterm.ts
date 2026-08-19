/* The long view: months, years, and seasons.

   Thirty days answers "how is this week". Twelve months answers "how is this
   year". Neither answers the question somebody asks in their third winter with
   a condition: *is this actually getting better, or does it just feel that way
   in July?*

   So this reduces the whole journal to one number per calendar month and then
   asks four things of that series: how does this year sit against last, which
   month was the best and which the worst, how long was the longest stretch
   where nothing went wrong, and does a particular month of the year keep
   showing up badly.

   The last one is the reason `MIN_YEARS_FOR_SEASON` exists. A "seasonal
   average" built from one January is just January, and presenting it as a
   pattern would be inventing a finding out of a single data point. Everything
   here that could mislead has a floor under it, and the floors are exported so
   the UI can say *why* something is hidden instead of just hiding it. */

export type Direction = "sym" | "pos" | "neutral" | undefined;

/** Below this many logged days, a month's average is not worth printing next to
    another month's. Roughly a fifth of a month. */
export const MIN_DAYS_PER_MONTH = 6;
/** A month-versus-same-month-last-year needs both sides to clear the floor. */
export const MIN_YEARS_FOR_SEASON = 2;

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const pad2 = (n: number) => String(n).padStart(2, "0");

const bad = (v: number, dir: Direction) => (dir === "pos" ? 11 - v : v);
const avg = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export interface Entryish {
  date: string;
  answers?: Record<string, unknown>;
}

export interface MonthPoint {
  /** "2026-03". */
  key: string;
  year: number;
  /** 0–11. */
  month: number;
  label: string;
  full: string;
  /** Days in that month carrying a score. */
  logged: number;
  average: number | null;
  best: number | null;
  worst: number | null;
  /** Whether `average` clears MIN_DAYS_PER_MONTH and can be compared. */
  solid: boolean;
}

/** One point per calendar month from the first logged day to the last, gaps
    included. The gaps matter: a year with a three-month hole in it should not
    draw as a continuous line. */
export function monthlyAverages(
  entries: Entryish[], key: string, dir?: Direction
): MonthPoint[] {
  const buckets = new Map<string, number[]>();
  let lo = "", hi = "";
  for (const e of entries) {
    if (!e || typeof e.date !== "string") continue;
    const v = e.answers?.[key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const k = e.date.slice(0, 7);
    if (!lo || e.date < lo) lo = e.date;
    if (!hi || e.date > hi) hi = e.date;
    const list = buckets.get(k);
    if (list) list.push(v); else buckets.set(k, [v]);
  }
  if (!lo) return [];

  const out: MonthPoint[] = [];
  let y = Number(lo.slice(0, 4)), m = Number(lo.slice(5, 7)) - 1;
  const endY = Number(hi.slice(0, 4)), endM = Number(hi.slice(5, 7)) - 1;
  while (y < endY || (y === endY && m <= endM)) {
    const k = `${y}-${pad2(m + 1)}`;
    const vs = buckets.get(k) || [];
    const byBad = [...vs].sort((a, b) => bad(a, dir) - bad(b, dir));
    out.push({
      key: k, year: y, month: m,
      label: MONTH_SHORT[m], full: `${MONTH_FULL[m]} ${y}`,
      logged: vs.length,
      average: avg(vs),
      best: byBad[0] ?? null,
      worst: byBad[byBad.length - 1] ?? null,
      solid: vs.length >= MIN_DAYS_PER_MONTH,
    });
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return out;
}

/* ---------- year over year ---------- */

export interface YearLine {
  year: number;
  /** Twelve slots, January first; null where that month has too little in it
      to plot honestly. */
  points: (number | null)[];
  /** Months in this year that cleared the floor. */
  solidMonths: number;
}

/** One line per calendar year, all twelve months wide, for overlaying. */
export function yearLines(months: MonthPoint[]): YearLine[] {
  const years = new Map<number, YearLine>();
  for (const p of months) {
    let line = years.get(p.year);
    if (!line) {
      line = { year: p.year, points: new Array(12).fill(null), solidMonths: 0 };
      years.set(p.year, line);
    }
    if (p.solid && p.average != null) {
      line.points[p.month] = Math.round(p.average * 10) / 10;
      line.solidMonths += 1;
    }
  }
  return [...years.values()].sort((a, b) => a.year - b.year);
}

export interface SameMonthCompare {
  now: MonthPoint | null;
  prev: MonthPoint | null;
  /** now − prev, in raw score points. */
  delta: number | null;
  /** True when the change is an improvement in this metric's direction. */
  improving: boolean | null;
  /** Both sides cleared MIN_DAYS_PER_MONTH. When false the UI must not show a
      comparison at all — a 3-day month against a 28-day month is noise wearing
      the costume of a finding. */
  enough: boolean;
}

/** This month against the same month a year ago. */
export function sameMonthLastYear(
  months: MonthPoint[], today: string, dir?: Direction
): SameMonthCompare {
  const k = today.slice(0, 7);
  const y = Number(k.slice(0, 4)), m = k.slice(5, 7);
  const now = months.find((p) => p.key === k) || null;
  const prev = months.find((p) => p.key === `${y - 1}-${m}`) || null;
  const enough = !!(now?.solid && prev?.solid);
  const delta = now?.average != null && prev?.average != null
    ? now.average - prev.average : null;
  return {
    now, prev, delta, enough,
    improving: delta == null || dir === "neutral" ? null
      : dir === "pos" ? delta > 0 : delta < 0,
  };
}

/** The kindest and the worst month on record, ignoring thin ones. */
export function extremeMonths(
  months: MonthPoint[], dir?: Direction
): { best: MonthPoint | null; worst: MonthPoint | null } {
  let best: MonthPoint | null = null, worst: MonthPoint | null = null;
  for (const p of months) {
    if (!p.solid || p.average == null) continue;
    if (!best || bad(p.average, dir) < bad(best.average!, dir)) best = p;
    if (!worst || bad(p.average, dir) > bad(worst.average!, dir)) worst = p;
  }
  return { best, worst };
}

/* ---------- the good stretch ---------- */

export interface StableRun {
  start: string;
  end: string;
  days: number;
  average: number | null;
}

/** The longest unbroken run of logged days that all stayed in the calm band.

    Unbroken means unbroken: an unlogged day ends the run rather than extending
    it, because "I did not write anything down" is not evidence of a good day.
    That makes this a conservative number, which is the right way for it to be
    wrong — it is a thing the app tells you went *well*. */
export function longestStableRun(
  entries: Entryish[], key: string, dir?: Direction, calmAt = 4
): StableRun | null {
  const rows = entries
    .filter((e) => typeof e?.answers?.[key] === "number")
    .map((e) => ({ date: e.date, v: e.answers![key] as number }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  let best: StableRun | null = null;
  let runStart: string | null = null, runEnd = "", vals: number[] = [];

  const close = () => {
    if (runStart && (!best || vals.length > best.days)) {
      best = { start: runStart, end: runEnd, days: vals.length, average: avg(vals) };
    }
    runStart = null; vals = [];
  };

  const dayAfter = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    const n = new Date(y, m - 1, dd + 1);
    return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
  };

  for (const r of rows) {
    const calm = bad(r.v, dir) <= calmAt;
    const contiguous = runStart != null && r.date === dayAfter(runEnd);
    if (calm && contiguous) { runEnd = r.date; vals.push(r.v); continue; }
    close();
    if (calm) { runStart = r.date; runEnd = r.date; vals = [r.v]; }
  }
  close();
  return best;
}

/* ---------- seasons ---------- */

export interface SeasonPoint {
  /** 0–11. */
  month: number;
  label: string;
  average: number | null;
  /** How many separate years contributed. Below MIN_YEARS_FOR_SEASON this is
      one year wearing the word "seasonal", and the UI must say so. */
  years: number;
  logged: number;
}

/** Each month of the year, averaged across every year on record. */
export function seasonalAverages(months: MonthPoint[]): SeasonPoint[] {
  return MONTH_SHORT.map((label, month) => {
    const rows = months.filter((p) => p.month === month && p.solid && p.average != null);
    return {
      month, label,
      average: avg(rows.map((p) => p.average!)),
      years: new Set(rows.map((p) => p.year)).size,
      logged: rows.reduce((a, p) => a + p.logged, 0),
    };
  });
}

/** Whether the seasonal card has enough behind it to be shown at all. */
export const seasonsWorthShowing = (season: SeasonPoint[]): boolean =>
  season.filter((s) => s.years >= MIN_YEARS_FOR_SEASON).length >= 6;

/** How much history there is, in words, for the section header. */
export function historySpan(months: MonthPoint[]): string {
  const solid = months.filter((p) => p.logged > 0);
  if (!solid.length) return "";
  const a = solid[0], b = solid[solid.length - 1];
  return a.key === b.key ? a.full : `${a.full} – ${b.full}`;
}
