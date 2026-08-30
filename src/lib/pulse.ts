/* The Daily Pulse, and what it asks next.

   The single most important number in this app is one tap away from being
   recorded, and for most people on most days it is the *only* thing they will
   record. A journal that demands a seven-screen survey gets abandoned in a
   fortnight; a journal that takes one tap gets a year of data, and a year of
   one number beats a fortnight of forty.

   So Today opens with one question — the key metric, 1 to 10 — and the tap
   writes it. Everything else is optional and comes *after*, never in front.

   This module owns the part of that which is arithmetic rather than paint:
   what counts as recorded, and which three-to-five optional details are worth
   offering once the number is in.

   Three rules govern the suggestions.

   1. **Never suggest what is already answered.** A chip offering to record a
      thing somebody recorded ten seconds ago is the app not paying attention.
   2. **The day decides the order.** On a hard day the useful details are the
      ones a clinician will ask about — what else hurt, what you took, what it
      looked like. On a calm day they are the ones that explain *why* it was
      calm: sleep, stress, what you did differently. Offering "photograph the
      rash" on a 2 is noise.
   3. **Never more than five, and never a screen.** These are offers. The floor
      of three is a target, not a promise — an empty setup gets fewer, and
      inventing suggestions to hit a number is how a helpful row becomes a
      nag.

   And one thing added later, which is the other half of the same idea.

   A chip row is a *menu*: it shows what could be answered and leaves the
   choosing to the reader. That is right for three offers and wrong for eleven
   questions, and eleven questions is what a real setup has. So the pulse is
   now followed by a **queue** — `askQueue` — and the screen asks the front of
   it, one question at a time, in place, with the answer written on the tap.
   Answering removes it from the queue and the next one takes its place, so
   somebody who wants to do their whole daily review can do it without ever
   opening the survey, and somebody who wanted to log one number has already
   finished and can ignore the rest.

   The queue is ordered by what the pack is about, what kind of day it is, and
   what this person actually records — in that order. It never asks the same
   question twice, it never re-asks something answered, and a skip lasts for
   the sitting rather than being learned: a journal that permanently stops
   asking because of one impatient tap has started editing what its owner
   tracks. */

export type Direction = "sym" | "pos" | "neutral" | undefined;

/** A template field, as much of it as this module needs. */
export interface PulseField {
  k: string;
  label: string;
  type: string;
  dir?: Direction;
  unit?: string;
  sec?: string;
  /** chips: one choice rather than many. Decides whether a tap finishes the
      question, which is what the one-at-a-time chain advances on. */
  single?: boolean;
}

/** How far up the bad end of the scale a score sits, whichever end that is. */
export const badness = (value: number, dir: Direction): number =>
  dir === "pos" ? 11 - value : value;

export const HARD_AT = 7;
export const CALM_AT = 3;

/** What the day is, in one word — the thing that decides which details are
    worth offering. A day nobody has rated yet is `unrated`, and gets the
    neutral set rather than a guess. */
export type DayKind = "hard" | "middling" | "calm" | "unrated";

export function dayKind(score: number | null | undefined, dir: Direction): DayKind {
  if (score == null || !Number.isFinite(score)) return "unrated";
  const bad = badness(score, dir);
  if (bad >= HARD_AT) return "hard";
  if (bad <= CALM_AT) return "calm";
  return "middling";
}

export type FollowUpKind = "field" | "photo" | "note" | "routine";

export interface FollowUp {
  /** Stable id — the field key for a field, the kind otherwise. */
  id: string;
  kind: FollowUpKind;
  /** Present for `field`: which question this answers. */
  key?: string;
  label: string;
  /** One short line under the label — a *fact* about this offer, or nothing.
      Never an instruction: see the note in `followUps`. */
  hint: string | null;
  icon: string;
}

