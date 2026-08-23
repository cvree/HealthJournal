/* Rituals — the routine as a *process*, and the weekly tune-up that keeps it
   honest.

   The routine (src/lib/routine.ts) answers "what am I taking, and did I take
   it". It is a flat checklist of things, and for pills that is exactly right.

   It is wrong for a shower.

   A shower is not one tick. It is a lukewarm shower that is shorter than you
   want it to be, then getting out, then the ninety seconds afterwards where
   the moisturiser either goes on damp skin or doesn't work — and that last
   step is the one that matters and the one that gets dropped. Ticking
   "showered" records the part that was never in doubt and loses the part that
   was. Same for a morning: the pills, the water, the cream, in that order,
   because two of them need food and one needs a wet face.

   So a **ritual** is an ordered list of steps with one name on it, and a
   **run** is one day's attempt at it. Three rules hold the whole thing up.

   1. **A run is a record, a ritual is a plan.** A run carries its own copy of
      the name and the step count at the moment it happened, so editing the
      ritual — dropping a step, renaming it — can never rewrite what last
      Tuesday says you did. Same contract as a routine log, for the same
      reason.
   2. **One tap finishes the whole thing.** Every day, for every ritual, the
      cheapest possible interaction is "yes, did it, all of it". Stepping
      through it one step at a time is *offered*, never required. A five-step
      ritual that costs five taps on a normal day is a ritual that gets
      abandoned in a fortnight, and a fortnight of data is worth nothing.
   3. **The app asks about a ritual once a week, and never two on the same
      day.** See the scheduler below. This is the rule with actual arithmetic
      behind it, because "weekly check-in" implemented naively means every
      ritual somebody set up on the same Sunday comes back to them on the same
      Sunday forever, and five modal dialogs at once is not a check-in, it is
      an ambush.

   Nothing here is medical and nothing here scores a person. The tune-up asks
   how a week went and offers to change the plan to fit the answer; it never
   tells anybody they failed at a shower. */

import type { RoutineItem, RoutineTime } from "../types/models";
import { addDays, daySpan } from "./episodes";
import { ROUTINE_TIMES, slotForTime, timeLabel } from "./routine";
import type { DerivedMetric } from "./tracking";
import { localDate, localTime } from "./tracking";

const rand = () => Math.random().toString(36).slice(2, 9);
const stamp = () => new Date().toISOString();
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/* ---------- shapes ---------- */

/** One step of a ritual. `itemId` is the seam back into the routine: a step
    that points at a routine item logs a dose when it is ticked, so "morning
    meds" is one ritual *and* four rows in the medication history rather than
    two places to write the same fact down. */
export interface RitualStep {
  id: string;
  label: string;
  /** The reason, in a few words. Shown small, under the step, only in the
      player — a list of steps with a paragraph under each is a manual. */
  hint?: string;
  /** Links this step to a routine item. Ticking it logs a dose of that item. */
  itemId?: string;
  /** Some steps are timed and the timing is the point — "cool water, 5
      minutes", "wait 2 minutes before the next cream". Seconds; the player
      offers a countdown and nothing forces you to use it. */
  seconds?: number;
  /** Nice to have, not part of the count. Optional steps never make a run
      look incomplete, which is what stops a tune-up nagging about them. */
  optional?: boolean;
}

