/* How often this journal asks.

   Every screen in this app was built on one unexamined assumption: that the
   check-in happens *every day*. The ring counts today. The streak counts
   consecutive dates. The queue offers every question in the setup, today. The
   reminder fires at eight, today. The word "daily" is in the name of half the
   modules here.

   For a lot of people that is right, and it is why it is still the default.
   For a lot of other people it is the reason the journal is empty.

   Somebody tracking a slow-moving thing — a supplement they want six months of
   evidence about, a skin condition that changes over weeks, a weight they have
   no intention of standing on a scale for every morning — does not need a daily
   check-in. They need a *weekly* one. Asked to do it daily, they do it for
   eleven days, miss one, watch a streak counter reset to zero, and stop. The
   app told them they had failed at something they were never trying to do.

   So the frequency is theirs to choose, and this module owns what that choice
   means everywhere it lands.

   ---

   **The period is the unit, not the day.**

   This is the decision the whole module rests on, and the one that is easy to
   get wrong. The naive implementation of "once a week" picks a weekday and asks
   on it: your check-in is Monday, and if you miss Monday you have missed the
   week. That is a worse deal than daily, not a gentler one — it takes the one
   chance you had and puts it on the day you were busiest.

   The honest reading of "once a week" is that **the week owes one check-in**.
   Do it Monday, do it Saturday night, it is the same week and the same
   fulfilled promise. So a cadence describes a period — a day, a week, a
   fortnight, a month — and how many check-ins that period wants, and every
   number this module produces is counted in periods.

   Which means:

   - **Due** is a question about the period, not the date. Nothing is late
     until the period it belonged to is over.
   - **A streak is a run of periods**, so a weekly journaler has a 30-week
     streak rather than the permanent "no streak yet" the daily counter gives
     them. This is not a cosmetic fix. It is the difference between the app
     recognising what somebody is doing and quietly scoring them against a
     schedule they explicitly turned off.
   - **The current period never breaks a streak.** It is not over yet. A
     counter that goes to zero at midnight on a Monday because the week's
     check-in has not happened *by Monday* has misunderstood the whole idea.

   Named weekdays still exist — somebody who wants Monday, Wednesday and Friday
   should get Monday, Wednesday and Friday — but they name where the *nudges*
   land and how many the week wants. They never make a Tuesday check-in count
   for nothing.

   **Pausing is a first-class answer.** People go on holiday, into hospital,
   through a fortnight where the journal is the last thing that matters. Every
   long-running tracker dies in one of those fortnights, because coming back to
   a broken streak and a wall of red feels like starting over. So a pause is a
   thing you can set, periods inside it are neither owed nor missed, and the
   streak steps over them rather than resetting.

   **Nothing here scores a person.** A cadence is a plan somebody made, and this
   module's only job is to hold the app to it — never to hold the person to it.
   There is no "adherence" grade shown to anybody, no compliance percentage, no
   red. `adherence()` exists because an export bound for a clinician should be
   able to say "this is a weekly journal and here are 22 of the last 24 weeks",
   which is context for reading the data, not a mark out of ten.

   Everything in this file is pure. */

import { addDays, daySpan } from "./episodes";

/* ---------- the shape ---------- */

/** The length of one period — the unit everything here is counted in. */
export type CadenceUnit = "day" | "week" | "month";

/**
 * How often a journal, or one question in it, asks.
 *
 * Read it as a sentence: *every `n` `unit`s, `times` times, on `days`.*
 * "Every 1 week, 1 time, on no particular day" is once a week. "Every 2 days,
 * 1 time" is every other day. "Every 1 week, on Mon/Wed/Fri" is three times a
 * week with the days named.
 */
export interface Cadence {
  unit: CadenceUnit;
  /** Periods between asks. 1 = every period. Always at least 1. */
  n: number;
  /** How many check-ins the period wants, when no particular days are named.
      Ignored — and derived from `days` — when days are named. */
  times: number;
  /** Weekdays the asks land on, 0 = Sunday. Empty means any day of the period,
      which is the point of the period model. Only meaningful on a one-week
      cadence; sanitising drops them anywhere else, because "every other week
      on a Tuesday" and "every 2 weeks" are the same sentence with more rope. */
  days: number[];
  /** No schedule at all. Nothing is ever due, nothing is ever missed, and the
      streak counts logged days because there is no period to count. For the
      people — and there are plenty — who want the journal there when they need
      it and silent when they don't. */
  manual?: boolean;
  /** The date the period grid counts from. Only matters when `n` > 1: without
      it, "every other day" has no way to know which days. Defaults to the
      journal's own beginning, and is set once and left alone. */
  anchor?: string;
  /** A stretch with nothing owed in it. See the note above about the fortnight
      that kills a tracker. */
  pause?: CadencePause;
}

