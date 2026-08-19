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
      nag. */

export type Direction = "sym" | "pos" | "neutral" | undefined;

/** A template field, as much of it as this module needs. */
export interface PulseField {
  k: string;
  label: string;
  type: string;
  dir?: Direction;
  unit?: string;
  sec?: string;
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
  /** One short line under the label. Never an instruction. */
  hint: string;
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

/** Fields worth offering, in the order the day makes them worth offering.

    On a hard day the symptom questions come first — the ones whose scale runs
    the same way as the metric that is bad. On a calm day the "more is better"
    questions come first, because they are the ones that might explain it. */
function rankFields(ctx: FollowUpContext, kind: DayKind): PulseField[] {
  const priority = ctx.priority || [];
  const rank = (f: PulseField): number => {
    const p = priority.indexOf(f.k);
    const base = p >= 0 ? p : priority.length + 10;
    if (kind === "hard") return base + (f.dir === "pos" ? 6 : 0);
    if (kind === "calm") return base + (f.dir === "pos" ? 0 : 6);
    return base;
  };
  return ctx.fields
    .filter((f) => f.k !== ctx.primaryKey)
    .filter((f) => f.type === "scale" || f.type === "number" || f.type === "toggle" || f.type === "chips")
    .filter((f) => !answered(ctx.answers, f.k))
    .sort((a, b) => rank(a) - rank(b));
}

/* Icon names are the app's own small set (see `Icon` in App.tsx); this module
   names one per kind so the chip row never has to branch on type itself. */
const iconFor = (f: PulseField): string =>
  f.type === "toggle" ? "check" : f.type === "chips" ? "star" : f.type === "number" ? "target" : "spark";

const hintFor = (f: PulseField): string =>
  f.type === "scale" ? "1–10, one tap"
    : f.type === "toggle" ? "yes or no"
      : f.type === "chips" ? "pick any that apply"
        : f.unit ? `a number in ${f.unit}` : "a number";

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
  const wantFields = kind === "hard" ? 3 : 2;
  for (const f of rankFields(ctx, kind).slice(0, wantFields)) {
    out.push({ id: f.k, kind: "field", key: f.k, label: f.label, hint: hintFor(f), icon: iconFor(f) });
  }

  if ((ctx.routineDue ?? 0) > 0) {
    const n = ctx.routineDue!;
    out.push({
      id: "routine", kind: "routine", label: "Routine",
      hint: `${n} still to tick off`, icon: "pill",
    });
  }

  const photoWorthIt = (ctx.photoFields?.length ?? 0) > 0 && !ctx.photoToday && (
    kind === "hard"
    || ctx.daysSincePhoto == null
    || ctx.daysSincePhoto >= PHOTO_GAP_DAYS
  );
  if (photoWorthIt) {
    out.push({
      id: "photo", kind: "photo", label: "Photo",
      hint: kind === "hard" ? "worth seeing again later"
        : ctx.daysSincePhoto == null ? "your first progress shot"
          : `${ctx.daysSincePhoto} days since the last one`,
      icon: "camera",
    });
  }

  if (!ctx.hasNote) {
    out.push({
      id: "note", kind: "note", label: "Note",
      hint: kind === "calm" ? "what was different today?"
        : kind === "hard" ? "what happened?"
          : "anything worth remembering",
      icon: "note",
    });
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