/** A named process, done on some days, reviewed once a week. */
export interface Ritual {
  id: string;
  name: string;
  /** One character of personality. It is the fastest thing on the screen to
      recognise and the cheapest thing in the file. */
  emoji?: string;
  /** Fallback glyph from the app's icon set, for anywhere emoji don't belong. */
  icon: string;
  /** Which part of the day it belongs to. Orders the day's board; never
      enforced — a shower at 11pm is still today's shower. */
  slot?: RoutineTime;
  steps: RitualStep[];
  /** Weekdays it is asked for, 0 = Sunday … 6 = Saturday. Empty means every
      day, which is a different fact from "all seven listed" only in that it
      keeps meaning every day after somebody edits it. */
  days: number[];
  /** The weekday its tune-up lands on, 0–6. Assigned by `pickReviewDay` so no
      two rituals share one until there are more than seven. */
  reviewDay: number;
  notes?: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One day's attempt. Absent means nothing was said — never "missed". */
export interface RitualRun {
  id: string;
  date: string; // YYYY-MM-DD (local)
  time: string; // HH:MM (local) — when it was first touched
  ritualId: string;
  /** Snapshots, written when the run is created. See rule 1. */
  name: string;
  /** How many required steps the ritual had at the time. A run of 4 of 4 stays
      4 of 4 after a fifth step is added tomorrow. */
  total: number;
  /** Ids of the steps ticked, in the order they were ticked. */
  done: string[];
  /** A deliberate miss — "not today". Distinct from an absent run. */
  skipped?: boolean;
  /** Set the moment the last required step lands. Drives "when do you actually
      do this", which is what the tune-up's move-the-slot suggestion reads. */
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** One answered tune-up. Also the scheduler's memory: it is the only record of
    when a ritual was last asked about, which is what stops it being asked
    twice. */
export interface RitualReview {
  id: string;
  ritualId: string;
  date: string;
  /** How the week felt, 1–5. Absent on a snooze. */
  felt?: number;
  /** What got in the way, if they said. One of FRICTIONS. */
  friction?: string;
  /** Which tweak they chose, as its id. "keep" is a real answer. */
  tweak?: string;
  /** Dismissed rather than answered. Costs the scheduler a short delay rather
      than a whole week — see `nextReviewDate`. */
  snoozed?: boolean;
  createdAt: string;
}

/* ---------- the day of the week ---------- */

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** One letter, for the seven-dot week strip. Duplicated T and S are fine: the
    strip is read as a shape and always starts on Sunday. */
export const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** 0 = Sunday. Parsed as a local date, deliberately — `new Date("2026-08-23")`
    is UTC midnight and lands on the previous day for anybody west of London. */
export function weekdayOf(date: string): number {
  const [y, m, d] = String(date).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getDay();
}

/** Does this ritual ask for anything on this date? */
export const scheduledOn = (ritual: Ritual, date: string): boolean =>
  !ritual.archived && (!ritual.days.length || ritual.days.includes(weekdayOf(date)));

/** "Every day", "Weekdays", "Mon, Wed, Fri" — the line under a ritual's name. */
export function daysLabel(days: number[]): string {
  const set = [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (!set.length || set.length === 7) return "Every day";
  if (set.length === 5 && set.every((d) => d >= 1 && d <= 5)) return "Weekdays";
  if (set.length === 2 && set.includes(0) && set.includes(6)) return "Weekends";
  return set.map((d) => WEEKDAYS_SHORT[d]).join(", ");
}

/* ---------- constructors ---------- */

const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

export function newStep(partial: Partial<RitualStep> & { label: string }): RitualStep {
  const { label, hint, ...rest } = partial;
  return {
    id: `rs_${Date.now().toString(36)}${rand()}`,
    ...defined(rest as Partial<RitualStep>),
    label: label.trim(),
    hint: hint?.trim() || undefined,
  } as RitualStep;
}

export function newRitual(partial: Partial<Ritual> & { name: string }): Ritual {
  const { name, steps, ...rest } = partial;
  return {
    id: `rt_${Date.now().toString(36)}${rand()}`,
    icon: "clock",
    days: [],
    reviewDay: 0,
    createdAt: stamp(),
    updatedAt: stamp(),
    ...defined(rest as Partial<Ritual>),
    name: name.trim(),
    steps: (steps || []).map((s) => ({ ...s, label: s.label.trim() })),
  } as Ritual;
}

/** Start today's run. Empty, so the first tick and the "did it all" button are
    the same code path. */
export function newRun(ritual: Ritual, date: string = localDate()): RitualRun {
  return {
    id: `rr_${Date.now().toString(36)}${rand()}`,
    date,
    time: localTime(),
    ritualId: ritual.id,
    name: ritual.name,
    total: requiredSteps(ritual).length,
    done: [],
    createdAt: stamp(),
    updatedAt: stamp(),
  };
}

export const requiredSteps = (ritual: Ritual): RitualStep[] =>
  (ritual.steps || []).filter((s) => !s.optional);

/* ---------- reading a run ---------- */

export const runOn = (runs: RitualRun[], ritualId: string, date: string): RitualRun | undefined =>
  (runs || []).find((r) => r && r.ritualId === ritualId && r.date === date);

export const runsFor = (runs: RitualRun[], ritualId: string): RitualRun[] =>
  (runs || []).filter((r) => r && r.ritualId === ritualId).sort((a, b) => a.date.localeCompare(b.date));

export const stepDone = (run: RitualRun | undefined, stepId: string): boolean =>
  !!run && !run.skipped && run.done.includes(stepId);

/** How far through.

    Both numbers come off the *run*, never off the ritual — which is rule 1
    doing real work rather than sitting in a comment. Drop a step from the
    shower tomorrow and last Tuesday still says 5 of 5, because last Tuesday
    was 5 of 5. The alternative, recounting history against today's plan, means
    a tune-up that trims one step silently un-completes a fortnight, and the
    one thing a record must never do is change.

    `ritual` is only consulted when there is no run at all, to answer "how many
    would this be asking for". */
export function runProgress(run: RitualRun | undefined, ritual?: Ritual): { done: number; total: number; ratio: number } {
  const total = run ? run.total : ritual ? requiredSteps(ritual).length : 0;
  if (!run || run.skipped) return { done: 0, total, ratio: 0 };
  /* Capped at the total because optional steps live in the same list: ticking
     the extra cream on top of all four required ones is 4 of 4, not 5 of 4. */
  const done = Math.min(run.done.length, total);
  return { done, total, ratio: total ? done / total : done > 0 ? 1 : 0 };
}

export const runComplete = (run: RitualRun | undefined, ritual?: Ritual): boolean => {
  if (!run || run.skipped) return false;
  const { done, total } = runProgress(run, ritual);
  return total === 0 ? run.done.length > 0 || !!run.completedAt : done >= total;
};

/** Tick or untick one step. Returns a new run; the caller writes it. Completion
    is stamped the moment the last required step lands and cleared if it is
    taken back, because the stamp is a fact about the day rather than a flag. */
export function toggleStep(run: RitualRun, ritual: Ritual, stepId: string): RitualRun {
  const has = run.done.includes(stepId);
  const done = has ? run.done.filter((id) => id !== stepId) : [...run.done, stepId];
  /* `total` is re-read from the plan on every write, and only on a write. That
     is what lets a ritual edited this morning be right this evening without
     any past day being touched: yesterday's run is never written again. */
  const next: RitualRun = {
    ...run, done, total: requiredSteps(ritual).length, skipped: undefined, updatedAt: stamp(),
  };
  const complete = runComplete(next, ritual);
  next.completedAt = complete ? (run.completedAt || `${next.date}T${localTime()}`) : undefined;
  return next;
}

/** The one-tap path: every required step, at once. Optional steps are left
    alone — saying "did the usual" should not claim the extras. */
export function completeRun(run: RitualRun, ritual: Ritual): RitualRun {
  const ids = requiredSteps(ritual).map((s) => s.id);
  const done = [...new Set([...run.done, ...ids])];
  return {
    ...run,
    done,
    total: ids.length,
    skipped: undefined,
    completedAt: run.completedAt || `${run.date}T${localTime()}`,
    updatedAt: stamp(),
  };
}

/** And its undo: back to nothing said. */
export function clearRun(run: RitualRun): RitualRun {
  return { ...run, done: [], skipped: undefined, completedAt: undefined, updatedAt: stamp() };
}

export function skipRun(run: RitualRun): RitualRun {
  return { ...run, done: [], skipped: true, completedAt: undefined, updatedAt: stamp() };
}

/* ---------- the day's board ----------

   What Today draws. Sorted by slot in clock order so the morning ritual is
   above the bedtime one whatever order they were created in, and rituals with
   no slot fall to the end rather than to the top. */

export interface RitualRow {
  ritual: Ritual;
  run?: RitualRun;
  done: number;
  total: number;
  ratio: number;
  complete: boolean;
  skipped: boolean;
  /** Days in a row up to and including today, if today is done. */
  streak: number;
}

const slotOrder = (slot?: RoutineTime): number => {
  const i = ROUTINE_TIMES.findIndex((t) => t.id === slot);
  return i < 0 ? ROUTINE_TIMES.length : i;
};

export function dayBoard(rituals: Ritual[], runs: RitualRun[], date: string): RitualRow[] {
  return (rituals || [])
    .filter((r) => r && scheduledOn(r, date))
    .sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot) || a.name.localeCompare(b.name))
    .map((ritual) => {
      const run = runOn(runs, ritual.id, date);
      const { done, total, ratio } = runProgress(run, ritual);
      return {
        ritual, run, done, total, ratio,
        complete: runComplete(run, ritual),
        skipped: !!run?.skipped,
        streak: ritualStreak(ritual, runs, date),
      };
    });
}

/** One number for the whole board: how much of today's rituals are answered.
    Skips count as answered, exactly as they do in the routine's progress. */
export function boardProgress(rituals: Ritual[], runs: RitualRun[], date: string) {
  const rows = dayBoard(rituals, runs, date);
  const done = rows.filter((r) => r.complete).length;
  const skipped = rows.filter((r) => r.skipped).length;
  return {
    done, skipped, total: rows.length,
    ratio: rows.length ? (done + skipped) / rows.length : null,
  };
}

/* ---------- streaks and the week strip ---------- */

/** Consecutive *scheduled* days completed, counting back from `date`.

   Two decisions worth stating. A day the ritual was never asked for does not
   break a streak and does not extend it — a weekday-only ritual should not
   lose its streak to a Saturday. And an unanswered today does not break one
   either: the streak stands at yesterday's number until the day is over,
   because a counter that resets at midnight and stays reset until you open the
   app is a counter that punishes you for sleeping in. */
export function ritualStreak(ritual: Ritual, runs: RitualRun[], date: string): number {
  const byDate = new Map((runs || []).filter((r) => r.ritualId === ritual.id).map((r) => [r.date, r]));
  let n = 0;
  let d = date;
  let first = true;
  for (let guard = 0; guard < 400; guard++) {
    if (scheduledOn(ritual, d)) {
      const run = byDate.get(d);
      if (runComplete(run, ritual)) n++;
      else if (!first) break;
      else if (run?.skipped) break; // an explicit "not today" does end it
    }
    first = false;
    d = addDays(d, -1);
    if (ritual.createdAt && d < ritual.createdAt.slice(0, 10)) break;
  }
  return n;
}

export function bestStreak(ritual: Ritual, runs: RitualRun[], upTo: string): number {
  const rows = runsFor(runs, ritual.id);
  if (!rows.length) return 0;
  const start = rows[0].date;
  const byDate = new Map(rows.map((r) => [r.date, r]));
  let best = 0;
  let cur = 0;
  for (let d = start; d <= upTo; d = addDays(d, 1)) {
    if (!scheduledOn(ritual, d)) continue;
    if (runComplete(byDate.get(d), ritual)) { cur++; best = Math.max(best, cur); }
    else cur = 0;
  }
  return best;
}

export type DotState = "done" | "part" | "skip" | "miss" | "off" | "future";

export interface WeekDot {
  date: string;
  weekday: number;
  letter: string;
  state: DotState;
  ratio: number;
}

/** The seven days ending on `date`, oldest first. The single most-looked-at
    object in the feature: it is the reward on the tune-up, the progress on the
    card, and the only history most people will ever read. */
export function weekDots(ritual: Ritual, runs: RitualRun[], date: string, today: string = date): WeekDot[] {
  const out: WeekDot[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(date, -i);
    const run = runOn(runs, ritual.id, d);
    const { ratio } = runProgress(run, ritual);
    let state: DotState;
    if (!scheduledOn(ritual, d)) state = "off";
    else if (runComplete(run, ritual)) state = "done";
    else if (run?.skipped) state = "skip";
    else if (ratio > 0) state = "part";
    else if (d > today) state = "future";
    else state = "miss";
    out.push({ date: d, weekday: weekdayOf(d), letter: WEEKDAY_LETTERS[weekdayOf(d)], state, ratio });
  }
  return out;
}

/* ---------- what a week actually says ----------

   Everything the tune-up needs to be *about something*. A weekly popup that
   asks "how did it go?" and nothing else is a survey; one that says "you
   moisturised on six of seven days and the after-shower step is the one that
   slips" is worth opening. */

export interface StepStat {
  step: RitualStep;
  done: number;
  of: number;
  rate: number;
}

export interface RitualReport {
  ritual: Ritual;
  from: string;
  to: string;
  /** Scheduled days in the window. */
  asked: number;
  completed: number;
  partial: number;
  skipped: number;
  missed: number;
  /** completed / asked, 0–1. Null when nothing was asked. */
  rate: number | null;
  /** Same, for the seven days before this window. Null when there is no
      history to compare — the tune-up says nothing rather than inventing a
      trend out of one week. */
  prevRate: number | null;
  streak: number;
  best: number;
  dots: WeekDot[];
  steps: StepStat[];
  /** The required step done least often, when it is clearly behind the rest. */
  weakest?: StepStat;
  /** The typical clock time it gets finished, "HH:MM", when there is one. */
  usualTime?: string;
  /** Which slot that time falls in — the move-it suggestion reads this. */
  usualSlot?: RoutineTime;
}

const rateOf = (ritual: Ritual, runs: RitualRun[], from: string, to: string): number | null => {
  let asked = 0;
  let done = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!scheduledOn(ritual, d)) continue;
    asked++;
    if (runComplete(runOn(runs, ritual.id, d), ritual)) done++;
  }
  return asked ? done / asked : null;
};

