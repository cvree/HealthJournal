/* Import: somebody's own notes, turned into their journal.

   Everybody who tracks anything seriously was already tracking it before they
   found this app. It is in a Notes file, a chat with themselves, a photo of a
   page, a text thread. It looks like this:

       8.21 weight 12pm 182
       8.21 food, 2.5 hamburger, havarti cheese
       2acv premeal + 2 pepsin combo 12:30pm
       8.21 4pm bowel movement, small firm sank
       8.21 Trazo 50mg STARTING NEW MED. Day 1

   Every one of those lines is a row this app already has a shape for. Typing
   them in one at a time, through the right sheet, on the right date, is an
   hour of work — which is why nobody does it, and why a journal that could
   have started in March starts today with nothing behind it.

   So: paste the text, or hand over a screenshot of it, and a model reads it
   and proposes rows. Meals to the diary, doses to the routine, numbers to the
   questions they belong to, movements to the bowel log, everything else to the
   day's note — each on the date and time the note itself gave, not today's.

   Four rules hold this together, and they are not negotiable.

   1. **Nothing is written without being seen.** The model never writes. It
      proposes; every proposal is listed with the words it came from, every one
      can be switched off, every date can be corrected, and one button at the
      bottom commits what survived. `applyImport` is a pure function of what
      the person approved — it has never heard of a model.
   2. **The person's words are kept, not improved.** A note copied into a
      journal that has been "cleaned up" is no longer a record of what they
      wrote. The prompt says copy, never rewrite, and every row carries the
      source fragment beside it so the two can always be compared.
   3. **This one sends the notes.** Every other outbound path in this app is
      built to send as little as possible — `buildAnalysisInput` reduces the
      journal to numbers precisely so free text never leaves. This feature
      cannot do that: the text *is* the input. So it says so, in plain words,
      before anything goes, every time — see `summariseImportRequest` — and it
      does not exist at all unless the person has turned AI on and set up a key.
   4. **A guess is labelled as one.** A row the model was unsure of arrives
      marked unsure, with the assumption it made. A date it could not read
      falls back to today and says so rather than inventing one.

   5. **It never asks instead of answering.** Real notes are ambiguous — two
      things with the same short name, a course with no stated end, a number
      with no unit. A reader that stopped and asked would have turned a paste
      into an interrogation, so it decides, files everything under the decision,
      and hands back the decision *and* the question as one `ImportQuestion`.
      Answer it and the notes are re-read around the answer; ignore it and the
      plan is still complete and still honest about what it assumed.

   What it never does: diagnose, interpret, rate, advise, or invent a row that
   no part of the text supports. Those are prompt rules *and* checks on the way
   back in, the same belt-and-braces as the rest of ./ai.

   One thing it deliberately *will* do is read a paragraph. "I started 10 mg
   amitriptyline last Tuesday and have taken it every night since" is not
   shorthand and has no dates in it, and it is still eight doses, a start date
   and a note. See the prompt's "Two shapes of notes" and `resolveSpan`. */

import { AiError, isDiagnosticText, scrubCausalLanguage } from "./ai";
import type { ChatImage, Connection } from "./aiProviders";
import { chat, isModelGone, isNoVision } from "./aiProviders";
import {
  localTime, mealForTime, mealLabel, newBowelLog, newFoodLog, prettyTime, rememberFood,
} from "./tracking";
import { bumpItemUse, kindLabel, logFromItem, newRoutineItem, slotForTime } from "./routine";
import type {
  AiConfidence, BowelAmount, BowelLog, DailyEntry, FoodItem, FoodLog, MealCategory,
  RoutineItem, RoutineKind, RoutineLog,
} from "../types/models";

/* ---------- what the model is allowed to know ---------- */

/** One question this journal can answer, as much of it as the reader needs. */
export interface VocabField {
  k: string;
  label: string;
  type: string;
  unit?: string;
  options?: string[];
  single?: boolean;
}

/** The journal, described to the model. Deliberately *only* structure: the
    names of the questions, the routine already set up, and the foods already
    saved. No answers, no history, no notes — none of that is needed to read a
    line of text, so none of it goes. */
export interface ImportVocabulary {
  /** Today, as the journal's own local date. Every relative date resolves off it. */
  today: string;
  fields: VocabField[];
  routineItems: { id: string; name: string; kind: RoutineKind; dose?: string }[];
  /** Names only, so "the usual porridge" lands on the food already saved. */
  foods: string[];
}

/** How many screenshots one reading will carry. Four is not arbitrary: it is
    about as much text as a model reads carefully in one pass, and it is what a
    long chat log takes to capture. Past that the honest answer is to run the
    import twice — the duplicate check makes that free. */
export const MAX_IMPORT_IMAGES = 4;

export interface ImportInput {
  /** Pasted or typed notes. */
  text?: string;
  /** A screenshot or photo of them. */
  image?: ChatImage | null;
  /** Several, for the common case: a chat with yourself, screenshotted in
      four goes, is one document. They go in the order given, and the prompt
      is told they are one continuous set, so a date at the top of the second
      shot still governs the lines under it. */
  images?: ChatImage[] | null;
  /** Answers to the questions the last reading asked. Sending them re-reads
      the same notes with the ambiguity settled — see `ImportQuestion`. */
  answers?: ImportAnswer[] | null;
}

/** One of the reading's own questions, answered. */
export interface ImportAnswer {
  ask: string;
  answer: string;
}

/** Every image in one input, in reading order, capped. */
export const imagesOf = (input: ImportInput): ChatImage[] =>
  [...(input.images || []), ...(input.image ? [input.image] : [])]
    .filter(Boolean)
    .slice(0, MAX_IMPORT_IMAGES);

/* ---------- what comes back ---------- */

export type ImportKind = "answer" | "food" | "bowel" | "routine" | "note";