/** Time off, on purpose. `to` absent means it runs until it is cleared, which
    is the right shape for "I don't know when I'm back". */
export interface CadencePause {
  from: string;
  to?: string;
  /** In the person's own words: "hospital", "away". Shown, never parsed. */
  note?: string;
}

export const DEFAULT_CADENCE: Cadence = { unit: "day", n: 1, times: 1, days: [] };

/** Weeks run Monday to Sunday. Not a preference — a period called "a week"
    has to be the same week for the person and the app, and every calendar
    they'll cross-check against draws the working week that way. */
const WEEK_START = 1;

const pad2 = (n: number) => String(n).padStart(2, "0");
const clampInt = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = typeof v === "number" ? Math.round(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

const isDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** 0 = Sunday. Parsed as a local date deliberately — `new Date("2026-08-23")`
    is UTC midnight and lands a day early for anybody west of London. */
export function weekdayOf(date: string): number {
  const [y, m, d] = String(date).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getDay();
}

/**
 * Coerce anything into a usable cadence.
 *
 * Same contract as `sanitizeCustomField`: a hand-edited backup, an older
 * schema or a bad import degrades to something that still runs, and the
 * degradation is always toward *asking more often* rather than less. An app
 * that silently decides it is a monthly journal because a number was a string
 * has stopped being the thing somebody set up.
 */
export function sanitizeCadence(raw: unknown): Cadence {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_CADENCE };
  const r = raw as Record<string, unknown>;

  if (r.manual === true) {
    const out: Cadence = { ...DEFAULT_CADENCE, manual: true };
    const pause = sanitizePause(r.pause);
    if (pause) out.pause = pause;
    return out;
  }

  const unit: CadenceUnit =
    r.unit === "week" || r.unit === "month" ? r.unit : "day";
  const n = clampInt(r.n, 1, unit === "day" ? 60 : 12, 1);

  /* Named days are a one-week idea. On anything else they are either
     meaningless (a month) or a second way of saying the same thing (a
     fortnight), and two ways of saying it is how the label and the arithmetic
     drift apart. */
  const days =
    unit === "week" && n === 1 && Array.isArray(r.days)
      ? [...new Set(
          (r.days as unknown[])
            .map((d) => (typeof d === "number" ? Math.round(d) : NaN))
            .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        )].sort((a, b) => a - b)
      : [];

  /* A period cannot want more check-ins than it has days in it. Seven is the
     cap on a week either way, and a day-period always wants exactly one —
     "twice a day" is a different feature (it is the log, not the check-in). */
  const maxTimes = unit === "day" ? 1 : unit === "week" ? 7 * n : 28 * n;
  const times = days.length ? days.length : clampInt(r.times, 1, maxTimes, 1);

  const out: Cadence = { unit, n, times, days };
  if (isDate(r.anchor)) out.anchor = r.anchor;
  const pause = sanitizePause(r.pause);
  if (pause) out.pause = pause;
  return out;
}

function sanitizePause(raw: unknown): CadencePause | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (!isDate(r.from)) return undefined;
  const out: CadencePause = { from: r.from };
  if (isDate(r.to) && r.to >= r.from) out.to = r.to;
  if (typeof r.note === "string" && r.note.trim()) out.note = r.note.trim();
  return out;
}

/** Same cadence, expressed the same way — for "have they actually changed it". */
export const sameCadence = (a: Cadence, b: Cadence): boolean =>
  a.manual === b.manual &&
  a.unit === b.unit && a.n === b.n && a.times === b.times &&
  a.days.length === b.days.length && a.days.every((d, i) => d === b.days[i]);

/* ---------- periods ----------

   Everything below counts in these. A period is a half-open stretch of dates
   named by its first day, and the whole grid is derived rather than stored, so
   changing the cadence never has to migrate anything: yesterday's entries sit
   in whatever periods today's cadence puts them in. */

