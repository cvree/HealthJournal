/* What somebody came here to find out.

   The first run has always been very good at asking *what* you track. It has
   never once asked *why* — and the why is the only thing on the whole
   screen that is worth tailoring around. Two people can both pick Eczema and
   want completely different objects out of this app: one wants to know what
   sets it off, the other wants to know whether the cream she started in
   January is doing anything, and the third wants twelve weeks of evidence to
   put in front of a dermatologist who gets ten minutes.

   Those are three different journals. Same questions on the surface; different
   things switched on underneath, different first suggestion, and — the part
   that actually decides whether somebody is still here in March — a different
   answer to *when does this start paying me back*.

   So this module holds the small number of things people actually come for,
   what each one needs in the journal before it can be answered, and the honest
   arithmetic of how long that takes at the rate they said they would write.

   Three rules it obeys:

   1. **An aim never switches anything on by itself.** It suggests, and the
      suggestion is drawn as one — the same rule the packs already follow. The
      person still says yes to every question, every photograph and every
      extra, one card at a time.
   2. **Every date it prints is arithmetic somebody could check.** The rungs
      come from ./evidence — the same ladder the insights and the experiments
      are graded on — and the rate comes from the cadence they picked two
      screens later. Nothing here is a marketing horizon; if it says the first
      pattern can show around the 12th, that is twelve paired days at one a
      day, and the app will still refuse to say anything on the 11th.
   3. **"Nothing in particular" is a real answer.** It is the last card, it is
      not sulked at, and it produces a plan of its own — because somebody who
      just wants a record still deserves to know what the record will be worth
      and when.

   The extra and subject ids in `needs` are the app's own (see FIRST_RUN_EXTRAS
   and FIRST_RUN_PHOTO_SUBJECTS in App). An id this build no longer offers is
   simply never matched — nothing here fails on an unknown one. */

import { EMERGING_AT, USEFUL_AT } from "./evidence";

export interface Aim {
  id: string;
  /** The aim as a person would say it out loud. */
  label: string;
  /** One line under it: what saying yes to this actually means. */
  blurb: string;
  /** A name from the app's own icon set. Passed through rather than drawn
      here — this module knows nothing about React. */
  icon: string;
  /** Their question, in the first person. Quoted back on the plan at the end,
      because the last screen of a setup should be able to say what the setup
      was *for*. */
  question: string;
  /** What the journal needs before this is answerable. Suggestions, never
      switches — see rule 1. */
  needs: { extras: string[]; subjects: string[] };
  /** Words that mark a pack question as one that answers this aim. Matched
      case-insensitively against the question's own label and section, which is
      the only vocabulary shared by eleven packs written years apart. */
  marks: string[];
  /** Which packs reach for this one first. Ordering only. */
  suggest: string[];
  /** What the app will actually do about it, in one sentence, in terms of
      machinery that exists: a comparison, a before/after, a printed pack. */
  promise: string;
  /** The line the plan uses for the middle milestone — what this aim looks
      like the day it first has something to say. */
  emerging: string;
  /** …and the day it is worth showing somebody. */
  useful: string;
}

/* The five. Not a taxonomy of health goals — the five sentences people
   actually type into a search box at eleven at night, plus the honest refusal.

   "Lose weight", "sleep better" and the rest of the wellness catalogue are
   deliberately absent: this app does not set targets, and an aim it cannot
   act on would be a promise made by a list. Every one of these maps onto
   machinery that is already in the build. */