export function ritualReport(ritual: Ritual, runs: RitualRun[], to: string, span = 7): RitualReport {
  const from = addDays(to, -(span - 1));
  let asked = 0, completed = 0, partial = 0, skipped = 0, missed = 0;
  const times: number[] = [];
  const stepDoneCount = new Map<string, number>();

  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!scheduledOn(ritual, d)) continue;
    asked++;
    const run = runOn(runs, ritual.id, d);
    const { ratio } = runProgress(run, ritual);
    if (runComplete(run, ritual)) completed++;
    else if (run?.skipped) skipped++;
    else if (ratio > 0) partial++;
    else missed++;
    for (const id of run?.done || []) stepDoneCount.set(id, (stepDoneCount.get(id) || 0) + 1);
    const at = run?.completedAt?.slice(11, 16);
    if (at && /^\d{2}:\d{2}$/.test(at)) times.push(Number(at.slice(0, 2)) * 60 + Number(at.slice(3, 5)));
  }

  const steps: StepStat[] = (ritual.steps || []).map((step) => ({
    step,
    done: stepDoneCount.get(step.id) || 0,
    of: asked,
    rate: asked ? (stepDoneCount.get(step.id) || 0) / asked : 0,
  }));

  /* "Weakest" only means something next to the others. A step done three times
     out of seven in a ritual where everything is done three times out of seven
     is not the problem — the week is. So it has to be clearly behind. */
  const required = steps.filter((s) => !s.step.optional);
  const bestRate = required.reduce((m, s) => Math.max(m, s.rate), 0);
  const weakest = required
    .slice()
    .sort((a, b) => a.rate - b.rate)
    .find((s) => asked >= 3 && s.rate <= 0.6 && bestRate - s.rate >= 0.25);

  const usual = times.length >= 3 ? median(times) : null;
  const usualTime = usual == null ? undefined
    : `${String(Math.floor(usual / 60)).padStart(2, "0")}:${String(Math.round(usual % 60)).padStart(2, "0")}`;

  return {
    ritual, from, to, asked, completed, partial, skipped, missed,
    rate: asked ? completed / asked : null,
    prevRate: rateOf(ritual, runs, addDays(from, -span), addDays(from, -1)),
    streak: ritualStreak(ritual, runs, to),
    best: bestStreak(ritual, runs, to),
    dots: weekDots(ritual, runs, to),
    steps,
    weakest,
    usualTime,
    usualSlot: usualTime ? slotForTime(usualTime) : undefined,
  };
}

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/* ---------- the scheduler: one at a time, and never the same day ----------

   This is the part the feature lives or dies on.

   Somebody sets up four rituals on a Sunday afternoon because that is when
   people set things up. The naive weekly check-in gives all four the same
   anniversary, and a week later they get four popups in a row on a Sunday, and
   the week after that they get four more, and by the third Sunday the feature
   is off. Every rule below exists to make that impossible:

   · **Each ritual gets its own weekday.** `pickReviewDay` spreads them — the
     first goes on today's day, the second as far from it as the week allows,
     the third into the widest remaining gap, and so on, so seven rituals
     occupy seven different days before any day is used twice.
   · **A ritual is only asked about once a week**, on or after its own day, and
     it waits rather than being lost if the app isn't opened that day.
   · **Never two tune-ups within `REVIEW_GAP_DAYS` of each other**, whatever
     their days say. This is the backstop: even a pathological setup — nine
     rituals, three sharing a Tuesday — can only surface one every other day.
   · **Never before there is something to say.** A ritual younger than
     `REVIEW_MIN_AGE` days, or with fewer than `REVIEW_MIN_RUNS` days of
     history, is not reviewed at all. The first tune-up somebody ever sees has
     a real week behind it, which is the only version of it that is any good.
   · **A snooze costs days, not a week.** "Not now" comes back in
     `SNOOZE_DAYS`, not next Tuesday — dismissing once should not silently
     switch the feature off. */