export interface ImportedItem {
  /** Stable within one plan; the review list keys off it. */
  id: string;
  kind: ImportKind;
  /** YYYY-MM-DD, resolved and range-checked. Editable in the review. */
  date: string;
  /** HH:MM when the note gave one. */
  time?: string;
  /** How this row reads in the review list, in the app's own words. */
  label: string;
  /** A second line: the detail that makes it a row rather than a category. */
  detail?: string;
  /** The words this came from. The receipt, and the thing that makes a wrong
      reading obvious at a glance. */
  source: string;
  confidence: AiConfidence;
  /** What the model had to assume, when it had to assume something. */
  note?: string;
  /** True when the date was not in the text and today was assumed. */
  dateGuessed?: boolean;

  /* kind === "answer" */
  key?: string;
  value?: number | boolean | string[];

  /* kind === "food" */
  food?: { description: string; meal: MealCategory; serving?: string };

  /* kind === "bowel" */
  bowel?: {
    bristol?: number; amount?: BowelAmount; color?: string; consistency?: string; notes?: string;
  };

  /* kind === "routine" */
  routine?: { itemId?: string; name: string; kind: RoutineKind; dose?: string; skipped?: boolean };

  /* kind === "note" */
  text?: string;

  /** A row that describes a stretch of days rather than one.

      "10 mg of the antihistamine every night since Tuesday" is eight doses,
      not one, and a journal that files it as one dose on Tuesday is a journal
      that quietly disagrees with the notes it was given. So the row stays one
      row in the review — a list of forty proposals is unreadable if a fortnight
      of a nightly tablet takes fourteen lines of it — and writes one record per
      day when it is approved. `days` is the resolved, capped, sorted list, and
      it is what `applyImport` iterates: the two ends are for the label. */
  span?: { from: string; to: string; days: string[] };
}

/**
 * Something the reading was genuinely unsure of, with the reading it used.
 *
 * The rule this shape exists to enforce: **a question never stops the import.**
 * A model that asked "which antihistamine did you mean?" and returned no rows
 * would have turned a paste into an interrogation. So it picks the likeliest
 * reading, files everything under it, and hands back the question *and* the
 * assumption it already made — which means somebody who reads none of this
 * still gets a complete, honest plan, and somebody who reads it can correct
 * one thing and have the whole reading redone around the correction.
 */
export interface ImportQuestion {
  id: string;
  /** The question, in plain words. */
  ask: string;
  /** What it changes about the rows. One short sentence. */
  why?: string;
  /** Two to four concrete answers, one of which is `assumed`. */
  options: string[];
  /** The option the plan in front of you was actually built on. */
  assumed: string;
}

export interface ImportPlan {
  items: ImportedItem[];
  /** Which model read it, for the receipt on the review screen. */
  model: string;
  /** What the model could read but could not place, in its own words. Empty is
      the norm, and a full one is the honest half of the feature. */
  unreadable?: string;
  /** What it had to decide for itself, each with the decision it made. */
  questions?: ImportQuestion[];
  /** Rows this app refused on the way in — a question it does not ask, a value
      the question cannot hold, a row with nothing behind it. Their source
      fragments, so the review can say what was dropped instead of silently
      being shorter than the notes. */
  unplaced?: string[];
}

/* ---------- what leaves the device ---------- */

/**
 * Plain words for what this import is about to send, shown before it goes.
 *
 * The rest of the app can promise that free text never leaves; this feature
 * cannot, and papering over that with a vague "sends some data" line would be
 * the one dishonest sentence in the product. So it counts the characters, says
 * whether an image is going, and names the structural things that ride along.
 */
export function summariseImportRequest(input: ImportInput, vocab: ImportVocabulary): {
  sendsImage: boolean;
  characters: number;
  lines: string[];
} {
  const body = (input.text || "").trim();
  const shots = imagesOf(input);
  const lines: string[] = [];
  if (body) {
    lines.push(`The ${body.length.toLocaleString("en-US")} characters of notes you pasted, exactly as written`);
  }
  if (shots.length === 1) lines.push("The screenshot you chose, as an image");
  else if (shots.length > 1) lines.push(`The ${shots.length} screenshots you chose, as images`);
  lines.push(`The names of your ${vocab.fields.length} questions, so a number can be filed against the right one`);
  if (vocab.routineItems.length) {
    lines.push(`The names of the ${vocab.routineItems.length} things in your routine, so a dose matches one you already have`);
  }
  if (vocab.foods.length) lines.push(`The names of your ${vocab.foods.length} saved foods`);
  lines.push("Today's date, so a note that says “yesterday” means something");
  if (input.answers?.length) {
    lines.push(`Your ${input.answers.length === 1 ? "answer" : `${input.answers.length} answers`} to what it asked last time`);
  }
  return { sendsImage: shots.length > 0, characters: body.length, lines };
}

/* ---------- the prompt ---------- */