/** The Monday of the week `date` falls in. */
function weekStartOf(date: string): string {
  const wd = weekdayOf(date);
  return addDays(date, -((wd - WEEK_START + 7) % 7));
}

const monthStartOf = (date: string): string => `${date.slice(0, 7)}-01`;

/** Whole calendar months from `a` to `b`. */
function monthSpan(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, d);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/** Where the grid counts from. An unanchored cadence lines up with the
    calendar, which is what somebody who never set an anchor expects: "every
    other week" starting on a week boundary, not on whichever Thursday the code
    happened to run. */
const anchorOf = (c: Cadence): string => c.anchor || "2000-01-03"; // a Monday, 1st of the month-ish grid

/** The first day of the period `date` falls in. */
export function periodStart(c: Cadence, date: string): string {
  if (c.manual) return date;
  const a = anchorOf(c);
  if (c.unit === "day") {
    if (c.n === 1) return date;
    const off = daySpan(a, date) - 1;
    return addDays(a, Math.floor(off / c.n) * c.n);
  }
  if (c.unit === "week") {
    const ws = weekStartOf(date);
    if (c.n === 1) return ws;
    const aw = weekStartOf(a);
    const weeks = Math.floor((daySpan(aw, ws) - 1) / 7);
    return addDays(aw, Math.floor(weeks / c.n) * c.n * 7);
  }
  const ms = monthStartOf(date);
  if (c.n === 1) return ms;
  const am = monthStartOf(a);
  const months = monthSpan(am, ms);
  return addMonths(am, Math.floor(months / c.n) * c.n);
}

/** The last day of the period `date` falls in. Inclusive. */
export function periodEnd(c: Cadence, date: string): string {
  if (c.manual) return date;
  const s = periodStart(c, date);
  if (c.unit === "day") return addDays(s, c.n - 1);
  if (c.unit === "week") return addDays(s, c.n * 7 - 1);
  return addDays(addMonths(s, c.n), -1);
}

/** The period after this one. */
export const nextPeriod = (c: Cadence, date: string): string =>
  addDays(periodEnd(c, date), 1);

/** The period before this one. */
export const prevPeriod = (c: Cadence, date: string): string =>
  addDays(periodStart(c, date), -1);

/** A stable id for the period — the key everything memoises and groups on. */
export const periodKey = (c: Cadence, date: string): string =>
  c.manual ? date : `${c.unit}${c.n}:${periodStart(c, date)}`;