export const REVIEW_MIN_AGE = 7;
export const REVIEW_MIN_RUNS = 3;
export const REVIEW_GAP_DAYS = 2;
export const SNOOZE_DAYS = 2;

/** The weekday for a new ritual's tune-up: the one furthest from every day
    already spoken for. Deterministic, so the same set of rituals always
    produces the same spread. */
export function pickReviewDay(existing: Ritual[], today: string = localDate()): number {
  const used = (existing || []).filter((r) => !r.archived).map((r) => clamp(Math.round(r.reviewDay), 0, 6));
  if (!used.length) return weekdayOf(today);
  const counts = Array.from({ length: 7 }, (_, d) => used.filter((u) => u === d).length);
  const fewest = Math.min(...counts);
  /* Among the least-used days, the one with the widest circular gap to any
     used day. Ties go to the lower index purely so the answer is stable. */
  let best = -1;
  let bestGap = -1;
  for (let d = 0; d < 7; d++) {
    if (counts[d] !== fewest) continue;
    const gap = Math.min(...used.map((u) => {
      const raw = Math.abs(u - d);
      return Math.min(raw, 7 - raw);
    }));
    if (gap > bestGap) { bestGap = gap; best = d; }
  }
  return best < 0 ? weekdayOf(today) : best;
}

export const reviewsFor = (reviews: RitualReview[], ritualId: string): RitualReview[] =>
  (reviews || []).filter((r) => r && r.ritualId === ritualId).sort((a, b) => a.date.localeCompare(b.date));

export const lastReview = (reviews: RitualReview[], ritualId: string): RitualReview | undefined => {
  const rows = reviewsFor(reviews, ritualId);
  return rows[rows.length - 1];
};

/** The earliest date this ritual's tune-up may appear.

    Never reviewed: `REVIEW_MIN_AGE` days after it was made, then forward to
    its own weekday — so a ritual created on a Monday with a Thursday review
    day first surfaces on the Thursday after its first full week, not on day 7.
    Reviewed: a week later, which lands on the same weekday by construction.
    Snoozed: a couple of days later, on whatever day that is. */
export function nextReviewDate(ritual: Ritual, reviews: RitualReview[]): string {
  const last = lastReview(reviews, ritual.id);
  if (last) return addDays(last.date, last.snoozed ? SNOOZE_DAYS : 7);
  const born = (ritual.createdAt || "").slice(0, 10) || localDate();
  let d = addDays(born, REVIEW_MIN_AGE);
  for (let i = 0; i < 7 && weekdayOf(d) !== clamp(Math.round(ritual.reviewDay), 0, 6); i++) d = addDays(d, 1);
  return d;
}

export interface DueReview {
  ritual: Ritual;
  /** How many days past its due date — ranks two rituals that came due while
      the app was closed. */
  overdue: number;
  due: string;
}

/** Every ritual whose tune-up is owed, most overdue first. Does *not* apply the
    one-a-day rule — `dueReview` does that. Exported because the manage screen
    shows "next tune-up: Thursday" and wants the same arithmetic. */