const IMPORT_SYSTEM = `You are reading someone's own health notes and turning each line into a row for their personal health journal. You are a transcriber and a filing clerk. You are not an analyst, a clinician, or an editor.

You will be given: today's date, the list of questions this person's journal asks, the list of things already in their routine, the names of foods they have already saved, and their notes as text and/or as an image of text.

Return one item per distinct thing the notes record. One line often holds several: "8.21 food, 2.5 hamburger, havarti cheese" is a meal; "2acv premeal + 2 pepsin combo 12:30pm" is two doses at the same time.

## Two shapes of notes, one job

Some notes are a log — dated shorthand, one thing per line. Read those line by line.

Others are somebody describing how things have been, in sentences, to you: "I started 10mg amitriptyline last Tuesday for sleep, taking it every night since. Sleep has been maybe a 4 out of 10 most nights, worse at the weekend. Cut out dairy on the 12th and the itch has been better since — I'd say a 3 today, was a 7 before." That is a paragraph, and it is still a pile of rows: a course of a medication over a stretch of days, a rating on a question, a change of diet, a rating today. Read it exactly as carefully as the log. Pull out every fact that is a row and leave the rest as a note, in their words.

Do not invent precision the prose did not have. "Maybe a 4 most nights" is one answer of 4 with low confidence and a caveat that says so — not seven answers of 4.

## The kinds

- "answer": a number, a rating, a yes/no or a choice that belongs to one of this person's questions. Use "key" for the question's key, exactly as given. Put the value in "number" for a number or a 1-10 rating, "yes" for a yes/no, or "choices" for one or more of that question's listed options. Only ever use a key from the list you were given — if nothing fits, it is not an answer, it is a note.
- "food": something eaten or drunk. Put what they ate in "description", in their words. Set "meal" to breakfast, lunch, dinner, snack or drink if the note says so or the time implies it. Put a stated amount in "serving" ("2.5 patties", "1 bowl", "large").
- "bowel": a bowel movement. Fill only what the note actually describes: "bristol" 1-7 if the description places it on the Bristol scale, "amount" small/medium/large, "color", "consistency". Anything else the note said about it goes in "text".
- "routine": a medication, supplement, cream, product or daily driver being taken, applied or used. Put the name in "name" and the amount in "dose" ("50 mg", "2 capsules", "2 pumps"). If it matches something already in their routine, set "itemId" to that item's id and use that item's exact name. Otherwise set "routineKind" to med, supplement, topical, product, food or other. Set "skipped" true only if the note says they did NOT take it.
- "note": anything worth keeping that is none of the above — how they felt, what happened, an observation, a plan. Put the person's own words in "text".

## Dates and times

Every item needs "date" as YYYY-MM-DD. Notes are written in shorthand: "8.21", "8/21", "Thu", "yesterday", "last night". Resolve them against today's date, which you are given. A bare month and day with no year means the most recent occurrence of that date that is not in the future. If a line has no date of its own, it belongs to the date of the line above it. If nothing in the notes gives you a date at all, use today's date and say so in "note".

Never return a date in the future.

Set "time" as HH:MM in 24-hour form when the note gives one ("12pm" is 12:00, "1:20pm" is 13:20, "10:54 PM" is 22:54). Leave it out when the note does not — do not invent one.

## Something that happened over a stretch of days

When the notes say something ran across days rather than happening once — "every night since Tuesday", "twice a day for five days", "took it all last week", "porridge every morning this week" — set "date" to the first day and "until" to the last day it covers, as YYYY-MM-DD. The app writes one row per day between them.

"until" is only for a medication, supplement, product or food that genuinely repeated. Never use it for a bowel movement, for a note, or for a rating: repeating one number across a week that was never rated seven times would be inventing six answers. A course still running today ends today.

If a stretch has no clear end in the notes, end it today and say so in "note".

## Rules

- Copy the person's own words. Never rewrite, summarise, correct, tidy, translate or improve them. Their spelling of a medication is their spelling. This is a record, not a draft.
- Never invent a row. If the notes do not say it, it is not there. An empty result for an unreadable image is a correct answer.
- Never interpret. Do not say what something means, whether it is good or bad, high or low, normal or concerning, improving or worsening. Do not name or suggest any condition, diagnosis or cause. Do not advise anything. You are filing what they wrote.
- "source" must be the exact fragment of their notes this row came from, so they can check your reading against their own words. Copy it verbatim, at most 200 characters.
- "confidence": "high" when the line plainly says this; "medium" when you had to interpret shorthand or infer a category; "low" when you are guessing at the date, the amount, or what a word means.
- "note": only when you had to assume something — which date you picked and why, an amount you guessed at, an abbreviation you read one way rather than another. One short sentence. Leave it empty otherwise.
- Put anything you could read but could not place into "unreadable", in their words, so they can see what was dropped.

## When you are not sure

Never stop, never ask instead of answering, and never leave a row out because you were unsure of it. Pick the most likely reading, file every row under it, and then — for at most three things, and only the ones that genuinely change what gets written — add an entry to "questions":

- "ask": the question in plain words, as you would ask a person. One sentence.
- "why": what it changes about the rows. One short sentence.
- "options": two to four concrete answers. Real ones, in their words where you have them.
- "assumed": the option you actually used, copied exactly from "options".

The rows you return must already be built on "assumed". Somebody who reads none of your questions must still get a complete, honest plan.

Ask only about things you could not settle from the notes: which of two things a name refers to, whether a stretch of days ended, whether a number is the unit you assumed. Do not ask which question something belongs to when the list of questions answers it, do not ask them to confirm something the notes plainly say, and never ask anything clinical.`;

const IMPORT_ITEM_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["answer", "food", "bowel", "routine", "note"] },
    date: { type: "string" },
    until: { type: "string" },
    time: { type: "string" },
    source: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    note: { type: "string" },
    /* answer */
    key: { type: "string" },
    number: { type: "number" },
    yes: { type: "boolean" },
    choices: { type: "array", items: { type: "string" } },
    /* food */
    description: { type: "string" },
    meal: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack", "drink"] },
    serving: { type: "string" },
    /* bowel */
    bristol: { type: "integer" },
    amount: { type: "string", enum: ["small", "medium", "large"] },
    color: { type: "string" },
    consistency: { type: "string" },
    /* routine */
    itemId: { type: "string" },
    name: { type: "string" },
    routineKind: { type: "string", enum: ["med", "supplement", "topical", "product", "food", "other"] },
    dose: { type: "string" },
    skipped: { type: "boolean" },
    /* note, and whatever else a bowel line said */
    text: { type: "string" },
  },
  required: ["kind", "date", "source", "confidence"],
};

const IMPORT_QUESTION_SCHEMA = {
  type: "object",
  properties: {
    ask: { type: "string" },
    why: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    assumed: { type: "string" },
  },
  required: ["ask", "options", "assumed"],
};