export interface FollowUpContext {
  /** The metric the pulse itself is. Never offered again. */
  primaryKey: string;
  /** Today's pulse, if it has been recorded. */
  score: number | null;
  dir?: Direction;
  /** The whole enabled template, in its own order. */
  fields: PulseField[];
  /** The pack's own idea of what matters, most first (tpl.chartMetrics). */
  priority?: string[];
  /** Today's answers, exactly as stored — a null is a deliberate skip. */
  answers?: Record<string, unknown>;
  hasNote?: boolean;
  /** Photo field keys in this setup. */
  photoFields?: string[];
  photoToday?: boolean;
  /** Days since the last progress photo, or null when there has never been one. */
  daysSincePhoto?: number | null;
  /** Rows on today's routine checklist still unanswered. */
  routineDue?: number;
  /** Per question, the share (0–1) of recent days it was answered on. Optional;
      absent simply means the ordering falls back to the pack's own. */
  usual?: Record<string, number>;
  /** Whether the chip row may offer questions. False when something else on the
      screen is already asking them one at a time, which is the case on Today —
      the same question in two places is one place too many. */
  includeFields?: boolean;
  max?: number;
}

const MAX = 5;
/* A photo is worth asking for when the day is bad enough to be worth seeing
   again later, or when it has simply been a while. Both, not either, would
   mean somebody who never has a bad day is never asked. */
const PHOTO_GAP_DAYS = 7;

const answered = (answers: Record<string, unknown> | undefined, k: string): boolean => {
  if (!answers) return false;
  const v = answers[k];
  if (v == null) return false;          // absent, or a deliberate skip
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
};

/** Every question this screen is allowed to ask inline — the types that can be
    answered in a tap or two. Text, dates and photos are deliberately not among
    them: a photo has its own offer, and a text box is the one thing that turns
    an offer back into a form. */
const ASKABLE = new Set(["scale", "number", "toggle", "chips"]);

export const isAskable = (f: PulseField): boolean => ASKABLE.has(f.type);

/** True when one tap finishes the question, which is what decides whether the
    chain may move on by itself. A number and a multi-select cannot: moving on
    the instant a digit lands would snatch the field away mid-answer. */
export const isOneTap = (f: PulseField): boolean =>
  f.type === "scale" || f.type === "toggle" || (f.type === "chips" && f.single === true);

/** Fields worth offering, in the order the day makes them worth offering.

    Three things decide it, in this order:

    1. **What the pack is about.** `priority` is the journal's own list of the
       metrics that matter (tpl.chartMetrics), and it wins.
    2. **What the day is.** On a hard day the symptom questions come first — the
       ones whose scale runs the same way as the metric that is bad. On a calm
       day the "more is better" questions come first, because those are the ones
       that might explain it.
    3. **What this person actually records.** `usual` is the share of recent days
       each question was answered on. Somebody who fills in their weight every
       morning and has never once touched "possible triggers" should be asked
       for the weight first, whatever the pack thinks — the queue is theirs, not
       the template's.

    The three are one number, and the sizes of the moves are the whole policy:
    the pack's list contributes the position on it, everything else starts just
    past the end of that list, the day's shape moves a question six places, and
    a habit moves it up to ten. Which means a question somebody answers every
    single day can reach the front from anywhere, one they have never answered
    stays exactly where the pack put it, and on a brand-new journal — where
    every habit is zero — the order is the pack's alone.

    Everything outside `priority` keeps its template order, because the sort is
    stable and `ctx.fields` arrives in that order. */
const DAY_BIAS = 6;
const HABIT_LIFT = 10;