export function dueReviews(
  rituals: Ritual[], runs: RitualRun[], reviews: RitualReview[], date: string
): DueReview[] {
  return (rituals || [])
    .filter((r) => r && !r.archived && (r.steps || []).length > 0)
    .map((ritual) => ({ ritual, due: nextReviewDate(ritual, reviews) }))
    .filter(({ ritual, due }) => {
      if (date < due) return false;
      const history = runsFor(runs, ritual.id).filter((r) => r.date <= date);
      return history.length >= REVIEW_MIN_RUNS;
    })
    .map(({ ritual, due }) => ({ ritual, due, overdue: daySpan(due, date) - 1 }))
    .sort((a, b) => b.overdue - a.overdue || a.ritual.reviewDay - b.ritual.reviewDay
      || a.ritual.name.localeCompare(b.ritual.name));
}

/** The one tune-up to show today, or nothing. This is the function the app
    calls; everything above is in service of it returning `null` far more often
    than it returns a ritual. */
export function dueReview(
  rituals: Ritual[], runs: RitualRun[], reviews: RitualReview[], date: string
): Ritual | null {
  /* Anything answered or dismissed today means today is spent. */
  if ((reviews || []).some((r) => r.date === date)) return null;
  /* And the gap since the last one, whichever ritual it was about. */
  const latest = (reviews || []).reduce((m, r) => (r.date > m ? r.date : m), "");
  if (latest && daySpan(latest, date) - 1 < REVIEW_GAP_DAYS) return null;
  return dueReviews(rituals, runs, reviews, date)[0]?.ritual || null;
}

/* ---------- what the tune-up asks ----------

   Three cards, each answered with one tap, each optional. The first is how the
   week felt, the second is what got in the way and only appears when something
   did, and the third is the one that makes the whole thing worth opening: a
   short list of *changes to the plan*, written from the week's own numbers,
   any of which is applied by tapping it.

   A weekly survey that only collects answers is a tax. This one pays out. */

export const FEELINGS: { v: number; emoji: string; label: string }[] = [
  { v: 1, emoji: "🥴", label: "Rough" },
  { v: 2, emoji: "😕", label: "Patchy" },
  { v: 3, emoji: "🙂", label: "Fine" },
  { v: 4, emoji: "😄", label: "Good" },
  { v: 5, emoji: "🤩", label: "Nailed it" },
];

export const FRICTIONS: { v: string; emoji: string; label: string }[] = [
  { v: "time", emoji: "⏱️", label: "No time" },
  { v: "tired", emoji: "🥱", label: "Too tired" },
  { v: "forgot", emoji: "🌀", label: "Forgot" },
  { v: "toomuch", emoji: "🧱", label: "Too many steps" },
  { v: "unwell", emoji: "🤒", label: "Felt unwell" },
  { v: "away", emoji: "🧳", label: "Away from home" },
  { v: "nothing", emoji: "✨", label: "Nothing, honestly" },
];

export type TweakAction =
  | { type: "keep" }
  | { type: "dropStep"; stepId: string }
  | { type: "easeStep"; stepId: string }
  | { type: "moveSlot"; slot: RoutineTime }
  | { type: "dropDays"; days: number[] }
  | { type: "addDays"; days: number[] };

export interface Tweak {
  id: string;
  emoji: string;
  label: string;
  /** The evidence, in a few words. Never a judgement — "5 of 7 days" not
      "you keep skipping this". */
  detail?: string;
  action: TweakAction;
}

export type TuneUpCard =
  | { id: "felt"; kind: "faces"; question: string; sub?: string }
  | { id: "friction"; kind: "chips"; question: string; sub?: string }
  | { id: "tweak"; kind: "tweaks"; question: string; sub?: string; tweaks: Tweak[] }
  | { id: "done"; kind: "reward"; question: string; sub?: string };

/** The changes worth offering, from what the week did.

    At most three, plus "leave it alone" — which is listed *first* when the week
    went well, because the most common right answer to "change anything?" is
    no, and burying it under three suggestions is how an app talks somebody into
    editing a routine that was working. */
export function suggestTweaks(report: RitualReport, runs: RitualRun[]): Tweak[] {
  const { ritual } = report;
  const out: Tweak[] = [];

  if (report.weakest) {
    const s = report.weakest;
    out.push({
      id: `ease_${s.step.id}`,
      emoji: "🪶",
      label: `Make “${s.step.label}” optional`,
      detail: `${s.done} of ${s.of} days`,
      action: { type: "easeStep", stepId: s.step.id },
    });
    /* Only offer to delete a step that is basically never done. Offering to
       delete something done half the time is the app deciding for somebody. */
    if (s.rate <= 0.25) {
      out.push({
        id: `drop_${s.step.id}`,
        emoji: "✂️",
        label: `Drop “${s.step.label}”`,
        detail: s.done === 0 ? "not once this week" : `${s.done} of ${s.of} days`,
        action: { type: "dropStep", stepId: s.step.id },
      });
    }
  }

  /* Doing it at a different time of day than it is filed under. Only when
     there is a real habit behind it — `usualSlot` needs three finishes. */
  if (report.usualSlot && report.usualSlot !== ritual.slot) {
    out.push({
      id: `slot_${report.usualSlot}`,
      emoji: "🕰️",
      label: `Move it to ${timeLabel(report.usualSlot).toLowerCase()}`,
      detail: report.usualTime ? `you usually finish around ${prettyClock(report.usualTime)}` : undefined,
      action: { type: "moveSlot", slot: report.usualSlot },
    });
  }

  /* A weekday it is asked for and never done, over a month. One bad Tuesday is
     a bad Tuesday; four is a schedule that doesn't match a life. */
  const dead = deadWeekdays(ritual, runs, report.to);
  if (dead.length && (ritual.days.length ? ritual.days.length : 7) - dead.length >= 1) {
    out.push({
      id: `dropdays_${dead.join("_")}`,
      emoji: "📆",
      label: `Stop asking on ${dead.map((d) => WEEKDAYS[d]).join(" and ")}`,
      detail: "not once in four weeks",
      action: { type: "dropDays", days: dead },
    });
  }

  /* And the opposite: done on days it was never asked for. */
  const extra = extraWeekdays(ritual, runs, report.to);
  if (extra.length && ritual.days.length) {
    out.push({
      id: `adddays_${extra.join("_")}`,
      emoji: "➕",
      label: `Add ${extra.map((d) => WEEKDAYS[d]).join(" and ")}`,
      detail: "you did it anyway",
      action: { type: "addDays", days: extra },
    });
  }

  const keep: Tweak = {
    id: "keep",
    emoji: "👌",
    label: "It's good — leave it",
    action: { type: "keep" },
  };
  const wentWell = (report.rate ?? 0) >= 0.7;
  const trimmed = out.slice(0, 3);
  return wentWell ? [keep, ...trimmed] : [...trimmed, keep];
}

