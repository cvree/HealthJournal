/* Today's check-in, and how much of it is done.

   The Daily Pulse asks one question and writes it on the tap, and for most
   people on most days that is the whole log. Everything past it — the rest of
   the questions, the routine, the camera, the note — used to be reachable
   only through a link at the foot of the pulse card that said *Add more
   detail*, which is a name for an afterthought. It named the work rather than
   the thing, it promised more of something rather than the completion of
   something, and it sat under the card looking like a footnote.

   It is not an afterthought. The daily check-in is what this app is: a set of
   questions somebody chose about their own body, answered once a day, for long
   enough that the answer means something. So it has a name — **today's
   check-in** — and it has a state, and the state is the point.

   This module owns the arithmetic of that state, and nothing else. It is the
   single answer to one question:

     *Of what today was supposed to hold, how much is in?*

   Two screens ask it and they must never disagree. Today asks it to draw the
   card that opens the check-in; History asks it to put today at the top of the
   record with the same numbers on it. A person who reads "7 of 11" on one
   screen and "8 of 12" on the other has learned that neither is worth reading.

   ---

   **What counts, and what merely shows.**

   Two of the five parts have a real daily target: the questions in somebody's
   own setup, and the rows on their routine that were scheduled for today. Both
   are things the day *asked for*, both have a denominator that the person
   themselves set, and both are therefore what the ring is a ring of.

   The other three — a photo, a note, a meal — have no honest denominator. The
   right number of notes for a Tuesday is not one; it is however many there
   were worth writing. Counting them would either invent a target nobody set,
   or let a day with three meals in it read as more complete than a day with
   one, which is a claim about somebody's eating rather than about their
   journal. So they are shown, with a tick when they happened, and they stay
   out of the fraction.

   That distinction is the whole reason this is a module rather than four lines
   in a component: it is a promise about what a progress ring in a medical
   journal is allowed to mean, and it is enforced in one place. */

import { isAskable, type PulseField } from "./pulse";

/** One line of the breakdown: what it is, how much of it is done. */
export interface CheckinPart {
  id: "questions" | "routine" | "photo" | "note" | "meals";
  label: string;
  /** An icon name from the app's own set (see `Icon` in App.tsx). */
  icon: string;
  done: number;
  /** The target, when there is an honest one. Zero means "no denominator" —
      see the note above about what a ring may claim. */
  total: number;
  /** True when this part is inside the fraction rather than beside it. */
  counted: boolean;
}

export interface CheckinSource {
  /** The whole enabled template, in its own order. */
  fields: PulseField[];
  /** The metric the pulse itself is — counted once, whichever way it arrives. */
  primaryKey: string;
  /** Today's answers exactly as stored; a null is a deliberate skip. */
  answers?: Record<string, unknown> | null;
  /** The pulse value, when the caller holds it apart from `answers`. */
  score?: number | null;
  notes?: string | null;
  /** Today's photos, keyed by field, exactly as the entry stores them. */
  photos?: Record<string, { photoId?: string } | null | undefined> | null;
  /** Whether this setup has any photo question at all. Without one, the photo
      row is not "missing" — it does not exist. */
  hasPhotoFields?: boolean;
  /** Today's routine, already reduced (see routineProgress). Absent, or with a
      total of zero, and the routine row does not appear. */
  routine?: { done: number; skipped: number; total: number } | null;
  /** How many meals are on today's diary. Shown, never counted. */
  meals?: number;
}

export interface CheckinStatus {
  /** The breakdown, counted parts first, in the order they are shown. */
  parts: CheckinPart[];
  /** Answered, out of what today asked for. */
  done: number;
  total: number;
  left: number;
  /** 0–1 over the counted parts. Zero when nothing was asked for. */
  ratio: number;
  /** The same, rounded, for anything that has to print a percentage. */
  pct: number;
  /** Nothing at all is in yet. */
  untouched: boolean;
  /** Everything today asked for is answered. Never true of an empty setup —
      a journal with no questions in it has not finished anything. */
  complete: boolean;
  /** The parts that are shown rather than counted, and did happen. */
  extras: CheckinPart[];
}

const filled = (v: unknown): boolean => {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
};

/** Every question in this setup that the check-in can ask, counting the pulse
    itself — it is the first question of the same daily review, and a count
    that ignored it would be the app failing to notice the tap it just took. */
function questionCounts(src: CheckinSource): { done: number; total: number } {
  const askable = src.fields.filter(isAskable);
  const hasPrimary = askable.some((f) => f.k === src.primaryKey);
  const answers = src.answers || {};
  let done = askable.filter((f) =>
    f.k === src.primaryKey
      ? src.score != null || filled(answers[f.k])
      : filled(answers[f.k])
  ).length;
  let total = askable.length;
  /* A pulse whose metric is not itself an askable question — a photo or a text
     key metric, which a hand-built setup is allowed to have — still counts as
     the one question that was asked. It has to actually be in the setup: a
     primary key naming a field nobody has is not a question, and inventing a
     denominator for it would put a permanent "0 of 1" on an empty journal. */
  if (!hasPrimary && src.fields.some((f) => f.k === src.primaryKey)) {
    total += 1;
    if (src.score != null || filled(answers[src.primaryKey])) done += 1;
  }
  return { done, total };
}