/** Every date in the period, which is what a catch-up list is made of. */
export function periodDates(c: Cadence, date: string): string[] {
  const out: string[] = [];
  const end = periodEnd(c, date);
  for (let d = periodStart(c, date); d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/* ---------- pausing ---------- */

export function isPaused(c: Cadence, date: string): boolean {
  const p = c.pause;
  if (!p) return false;
  return date >= p.from && (!p.to || date <= p.to);
}

/** A period is paused when the pause covers the whole of it. A week with two
    days of holiday in it still owed a check-in on the other five. */
export function periodPaused(c: Cadence, date: string): boolean {
  if (!c.pause) return false;
  return isPaused(c, periodStart(c, date)) && isPaused(c, periodEnd(c, date));
}

export const pauseLine = (p: CadencePause | undefined): string | null => {
  if (!p) return null;
  const note = p.note ? `${p.note} — ` : "";
  return p.to ? `${note}paused until ${prettyDate(p.to)}` : `${note}paused`;
};

/* ---------- naming ---------- */

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_PLURAL = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const TIMES_WORD = ["", "Once", "Twice", "Three times", "Four times", "Five times", "Six times", "Seven times"];

function prettyDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  try {
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch {
    return date;
  }
}

/** "Mon, Wed & Fri" — the list with the last comma spoken rather than printed. */
function joinDays(days: number[]): string {
  const names = days.map((d) => WEEKDAY_SHORT[d]);
  if (names.length <= 1) return names[0] || "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** What the schedule is, in the fewest words that are still true. */
export function cadenceLabel(c: Cadence): string {
  if (c.manual) return "Only when you open it";
  if (c.unit === "day") return c.n === 1 ? "Every day" : c.n === 2 ? "Every other day" : `Every ${c.n} days`;
  if (c.unit === "month") return c.n === 1 ? "Once a month" : `Every ${c.n} months`;

  // weeks
  if (c.days.length === 7) return "Every day";
  if (c.days.length === 5 && c.days.every((d) => d >= 1 && d <= 5)) return "Weekdays";
  if (c.days.length === 2 && c.days.includes(0) && c.days.includes(6)) return "Weekends";
  if (c.days.length === 1) return WEEKDAY_PLURAL[c.days[0]];
  if (c.days.length) return joinDays(c.days);
  if (c.n === 1) return `${TIMES_WORD[c.times] || `${c.times} times`} a week`;
  if (c.n === 2 && c.times === 1) return "Every two weeks";
  return `${TIMES_WORD[c.times] || `${c.times} times`} every ${c.n} weeks`;
}

/** The line under the label — what the choice actually costs, in plain terms.
    Never an instruction and never encouragement. */
export function cadenceHint(c: Cadence): string {
  if (c.manual) return "Nothing is ever due, and nothing is ever missed.";
  const per = periodNoun(c);
  if (c.unit === "day" && c.n === 1) return "One check-in a day.";
  if (c.days.length) return `Nudged on ${joinDays(c.days)}. Any day still counts.`;
  return `${c.times === 1 ? "One check-in" : `${c.times} check-ins`} ${per}. Any day of it counts.`;
}

/** "a week", "a month", "every 3 days" — the phrase that follows a count. */
export function periodNoun(c: Cadence): string {
  if (c.unit === "day") return c.n === 1 ? "a day" : c.n === 2 ? "every other day" : `every ${c.n} days`;
  if (c.unit === "week") return c.n === 1 ? "a week" : c.n === 2 ? "a fortnight" : `every ${c.n} weeks`;
  return c.n === 1 ? "a month" : `every ${c.n} months`;
}

/** What to call the period a date is in — the heading over a catch-up list. */
export function periodLabel(c: Cadence, date: string, today: string): string {
  if (c.manual) return "Today";
  const start = periodStart(c, date);
  const here = periodStart(c, today);
  if (c.unit === "day" && c.n === 1) {
    return start === here ? "Today" : start === addDays(here, -1) ? "Yesterday" : prettyDate(start);
  }
  const noun = c.unit === "week" ? (c.n === 2 ? "fortnight" : "week") : c.unit === "month" ? "month" : "stretch";
  if (start === here) return `This ${noun}`;
  if (start === periodStart(c, prevPeriod(c, today))) return `Last ${noun}`;
  return `${prettyDate(start)} – ${prettyDate(periodEnd(c, date))}`;
}

/* ---------- what a period asked for, and what is in it ---------- */

export interface PeriodStatus {
  key: string;
  start: string;
  end: string;
  /** Check-ins this period asked for. */
  asked: number;
  /** Days inside it with something logged on them. */
  logged: number;
  /** Still owed. Never negative — logging six times on a weekly cadence is
      allowed and is not five days of credit. */
  left: number;
  complete: boolean;
  /** The period `today` is in. It is not over, so nothing in it is late. */
  current: boolean;
  /** Covered end to end by a pause. Neither owed nor missed. */
  paused: boolean;
  /** Days in it still open to a check-in: everything from its start to today,
      or to its end once it is over. What a catch-up list is drawn from. */
  open: string[];
}

/** How many check-ins a period wants. With days named it is however many of
    those weekdays actually fall inside it, which is the same as `days.length`
    on a one-week period and stays honest if that ever changes. */
export function asksInPeriod(c: Cadence, date: string): number {
  if (c.manual) return 0;
  if (!c.days.length) return c.times;
  let n = 0;
  for (const d of periodDates(c, date)) if (c.days.includes(weekdayOf(d))) n++;
  return n;
}

/**
 * The state of one period against a set of logged dates.
 *
 * `logged` is a set of dates the journal has something real on — the caller
 * decides what real means, and everywhere in this app it means the same thing
 * the streak already meant: an entry somebody made themselves, not one an
 * import created.
 */
export function periodStatus(
  c: Cadence,
  logged: ReadonlySet<string> | readonly string[],
  date: string,
  today: string = date
): PeriodStatus {
  const set = logged instanceof Set ? logged : new Set(logged);
  const start = periodStart(c, date);
  const end = periodEnd(c, date);
  const current = today >= start && today <= end;
  const asked = asksInPeriod(c, date);

  let n = 0;
  const open: string[] = [];
  const last = current ? today : end;
  for (const d of periodDates(c, date)) {
    if (set.has(d)) n++;
    else if (d <= last) open.push(d);
  }

  return {
    key: periodKey(c, date),
    start, end, asked, logged: n,
    left: Math.max(0, asked - n),
    complete: asked > 0 ? n >= asked : n > 0,
    current,
    paused: periodPaused(c, date),
    open,
  };
}

/**
 * Is a check-in outstanding right now?
 *
 * This is the one question the rest of the app asks this module, and it is
 * what a reminder fires on, what the Today card leads with, and what decides
 * whether the app has anything to say to somebody at all. False on a manual
 * cadence, false on a paused day, and false the moment the period's asks are
 * in — which is the whole reward for choosing a weekly journal: six days a
 * week where the app wants nothing from you.
 *
 * Named weekdays are the one place the day itself is the unit. A journal set
 * to weekdays owes something *on a Wednesday*, and owes nothing on a Saturday
 * even if the week is running short — a chosen day off that gets nagged is not
 * a day off. The single exception is a period about to close completely blank:
 * a Friday-only journal that missed Friday hears once more on the Sunday,
 * rather than nothing at all until the following Friday.
 */
export function dueNow(
  c: Cadence,
  logged: ReadonlySet<string> | readonly string[],
  today: string
): boolean {
  if (c.manual || isPaused(c, today)) return false;
  const set = logged instanceof Set ? logged : new Set(logged);
  if (set.has(today)) return false;
  const status = periodStatus(c, set, today, today);
  if (c.days.length) {
    if (c.days.includes(weekdayOf(today))) return status.left > 0;
    return today === status.end && status.logged === 0;
  }
  return status.left > 0;
}

/** The next day this cadence will ask on, from `after` exclusive. Null on a
    manual cadence, which never asks. Bounded so a pathological cadence can
    never spin. */
export function nextAsk(c: Cadence, after: string, limit = 400): string | null {
  if (c.manual) return null;
  for (let i = 1; i <= limit; i++) {
    const d = addDays(after, i);
    if (isPaused(c, d)) continue;
    if (!c.days.length) {
      /* No named day: the ask belongs to the next period that has one going
         spare, and the first day of it is the soonest it can be met. */
      if (periodStart(c, d) !== periodStart(c, after)) return d;
    } else if (c.days.includes(weekdayOf(d))) return d;
  }
  return null;
}

/* ---------- where the period stands ----------

   One sentence, for the top of the check-in card, and the only place in the
   app that says out loud what the frequency choice bought somebody.

   On a daily journal it says almost nothing, deliberately — the card
   underneath already counts today, and a second line repeating it is how a
   clean surface turns into a dashboard. The sentence earns its place on every
   other cadence, because on those the most useful thing the app can say is
   frequently **that there is nothing to do**: a weekly journal that has had
   its week should look, on the other six days, like a journal with nothing
   owed rather than like a journal being ignored. That difference is the whole
   feature. Without it, choosing "once a week" just means seeing an unfinished
   ring six days out of seven, which is the daily guilt with extra steps. */

export interface Standing {
  /** The cadence in a couple of words, for the chip beside it. */
  label: string;
  /** Where the period stands, in a sentence. Null when the cadence is daily
      and the card below is already saying it. */
  line: string | null;
  /** Everything this period asked for is in. Nothing is owed. */
  settled: boolean;
  /** Nothing is owed *and* the cadence is one that has something to say about
      it. The distinction matters: a daily journal is "settled" the moment the
      day is on the record, which is not the same claim as *today's check-in is
      finished* — that is the ring's job, and a card that announced "nothing is
      due" over a half-empty ring would be lying about somebody's own day. So
      only this flag ever silences the count. */
  quiet: boolean;
  /** Nothing is owed *and* nothing was skipped to get there — a pause. */
  paused: boolean;
  /** The next day something is asked for, when that day is not today. */
  next: string | null;
}

export function standing(
  c: Cadence,
  logged: ReadonlySet<string> | readonly string[],
  today: string
): Standing {
  const label = cadenceLabel(c);
  const set = logged instanceof Set ? logged : new Set(logged);

  if (c.manual) {
    return { label, line: "No schedule — nothing is ever due.", settled: true, quiet: true, paused: false, next: null };
  }
  if (isPaused(c, today)) {
    const p = c.pause!;
    return {
      label,
      line: p.to ? `Paused until ${prettyDate(p.to)}. Nothing is due.` : "Paused. Nothing is due.",
      settled: true, quiet: true, paused: true,
      next: p.to ? addDays(p.to, 1) : null,
    };
  }

  const st = periodStatus(c, set, today, today);
  const next = nextAsk(c, today);
  const nextLine = next ? ` Next from ${prettyDate(next)}.` : "";

  if (c.unit === "day" && c.n === 1) {
    /* Daily: the ring says it better than a sentence can. */
    return { label, line: null, settled: st.complete, quiet: false, paused: false, next: st.complete ? next : null };
  }

  const noun = c.unit === "week" ? (c.n === 2 ? "fortnight" : "week") : c.unit === "month" ? "month" : "stretch";
  if (st.complete) {
    const line = st.asked > 1
      ? `All ${st.asked} in for this ${noun}.${nextLine}`
      : `This ${noun} is in.${nextLine}`;
    return { label, line, settled: true, quiet: true, paused: false, next };
  }
  if (st.asked > 1) {
    return {
      label,
      line: `${st.logged} of ${st.asked} this ${noun}. ${st.left} to go.`,
      settled: false, quiet: false, paused: false, next: null,
    };
  }
  return {
    label,
    line: st.logged ? `This ${noun} is in.` : `Nothing in for this ${noun} yet.`,
    settled: false, quiet: false, paused: false, next: null,
  };
}

/* ---------- streaks ----------

   A run of periods that got what they asked for. The current one is never
   counted and never breaks the run, because it is not over; a paused period is
   stepped over in both directions, because time off is not a lapse.

   On a manual cadence this counts consecutive logged days, which is the old
   behaviour and the only honest thing to count when there is no schedule to
   count against. */
export function cadenceStreak(
  c: Cadence,
  logged: ReadonlySet<string> | readonly string[],
  today: string,
  limit = 520
): number {
  const set = logged instanceof Set ? logged : new Set(logged);
  if (c.manual) {
    let d = today, n = 0;
    if (!set.has(d)) d = addDays(d, -1);
    while (set.has(d) && n < limit) { n++; d = addDays(d, -1); }
    return n;
  }

  let n = 0;
  /* The current period counts if it is already satisfied — finishing this
     week's check-in on Monday should show the week, not withhold it until
     Sunday — but never subtracts. */
  const now = periodStatus(c, set, today, today);
  if (now.complete) n++;

  let cursor = prevPeriod(c, today);
  for (let i = 0; i < limit; i++) {
    const s = periodStatus(c, set, cursor, today);
    if (s.paused) { cursor = prevPeriod(c, cursor); continue; }
    if (!s.complete) break;
    n++;
    cursor = prevPeriod(c, cursor);
  }
  return n;
}

/** What a streak is a streak *of* — "weeks", "days", "fortnights". The unit has
    to be said out loud now that it is not always days. */
export function streakNoun(c: Cadence, n: number): string {
  const one = n === 1;
  if (c.manual) return one ? "day" : "days";
  if (c.unit === "day") return c.n === 1 ? (one ? "day" : "days") : one ? "stretch" : "stretches";
  if (c.unit === "week") return c.n === 2 ? (one ? "fortnight" : "fortnights") : one ? "week" : "weeks";
  return one ? "month" : "months";
}

/* ---------- the record, for a document that has to explain itself ---------- */

export interface Adherence {
  /** Periods in the range that asked for anything, pauses excluded. */
  periods: number;
  /** Of those, the ones that got what they asked for. */
  kept: number;
  /** Check-ins asked for and check-ins logged, across the same periods. */
  asked: number;
  logged: number;
  pct: number;
  /** Periods skipped because they were paused. Reported rather than hidden —
      a gap in a chart deserves its reason. */
  paused: number;
}

/**
 * How the journal ran against its own plan over a range.
 *
 * This exists for the appointment pack and the export, where "there are gaps in
 * August" and "this is a weekly journal and August was four for four" are very
 * different readings of the same rows. It is never shown as a score.
 */
export function adherence(
  c: Cadence,
  logged: ReadonlySet<string> | readonly string[],
  from: string,
  to: string
): Adherence {
  const set = logged instanceof Set ? logged : new Set(logged);
  const out: Adherence = { periods: 0, kept: 0, asked: 0, logged: 0, pct: 0, paused: 0 };
  if (from > to) return out;

  if (c.manual) {
    for (let d = from; d <= to; d = addDays(d, 1)) if (set.has(d)) out.logged++;
    out.asked = out.logged;
    out.pct = 100;
    return out;
  }

  let cursor = periodStart(c, from);
  for (let i = 0; i < 1000 && cursor <= to; i++) {
    const s = periodStatus(c, set, cursor, to);
    if (s.paused) out.paused++;
    else if (s.asked > 0) {
      out.periods++;
      out.asked += s.asked;
      out.logged += Math.min(s.logged, s.asked);
      if (s.complete) out.kept++;
    }
    cursor = nextPeriod(c, cursor);
  }
  out.pct = out.asked ? Math.round((out.logged / out.asked) * 100) : 0;
  return out;
}

/* ---------- per-question frequency ----------

   The second half of the feature, and the half that makes a big setup
   survivable.

   A journal is rarely one frequency. The pain score is a daily question; the
   weight is a weekly one; the tape measure round the waist is monthly, and
   asking for it every morning is how a thirty-question setup becomes a
   fifteen-question setup that somebody actually fills in. Before this, the only
   way to stop being asked for a monthly measurement every day was to turn the
   question off — which also took it out of the charts and the export, i.e. it
   deleted the answer to stop the question.

   So a question can carry its own cadence, and the rule between the two is one
   line: **a question is asked when the journal is asking and its own period has
   not been answered yet.** Not "on Mondays" — in *this week*, whichever day the
   check-in happens on. Which means a weekly weight on a daily journal is asked
   once, on the first check-in of the week, and is then quietly absent for six
   days. Answer it again on Friday if you like; nothing stops you, and the
   question simply stops being *asked*.

   A question with no cadence of its own is asked every time the journal asks.
   That is the default and it stays the default: this is opt-in per question,
   because a setup where every question quietly has its own schedule is a setup
   nobody can predict. */

/** The minimum a caller has to hand us to answer "has this been answered". */
export interface AnsweredDay {
  date: string;
  answers?: Record<string, unknown> | null;
  /** Days an import created. They never satisfy a question's period, for the
      same reason they never counted toward a streak. */
  auto?: boolean;
}

const filled = (v: unknown): boolean => {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
};

/**
 * Is this question due today?
 *
 * `date` included: answering it today and then looking at the screen again
 * should not show it as still owed, so the day itself is part of its own
 * period. A question answered *later* in the same period is answered.
 */
export function fieldDue(
  c: Cadence | undefined,
  key: string,
  days: readonly AnsweredDay[],
  date: string
): boolean {
  if (!c || c.manual) return true;             // no schedule of its own: always asked
  if (c.unit === "day" && c.n === 1) return true;
  const start = periodStart(c, date);
  const end = periodEnd(c, date);
  const want = asksInPeriod(c, date) || 1;
  let n = 0;
  for (const d of days) {
    if (d.auto) continue;
    if (d.date < start || d.date > end) continue;
    if (filled(d.answers?.[key])) n++;
  }
  return n < want;
}

/** When this question is next asked, in words: "next week", "in August".
    For the line under a question that has just gone quiet, so its absence
    reads as a schedule rather than a bug. */
export function fieldNextLine(c: Cadence | undefined, date: string): string | null {
  if (!c || c.manual) return null;
  if (c.unit === "day" && c.n === 1) return null;
  const next = nextPeriod(c, date);
  if (c.unit === "day") return `Asked again ${c.n === 2 ? "tomorrow" : `in ${daySpan(date, next) - 1} days`}.`;
  if (c.unit === "week") return c.n === 1 ? "Asked again next week." : "Asked again next fortnight.";
  return "Asked again next month.";
}

/** Every question due today, from a template and the per-question overrides.
    One place, so the ring, the queue and the survey can never disagree about
    what today asked for. */
export function dueKeys<T extends { k: string }>(
  fields: readonly T[],
  cadences: Record<string, Cadence> | undefined,
  days: readonly AnsweredDay[],
  date: string
): Set<string> {
  const out = new Set<string>();
  for (const f of fields) {
    if (fieldDue(cadences?.[f.k], f.k, days, date)) out.add(f.k);
  }
  return out;
}

/** Read the overrides off a stored profile, dropping anything unusable and
    anything that is just "daily" written out longhand — an override that
    matches the default is noise in every list that shows them. */
export function sanitizeFieldCadences(raw: unknown): Record<string, Cadence> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, Cadence> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k.trim()) continue;
    const c = sanitizeCadence(v);
    if (!c.manual && c.unit === "day" && c.n === 1) continue;
    out[k] = c;
  }
  return out;
}