/** Weekdays this ritual is asked for and has not been completed once in four
    weeks, with at least three chances to have been. */
function deadWeekdays(ritual: Ritual, runs: RitualRun[], to: string): number[] {
  const from = addDays(to, -27);
  const asked = new Map<number, number>();
  const did = new Map<number, number>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!scheduledOn(ritual, d)) continue;
    const w = weekdayOf(d);
    asked.set(w, (asked.get(w) || 0) + 1);
    if (runComplete(runOn(runs, ritual.id, d), ritual)) did.set(w, (did.get(w) || 0) + 1);
  }
  return [...asked.entries()]
    .filter(([w, n]) => n >= 3 && !did.get(w))
    .map(([w]) => w)
    .sort((a, b) => a - b)
    .slice(0, 2);
}

/** Weekdays it is *not* asked for but was completed at least three times in
    four weeks. */
function extraWeekdays(ritual: Ritual, runs: RitualRun[], to: string): number[] {
  if (!ritual.days.length) return [];
  const from = addDays(to, -27);
  const did = new Map<number, number>();
  for (const run of runsFor(runs, ritual.id)) {
    if (run.date < from || run.date > to) continue;
    const w = weekdayOf(run.date);
    if (ritual.days.includes(w)) continue;
    if (runComplete(run, ritual)) did.set(w, (did.get(w) || 0) + 1);
  }
  return [...did.entries()].filter(([, n]) => n >= 3).map(([w]) => w).sort((a, b) => a - b).slice(0, 2);
}

/** The cards, in order. `friction` is dropped on a clean week — asking what got
    in the way of something nothing got in the way of is the app not reading its
    own data. */
export function tuneUpCards(report: RitualReport): TuneUpCard[] {
  const name = report.ritual.name;
  const cards: TuneUpCard[] = [
    { id: "felt", kind: "faces", question: `How did ${name} go this week?`, sub: weekLine(report) },
  ];
  if ((report.rate ?? 1) < 1) {
    cards.push({ id: "friction", kind: "chips", question: "What got in the way?", sub: "Tap one, or skip it" });
  }
  return cards;
}

/** "Six of seven days" / "Every single day" — the line under the first
    question, so the tune-up opens by telling you something rather than asking
    for something. */
export function weekLine(report: RitualReport): string {
  if (!report.asked) return "Nothing was asked for this week";
  if (report.completed === report.asked) {
    return report.asked === 7 ? "Every single day. Look at that." : `All ${report.asked} days it was asked for`;
  }
  const bits = [`${report.completed} of ${report.asked} days`];
  if (report.partial) bits.push(`${report.partial} part-way`);
  if (report.skipped) bits.push(`${report.skipped} skipped on purpose`);
  return bits.join(" · ");
}

/** The line on the reward card. Warm, never a grade, and it does not pretend a
    hard week was a good one — a person who managed two showers in seven days
    knows it, and being congratulated for it is how an app loses their trust. */
export function celebrationFor(report: RitualReport): { title: string; line: string } {
  const rate = report.rate ?? 0;
  const up = report.prevRate != null && rate - report.prevRate >= 0.15;
  if (rate >= 1) {
    return { title: "Perfect week", line: report.streak > 7 ? `${report.streak} days without a gap.` : "Every day it asked. Nothing dropped." };
  }
  if (up) return { title: "Better than last week", line: `${pct(report.prevRate!)} → ${pct(rate)}. That is the direction.` };
  if (rate >= 0.7) return { title: "Solid week", line: "Most days, which is what actually moves anything." };
  if (rate >= 0.4) return { title: "Half a week", line: "Half is data. The chart keeps both halves." };
  if (report.completed > 0) return { title: "A hard week", line: "It still got written down, which counts for the record." };
  return { title: "A blank week", line: "Blank weeks happen. The plan is here when you want it." };
}

const pct = (r: number) => `${Math.round(r * 100)}%`;

function prettyClock(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2));
  const m = hhmm.slice(3, 5);
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

/* ---------- applying a tweak ---------- */

export function applyTweak(ritual: Ritual, action: TweakAction): Ritual {
  const now = stamp();
  switch (action.type) {
    case "keep":
      return ritual;
    case "dropStep":
      return { ...ritual, steps: ritual.steps.filter((s) => s.id !== action.stepId), updatedAt: now };
    case "easeStep":
      return {
        ...ritual,
        steps: ritual.steps.map((s) => (s.id === action.stepId ? { ...s, optional: true } : s)),
        updatedAt: now,
      };
    case "moveSlot":
      return { ...ritual, slot: action.slot, updatedAt: now };
    case "dropDays": {
      const base = ritual.days.length ? ritual.days : [0, 1, 2, 3, 4, 5, 6];
      const days = base.filter((d) => !action.days.includes(d));
      // Never leave a ritual that is asked for on no day at all — that is a
      // deletion wearing a schedule change, and nobody chose it.
      return days.length ? { ...ritual, days, updatedAt: now } : ritual;
    }
    case "addDays": {
      const base = ritual.days.length ? ritual.days : [0, 1, 2, 3, 4, 5, 6];
      const days = [...new Set([...base, ...action.days])].sort((a, b) => a - b);
      return { ...ritual, days: days.length === 7 ? [] : days, updatedAt: now };
    }
    default:
      return ritual;
  }
}

/** What the tweak did, in the past tense, for the toast that confirms it. */
export function tweakReceipt(ritual: Ritual, tweak: Tweak): string {
  switch (tweak.action.type) {
    case "keep": return `${ritual.name} left as it is`;
    case "dropStep": return "Step removed";
    case "easeStep": return "Step is optional now";
    case "moveSlot": return `Moved to ${timeLabel(tweak.action.slot).toLowerCase()}`;
    case "dropDays": return `${ritual.name} won't be asked for on ${tweak.action.days.map((d) => WEEKDAYS[d]).join(" or ")}`;
    case "addDays": return `${tweak.action.days.map((d) => WEEKDAYS[d]).join(" and ")} added`;
    default: return "Saved";
  }
}