const IMPORT_SCHEMA = {
  type: "object",
  properties: {
    items: { type: "array", items: IMPORT_ITEM_SCHEMA },
    unreadable: { type: "string" },
    questions: { type: "array", items: IMPORT_QUESTION_SCHEMA },
  },
  required: ["items"],
};

const IMPORT_JSON_HINT =
  "\n\nReply with JSON only — no prose, no markdown fence — matching: " +
  '{"items":[{"kind":"answer"|"food"|"bowel"|"routine"|"note","date":"YYYY-MM-DD",' +
  '"until":"YYYY-MM-DD","time":"HH:MM",' +
  '"source":string,"confidence":"low"|"medium"|"high","note":string,"key":string,"number":number,' +
  '"yes":boolean,"choices":[string],"description":string,' +
  '"meal":"breakfast"|"lunch"|"dinner"|"snack"|"drink","serving":string,"bristol":number,' +
  '"amount":"small"|"medium"|"large","color":string,"consistency":string,"itemId":string,' +
  '"name":string,"routineKind":"med"|"supplement"|"topical"|"product"|"food"|"other","dose":string,' +
  '"skipped":boolean,"text":string}],"unreadable":string,' +
  '"questions":[{"ask":string,"why":string,"options":[string],"assumed":string}]}';

/** The journal, written out for the model. A readable list rather than a wall
    of schema: the task is filing text against names, and names are what a
    reader files against. */
export function describeVocabulary(vocab: ImportVocabulary): string {
  const lines: string[] = [`Today is ${vocab.today}.`, "", "Questions this journal asks:"];
  if (!vocab.fields.length) lines.push("  (none)");
  for (const f of vocab.fields) {
    let line = `  ${f.k} — ${f.label} (${f.type}`;
    if (f.type === "scale") line += ", 1-10";
    if (f.unit) line += `, in ${f.unit}`;
    line += ")";
    if (f.options?.length) line += ` options: ${f.options.join(", ")}`;
    lines.push(line);
  }
  lines.push("", "Already in their routine:");
  if (!vocab.routineItems.length) lines.push("  (nothing yet)");
  for (const r of vocab.routineItems) {
    lines.push(`  ${r.id} — ${r.name}${r.dose ? ` (${r.dose})` : ""} [${r.kind}]`);
  }
  if (vocab.foods.length) {
    lines.push("", `Foods they have saved: ${vocab.foods.slice(0, 80).join(", ")}`);
  }
  return lines.join("\n");
}

/* ---------- dates ---------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** How far back an imported date is allowed to reach. Three years is longer
    than anybody's notes file and short enough that a model answering "8.21"
    with 2019 is caught rather than filed. */
export const IMPORT_MAX_AGE_DAYS = 365 * 3;

const dayNumber = (iso: string): number => Date.UTC(
  Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))
) / 86400000;

/**
 * A date the journal will accept, and whether it had to be invented.
 *
 * A journal is a record of what happened, so it cannot hold tomorrow; and a
 * date three years adrift is far likelier to be a misread than an entry
 * somebody wants restored. Both fall back to today and are flagged rather than
 * dropped, because the row itself is usually right and the date is one tap to
 * fix in the review — throwing away a real meal over a misread "8.21" would be
 * the worse failure.
 */
export function resolveDate(raw: unknown, today: string): { date: string; guessed: boolean } {
  const s = String(raw ?? "").trim().slice(0, 10);
  if (!DATE_RE.test(s)) return { date: today, guessed: true };
  const d = dayNumber(s);
  const t = dayNumber(today);
  if (!isFinite(d) || !isFinite(t)) return { date: today, guessed: true };
  if (d > t) return { date: today, guessed: true };
  if (t - d > IMPORT_MAX_AGE_DAYS) return { date: today, guessed: true };
  return { date: s, guessed: false };
}

export const resolveTime = (raw: unknown): string | undefined => {
  const s = String(raw ?? "").trim().slice(0, 5);
  return TIME_RE.test(s) ? s : undefined;
};

/** The longest stretch one row may write. A quarter is longer than any course
    somebody describes in a paste and short enough that a misread "until" can
    never turn one line into a thousand rows. */
export const MAX_SPAN_DAYS = 92;

const isoOf = (n: number): string => new Date(n * 86400000).toISOString().slice(0, 10);

/** Which kinds may describe a stretch of days at all.

    A rating and a bowel movement are deliberately not on this list, and for
    the same reason: repeating either across a week manufactures records
    nobody made. "About a 4 most nights" is one answer with a caveat — six
    invented fours would be six data points the charts would then draw. */
const SPANNABLE = new Set<ImportKind>(["routine", "food"]);

/**
 * A row's days: one, or the stretch it covers.
 *
 * Returns null when there is no stretch — which is the overwhelmingly common
 * case, and the one that costs nothing. Everything questionable collapses back
 * to the single date rather than being dropped: a dose is still a dose when the
 * "until" beside it was nonsense.
 */
export function resolveSpan(
  kind: ImportKind, date: string, raw: unknown, today: string
): { from: string; to: string; days: string[] } | null {
  if (!SPANNABLE.has(kind)) return null;
  const end = resolveDate(raw, today);
  if (end.guessed) return null; // unreadable, or the future — treat as no span
  const from = dayNumber(date);
  const to = dayNumber(end.date);
  if (!isFinite(from) || !isFinite(to) || to <= from) return null;
  const last = Math.min(to, from + MAX_SPAN_DAYS - 1);
  const days: string[] = [];
  for (let d = from; d <= last; d++) days.push(isoOf(d));
  return { from: days[0], to: days[days.length - 1], days };
}