export const AIMS: Aim[] = [
  {
    id: "triggers",
    icon: "search",
    label: "Find what sets it off",
    blurb: "Line the bad days up against what you ate, took and did on the days before them.",
    question: "What is setting this off?",
    needs: { extras: ["food", "flare"], subjects: ["meal"] },
    marks: ["trigger", "food", "diet", "drink", "lifestyle", "sleep", "stress", "digestion"],
    suggest: ["ibs", "migraine", "allergy", "eczema", "pots"],
    promise:
      "Your daily number and what the day held get written down beside each other. "
      + "Once there are enough days on both sides of a habit, the app compares them — "
      + "your own average on the days with, your own average on the days without.",
    emerging: "Enough paired days for the first comparison to appear at all.",
    useful: "A comparison that has survived several different weeks of your life.",
  },
  {
    id: "better",
    icon: "trends",
    label: "Know if it's actually getting better",
    blurb: "A line you can see, instead of a memory that only keeps the worst week.",
    question: "Is this actually getting better, or am I just having a good week?",
    needs: { extras: [], subjects: ["areas", "progress", "flare"] },
    marks: ["today", "symptom", "severity", "skin", "gut", "pain", "energy"],
    suggest: ["eczema", "carnivore", "thyroid", "autoimmune", "joint", "fatigue"],
    promise:
      "One number every day, charted — with a rolling average over the top, because a "
      + "fortnight of dots is noise and the average is the shape. Photographs of the same "
      + "thing line up side by side against the first one you took.",
    emerging: "A long enough run for the trend line to mean more than the last bad day.",
    useful: "A shape you can point at — with the good weeks and the bad ones both in it.",
  },
  {
    id: "treatment",
    icon: "pill",
    label: "See if a treatment is working",
    blurb: "Mark the day it started, and let the app hold the before up against the after.",
    question: "Is what I'm taking actually doing anything?",
    needs: { extras: ["routine"], subjects: ["label"] },
    marks: ["care", "relief", "med", "cream", "dose", "treatment", "routine", "tolerance"],
    suggest: ["eczema", "migraine", "autoimmune", "thyroid", "allergy", "joint"],
    promise:
      "What you take is a checklist rather than a memory, and the day you start something new "
      + "becomes a line on the chart. An experiment compares the weeks either side of it — "
      + "and says out loud everything else that changed in between.",
    emerging: "Enough days after the change to hold against the days before it.",
    useful: "Both sides long enough that a single bad week cannot flip the answer.",
  },
  {
    id: "appointment",
    icon: "note",
    label: "Have something to show at my appointment",
    blurb: "Ten minutes is not long enough to remember six weeks. This is the page that does.",
    question: "How do I show them what this has actually been like?",
    needs: { extras: ["flare"], subjects: ["flare"] },
    marks: ["symptom", "today", "severity", "flare", "vitals"],
    suggest: ["autoimmune", "pots", "joint", "thyroid", "allergy", "eczema", "migraine"],
    promise:
      "Every day you log goes into an appointment pack: how often, how bad, what changed, "
      + "the photographs, and your own words — on one page you print or hand over, with your "
      + "name and age already on it.",
    emerging: "Enough days that the pack is a record rather than an anecdote.",
    useful: "The version worth printing: weeks of days, with the pattern visible on it.",
  },
  {
    id: "record",
    icon: "log",
    label: "Nothing in particular — just keep the record",
    blurb: "A journal that is simply there, so that the day you do need it, it already exists.",
    question: "",
    needs: { extras: [], subjects: [] },
    marks: [],
    suggest: [],
    promise:
      "Nothing extra is switched on for this. You get the daily number, whatever else you keep, "
      + "and a journal that is quietly accumulating the thing that is impossible to get "
      + "retrospectively: the days before you knew they mattered.",
    emerging: "Enough days that the app will start pointing things out on its own.",
    useful: "A record long enough to answer a question you have not thought of yet.",
  },
];

export function aimById(id: string | null | undefined): Aim | null {
  if (!id) return null;
  return AIMS.find((a) => a.id === id) || null;
}

/** The aims, with the ones this person's own conditions reach for first.

    "Just keep the record" is pinned last, always. It is a real answer and it
    is on the screen, but an app that leads with it is an app suggesting you
    have no reason to be here. */
export function aimsFor(modules: string[]): Aim[] {
  const mine = new Set(modules);
  const rest = AIMS.filter((a) => a.id !== "record");
  const hit = rest.filter((a) => a.suggest.some((m) => mine.has(m)));
  const miss = rest.filter((a) => !hit.includes(a));
  const tail = AIMS.filter((a) => a.id === "record");
  return [...hit, ...miss, ...tail];
}