export function newReview(partial: Partial<RitualReview> & { ritualId: string }): RitualReview {
  return {
    id: `rv_${Date.now().toString(36)}${rand()}`,
    date: localDate(),
    createdAt: stamp(),
    ...defined(partial),
  } as RitualReview;
}

/* ---------- the starters ----------

   A blank "add a ritual" form is a wall. These are the four somebody actually
   asked for, written out in full, so setting up a shower routine is picking a
   card and editing a word rather than typing eleven fields.

   The copy in the steps is deliberately specific — "while your skin is still
   damp" rather than "moisturise" — because the specificity is the entire value
   of writing a shower down as a process instead of a tick. */

export interface RitualStarter {
  id: string;
  name: string;
  emoji: string;
  icon: string;
  slot?: RoutineTime;
  blurb: string;
  days?: number[];
  steps: { label: string; hint?: string; seconds?: number; optional?: boolean }[];
  /** Fill the steps from the routine items filed under this slot, on top of
      the written ones. That is what makes "Morning meds" one tap to set up for
      somebody who already keeps a routine. */
  fromSlot?: RoutineTime;
}

export const RITUAL_STARTERS: RitualStarter[] = [
  {
    id: "shower",
    name: "Shower & after",
    emoji: "🚿",
    icon: "drop",
    slot: "evening",
    blurb: "The wash, and the three minutes afterwards that actually do the work.",
    steps: [
      { label: "Lukewarm, not hot", hint: "hot water strips the skin barrier", seconds: 600 },
      { label: "Gentle cleanser, no scrubbing" },
      { label: "Rinse fully" },
      { label: "Pat dry — don't rub", hint: "leave the skin slightly damp" },
      { label: "Moisturise within 3 minutes", hint: "damp skin holds it; dry skin doesn't", seconds: 180 },
      { label: "Any treatment cream last", optional: true },
    ],
  },
  {
    id: "morning-meds",
    name: "Morning meds",
    emoji: "🌅",
    icon: "sunrise",
    slot: "morning",
    blurb: "Everything in the morning column of your routine, in order, in one go.",
    fromSlot: "morning",
    steps: [
      { label: "Big glass of water first" },
      { label: "Something in your stomach", hint: "some of these need food", optional: true },
    ],
  },
  {
    id: "night-meds",
    name: "Night meds & supplements",
    emoji: "🌙",
    icon: "moon",
    slot: "bed",
    blurb: "The bedtime column, plus the two things that make it stick.",
    fromSlot: "bed",
    steps: [
      { label: "Water by the bed" },
      { label: "Set tomorrow's out", hint: "the single highest-leverage 20 seconds of the day", optional: true },
    ],
  },
  {
    id: "winddown",
    name: "Wind-down",
    emoji: "🛌",
    icon: "moon",
    slot: "bed",
    blurb: "The half hour before sleep, as six things instead of one vague intention.",
    steps: [
      { label: "Screens down" },
      { label: "Teeth" },
      { label: "Face — cleanse, then moisturise" },
      { label: "Lay tomorrow's clothes out", optional: true },
      { label: "Room cool and dark" },
      { label: "Alarm set", hint: "and the phone across the room" },
    ],
  },
  {
    id: "morning-skin",
    name: "Morning skin",
    emoji: "🧴",
    icon: "tube",
    slot: "morning",
    blurb: "Wash, treat, moisturise, sunscreen. In that order, which is the whole trick.",
    steps: [
      { label: "Rinse or gentle cleanse" },
      { label: "Treatment on damp skin" },
      { label: "Moisturiser" },
      { label: "SPF, last, every day", hint: "including the grey ones" },
    ],
  },
  {
    id: "move",
    name: "Move a bit",
    emoji: "🌤️",
    icon: "sun",
    slot: "midday",
    blurb: "The smallest version that still counts, so it survives a bad day.",
    days: [1, 2, 3, 4, 5],
    steps: [
      { label: "Get outside", seconds: 600 },
      { label: "Ten minutes of anything" },
      { label: "Water afterwards" },
    ],
  },
];

/** Build a ritual from a starter, folding in the person's own routine items
    where the starter asks for them. The written steps come first; the items
    follow in the order the routine holds them, each carrying its dose so the
    player reads "Vitamin D3 · 2000 IU" without anybody typing it twice. */
export function ritualFromStarter(
  starter: RitualStarter,
  opts: { items?: RoutineItem[]; existing?: Ritual[]; today?: string } = {}
): Ritual {
  const today = opts.today || localDate();
  const steps = starter.steps.map((s) => newStep(s));
  if (starter.fromSlot) {
    const linked = (opts.items || [])
      .filter((i) => i && !i.archived && i.daily && (i.times || []).includes(starter.fromSlot!))
      .map((i) => newStep({
        label: i.name,
        hint: [i.dose?.trim(), i.brand?.trim()].filter(Boolean).join(" · ") || undefined,
        itemId: i.id,
      }));
    /* The written steps of a meds ritual are "water first" and "eat
       something" — they belong around the pills, not after them. Water first,
       then the doses, then the rest. */
    steps.splice(1, 0, ...linked);
  }
  return newRitual({
    name: starter.name,
    emoji: starter.emoji,
    icon: starter.icon,
    slot: starter.slot,
    days: starter.days || [],
    steps,
    reviewDay: pickReviewDay(opts.existing || [], today),
  });
}

/* ---------- derived daily metrics ----------

   Same bridge the routine, food and bowel metrics use: many rows per day on one
   side, one value per day on the chart. `dir` is neutral on both, for the same
   reason it is neutral there — there is no healthy number of showers, and
   colouring a quiet week red would be the app grading somebody's life. */

export const RITUAL_METRICS: DerivedMetric[] = [
  {
    k: "rl_done",
    label: "Rituals finished",
    dir: "neutral" as const,
    sec: "Rituals",
    value: ({ rituals = [], ritualRuns = [], date }) => {
      const rows = dayBoard(rituals, ritualRuns, date);
      if (!rows.length) return null;
      return rows.filter((r) => r.complete).length;
    },
  },
  {
    k: "rl_pct",
    label: "Rituals completed",
    unit: "%",
    dir: "neutral" as const,
    sec: "Rituals",
    value: ({ rituals = [], ritualRuns = [], date }) => {
      const rows = dayBoard(rituals, ritualRuns, date);
      if (!rows.length) return null;
      return Math.round((rows.filter((r) => r.complete).length / rows.length) * 100);
    },
  },
];