/** "every day, 12–19 Aug (8 days)", in the app's own words. */
export function spanLabel(span: { days: string[] }): string {
  const n = span.days.length;
  return `every day for ${n} day${n === 1 ? "" : "s"}`;
}

/* ---------- normalising what came back ---------- */

/* Control characters are stripped rather than escaped: they cannot mean
   anything in a journal row, and they are how a reply reaches a screen looking
   like something it is not. */
const CONTROL = /[\u0000-\u001f\u007f]/g;

const text = (v: unknown, max: number): string =>
  String(v ?? "").replace(CONTROL, " ").trim().slice(0, max);

/* The one exception: a note is prose the person wrote, and their line breaks
   are part of it — so newlines and tabs survive and nothing else does. */
const KEEP_BREAKS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const prose = (v: unknown, max: number): string =>
  String(v ?? "").replace(KEEP_BREAKS, " ").trim().slice(0, max);

const asConfidence = (v: unknown): AiConfidence =>
  v === "high" ? "high" : v === "low" ? "low" : "medium";

const ROUTINE_KINDS = new Set(["med", "supplement", "topical", "product", "food", "other"]);
const MEAL_KINDS = new Set(["breakfast", "lunch", "dinner", "snack", "drink"]);
const AMOUNTS = new Set(["small", "medium", "large"]);

/**
 * The reading's own questions, with the assumption each one was answered by.
 *
 * A question the app cannot present is worse than no question: two options or
 * it is not a choice, and an `assumed` that is not one of them would put a
 * review on screen claiming the plan was built on something it was not. Both
 * are repaired where repair is honest (an absent `assumed` becomes the first
 * option, which is what the prompt asks for anyway) and dropped where it is
 * not.
 */
export function normaliseQuestions(raw: unknown): ImportQuestion[] {
  const rows: any[] = Array.isArray(raw) ? raw.slice(0, 3) : [];
  const out: ImportQuestion[] = [];
  rows.forEach((r, i) => {
    if (!r || typeof r !== "object") return;
    const ask = text(r.ask, 160);
    if (!ask || isDiagnosticText(ask)) return;
    const options: string[] = [];
    for (const o of Array.isArray(r.options) ? r.options : []) {
      const label = text(o, 80);
      if (label && !options.includes(label)) options.push(label);
      if (options.length === 4) break;
    }
    if (options.length < 2) return;
    const wanted = text(r.assumed, 80);
    const assumed = options.find((o) => o.toLowerCase() === wanted.toLowerCase()) || options[0];
    const why = text(r.why, 160);
    out.push({
      id: `imq_${i}`,
      ask,
      why: why && !isDiagnosticText(why) ? scrubCausalLanguage(why) || undefined : undefined,
      options,
      assumed,
    });
  });
  return out;
}

/**
 * Turn a model's reply into rows this app would accept, or into nothing.
 *
 * This is the boundary. Everything past it is treated as the app's own data,
 * so everything questionable stops here: a question key that does not exist, a
 * routine id that does not exist, a value of the wrong type for the question
 * it claims, a row with no substance behind it, a caveat that strayed into
 * diagnosis. Each is dropped rather than repaired — a row whose provenance
 * nobody can explain has no business in a medical record.
 *
 * Exported for tests, because this is the function that has to hold when a
 * model ignores half of its instructions.
 */