function rankFields(ctx: FollowUpContext, kind: DayKind): PulseField[] {
  const priority = ctx.priority || [];
  const usual = ctx.usual || {};
  const rank = (f: PulseField): number => {
    const p = priority.indexOf(f.k);
    let base = p >= 0 ? p : priority.length + 4;
    if (kind === "hard") base += f.dir === "pos" ? DAY_BIAS : 0;
    if (kind === "calm") base += f.dir === "pos" ? 0 : DAY_BIAS;
    const habit = Math.max(0, Math.min(1, usual[f.k] ?? 0));
    return base - Math.round(habit * HABIT_LIFT);
  };
  return ctx.fields
    .filter((f) => f.k !== ctx.primaryKey)
    .filter(isAskable)
    .filter((f) => !answered(ctx.answers, f.k))
    .sort((a, b) => rank(a) - rank(b));
}

/**
 * The whole queue of questions still worth asking today, best first.
 *
 * `followUps` offers two or three of these as chips, because a chip row is a
 * menu and a menu of eleven things is a wall. This is the same ranking with
 * nothing trimmed off it, for the part of the screen that asks them *one at a
 * time* — where the length of the queue is not a cost, because the person only
 * ever sees the front of it.
 *
 * `skip` is what they have waved past in this sitting. It is deliberately not
 * stored: a question skipped this morning is a fair question again tonight,
 * and a journal that permanently learns "don't ask" from one impatient tap is
 * a journal quietly deciding what its owner tracks.
 */
export function askQueue(ctx: FollowUpContext, skip: readonly string[] = []): PulseField[] {
  const kind = dayKind(ctx.score, ctx.dir);
  const skipped = new Set(skip);
  return rankFields(ctx, kind).filter((f) => !skipped.has(f.k));
}

/**
 * How often each question actually gets answered, as a share of recent days.
 *
 * This is what makes the queue the person's rather than the template's. A pack
 * ships with an opinion about what matters; somebody who has filled in sleep
 * every night for a month and never once opened "possible triggers" has a
 * better one, and this is how the app hears it. Feed it the days you would
 * call recent — thirty is plenty — and it counts.
 *
 * Deliberately not persisted anywhere: it is derived from the journal on every
 * render, so it follows what somebody is doing now rather than a habit they
 * had in March.
 */
export function answerHabits(
  fields: PulseField[],
  recent: readonly { answers?: Record<string, unknown> | null }[]
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!recent.length) return out;
  for (const f of fields) {
    let n = 0;
    for (const day of recent) if (answered(day.answers || undefined, f.k)) n++;
    out[f.k] = n / recent.length;
  }
  return out;
}

/** The next question, or null when there is nothing left to ask. */
export function nextQuestion(ctx: FollowUpContext, skip: readonly string[] = []): PulseField | null {
  return askQueue(ctx, skip)[0] ?? null;
}

export interface SurveyProgress {
  /** Questions answered today, counting the pulse itself. */
  answered: number;
  /** Questions this setup can ask inline, counting the pulse itself. */
  total: number;
  /** Still unanswered. Never negative. */
  left: number;
}

/**
 * How much of today's survey is done.
 *
 * Counts the pulse as one of the questions, because it is one: it is the first
 * question of the same daily review, and a progress line that said "0 of 11"
 * immediately after somebody answered something would be the app failing to
 * notice what they just did.
 *
 * Answered means answered — a stored `null` is a deliberate skip and stays
 * outstanding, the same rule the follow-up chips use.
 */
export function surveyProgress(ctx: FollowUpContext): SurveyProgress {
  const askable = ctx.fields.filter(isAskable);
  const total = askable.length + (askable.some((f) => f.k === ctx.primaryKey) ? 0 : 1);
  const answered = askable.filter((f) => answered_(ctx, f)).length
    + (askable.some((f) => f.k === ctx.primaryKey) ? 0 : (ctx.score != null ? 1 : 0));
  return { answered, total, left: Math.max(0, total - answered) };
}

/** The primary metric is answered when the pulse has a value, whether or not
    the caller also put it in `answers`. Everything else reads the journal. */
function answered_(ctx: FollowUpContext, f: PulseField): boolean {
  if (f.k === ctx.primaryKey) return ctx.score != null || answered(ctx.answers, f.k);
  return answered(ctx.answers, f.k);
}