/* ---------- sanitising restored / imported rows ----------

   Backups are user-editable files and sync payloads arrive from another
   device's version of this code. Same contract as every other collection: drop
   what cannot be understood, repair what can, and never let one bad row cost
   the other three hundred. */

const str = (v: unknown, max = 400): string => (typeof v === "string" ? v.slice(0, max) : "");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLOT_IDS = ROUTINE_TIMES.map((t) => t.id) as string[];

const dayList = (v: unknown): number[] => {
  if (!Array.isArray(v)) return [];
  const out = [...new Set(v.map((d) => Math.round(Number(d))).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  return out.length === 7 ? [] : out.sort((a, b) => a - b);
};

export function sanitizeRituals(rows: unknown): Ritual[] {
  if (!Array.isArray(rows)) return [];
  const out: Ritual[] = [];
  const seen = new Set<string>();
  for (const r of rows as any[]) {
    if (!r || typeof r !== "object") continue;
    const name = str(r.name, 80).trim();
    if (!name) continue;
    const id = str(r.id, 64) || `rt_${Date.now().toString(36)}${rand()}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const stepIds = new Set<string>();
    const steps: RitualStep[] = (Array.isArray(r.steps) ? r.steps : [])
      .map((s: any): RitualStep | null => {
        if (!s || typeof s !== "object") return null;
        const label = str(s.label, 120).trim();
        if (!label) return null;
        const sid = str(s.id, 64) || `rs_${Date.now().toString(36)}${rand()}`;
        /* Two steps with one id means ticking either ticks both. */
        if (stepIds.has(sid)) return null;
        stepIds.add(sid);
        const seconds = Number(s.seconds);
        return {
          id: sid,
          label,
          hint: str(s.hint, 200).trim() || undefined,
          itemId: str(s.itemId, 64) || undefined,
          seconds: Number.isFinite(seconds) && seconds > 0 ? clamp(Math.round(seconds), 5, 7200) : undefined,
          optional: s.optional === true || undefined,
        };
      })
      .filter((s): s is RitualStep => !!s)
      .slice(0, 40);
    const reviewDay = Math.round(Number(r.reviewDay));
    out.push({
      id,
      name,
      emoji: str(r.emoji, 8).trim() || undefined,
      icon: str(r.icon, 24) || "clock",
      slot: SLOT_IDS.includes(r.slot) ? r.slot : undefined,
      steps,
      days: dayList(r.days),
      reviewDay: Number.isInteger(reviewDay) && reviewDay >= 0 && reviewDay <= 6 ? reviewDay : 0,
      notes: str(r.notes, 2000) || undefined,
      archived: r.archived === true || undefined,
      createdAt: str(r.createdAt, 40) || stamp(),
      updatedAt: str(r.updatedAt, 40) || stamp(),
    });
  }
  return out;
}

export function sanitizeRitualRuns(rows: unknown): RitualRun[] {
  if (!Array.isArray(rows)) return [];
  const out: RitualRun[] = [];
  /* One run per ritual per day, enforced here rather than trusted: two runs for
     the same Tuesday means the tick you can see and the tick that counts are
     different objects, which is the worst kind of bug to be told about. */
  const seen = new Set<string>();
  for (const r of rows as any[]) {
    if (!r || typeof r !== "object") continue;
    if (!DATE_RE.test(r.date)) continue;
    const ritualId = str(r.ritualId, 64);
    if (!ritualId) continue;
    const key = `${ritualId}|${r.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const total = Math.round(Number(r.total));
    const done: string[] = [...new Set(
      (Array.isArray(r.done) ? (r.done as unknown[]) : []).map((x) => str(x, 64)).filter(Boolean)
    )].slice(0, 40);
    out.push({
      id: str(r.id, 64) || `rr_${Date.now().toString(36)}${rand()}`,
      date: r.date,
      time: TIME_RE.test(r.time) ? r.time : "12:00",
      ritualId,
      name: str(r.name, 80).trim() || "Ritual",
      total: Number.isFinite(total) && total >= 0 ? Math.min(total, 40) : done.length,
      done,
      skipped: r.skipped === true || undefined,
      completedAt: str(r.completedAt, 40) || undefined,
      notes: str(r.notes, 2000) || undefined,
      createdAt: str(r.createdAt, 40) || stamp(),
      updatedAt: str(r.updatedAt, 40) || stamp(),
    });
  }
  return out;
}

export function sanitizeRitualReviews(rows: unknown): RitualReview[] {
  if (!Array.isArray(rows)) return [];
  const out: RitualReview[] = [];
  const felts = FEELINGS.map((f) => f.v);
  const frictions = FRICTIONS.map((f) => f.v);
  for (const r of rows as any[]) {
    if (!r || typeof r !== "object") continue;
    if (!DATE_RE.test(r.date)) continue;
    const ritualId = str(r.ritualId, 64);
    if (!ritualId) continue;
    const felt = Math.round(Number(r.felt));
    out.push({
      id: str(r.id, 64) || `rv_${Date.now().toString(36)}${rand()}`,
      ritualId,
      date: r.date,
      felt: felts.includes(felt) ? felt : undefined,
      friction: frictions.includes(str(r.friction, 24)) ? str(r.friction, 24) : undefined,
      tweak: str(r.tweak, 80) || undefined,
      snoozed: r.snoozed === true || undefined,
      createdAt: str(r.createdAt, 40) || stamp(),
    });
  }
  return out;
}

/** Backfill the review day on rituals restored from a file that predates it, or
    written by a version that never assigned one. Runs on load, and only ever
    moves rituals that are actually colliding — a spread somebody's app has
    already been using should not be reshuffled under them. */
export function spreadReviewDays(rituals: Ritual[], today: string = localDate()): Ritual[] {
  const out: Ritual[] = [];
  for (const ritual of rituals) {
    const clash = out.some((r) => r.reviewDay === ritual.reviewDay);
    out.push(clash && out.length < 7
      ? { ...ritual, reviewDay: pickReviewDay(out, today) }
      : ritual);
  }
  return out;
}