export function normaliseImportPlan(parsed: any, vocab: ImportVocabulary, model = ""): ImportPlan {
  const byKey = new Map(vocab.fields.map((f) => [f.k, f]));
  const byItemId = new Map(vocab.routineItems.map((r) => [r.id, r]));
  const byItemName = new Map(vocab.routineItems.map((r) => [r.name.trim().toLowerCase(), r]));
  const raw: any[] = Array.isArray(parsed?.items) ? parsed.items.slice(0, 300) : [];
  const items: ImportedItem[] = [];
  /* What was refused, in the words it came from. A shorter list than the notes
     with no explanation is the one outcome that makes somebody distrust the
     whole feature — so every drop is accounted for on the review screen. */
  const unplaced: string[] = [];
  const refuse = (r: any) => {
    const fragment = text(r?.source, 200) || text(r?.text, 200) || text(r?.description, 200);
    if (fragment && !unplaced.includes(fragment) && unplaced.length < 20) unplaced.push(fragment);
  };

  raw.forEach((r, i) => {
    if (!r || typeof r !== "object") return;
    const kind = r.kind;
    if (kind !== "answer" && kind !== "food" && kind !== "bowel" && kind !== "routine" && kind !== "note") {
      refuse(r);
      return;
    }

    const { date, guessed } = resolveDate(r.date, vocab.today);
    const time = resolveTime(r.time);
    const span = resolveSpan(kind, date, r.until, vocab.today);
    /* The caveat is the one string here the model wrote rather than copied, so
       it gets what the rest of the app gives model prose: softened for causal
       language, dropped outright if it reads as a diagnosis. */
    const caveat = (() => {
      const n = text(r.note, 240);
      if (!n || isDiagnosticText(n)) return undefined;
      return scrubCausalLanguage(n) || undefined;
    })();

    const base = {
      id: `imp_${i}`,
      date,
      time,
      source: text(r.source, 200),
      confidence: asConfidence(r.confidence),
      note: caveat,
      dateGuessed: guessed || undefined,
      span: span || undefined,
    };
    /* A stretch of days is the row's headline detail, not a footnote: it is
       the difference between one tablet and fourteen, and the review is where
       somebody has to be able to see which they are approving. */
    const over = span ? spanLabel(span) : null;

    if (kind === "answer") {
      const f = byKey.get(text(r.key, 80));
      if (!f) { refuse(r); return; } // a question this journal does not ask is not an answer
      const value = coerceAnswer(f, r);
      if (value == null) { refuse(r); return; }
      items.push({ ...base, kind, key: f.k, value, label: f.label, detail: describeAnswer(f, value) });
      return;
    }

    if (kind === "food") {
      const description = text(r.description, 200);
      if (!description) { refuse(r); return; }
      const meal = (MEAL_KINDS.has(r.meal) ? r.meal : mealForTime(time || "12:00")) as MealCategory;
      const serving = text(r.serving, 60) || undefined;
      items.push({
        ...base,
        kind,
        food: { description, meal, serving },
        label: description,
        detail: [mealLabel(meal), serving, time && prettyTime(time), over].filter(Boolean).join(" · "),
      });
      return;
    }

    if (kind === "bowel") {
      const bristolRaw = Number(r.bristol);
      const bowel = {
        bristol: isFinite(bristolRaw) && bristolRaw >= 1 && bristolRaw <= 7 ? Math.round(bristolRaw) : undefined,
        amount: (AMOUNTS.has(r.amount) ? r.amount : undefined) as BowelAmount | undefined,
        color: text(r.color, 40) || undefined,
        consistency: text(r.consistency, 40) || undefined,
        notes: text(r.text, 300) || undefined,
      };
      items.push({
        ...base,
        kind,
        bowel,
        label: "Bowel movement",
        detail: [
          bowel.bristol ? `Type ${bowel.bristol}` : null,
          bowel.amount, bowel.color, bowel.consistency,
          time ? prettyTime(time) : null,
        ].filter(Boolean).join(" · ") || undefined,
      });
      return;
    }

    if (kind === "routine") {
      const existing = byItemId.get(text(r.itemId, 60))
        || byItemName.get(text(r.name, 80).toLowerCase());
      const name = existing ? existing.name : text(r.name, 80);
      if (!name) { refuse(r); return; }
      const routineKind = (existing
        ? existing.kind
        : ROUTINE_KINDS.has(r.routineKind) ? r.routineKind : "supplement") as RoutineKind;
      const dose = text(r.dose, 60) || existing?.dose || undefined;
      const skipped = r.skipped === true || undefined;
      items.push({
        ...base,
        kind,
        routine: { itemId: existing?.id, name, kind: routineKind, dose, skipped },
        label: name,
        detail: [
          dose, kindLabel(routineKind), time ? prettyTime(time) : null,
          over,
          existing ? null : "new to your routine",
          skipped ? "skipped" : null,
        ].filter(Boolean).join(" · ") || undefined,
      });
      return;
    }

    const body = prose(r.text, 2000);
    if (!body) { refuse(r); return; }
    items.push({ ...base, kind, text: body, label: "Note", detail: body });
  });

  const questions = normaliseQuestions(parsed?.questions);
  return {
    items,
    model,
    unreadable: prose(parsed?.unreadable, 600) || undefined,
    questions: questions.length ? questions : undefined,
    unplaced: unplaced.length ? unplaced : undefined,
  };
}

/** The value for one question, in the type that question stores — or null when
    the model offered something the question cannot hold. */
function coerceAnswer(f: VocabField, r: any): number | boolean | string[] | null {
  if (f.type === "toggle") return typeof r.yes === "boolean" ? r.yes : null;
  if (f.type === "chips") {
    const opts = f.options || [];
    const want = Array.isArray(r.choices) ? r.choices.map((c: unknown) => text(c, 60)) : [];
    /* Matched case-insensitively, stored in the journal's own spelling — or the
       answer will not group with every other day's. */
    const picked: string[] = [];
    for (const w of want) {
      const hit = opts.find((o) => o.toLowerCase() === w.toLowerCase());
      if (hit && !picked.includes(hit)) picked.push(hit);
    }
    if (!picked.length) return null;
    return f.single ? [picked[0]] : picked;
  }
  const n = Number(r.number);
  if (!isFinite(n)) return null;
  if (f.type === "scale") return n >= 1 && n <= 10 ? Math.round(n) : null;
  if (f.type === "number") return n >= -1e6 && n <= 1e6 ? Math.round(n * 100) / 100 : null;
  return null;
}

function describeAnswer(f: VocabField, v: number | boolean | string[]): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.join(", ");
  if (f.type === "scale") return `${v} out of 10`;
  return f.unit ? `${v} ${f.unit}` : String(v);
}

/* ---------- running it ---------- */

/**
 * Read a pile of notes and propose rows. Never writes anything.
 *
 * The runner is a near-copy of ./ai's `runStructured` rather than a call into
 * it, for one reason: this is the only path in the app whose payload is the
 * person's own prose, and sharing a runner would make it possible to change
 * what the other four send by editing this one. It is fifteen lines. They can
 * be two copies.
 */