/* ---------- the choices somebody is actually offered ---------- */

export interface CadencePreset {
  id: string;
  label: string;
  hint: string;
  cadence: Cadence;
}

const preset = (id: string, label: string, hint: string, c: Partial<Cadence>): CadencePreset => ({
  id, label, hint, cadence: { ...DEFAULT_CADENCE, ...c },
});

/**
 * The survey-frequency question, as a list.
 *
 * Ordered by how often they ask, densest first, because that is the axis
 * somebody is actually moving along — "less often than that" is the thought,
 * and a list sorted by anything else makes them hunt for it. Every one of them
 * is a real sentence somebody has said about their own tracking.
 */
export const CADENCE_PRESETS: CadencePreset[] = [
  preset("daily", "Every day", "One check-in a day. What most journals want.", {}),
  preset("weekdays", "Weekdays", "Monday to Friday, weekends off.", { unit: "week", days: [1, 2, 3, 4, 5], times: 5 }),
  preset("alternate", "Every other day", "Half the asking, most of the picture.", { unit: "day", n: 2 }),
  preset("thrice", "Three times a week", "Any three days. Enough for a trend.", { unit: "week", times: 3 }),
  preset("twice", "Twice a week", "Any two days.", { unit: "week", times: 2 }),
  preset("weekly", "Once a week", "Any one day. The right pace for slow things.", { unit: "week", times: 1 }),
  preset("fortnightly", "Every two weeks", "For something that moves over months.", { unit: "week", n: 2, times: 1 }),
  preset("monthly", "Once a month", "A measurement, not a diary.", { unit: "month", times: 1 }),
  preset("manual", "Only when I open it", "Nothing is ever due, and nothing is ever missed.", { manual: true }),
];