/** Does this question help answer that aim?

    Deliberately generous and deliberately dumb: a substring match over the
    label and the section. The alternative — a hand-maintained map from every
    aim to every field key in eleven packs — is a file that would be wrong
    within a month of somebody adding a pack, and being wrong here means
    telling a person a question matters to them when it does not. */
export function answersAim(aim: Aim | null | undefined, q: { label: string; sec?: string }): boolean {
  if (!aim || !aim.marks.length) return false;
  const hay = `${q.label} ${q.sec || ""}`.toLowerCase();
  return aim.marks.some((w) => hay.includes(w));
}

/* ---------- how long that takes ----------

   How many check-ins a week each cadence actually produces. The ids are
   ./cadence's own presets; anything unrecognised is treated as daily, because
   the only thing worse than a wrong date is no date at all on the one screen
   that is trying to make a promise. */
export const PER_WEEK: Record<string, number> = {
  daily: 7, alternate: 3.5, thrice: 3, twice: 2, weekly: 1, weekdays: 5, fortnightly: 0.5,
};

export function perWeek(cadence: string): number {
  const n = PER_WEEK[cadence];
  return n && n > 0 ? n : 7;
}

/** Calendar days from today until the journal holds `entries` check-ins,
    counting the one written during setup as the first.

    Ceiling, not rounding: a date the journal reaches a day late is a promise
    broken on the morning somebody came to collect it. */
export function daysFor(entries: number, cadence: string): number {
  const need = Math.max(0, Math.round(entries) - 1);
  if (!need) return 0;
  return Math.ceil((need * 7) / perWeek(cadence));
}

const DAY_MS = 86400000;

