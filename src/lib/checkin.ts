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

   Three parts have a real daily target: the questions in somebody's own setup,
   the rows on their routine that were scheduled for today, and the rituals
   today asked for. All three are things the day *asked for*, all three have a
   denominator the person themselves set, and all three are therefore what the
   ring is a ring of.

   The rituals were missing from that list for a release, and it showed in the
   one place it could not be argued with: somebody whose morning is a five-step
   ritual could leave the whole of it untouched and still be told that today was
   fully on the record. A card named "today's check-in" that does not know about
   a thing today asked for is not a check-in, it is a subset with an ambitious
   name.

   The other three — a photo, a note, a meal — have no honest denominator. The
   right number of notes for a Tuesday is not one; it is however many there
   were worth writing. Counting them would either invent a target nobody set,
   or let a day with three meals in it read as more complete than a day with
   one, which is a claim about somebody's eating rather than about their
   journal. So they are shown, with a tick when they happened, and they stay
   out of the fraction.

   That distinction is the whole reason this is a module rather than four lines
   in a component: it is a promise about what a progress ring in a medical
   journal is allowed to mean, and it is enforced in one place.

   ---

   **And the day only asks for what the day asks for.**

   Once a question can carry its own frequency (see lib/cadence), "the whole
   enabled template" stops being the same thing as "what today asked for". A
   weekly weight already answered on Monday is not a question Tuesday is short
   of, and counting it would put a permanent `10 of 11` on a journal that is
   completely up to date — the exact failure this module exists to prevent,
   arriving through the front door.

   So callers pass `due`: the set of question keys the day is actually asking
   for. Absent, everything is due, which is what a daily journal has always
   been and what every existing install still is. */

import { isAskable, type PulseField } from "./pulse";

/** One line of the breakdown: what it is, how much of it is done. */
export interface CheckinPart {
  id: "questions" | "routine" | "rituals" | "photo" | "note" | "meals";
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
  /** Today's rituals, already reduced (see boardProgress in lib/rituals). Same
      contract as the routine: absent or empty and the row is not there, because
      a journal with no rituals in it is not short of one. */
  rituals?: { done: number; skipped: number; total: number } | null;
  /** How many meals are on today's diary. Shown, never counted. */
  meals?: number;
  /** The question keys today is asking for — see `dueKeys` in lib/cadence.
      Absent means all of them, which is what a daily journal is. A question
      already answered inside its own period is neither asked nor counted, so
      the fraction stays a statement about *today* rather than about the
      template. */
  due?: ReadonlySet<string> | null;
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
  /* The pulse is always asked. It is the one question this whole screen is
     built around, and a cadence that quietly retired it would leave Today with
     a scale on it that counts for nothing. */
  const asked = (k: string) => !src.due || k === src.primaryKey || src.due.has(k);
  const askable = src.fields.filter((f) => isAskable(f) && asked(f.k));
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

  /* A ritual is answered when it is finished or deliberately skipped — the
     same rule as a routine row, and for the same reason: the question a
     scheduled thing asks is "did you deal with this". A part-done ritual is
     not answered, which is exactly the state worth showing on a check-in. */
  const rituals = src.rituals;
  if (rituals && rituals.total > 0) {
    parts.push({
      id: "rituals", label: "Rituals", icon: "drop",
      done: rituals.done + rituals.skipped,
      total: rituals.total,
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
 * It never says "well done", it never counts a streak at somebody, and the
 * finished one is a statement about the record rather than about the person:
 * the thing being celebrated is that a day is fully written down, which is the
 * only thing here worth celebrating.
 *
 * It also never repeats the ring. Every caller draws this line beside a ring
 * showing how many are in and a row of pips showing which — so a line reading
 * "7 of 20 in. 13 to go." says the same number three times and adds nothing to
 * the two that are already shapes. What the shapes cannot say is what is
 * *left*, so that is the only thing left here.
 */
export function checkinLine(s: CheckinStatus): string {
  if (!s.total) return "Everything in it is optional.";
  if (s.complete) return "Today is fully on the record.";
  /* "Questions" would be a lie on a setup with a routine in it: some of these
     are doses to tick rather than questions to answer. */
  if (s.untouched) return `${s.total} to answer, about a minute.`;
  return s.left === 1 ? "One left." : `${s.left} to go.`;
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

/* ---------- the record behind today ----------

   What a paper journal gives you when you close a page, and an app almost
   never does, is the *stack*. You put the pen down and the thing you are
   making is visibly one page thicker. Nobody congratulated you; the evidence
   simply moved.

   That is the only kind of satisfaction this card is allowed to offer, and
   until now it did not offer it at all: the day went complete, the ring became
   a tick, and the row of marks that had been counting today's questions became
   fourteen identical solid blocks — a shape that had finished saying anything
   at the exact moment it had the most to say.

   So when today closes, that row is replaced rather than added to. The marks
   stop being today's questions and become the fortnight behind, with today's
   landing solid on the end of it. One shape at a time, same visual language,
   and it only exists in the one state where the other row has nothing left to
   tell anybody.

   What it is not, and must never become: a scoreboard. A day the journal has
   nothing on is a hairline and nothing else — no red, no gap count, no "four
   missed". The make-up row on a weekly journal follows the same rule, for the
   same reason. A record is a record of what happened. It is not a bill for
   what did not. */

/** One day behind today, marked against the journal. */
export interface RecordDay {
  date: string;
  /** The journal has something real on this day. */
  on: boolean;
  /** The day being closed. Always the last mark in the row. */
  today: boolean;
}

/** How long a stretch the row draws. Two weeks is the most a phone can carry
    at a width where a single day is still a distinguishable mark rather than a
    hairline in a texture — the same judgement the pip row makes. */
export const RECORD_STRIP_DAYS = 14;

/**
 * The days ending at `date`, oldest first, marked against what the journal
 * actually holds.
 *
 * `logged` is the app's own set of days with something real on them — the same
 * set every cadence question is asked against, so the row can never claim a
 * day the streak does not.
 */
export function recordStrip(
  logged: ReadonlySet<string> | Iterable<string>,
  date: string,
  days: number = RECORD_STRIP_DAYS
): RecordDay[] {
  const have = logged instanceof Set ? (logged as ReadonlySet<string>) : new Set(logged);
  const out: RecordDay[] = [];
  for (let i = Math.max(1, Math.floor(days)) - 1; i >= 0; i--) {
    const d = shiftDate(date, -i);
    out.push({ date: d, on: have.has(d), today: i === 0 });
  }
  return out;
}

/**
 * What the row says to somebody who cannot see it.
 *
 * A shape that carries information has to carry the same information in words,
 * and this is the sentence: how much of the recent record is written, said as
 * a fact about the journal rather than as a verdict on the person keeping it.
 */
export function recordStripLine(strip: RecordDay[]): string {
  const on = strip.filter((d) => d.on).length;
  return `${on} of the last ${strip.length} days are on the record.`;
}

/* A date shift that does not drag a module of episode arithmetic in behind it.
   Local-time construction on purpose: every date in this app is the day the
   person was living, never a UTC instant. */
function shiftDate(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  const p2 = (v: number) => String(v).padStart(2, "0");
  return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`;
}