export async function readNotes(
  conn: Connection,
  input: ImportInput,
  vocab: ImportVocabulary,
  opts: { signal?: AbortSignal } = {}
): Promise<ImportPlan> {
  if (!conn?.key?.trim()) throw new AiError("no-key", "No API key is set.");
  const body = (input.text || "").trim();
  const shots = imagesOf(input);
  if (!body && !shots.length) {
    throw new AiError("not-enough-data", "Paste some notes or choose a screenshot, and I can read them.");
  }

  /* The images are named as *one continuous set* rather than as several
     separate pictures. It matters: a chat log screenshotted in four goes has
     a date at the top of shot two that governs the lines under it in shot
     three, and a model told it is looking at four unrelated images will not
     carry that across. */
  const shotLine = shots.length === 0
    ? "Their notes:"
    : shots.length === 1
      ? (body ? "Their notes are below, and there is an image of notes as well." : "Their notes are in the image.")
      : (body
        ? `Their notes are below, and there are also ${shots.length} images. The images are consecutive screenshots of one continuous set of notes, in order — read them as one document.`
        : `Their notes are in the ${shots.length} images. They are consecutive screenshots of one continuous set of notes, in order — read them as one document, so a date near the top of one still applies to the lines below it in the next.`);

  /* A second pass. The notes are sent again unchanged — the answers settle an
     ambiguity, they do not replace the text — and the questions are quoted
     back so the model can see which of its own it is being answered on. */
  const answered = (input.answers || [])
    .filter((a) => a && a.ask && a.answer)
    .slice(0, 3);
  const answerBlock = answered.length
    ? [
      "",
      "You read these notes once already and asked about a few things. Here are their answers — take each as settled fact, apply it, and re-read the whole notes under it:",
      ...answered.map((a) => `  ${a.ask} → ${a.answer}`),
      "Do not ask these again.",
    ].join("\n")
    : "";

  const user = [
    describeVocabulary(vocab),
    answerBlock,
    "",
    shotLine,
    body ? "\n" + body.slice(0, 40000) : "",
  ].join("\n");

  const c: Connection = { ...conn };
  const attempt = async (allowRetry: boolean): Promise<string> => {
    try {
      return await chat(c, {
        system: IMPORT_SYSTEM,
        user,
        images: shots,
        schema: IMPORT_SCHEMA,
        jsonHint: IMPORT_JSON_HINT,
        maxTokens: 8000,
        signal: opts.signal,
      });
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;
      if (typeof e?.status !== "number") {
        throw new AiError("network", "Couldn't reach the service. Check your connection and try again.");
      }
      const errBody = String(e.body || e.message || "");
      if (allowRetry && isModelGone(e.status, errBody)) {
        c.model = undefined;
        return attempt(false);
      }
      if (shots.length && isNoVision(e.status, errBody)) {
        throw new AiError(
          "response",
          "The model this app picked for you reads text but not images. Paste the notes as text instead, or choose a different provider in Settings."
        );
      }
      if (e.status === 401 || e.status === 403) {
        throw new AiError("auth", "That key was turned down. Check it in Settings.");
      }
      if (e.status === 429) {
        throw new AiError("rate", "The service is rate-limiting this key. Wait a minute and try again.");
      }
      throw new AiError("response", "The service couldn't read that. Try again, or try a smaller chunk of notes.");
    }
  };

  const reply = await attempt(true);
  let parsed: any;
  try {
    parsed = JSON.parse(reply.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""));
  } catch {
    throw new AiError("response", "The reading came back in an unexpected shape. Try again.");
  }
  return normaliseImportPlan(parsed, vocab, c.model || "");
}

/* ---------- writing it down ---------- */

/** The slices an import can touch. Everything else in the journal is untouched
    by definition — this is the whole surface. */
export interface ImportTargets {
  entries: DailyEntry[];
  food: FoodLog[];
  foods: FoodItem[];
  bowel: BowelLog[];
  routine: RoutineLog[];
  routineItems: RoutineItem[];
}

export interface ImportResult {
  next: ImportTargets;
  /** How many rows of each kind actually landed. */
  added: Record<ImportKind, number>;
  /** Rows skipped because that thing was already in the journal. */
  duplicates: number;
  /** Which proposals landed on nothing at all, by id — every day they cover
      was already in the journal. The review runs this function against the
      real journal before anything is written and marks them, so "6 of these
      are already here" is something somebody learns *before* they commit
      rather than in the receipt afterwards. */
  duplicateIds: string[];
}

const stamp = () => new Date().toISOString();
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

/**
 * Write approved rows into the journal. Pure, synchronous, and model-free.
 *
 * Three things it is careful about.
 *
 * **It never overwrites.** An answer for a date that already has one is
 * skipped, not replaced: the person answered that question themselves, and an
 * import quietly correcting them is the one behaviour that would make this
 * unusable on a journal already running. Notes are appended on their own line,
 * never swapped.
 *
 * **It never doubles up.** Importing the same notes twice is what everybody
 * does — the first run is a test. A meal, a dose or a movement matching one
 * already on that date and time is counted as a duplicate and dropped.
 *
 * **It teaches the library exactly as much as an ordinary save would.** A meal
 * logged here reaches `rememberFood` like any other, and a routine item
 * invented here is created as-needed rather than daily: a line in a note is
 * evidence somebody took something once, not evidence the checklist should
 * start chasing them for it every morning.
 *
 * A row carrying a `span` writes one record per day in it, under all three
 * rules above — so re-importing "every night since Tuesday" a second time
 * adds nothing, and a course that overlaps days somebody logged by hand fills
 * only the gaps.
 */