/** The presets offered for one question, which is a shorter list: a question
    can only ever ask *less* often than the journal it lives in, so the dense
    end of the list is the journal's business and not this one's. */
export const FIELD_CADENCE_PRESETS: CadencePreset[] = [
  preset("every", "Every check-in", "Asked whenever the journal asks.", {}),
  preset("weekly", "Once a week", "Asked on the week's first check-in.", { unit: "week", times: 1 }),
  preset("twiceWeek", "Twice a week", "Asked on the week's first two.", { unit: "week", times: 2 }),
  preset("fortnightly", "Every two weeks", "For something that barely moves.", { unit: "week", n: 2, times: 1 }),
  preset("monthly", "Once a month", "A measurement — weight, a tape measure, a photo.", { unit: "month", times: 1 }),
];

/** Which preset this cadence *is*, or null when somebody has built their own.
    The picker needs it to show a selection; nothing else should branch on it. */
export function presetIdOf(c: Cadence, list: CadencePreset[] = CADENCE_PRESETS): string | null {
  for (const p of list) if (sameCadence(p.cadence, c)) return p.id;
  return null;
}

export const presetById = (id: string, list: CadencePreset[] = CADENCE_PRESETS): CadencePreset | null =>
  list.find((p) => p.id === id) || null;

/** Set the named weekdays on a cadence, which is the one piece of the shape a
    picker edits directly. Empty means "any day", and a week cadence keeps its
    `times` in step so the two can never contradict each other. */
export function withDays(c: Cadence, days: number[]): Cadence {
  const clean = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  if (c.manual || c.unit !== "week" || c.n !== 1) return c;
  return { ...c, days: clean, times: clean.length || c.times };
}