/* Icon names are the app's own small set (see `Icon` in App.tsx); this module
   names one per kind so the chip row never has to branch on type itself. */
const iconFor = (f: PulseField): string =>
  f.type === "toggle" ? "check" : f.type === "chips" ? "star" : f.type === "number" ? "target" : "spark";

/* The unit, where there is one — the single thing about a question the label
   does not already say. "1–10, one tap" and "yes or no" describe the control
   somebody is about to be shown, which they will see for themselves. */
const hintFor = (f: PulseField): string | null => (f.type === "number" && f.unit ? f.unit : null);

/**
 * Three to five optional details, chosen for today.
 *
 * Order is the order they are offered in, and it is deliberate: the questions
 * first (they are answered inline, in one tap), then the things that open
 * something — the routine, the camera — and the note last, because a note is
 * the one that takes typing and should never be the first thing asked for.
 */
export function followUps(ctx: FollowUpContext): FollowUp[] {
  const kind = dayKind(ctx.score, ctx.dir);
  const max = ctx.max ?? MAX;
  const out: FollowUp[] = [];

  /* Two or three questions from the person's own pack — never more, because
     the fourth one turns an offer into the survey this screen exists to
     replace. A hard day gets the extra one: it is the day worth describing. */
  const wantFields = ctx.includeFields === false ? 0 : kind === "hard" ? 3 : 2;
  for (const f of rankFields(ctx, kind).slice(0, wantFields)) {
    out.push({ id: f.k, kind: "field", key: f.k, label: f.label, hint: hintFor(f), icon: iconFor(f) });
  }

  if ((ctx.routineDue ?? 0) > 0) {
    const n = ctx.routineDue!;
    out.push({
      id: "routine", kind: "routine", label: "Routine",
      hint: `${n} left`, icon: "pill",
    });
  }

  const photoWorthIt = (ctx.photoFields?.length ?? 0) > 0 && !ctx.photoToday && (
    kind === "hard"
    || ctx.daysSincePhoto == null
    || ctx.daysSincePhoto >= PHOTO_GAP_DAYS
  );
  /* A hint only ever carries a *fact* — a count, a gap in days, the unit a
     number wants. It never carries a prompt. "Note — what happened?" and
     "Photo — worth seeing again later" are the app filling its own silence:
     the icon and the word already say what the chip does, and a second line
     under each one turns a row of three offers into a paragraph to read. So
     where there is no fact, there is no hint. */
  if (photoWorthIt) {
    out.push({
      id: "photo", kind: "photo", label: "Photo",
      hint: ctx.daysSincePhoto == null || kind === "hard" ? null
        : `${ctx.daysSincePhoto}d since the last`,
      icon: "camera",
    });
  }

  if (!ctx.hasNote) {
    out.push({ id: "note", kind: "note", label: "Note", hint: null, icon: "note" });
  }

  return out.slice(0, max);
}

/* ---------- what the pulse itself says ---------- */

export interface PulseState {
  value: number | null;
  /** True only when the number is actually in the journal. The saved state on
      screen is derived from this and nothing else — never from "a tap
      happened", which is how an app ends up claiming to have saved something
      it dropped. */
  recorded: boolean;
}

export function pulseState(answers: Record<string, unknown> | undefined, key: string): PulseState {
  const v = answers?.[key];
  const value = typeof v === "number" && Number.isFinite(v) ? v : null;
  return { value, recorded: value != null };
}

/** The word for a score, in the metric's own direction. Used under the number
    so a 7 is never ambiguous about which end of the scale it is at. */
export function scoreWord(score: number | null, dir: Direction): string {
  if (score == null) return "";
  const bad = badness(score, dir);
  if (bad <= 2) return "a good day";
  if (bad <= 4) return "a mild day";
  if (bad <= 6) return "a middling day";
  if (bad <= 8) return "a hard day";
  return "a very hard day";
}