export function applyImport(cur: ImportTargets, items: readonly ImportedItem[]): ImportResult {
  const entries = cur.entries.slice();
  const food = cur.food.slice();
  const bowel = cur.bowel.slice();
  const routine = cur.routine.slice();
  let foods = cur.foods.slice();
  let routineItems = cur.routineItems.slice();
  const added: Record<ImportKind, number> = { answer: 0, food: 0, bowel: 0, routine: 0, note: 0 };
  let duplicates = 0;
  const duplicateIds: string[] = [];

  const entryFor = (date: string): DailyEntry => {
    const i = entries.findIndex((e) => e.date === date);
    if (i >= 0) {
      const copy = { ...entries[i], answers: { ...entries[i].answers } };
      entries[i] = copy;
      return copy;
    }
    const fresh: DailyEntry = {
      id: `e_${date}_${Math.random().toString(36).slice(2, 9)}`,
      date,
      answers: {},
      createdAt: stamp(),
      updatedAt: stamp(),
    };
    entries.push(fresh);
    return fresh;
  };

  /* One proposal, one row — except for a stretch of days, which is one
     proposal and one row *per day*. `datesOf` is the whole of that difference,
     and keeping it here rather than in the review means the list somebody
     approves stays the length of the notes rather than the length of the
     calendar. */
  const datesOf = (it: ImportedItem): string[] =>
    (it.span?.days?.length ? it.span.days : [it.date]);

  for (const proposal of items) {
    /* A row that covers eight days and lands on none of them is a duplicate;
       one that lands on six of eight is not. The count is per row written, the
       id is per proposal entirely refused. */
    let landed = 0;
    for (const on of datesOf(proposal)) {
      const it: ImportedItem = on === proposal.date ? proposal : { ...proposal, date: on };
      if (it.kind === "answer" && it.key) {
        const e = entryFor(it.date);
        if (e.answers[it.key] != null) { duplicates++; continue; }
        e.answers[it.key] = it.value as never;
        e.updatedAt = stamp();
        added.answer++; landed++;
        continue;
      }

      if (it.kind === "note" && it.text) {
        const e = entryFor(it.date);
        const had = (e.notes || "").trim();
        const line = it.text.trim();
        if (had.includes(line)) { duplicates++; continue; }
        e.notes = had ? `${had}\n${line}` : line;
        e.updatedAt = stamp();
        added.note++; landed++;
        continue;
      }

      if (it.kind === "food" && it.food) {
        const time = it.time || localTime();
        const dupe = food.some((f) =>
          f.date === it.date && f.time === time && norm(f.description) === norm(it.food!.description));
        if (dupe) { duplicates++; continue; }
        const log = newFoodLog({
          date: it.date,
          time,
          meal: it.food.meal,
          description: it.food.description,
          serving: it.food.serving,
        });
        food.push(log);
        foods = rememberFood(foods, log);
        added.food++; landed++;
        continue;
      }

      if (it.kind === "bowel" && it.bowel) {
        const time = it.time || localTime();
        if (bowel.some((b) => b.date === it.date && b.time === time)) { duplicates++; continue; }
        bowel.push(newBowelLog({
          date: it.date,
          time,
          bristol: it.bowel.bristol,
          amount: it.bowel.amount,
          color: it.bowel.color,
          consistency: it.bowel.consistency,
          notes: it.bowel.notes,
        }));
        added.bowel++; landed++;
        continue;
      }

      if (it.kind === "routine" && it.routine) {
        const time = it.time || localTime();
        const want = it.routine;
        let item = want.itemId ? routineItems.find((r) => r.id === want.itemId) : undefined;
        if (!item) item = routineItems.find((r) => norm(r.name) === norm(want.name));
        if (!item) {
          item = newRoutineItem({ name: want.name, kind: want.kind, dose: want.dose, daily: false });
          routineItems = [...routineItems, item];
        }
        const named = item.name;
        if (routine.some((r) => r.date === it.date && r.time === time && norm(r.name) === norm(named))) {
          duplicates++;
          continue;
        }
        routine.push(logFromItem(item, {
          date: it.date,
          time,
          slot: slotForTime(time),
          dose: want.dose,
          skipped: want.skipped,
        }));
        routineItems = bumpItemUse(routineItems, item.id);
        added.routine++; landed++;
      }
    }
    if (!landed) duplicateIds.push(proposal.id);
  }

  return {
    next: { entries, food, foods, bowel, routine, routineItems },
    added, duplicates, duplicateIds,
  };
}

/** How many rows of each kind are in a list. Used for the receipt after a
    commit and for the "what it found" line before one, so both sentences come
    out of the same counter and cannot disagree.

    A row covering a stretch of days counts as the days it covers, not as one:
    the sentence is about what will be written, and "1 dose" in front of a
    fortnight of a nightly tablet would be the wrong number. */
export function countKinds(items: readonly ImportedItem[]): Record<ImportKind, number> {
  const out: Record<ImportKind, number> = { answer: 0, food: 0, bowel: 0, routine: 0, note: 0 };
  for (const it of items) out[it.kind] += it.span?.days?.length || 1;
  return out;
}

/** "3 meals, 2 doses and a note" — the receipt, in the app's own words. */
export function describeAdded(added: Record<ImportKind, number>): string {
  const bits: string[] = [];
  const say = (n: number, one: string, many: string) => { if (n > 0) bits.push(`${n} ${n === 1 ? one : many}`); };
  say(added.answer, "answer", "answers");
  say(added.food, "meal", "meals");
  say(added.bowel, "bowel entry", "bowel entries");
  say(added.routine, "dose", "doses");
  say(added.note, "note", "notes");
  if (!bits.length) return "Nothing added";
  if (bits.length === 1) return bits[0];
  return `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}`;
}

/**
 * A row moved to a different day, taking its stretch with it.
 *
 * The review lets any date be corrected, and a row covering eight days has to
 * move as eight days: correcting the start of a course to a day earlier means
 * the course started a day earlier, not that it now runs nine days. The length
 * is what the notes said; only the position was wrong.
 */
export function shiftItemDate(item: ImportedItem, date: string): ImportedItem {
  if (!DATE_RE.test(date) || date === item.date) return item;
  /* `undefined` rather than `false`, like everywhere else in this module: a
     date somebody corrected by hand was not guessed at all. */
  const moved: ImportedItem = { ...item, date, dateGuessed: undefined };
  if (!item.span?.days?.length) return moved;
  const delta = dayNumber(date) - dayNumber(item.date);
  if (!isFinite(delta)) return moved;
  const days = item.span.days.map((d) => isoOf(dayNumber(d) + delta));
  moved.span = { from: days[0], to: days[days.length - 1], days };
  return moved;
}

/** Rows grouped by the day they belong to, newest day first — which is how the
    review reads, because "what is this about to do to the 21st" is the question
    somebody actually has in front of a list of forty proposals. */
export function groupByDate(items: readonly ImportedItem[]): { date: string; items: ImportedItem[] }[] {
  const map = new Map<string, ImportedItem[]>();
  for (const it of items) {
    const list = map.get(it.date);
    if (list) list.push(it);
    else map.set(it.date, [it]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, rows]) => ({
      date,
      items: rows.slice().sort((a, b) => String(a.time || "").localeCompare(String(b.time || ""))),
    }));
}