export function shift(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

/** "Thu 25 Sep" — a date somebody can find on a calendar, without a year on
    it until the year is not this one. */
export function whenLabel(d: Date, from: Date = new Date()): string {
  const opts: Intl.DateTimeFormatOptions = d.getFullYear() === from.getFullYear()
    ? { weekday: "short", month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" };
  return d.toLocaleDateString(undefined, opts);
}

/** "in about three weeks" — the same distance said the way people say it,
    because a date answers *when* and this answers *how far off*. */
export function awayLabel(days: number): string {
  if (days <= 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `in about ${weeks} weeks`;
  const months = Math.round(days / 30);
  return `in about ${months} month${months === 1 ? "" : "s"}`;
}

export interface Milestone {
  id: string;
  /** Check-ins on the record by then, counting today's. */
  entries: number;
  /** Calendar days from today. */
  days: number;
  /** ISO date, so tests and callers never have to parse a rendered string. */
  date: string;
  /** The same day, written for a human. */
  when: string;
  away: string;
  /** Check-ins still to write before it. 0 once the rung is behind you. */
  left: number;
  title: string;
  body: string;
}

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* The three rungs the plan is made of, in the order a journal reaches them.

   They are targets in *check-ins*, not in days, because a journal that asks
   three times a week reaches them at a third of the pace and telling somebody
   "the first pattern shows in twelve days" would be a lie to everybody who did
   not pick every day. The counts themselves come from ./evidence, which is the
   same ladder the insights, the relationships and the experiments are graded
   on — this module invents no thresholds of its own. */
const TARGETS = (weekly: boolean) => [
  { id: "first", entries: weekly ? 4 : 7 },
  { id: "emerging", entries: EMERGING_AT },
  { id: "useful", entries: USEFUL_AT },
];

/**
 * The plan: three dated things this journal will be able to do, in the order
 * it reaches them.
 *
 * This is the single most important paragraph in the whole first run, and it
 * is the one that was missing. Everything else the setup says is about what
 * the app *is*; a person who has just spent ninety seconds choosing questions
 * is owed an answer to the only question they actually have, which is *when
 * does this start being worth it*. "Keep going and it answers what memory
 * cannot" is a lovely sentence and it is not an answer.
 *
 * So: their own rungs, on their own rate, with their own dates on them — and
 * the middle one worded around what they said they came for.
 */
export function horizon(opts: {
  aim?: Aim | null;
  cadence: string;
  from?: Date;
  /** Whether anything is being photographed — it changes what the first week
      is worth, and it is the one milestone that is about looking rather than
      counting. */
  photos?: boolean;
  /** What their daily number is called, so the first rung can name it. */
  metricLabel?: string;
  /** Check-ins already on the record, counting today's. One during setup;
      whatever the journal actually holds, later. */
  have?: number;
}): Milestone[] {
  const { aim, cadence, photos, metricLabel, have } = { have: 1, ...opts };
  const from = opts.from || new Date();
  /* Days are counted from what is already on the record, not from zero: the
     same rung is a fortnight away on day one and four days away on day eight,
     and a plan that cannot say the second one is a poster rather than a
     plan. */
  const one = (id: string, entries: number, title: string, body: string): Milestone => {
    const days = daysFor(Math.max(1, entries - have + 1), cadence);
    const date = shift(from, days);
    return {
      id, entries, days, date: iso(date), when: whenLabel(date, from),
      away: awayLabel(days), left: Math.max(0, entries - have), title, body,
    };
  };

  const metric = metricLabel || "your daily number";
  const weekly = perWeek(cadence) <= 1;

  const first = one(
    "first",
    TARGETS(weekly)[0].entries,
    weekly ? "Four weeks in" : "Your first week",
    photos
      ? `${weekly ? "Four" : "Seven"} check-ins and the first photographs to line up against each other. `
        + `The week view stops being empty and ${metric.toLowerCase()} has a shape.`
      : `${weekly ? "Four" : "Seven"} check-ins on the record. Enough for the week view to have a `
        + `shape, and for ${metric.toLowerCase()} to be a line rather than a number.`
  );

  const second = one(
    "emerging",
    EMERGING_AT,
    `${EMERGING_AT} days on the record`,
    aim?.emerging
      ? `${aim.emerging} This is the first rung where the app will say anything at all — below it, it says so.`
      : "The first rung where the app will point anything out. Below it, it says so instead of guessing.",
  );

  const third = one(
    "useful",
    USEFUL_AT,
    `${USEFUL_AT} days, across a few different weeks`,
    aim?.useful
      ? `${aim.useful} This is the rung the app calls Useful, and the one worth printing.`
      : "The rung the app calls Useful — enough days, spread across enough weeks, to be worth printing.",
  );

  return [first, second, third];
}

/**
 * The next rung, for a journal that is already running.
 *
 * The plan at the end of the first run is a promise, and a promise that is
 * never mentioned again is a slogan. This is the same arithmetic, run against
 * what the journal actually holds, so the one place a new person goes looking
 * for a finding — Insights, in week one, where there is nothing yet — can say
 * *when* instead of shrugging and asking them to keep going.
 *
 * Null once the top rung is behind them: at that point the app has real
 * findings to show and a countdown would be furniture.
 */
export function nextRung(opts: {
  have: number;
  cadence: string;
  aim?: Aim | null;
  from?: Date;
  photos?: boolean;
  metricLabel?: string;
}): Milestone | null {
  const all = horizon(opts);
  return all.find((m) => m.left > 0) || null;
}

/** One sentence for the screen where the aim is chosen: when it starts paying
    out, at the rate the app currently assumes. Said before the cadence card so
    that "how often should it ask" arrives as a decision with a consequence
    rather than as a preference. */
export function readyLine(aim: Aim | null, cadence: string): string {
  const days = daysFor(EMERGING_AT, cadence);
  const d = shift(new Date(), days);
  const when = whenLabel(d);
  if (!aim || aim.id === "record") {
    return `At ${EMERGING_AT} days on the record — around ${when} — the app starts pointing things out on its own.`;
  }
  return `At the rate this is set to ask, that is around ${when}: ${EMERGING_AT} days on the record, `
    + "which is the first point the app is willing to say anything at all.";
}