/**
 * The state of today's check-in: what it asked for, and what is in.
 *
 * Everything on both screens that draws this — the ring, the pips, the
 * breakdown, the sentence — reads it from here and nowhere else.
 */
export function checkinStatus(src: CheckinSource): CheckinStatus {
  const q = questionCounts(src);
  const parts: CheckinPart[] = [
    { id: "questions", label: "Questions", icon: "log", done: q.done, total: q.total, counted: true },
  ];

  const routine = src.routine;
  if (routine && routine.total > 0) {
    parts.push({
      id: "routine", label: "Routine", icon: "pill",
      /* A skip is answered, not achieved — the same rule the checklist itself
         uses. The question a routine row asks is "did you deal with this". */
      done: routine.done + routine.skipped,
      total: routine.total,
      counted: true,
    });
  }

  if (src.hasPhotoFields) {
    const shots = Object.values(src.photos || {}).filter((p) => !!p?.photoId).length;
    parts.push({ id: "photo", label: "Photo", icon: "camera", done: shots, total: 0, counted: false });
  }

  parts.push({
    id: "note", label: "Note", icon: "note",
    done: (src.notes || "").trim() ? 1 : 0, total: 0, counted: false,
  });

  if ((src.meals ?? 0) > 0 || src.meals === 0) {
    parts.push({ id: "meals", label: "Meals", icon: "food", done: src.meals ?? 0, total: 0, counted: false });
  }

  const counted = parts.filter((p) => p.counted);
  const done = counted.reduce((n, p) => n + p.done, 0);
  const total = counted.reduce((n, p) => n + p.total, 0);
  const extras = parts.filter((p) => !p.counted && p.done > 0);

  return {
    parts,
    done, total,
    left: Math.max(0, total - done),
    ratio: total ? Math.min(1, done / total) : 0,
    pct: total ? Math.round(Math.min(1, done / total) * 100) : 0,
    untouched: done === 0 && extras.length === 0,
    complete: total > 0 && done >= total,
    extras,
  };
}

/**
 * What the card says under its own name.
 *
 * Four states, four sentences, and the differences between them are
 * deliberate. It never says "well done", it never counts a streak at somebody,
 * and the finished one is a statement about the record rather than about the
 * person: the thing being celebrated is that a day is fully written down, which
 * is the only thing here worth celebrating.
 */
export function checkinLine(s: CheckinStatus): string {
  if (!s.total) return "Answer what applies — everything is optional.";
  if (s.complete) return `All ${s.total} answered. Today is fully on the record.`;
  /* "Questions" would be a lie on a setup with a routine in it: some of these
     are doses to tick rather than questions to answer. */
  if (s.untouched) return `${s.total} to answer, about a minute.`;
  if (s.left === 1) return `${s.done} of ${s.total} in. One left.`;
  return `${s.done} of ${s.total} in. ${s.left} to go.`;
}

/** The name of the action, which changes with the state and nothing else. */
export function checkinVerb(s: CheckinStatus): string {
  if (s.complete) return "Review today's check-in";
  if (s.untouched) return "Start today's check-in";
  return "Finish today's check-in";
}

/**
 * One mark per thing today asked for, in the order the parts are in.
 *
 * The row of pips is the part of this that people actually watch. A fraction
 * is read; a row of small blocks going solid one at a time is *seen*, and seen
 * from the top of the screen without reading anything at all — which is what
 * makes "two left" a thing somebody finishes rather than a thing somebody is
 * told.
 *
 * The row wraps, so a long setup costs a second line rather than legibility,
 * and the limit is set where a real journal actually lands: the packs that
 * ship here run to about thirty questions and doses once a routine is on them,
 * and drawing those as a plain bar would have meant almost nobody ever saw the
 * marks. Past the limit it stops being a count and starts being a texture, and
 * a bar says the same thing better.
 */
export const PIP_LIMIT = 36;

export interface Pip {
  /** Which part this mark belongs to, so the row can be tinted by section. */
  part: CheckinPart["id"];
  on: boolean;
}

export function checkinPips(s: CheckinStatus): Pip[] {
  if (s.total > PIP_LIMIT || s.total === 0) return [];
  const out: Pip[] = [];
  for (const p of s.parts) {
    if (!p.counted) continue;
    for (let i = 0; i < p.total; i++) out.push({ part: p.id, on: i < p.done });
  }
  return out;
}
