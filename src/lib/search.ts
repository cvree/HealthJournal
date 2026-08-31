/* Search: one box over the whole journal.

   A journal that has been kept for a year is a filing cabinet, and until now
   this app gave you no way to open a drawer. "When did I last take the
   antihistamine?" "What did I eat the week of the flare?" "Which days was the
   itch a 9?" — every one of those questions had the same answer, which was to
   scroll History with your thumb and hope.

   So: one field, everything in it.

   Four decisions hold this module together.

   1. **It is a pure function of the journal.** `buildIndex` turns the database
      into a flat list of documents; `runSearch` ranks that list against a
      parsed query. Neither touches storage, the network, React, or the clock
      except through a `today` string it is handed. That is what makes the
      whole thing testable, and it is why the screen over it is thin.

   2. **A record is one document, and it carries its own way back.** Every hit
      knows the screen it belongs to and the date to open it on, so a result is
      never a dead end. That includes the ones that are not records at all —
      the questions the journal asks, and the screens themselves — because
      "where is the backup button" is a search somebody makes, and answering it
      with nothing would be a worse answer than the truth.

   3. **The query language is small, guessable, and never in the way.** Plain
      words work and are the overwhelming majority of searches. On top of that
      sit five things people already type into search boxes elsewhere: quotes
      for a phrase, `is:` for a kind, `on:`/`before:`/`after:`/`last:` for
      dates, `-word` to exclude, and — the one this app actually needed —
      `pain>7`, a comparison against a question by its own name. Anything that
      does not parse as a filter is treated as a word, so a query is never
      rejected and a stray colon never costs somebody their search.

   4. **Every term must match.** AND, not OR. A search for "hamburger cheese"
      that returned every meal containing either would be a list nobody reads.
      Where the terms matched decides the ranking; whether they all matched
      decides membership.

   Nothing here leaves the device. This is the opposite of the import path:
   it is an index built in memory, over data already on the phone, thrown away
   when the screen closes. */

import type {
  BowelLog, DailyEntry, FoodItem, FoodLog, RoutineItem, RoutineLog, SurveyQuestion,
} from "../types/models";
import type { HealthEpisode } from "./episodes";
import type { Experiment } from "./experiments";
import type { LabResult } from "./labs";
import type { Ritual, RitualRun } from "./rituals";
import type { SunSession } from "./sun";
import { bristolLabel, mealLabel, prettyTime } from "./tracking";
import { kindLabel } from "./routine";

/* ---------- what a result can be ---------- */

export type SearchKind =
  | "day" // a logged day: its note, its answers
  | "food" // one meal
  | "bowel" // one movement
  | "dose" // one use of a routine item
  | "item" // the routine item itself
  | "ritual" // a ritual, and the days it ran
  | "episode" // a flare
  | "lab" // a result somebody else measured
  | "experiment"
  | "sun" // time outside
  | "question" // one of the questions this journal asks
  | "place"; // a screen, or something that lives on one

/** Ordered the way the results list groups them: records first, newest kinds
    of record first, then the two kinds that are not records at all. */
export const KIND_ORDER: SearchKind[] = [
  "day", "food", "dose", "bowel", "ritual", "episode", "lab", "sun",
  "experiment", "item", "question", "place",
];

export const KIND_LABEL: Record<SearchKind, string> = {
  day: "Days",
  food: "Meals",
  bowel: "Bowel",
  dose: "Doses",
  item: "Routine",
  ritual: "Rituals",
  episode: "Flares",
  lab: "Labs",
  experiment: "Experiments",
  sun: "Sun",
  question: "Questions",
  place: "Screens",
};

/** Singular, for the one-result case and for a row's own eyebrow. */
export const KIND_ONE: Record<SearchKind, string> = {
  day: "Day",
  food: "Meal",
  bowel: "Bowel movement",
  dose: "Dose",
  item: "Routine item",
  ritual: "Ritual",
  episode: "Flare",
  lab: "Lab result",
  experiment: "Experiment",
  sun: "Time outside",
  question: "Question",
  place: "Screen",
};

export const KIND_ICON: Record<SearchKind, string> = {
  day: "log",
  food: "food",
  bowel: "bowel",
  dose: "pill",
  item: "clock",
  ritual: "drop",
  episode: "spark",
  lab: "tube",
  experiment: "target",
  sun: "sun",
  question: "info",
  place: "right",
};

/** Where a result goes when it is tapped. The screen ids are App.tsx's own. */
export interface SearchTarget {
  screen: string;
  /** For anything that opens a day. */
  date?: string;
  /** For a screen that can be opened on one row. */
  id?: string;
}

export interface SearchDoc {
  id: string;
  kind: SearchKind;
  /** The day this belongs to, when it belongs to one. Drives date filters,
      the recency nudge, and the date shown on the row. */
  date?: string;
  time?: string;
  /** The row's headline. Matches here outrank matches anywhere else. */
  title: string;
  /** The second line: what makes it this record rather than its category. */
  subtitle?: string;
  /** Prose worth excerpting a hit out of — a note, a caveat, a step list. */
  text?: string;
  /** Everything else worth matching on that is not worth showing: synonyms,
      the pack a question came from, a screen's other names. */
  extra?: string;
  /** Question key -> value, for `pain>7`. Only days carry these. */
  numbers?: Record<string, number>;
  target: SearchTarget;
}

/* ---------- the query ---------- */

export type CompareOp = ">" | ">=" | "<" | "<=" | "=";

export interface NumericTerm {
  /** As typed — resolved against question keys and labels at search time. */
  field: string;
  op: CompareOp;
  value: number;
  /** The whole token, for the chip that says it is on. */
  raw: string;
}

export interface ParsedQuery {
  raw: string;
  /** Bare words, lowercased. Every one of them must match somewhere. */
  words: string[];
  /** "in quotes" — must appear as written. */
  phrases: string[];
  /** -word: a document containing it is out, however well it scores. */
  without: string[];
  kinds: SearchKind[];
  from?: string;
  to?: string;
  numeric: NumericTerm[];
  /** True when there is nothing to search on at all. */
  empty: boolean;
  /** Every filter that parsed, in the words the box will show back. */
  chips: { label: string; token: string }[];
}

const KIND_WORDS: Record<string, SearchKind> = {
  day: "day", days: "day", note: "day", notes: "day", entry: "day", entries: "day",
  food: "food", foods: "food", meal: "food", meals: "food", ate: "food",
  bowel: "bowel", stool: "bowel", poo: "bowel",
  dose: "dose", doses: "dose", med: "dose", meds: "dose", pill: "dose",
  supplement: "dose", took: "dose",
  item: "item", routine: "item",
  ritual: "ritual", rituals: "ritual",
  episode: "episode", flare: "episode", flares: "episode",
  lab: "lab", labs: "lab", result: "lab", bloods: "lab",
  experiment: "experiment", experiments: "experiment",
  sun: "sun", light: "sun", outside: "sun",
  question: "question", questions: "question", field: "question",
  place: "place", screen: "place", screens: "place", settings: "place",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const dayNumber = (iso: string): number =>
  Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;

const fromDayNumber = (n: number): string =>
  new Date(n * 86400000).toISOString().slice(0, 10);

export const shiftDate = (iso: string, days: number): string => {
  const n = dayNumber(iso);
  return isFinite(n) ? fromDayNumber(n + days) : iso;
};

/* "last:7d", "last:2w", "last:3m", "last:year", and the bare words people
   actually type. Everything resolves to a plain start date so the rest of the
   module only ever compares two ISO strings. */
function relativeStart(word: string, today: string): string | undefined {
  const w = word.trim().toLowerCase();
  if (!w) return undefined;
  const named: Record<string, number> = {
    today: 0, day: 1, yesterday: 1, week: 7, fortnight: 14, month: 30,
    quarter: 91, season: 91, year: 365,
  };
  if (named[w] != null) return shiftDate(today, -named[w]);
  const m = /^(\d{1,4})\s*(d|day|days|w|week|weeks|m|month|months|y|year|years)?$/.exec(w);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!isFinite(n) || n <= 0 || n > 3650) return undefined;
  const unit = (m[2] || "d")[0];
  const mult = unit === "w" ? 7 : unit === "m" ? 30 : unit === "y" ? 365 : 1;
  return shiftDate(today, -(n * mult));
}

/** A date somebody typed, in any of the shapes they type it in. */
function absoluteDate(word: string, today: string): string | undefined {
  const w = word.trim();
  if (DATE_RE.test(w)) return w;
  const rel = { today: 0, yesterday: 1 }[w.toLowerCase()];
  if (rel != null) return shiftDate(today, -rel);
  /* 8/21, 8.21, 21-8 — a bare month and day means the most recent one that is
     not in the future, which is the same rule the import reads notes under. */
  const md = /^(\d{1,2})[./-](\d{1,2})$/.exec(w);
  if (md) {
    const [a, b] = [Number(md[1]), Number(md[2])];
    const year = Number(today.slice(0, 4));
    const iso = (y: number) => `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    if (a >= 1 && a <= 12 && b >= 1 && b <= 31) {
      const guess = iso(year);
      return guess > today ? iso(year - 1) : guess;
    }
  }
  return undefined;
}

const COMPARE_RE = /^([a-z][a-z0-9_ ]{0,40}?)\s*(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/i;

/**
 * Turn what somebody typed into something searchable.
 *
 * Nothing here ever fails. A token that looks like a filter and is not one is
 * a word, which is exactly what somebody searching for "on:call" meant.
 */
export function parseQuery(raw: string, today: string): ParsedQuery {
  const out: ParsedQuery = {
    raw, words: [], phrases: [], without: [], kinds: [], numeric: [], empty: true, chips: [],
  };
  const text = String(raw ?? "");

  /* Phrases come out first so a space inside quotes never becomes a split. */
  const rest = text.replace(/"([^"]*)"/g, (_, inner: string) => {
    const phrase = String(inner).trim().toLowerCase();
    if (phrase) {
      out.phrases.push(phrase);
      out.chips.push({ label: `“${phrase}”`, token: `"${inner}"` });
    }
    return " ";
  });

  for (const token of rest.split(/\s+/)) {
    if (!token) continue;
    const lower = token.toLowerCase();

    if (lower.length > 1 && lower.startsWith("-")) {
      const w = lower.slice(1);
      out.without.push(w);
      out.chips.push({ label: `not “${w}”`, token });
      continue;
    }

    const colon = lower.indexOf(":");
    if (colon > 0 && colon < lower.length - 1) {
      const head = lower.slice(0, colon);
      const tail = lower.slice(colon + 1);
      if (head === "is" || head === "type" || head === "in") {
        const kind = KIND_WORDS[tail] || KIND_WORDS[tail.replace(/s$/, "")];
        if (kind) {
          if (!out.kinds.includes(kind)) out.kinds.push(kind);
          out.chips.push({ label: KIND_LABEL[kind], token });
          continue;
        }
      }
      if (head === "on") {
        const d = absoluteDate(tail, today);
        if (d) {
          out.from = d;
          out.to = d;
          out.chips.push({ label: `on ${d}`, token });
          continue;
        }
      }
      if (head === "after" || head === "since" || head === "from") {
        const d = absoluteDate(tail, today) || relativeStart(tail, today);
        if (d) {
          out.from = d;
          out.chips.push({ label: `after ${d}`, token });
          continue;
        }
      }
      if (head === "before" || head === "until" || head === "to") {
        const d = absoluteDate(tail, today);
        if (d) {
          out.to = d;
          out.chips.push({ label: `before ${d}`, token });
          continue;
        }
      }
      if (head === "last" || head === "past" || head === "recent") {
        const d = relativeStart(tail, today);
        if (d) {
          out.from = d;
          out.chips.push({ label: `since ${d}`, token });
          continue;
        }
      }
    }

    const cmp = COMPARE_RE.exec(token);
    if (cmp) {
      const value = Number(cmp[3]);
      if (isFinite(value)) {
        out.numeric.push({
          field: cmp[1].trim().toLowerCase(), op: cmp[2] as CompareOp, value, raw: token,
        });
        out.chips.push({ label: token, token });
        continue;
      }
    }

    out.words.push(lower);
  }

  out.empty = !out.words.length && !out.phrases.length && !out.numeric.length
    && !out.kinds.length && !out.from && !out.to && !out.without.length;
  return out;
}

/* ---------- building the index ---------- */

/** Everything `buildIndex` reads. All optional: a fresh journal has almost
    none of it, and a search over an empty index is a legitimate search. */
export interface SearchSource {
  today: string;
  /** The questions this journal asks, already resolved (packs + custom). */
  fields?: SurveyQuestion[];
  entries?: DailyEntry[];
  food?: FoodLog[];
  foods?: FoodItem[];
  bowel?: BowelLog[];
  routine?: RoutineLog[];
  routineItems?: RoutineItem[];
  rituals?: Ritual[];
  ritualRuns?: RitualRun[];
  episodes?: HealthEpisode[];
  labs?: LabResult[];
  experiments?: Experiment[];
  sun?: SunSession[];
  /** False in the read-only viewer, which must not offer what it cannot do. */
  canWrite?: boolean;
}

/* The screens, and the things that live on one. A search box that knows only
   about records is half a search box: "where do I turn the reminder off" is
   the question people actually get stuck on, and it has an exact answer. */
interface Place {
  id: string;
  title: string;
  subtitle: string;
  /** Every other name somebody might reach for. */
  extra: string;
  screen: string;
  /** False for anything that writes — the viewer never offers those. */
  viewer: boolean;
}

export const PLACES: Place[] = [
  { id: "p_today", title: "Today", subtitle: "The day you're in", extra: "home dashboard check in check-in quick log pulse", screen: "dashboard", viewer: true },
  { id: "p_log", title: "Daily log", subtitle: "Answer today's questions", extra: "survey quick detailed record answer", screen: "log", viewer: false },
  { id: "p_history", title: "History", subtitle: "Every day you've logged", extra: "calendar past archive streak heatmap year", screen: "history", viewer: true },
  { id: "p_insights", title: "Insights", subtitle: "Charts, trends and possible patterns", extra: "graph chart trend pattern correlation analysis compare", screen: "insights", viewer: true },
  { id: "p_food", title: "Diary", subtitle: "Meals, drinks and bowel movements", extra: "food eating nutrition calories protein bristol", screen: "food", viewer: true },
  { id: "p_routine", title: "Routine", subtitle: "Medications, supplements and creams", extra: "meds medication supplement dose pill cream topical product", screen: "routine", viewer: false },
  { id: "p_rituals", title: "Rituals", subtitle: "Your routines, step by step", extra: "shower wind down morning steps checklist", screen: "rituals", viewer: false },
  { id: "p_sun", title: "Sun & outdoor light", subtitle: "Time outside and vitamin D", extra: "uv daylight sunlight vitamin d outdoors", screen: "sun", viewer: true },
  { id: "p_labs", title: "Labs & measurements", subtitle: "Blood work and anything somebody else measured", extra: "blood test result ferritin vitamin thyroid range reference", screen: "labs", viewer: true },
  { id: "p_experiments", title: "Experiments", subtitle: "Change one thing, watch what moves", extra: "trial test compare before after ab", screen: "experiments", viewer: true },
  { id: "p_gallery", title: "Photo progress", subtitle: "Progress shots side by side", extra: "photos pictures camera compare baseline", screen: "gallery", viewer: true },
  { id: "p_export", title: "Export", subtitle: "Spreadsheets, backups and appointment packs", extra: "csv xlsx excel backup restore download doctor appointment pack pdf print", screen: "export", viewer: true },
  { id: "p_import", title: "Import your notes", subtitle: "Paste old notes or a photo of them and have them read in", extra: "paste text screenshot ocr bring old notes migrate transcribe", screen: "import", viewer: false },
  { id: "p_fitbit", title: "Import health data", subtitle: "Steps, sleep and weight from a Fitbit or Google export", extra: "fitbit google fit takeout wearable steps sleep watch csv", screen: "fitbit", viewer: false },
  { id: "p_settings", title: "Settings", subtitle: "Reminders, privacy, appearance, backup and AI", extra: "preferences reminder notification alarm theme dark light sound haptics vibration pin lock passcode sync backup ai key privacy cadence", screen: "settings", viewer: false },
  { id: "p_setup", title: "Survey setup", subtitle: "Add, hide and reorder the questions you're asked", extra: "questions edit custom field pack module hide reorder cadence", screen: "setup", viewer: false },
];

const clean = (v: unknown): string => String(v ?? "").replace(/\s+/g, " ").trim();

const joined = (...parts: (string | undefined | null | false)[]): string =>
  parts.filter(Boolean).join(" · ");

/** A day's answers, rendered once so the words are searchable and the numbers
    are comparable. Photo answers are left out: a blob id is not a word. */
function describeAnswers(entry: DailyEntry, fields: SurveyQuestion[]): {
  text: string; numbers: Record<string, number>;
} {
  const parts: string[] = [];
  const numbers: Record<string, number> = {};
  const byKey = new Map(fields.map((f) => [f.k, f]));
  for (const [k, v] of Object.entries(entry.answers || {})) {
    const f = byKey.get(k);
    if (!f || f.type === "photo") continue;
    if (typeof v === "number" && isFinite(v)) {
      numbers[k] = v;
      parts.push(`${f.label} ${v}${f.unit ? ` ${f.unit}` : ""}`);
    } else if (typeof v === "boolean") {
      if (v) numbers[k] = 1;
      parts.push(`${f.label} ${v ? "yes" : "no"}`);
    } else if (Array.isArray(v)) {
      if (v.length) parts.push(`${f.label} ${v.join(" ")}`);
    } else if (typeof v === "string" && v.trim()) {
      parts.push(`${f.label} ${v}`);
    }
  }
  return { text: parts.join(" · "), numbers };
}

/**
 * The journal, flattened into documents.
 *
 * Deliberately eager: the whole index for a year of daily logging is a few
 * thousand small objects, which is nothing next to what the charts already
 * hold, and building it once per journal change is far cheaper than teaching
 * eleven data shapes how to answer a query.
 */
export function buildIndex(src: SearchSource): SearchDoc[] {
  const docs: SearchDoc[] = [];
  const fields = (src.fields || []).filter((f) => f && f.k);
  const canWrite = src.canWrite !== false;

  /* ---- days: the note somebody wrote, and what they answered ---- */
  for (const e of src.entries || []) {
    if (!e?.date) continue;
    const note = clean(e.notes);
    const { text, numbers } = describeAnswers(e, fields);
    if (!note && !text) continue;
    docs.push({
      id: `day_${e.date}`,
      kind: "day",
      date: e.date,
      title: note ? note.slice(0, 90) : "Logged day",
      subtitle: note && text ? text.slice(0, 120) : text.slice(0, 120) || undefined,
      text: note || undefined,
      extra: text,
      numbers,
      /* The read-only viewer has no Daily Log to open — the app bounces that
         screen — so a day there points at History, which is where a backup
         being read actually shows a day. */
      target: { screen: canWrite ? "log" : "history", date: e.date },
    });
  }

  /* ---- meals ---- */
  for (const f of src.food || []) {
    if (!f?.date) continue;
    const desc = clean(f.description) || "Meal";
    docs.push({
      id: `food_${f.id}`,
      kind: "food",
      date: f.date,
      time: f.time,
      title: desc,
      subtitle: joined(mealLabel(f.meal), clean(f.serving), f.time && prettyTime(f.time)),
      text: clean(f.notes) || undefined,
      extra: `${mealLabel(f.meal)} ${clean(f.unit)} ${clean(f.notes)}`,
      target: { screen: "food", date: f.date },
    });
  }

  /* ---- the food library: what somebody eats, whether or not they logged it
     this week. Searching "kefir" should find the saved food too, or the answer
     to "do I already have this saved" is a scroll. ---- */
  for (const f of src.foods || []) {
    if (!f?.id) continue;
    docs.push({
      id: `saved_${f.id}`,
      kind: "food",
      title: clean(f.name),
      subtitle: joined("Saved food", clean(f.brand), clean(f.serving),
        f.useCount ? `logged ${f.useCount}×` : null),
      extra: `${clean(f.brand)} saved library favourite favorite`,
      target: { screen: "food" },
    });
  }

  /* ---- bowel ---- */
  for (const b of src.bowel || []) {
    if (!b?.date) continue;
    docs.push({
      id: `bowel_${b.id}`,
      kind: "bowel",
      date: b.date,
      time: b.time,
      title: b.bristol ? `Type ${b.bristol} — ${bristolLabel(b.bristol)}` : "Bowel movement",
      subtitle: joined(b.amount, clean(b.color), clean(b.consistency),
        b.time && prettyTime(b.time)),
      text: clean(b.notes) || undefined,
      extra: `bowel movement stool ${clean(b.color)} ${clean(b.consistency)} ${b.amount || ""}`,
      target: { screen: "food", date: b.date },
    });
  }

  /* ---- the routine, and every use of it ---- */
  for (const r of src.routineItems || []) {
    if (!r?.id) continue;
    docs.push({
      id: `item_${r.id}`,
      kind: "item",
      title: clean(r.name),
      subtitle: joined(kindLabel(r.kind), clean(r.brand), clean(r.dose),
        r.daily ? "every day" : "as needed", r.archived ? "archived" : null),
      text: clean(r.notes) || undefined,
      extra: `${kindLabel(r.kind)} ${clean(r.brand)} ${(r.times || []).join(" ")}`,
      target: { screen: canWrite ? "routine" : "history" },
    });
  }
  for (const l of src.routine || []) {
    if (!l?.date) continue;
    docs.push({
      id: `dose_${l.id}`,
      kind: "dose",
      date: l.date,
      time: l.time,
      title: clean(l.name),
      subtitle: joined(l.skipped ? "Skipped" : clean(l.dose) || "Taken",
        kindLabel(l.kind), l.time && prettyTime(l.time)),
      text: clean(l.notes) || undefined,
      extra: `${kindLabel(l.kind)} ${l.skipped ? "skipped missed" : "took taken"} ${l.slot || ""}`,
      target: { screen: "food", date: l.date },
    });
  }

  /* ---- rituals, and the days they ran ---- */
  for (const r of src.rituals || []) {
    if (!r?.id) continue;
    const steps = (r.steps || []).map((s) => clean(s.label)).filter(Boolean);
    docs.push({
      id: `ritual_${r.id}`,
      kind: "ritual",
      title: clean(r.name),
      subtitle: joined(`${steps.length} step${steps.length === 1 ? "" : "s"}`,
        r.slot, r.archived ? "archived" : null),
      text: steps.join(", ") || undefined,
      extra: `${steps.join(" ")} ${clean(r.notes)}`,
      target: { screen: canWrite ? "rituals" : "history" },
    });
  }
  for (const run of src.ritualRuns || []) {
    if (!run?.date) continue;
    const done = (run.done || []).length;
    docs.push({
      id: `run_${run.id}`,
      kind: "ritual",
      date: run.date,
      time: run.time,
      title: clean(run.name),
      subtitle: joined(run.skipped ? "Skipped" : `${done} of ${run.total} done`,
        run.time && prettyTime(run.time)),
      text: clean(run.notes) || undefined,
      extra: run.skipped ? "skipped missed" : "ran done finished",
      target: { screen: "history", date: run.date },
    });
  }

  /* ---- flares ---- */
  for (const ep of src.episodes || []) {
    if (!ep?.id) continue;
    docs.push({
      id: `ep_${ep.id}`,
      kind: "episode",
      date: ep.start,
      title: clean(ep.title) || "Flare",
      subtitle: joined(ep.end ? `${ep.start} → ${ep.end}` : `since ${ep.start}`,
        ep.end ? null : "still open"),
      text: clean(ep.notes) || undefined,
      extra: `flare episode bad stretch ${clean(ep.metric)}`,
      target: { screen: "episode", id: ep.id, date: ep.start },
    });
  }

  /* ---- labs ---- */
  for (const lab of src.labs || []) {
    if (!lab?.id) continue;
    docs.push({
      id: `lab_${lab.id}`,
      kind: "lab",
      date: lab.date,
      time: lab.time,
      title: `${clean(lab.name)} ${lab.value}${lab.unit ? ` ${lab.unit}` : ""}`.trim(),
      subtitle: joined(clean(lab.provider), lab.fasting ? "fasting" : null,
        lab.refText ? `ref ${lab.refText}` : null,
        lab.kind === "estimate" ? "estimate" : null),
      text: clean(lab.note) || undefined,
      extra: `${clean(lab.test)} blood test result ${clean(lab.unit)}`,
      target: { screen: "labs", id: lab.id, date: lab.date },
    });
  }

  /* ---- experiments ---- */
  for (const x of src.experiments || []) {
    if (!x?.id) continue;
    docs.push({
      id: `exp_${x.id}`,
      kind: "experiment",
      date: x.changedOn,
      title: clean(x.title) || "Experiment",
      subtitle: joined(`${clean(x.factor)} → ${clean(x.outcome)}`,
        x.archived ? "archived" : null),
      extra: `${clean(x.factor)} ${clean(x.outcome)} ${x.kind} trial compare`,
      target: { screen: "experiments", id: x.id },
    });
  }

  /* ---- time outside ---- */
  for (const s of src.sun || []) {
    if (!s?.date) continue;
    docs.push({
      id: `sun_${s.id}`,
      kind: "sun",
      date: s.date,
      time: s.start,
      title: `${Math.round(s.minutes)} min outside`,
      subtitle: joined(s.start && prettyTime(s.start), s.exposure, s.shade,
        s.spf ? `SPF ${s.spf}` : null, `${Math.round(s.iu)} IU est.`),
      text: clean(s.note) || undefined,
      extra: "sun sunlight outside daylight uv vitamin d",
      target: { screen: "sun", date: s.date },
    });
  }

  /* ---- the questions themselves ---- */
  for (const f of fields) {
    if (f.type === "photo") continue;
    docs.push({
      id: `q_${f.k}`,
      kind: "question",
      title: clean(f.label),
      subtitle: joined(clean(f.sec), f.type === "scale" ? "rated 1–10" : f.type,
        clean(f.unit), f.custom ? "your own question" : null),
      extra: `${f.k} ${(f.options || []).join(" ")} ${clean(f.sec)}`,
      target: { screen: canWrite ? "setup" : "insights" },
    });
  }

  /* ---- and the screens ---- */
  for (const p of PLACES) {
    if (!canWrite && !p.viewer) continue;
    docs.push({
      id: p.id,
      kind: "place",
      title: p.title,
      subtitle: p.subtitle,
      extra: p.extra,
      target: { screen: p.screen },
    });
  }

  return docs;
}

/* ---------- matching ---------- */

/* Word boundaries the cheap way. A journal is prose and shorthand, not a
   corpus, and a real tokeniser here would buy accuracy nobody would notice at
   the cost of being unable to match "2acv" against "acv". */
const boundary = (hay: string, needle: string): boolean => {
  let at = hay.indexOf(needle);
  while (at >= 0) {
    const before = at === 0 ? " " : hay[at - 1];
    if (!/[a-z0-9]/.test(before)) return true;
    at = hay.indexOf(needle, at + 1);
  }
  return false;
};

/** How well one term does against one document. 0 means it did not match. */
function termScore(doc: Lowered, term: string): number {
  if (doc.title === term) return 120;
  if (doc.title.startsWith(term)) return 80;
  if (boundary(doc.title, term)) return 55;
  if (doc.title.includes(term)) return 30;
  if (doc.subtitle && boundary(doc.subtitle, term)) return 26;
  if (doc.text && boundary(doc.text, term)) return 22;
  if (doc.extra && boundary(doc.extra, term)) return 16;
  if (doc.subtitle?.includes(term) || doc.text?.includes(term) || doc.extra?.includes(term)) return 8;
  return 0;
}

interface Lowered {
  title: string;
  subtitle?: string;
  text?: string;
  extra?: string;
  all: string;
}

/* Lowercasing four strings per document per keystroke is the one thing in here
   that would actually be felt: a year of daily logging is a few thousand
   documents, and the box re-ranks all of them on every character. The index is
   rebuilt only when the journal changes, so the cache is keyed on the document
   object itself and stays warm for the whole life of a search. */
const LOWERED = new WeakMap<SearchDoc, Lowered>();

const lowered = (d: SearchDoc): Lowered => {
  const seen = LOWERED.get(d);
  if (seen) return seen;
  const title = d.title.toLowerCase();
  const subtitle = d.subtitle?.toLowerCase();
  const text = d.text?.toLowerCase();
  const extra = d.extra?.toLowerCase();
  const made: Lowered = {
    title, subtitle, text, extra,
    all: [title, subtitle, text, extra].filter(Boolean).join(" "),
  };
  LOWERED.set(d, made);
  return made;
};

/** Newer is likelier to be what somebody meant, but only just: a note from
    March is not less true than one from Tuesday, and a recency weight big
    enough to reorder a real match would be the search lying about relevance. */
function recencyBoost(date: string | undefined, today: string): number {
  if (!date) return 0;
  const gap = dayNumber(today) - dayNumber(date);
  if (!isFinite(gap)) return 0;
  if (gap < 0) return 0;
  if (gap <= 1) return 14;
  if (gap <= 7) return 10;
  if (gap <= 30) return 6;
  if (gap <= 120) return 3;
  return 0;
}

const compare = (value: number, op: CompareOp, against: number): boolean =>
  op === ">" ? value > against
    : op === ">=" ? value >= against
      : op === "<" ? value < against
        : op === "<=" ? value <= against
          : value === against;

/**
 * Which question a `pain>7` is about.
 *
 * Matched against the key first (which is what an export column says), then
 * the label, then any word of the label — so "sleep>7" finds "Sleep quality"
 * without anybody having to know the key is `sleep_quality`.
 */
export function resolveField(fields: SurveyQuestion[], name: string): SurveyQuestion | undefined {
  const want = name.trim().toLowerCase();
  if (!want) return undefined;
  const usable = fields.filter((f) => f.type === "scale" || f.type === "number" || f.type === "toggle");
  return usable.find((f) => f.k.toLowerCase() === want)
    || usable.find((f) => f.label.toLowerCase() === want)
    || usable.find((f) => f.label.toLowerCase().startsWith(want))
    || usable.find((f) => boundary(f.label.toLowerCase(), want))
    || usable.find((f) => f.k.toLowerCase().includes(want));
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
  /** The line to show under the title, already cut down to the match. */
  snippet?: string;
  /** Which term hit where, for the highlight. Lowercased. */
  terms: string[];
}

export interface SearchOutcome {
  hits: SearchHit[];
  /** How many there were before `limit` cut it down. */
  total: number;
  /** Counts per kind over the *unlimited* result set, for the filter row. */
  counts: Record<string, number>;
  /** Numeric terms that named a question this journal does not ask. */
  unknownFields: string[];
  /** What was actually compared, so the screen can say it in words. */
  resolved: { term: NumericTerm; field: SurveyQuestion }[];
}

export interface SearchOptions {
  today: string;
  fields?: SurveyQuestion[];
  limit?: number;
}

const EMPTY: SearchOutcome = { hits: [], total: 0, counts: {}, unknownFields: [], resolved: [] };

/**
 * Rank the index against a query.
 *
 * The membership rules, in the order they are applied, because the order is
 * the difference between a useful list and a long one:
 *
 * 1. A kind filter, a date range and an exclusion are absolute. They remove.
 * 2. A numeric comparison is absolute too, and only days can satisfy one — a
 *    meal has no severity. `pain>7` on its own is therefore a legitimate whole
 *    query, and returns the days.
 * 3. Every remaining word and phrase must match somewhere in the document.
 * 4. What is left is ordered by where the words landed, then by recency, then
 *    by kind, so two equal matches come out in a stable order rather than in
 *    whatever order the journal happened to be built in.
 */
export function runSearch(
  docs: readonly SearchDoc[],
  query: ParsedQuery,
  opts: SearchOptions
): SearchOutcome {
  if (query.empty) return EMPTY;
  const fields = opts.fields || [];
  const limit = opts.limit ?? 200;

  const resolved: { term: NumericTerm; field: SurveyQuestion }[] = [];
  const unknownFields: string[] = [];
  for (const term of query.numeric) {
    const f = resolveField(fields, term.field);
    if (f) resolved.push({ term, field: f });
    else if (!unknownFields.includes(term.field)) unknownFields.push(term.field);
  }
  /* A comparison against a question that does not exist cannot be satisfied by
     anything, and quietly ignoring it would answer a question nobody asked.
     The screen says which name it did not recognise. */
  if (unknownFields.length) {
    return { ...EMPTY, unknownFields };
  }

  const terms = [...query.words, ...query.phrases];
  const hits: SearchHit[] = [];
  const counts: Record<string, number> = {};

  for (const doc of docs) {
    if (query.kinds.length && !query.kinds.includes(doc.kind)) continue;
    if (query.from && (!doc.date || doc.date < query.from)) continue;
    if (query.to && (!doc.date || doc.date > query.to)) continue;

    const low = lowered(doc);

    if (query.without.some((w) => low.all.includes(w))) continue;

    if (resolved.length) {
      if (!doc.numbers) continue;
      let ok = true;
      for (const { term, field } of resolved) {
        const v = doc.numbers[field.k];
        if (v == null || !compare(v, term.op, term.value)) { ok = false; break; }
      }
      if (!ok) continue;
    }

    let score = 0;
    let matched = true;
    for (const term of terms) {
      const s = termScore(low, term);
      if (!s) { matched = false; break; }
      score += s;
    }
    if (!matched) continue;

    /* A query that is only filters ranks on recency alone, which is the right
       answer: "every meal last week" is a list in date order. */
    score += recencyBoost(doc.date, opts.today);
    /* A screen is an answer to "take me there", never to "what did I write" —
       so it only wins when almost nothing else did. */
    if (doc.kind === "place") score -= 6;
    if (doc.kind === "question") score -= 4;

    counts[doc.kind] = (counts[doc.kind] || 0) + 1;
    hits.push({ doc, score, snippet: snippetFor(doc, terms), terms });
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ad = a.doc.date || "";
    const bd = b.doc.date || "";
    if (ad !== bd) return ad < bd ? 1 : -1;
    const ak = KIND_ORDER.indexOf(a.doc.kind);
    const bk = KIND_ORDER.indexOf(b.doc.kind);
    if (ak !== bk) return ak - bk;
    return a.doc.id < b.doc.id ? -1 : 1;
  });

  return { hits: hits.slice(0, limit), total: hits.length, counts, unknownFields: [], resolved };
}

/* ---------- showing the match ---------- */

const SNIPPET = 150;

/**
 * The words around the hit, not the first words of the note.
 *
 * A 600-character note truncated at 150 shows the same opening sentence for
 * every search, which makes every result look identical and none of them look
 * like an answer. Centring on the first term is what makes a list of notes
 * scannable.
 */
export function snippetFor(doc: SearchDoc, terms: readonly string[]): string | undefined {
  const body = doc.text;
  if (!body) return undefined;
  const low = body.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = low.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (body.length <= SNIPPET) return body;
  if (at < 0) return `${body.slice(0, SNIPPET).trimEnd()}…`;
  const start = Math.max(0, at - 45);
  const end = Math.min(body.length, start + SNIPPET);
  return `${start > 0 ? "…" : ""}${body.slice(start, end).trim()}${end < body.length ? "…" : ""}`;
}

/** A string cut into matched and unmatched runs, so a renderer can mark the
    matched ones without knowing anything about the query. */
export function highlight(
  value: string, terms: readonly string[]
): { text: string; hit: boolean }[] {
  const text = String(value ?? "");
  const wanted = [...new Set(terms.map((t) => t.toLowerCase()).filter((t) => t.length > 1))];
  if (!text || !wanted.length) return text ? [{ text, hit: false }] : [];
  const low = text.toLowerCase();
  /* Every occurrence of every term, then merged, so overlapping terms
     ("pain" and "painful") produce one mark rather than nested ones. */
  const spans: [number, number][] = [];
  for (const t of wanted) {
    let at = low.indexOf(t);
    while (at >= 0) {
      spans.push([at, at + t.length]);
      at = low.indexOf(t, at + t.length);
    }
  }
  if (!spans.length) return [{ text, hit: false }];
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [spans[0]];
  for (const [s, e] of spans.slice(1)) {
    const last = merged[merged.length - 1];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const out: { text: string; hit: boolean }[] = [];
  let cursor = 0;
  for (const [s, e] of merged) {
    if (s > cursor) out.push({ text: text.slice(cursor, s), hit: false });
    out.push({ text: text.slice(s, e), hit: true });
    cursor = e;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), hit: false });
  return out;
}

/* ---------- saying what happened ---------- */

const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n} ${n === 1 ? one : many}`;

/**
 * The line above the results.
 *
 * It says what was actually done rather than only how much came back, because
 * the commonest search failure is a filter somebody forgot was on — and a bare
 * "3 results" is the one sentence that cannot tell them.
 */
export function describeSearch(query: ParsedQuery, out: SearchOutcome): string {
  if (out.unknownFields.length) {
    return `No question here is called “${out.unknownFields[0]}”.`;
  }
  if (!out.total) return "Nothing matched.";
  const bits = [plural(out.total, "result")];
  const days = new Set(out.hits.map((h) => h.doc.date).filter(Boolean));
  if (days.size > 1) bits.push(`across ${plural(days.size, "day")}`);
  if (query.from && query.to && query.from === query.to) bits.push(`on ${query.from}`);
  else if (query.from) bits.push(`since ${query.from}`);
  else if (query.to) bits.push(`up to ${query.to}`);
  return `${bits.join(" ")}${out.total > out.hits.length ? ` · showing ${out.hits.length}` : ""}`;
}

/** The examples the empty screen offers. Written as things somebody would
    actually want to know, not as a syntax reference. */
export const SEARCH_EXAMPLES: { q: string; why: string }[] = [
  { q: "headache", why: "Every day, meal and dose that mentions it" },
  { q: "is:food dairy", why: "Only meals, only the ones with dairy" },
  { q: "last:30d flare", why: "The last month" },
  { q: "\"woke at 4\"", why: "Those exact words, in that order" },
  { q: "-coffee tea", why: "Tea, but not where coffee is mentioned too" },
];

/** How the operators work, in one place, for the help panel and the tests. */
export const SEARCH_SYNTAX: { token: string; means: string }[] = [
  { token: "\"two words\"", means: "That exact phrase" },
  { token: "-word", means: "Leave out anything containing it" },
  { token: "is:meals", means: "One kind only — days, meals, doses, bowel, labs, rituals, flares, sun, questions, screens" },
  { token: "on:2026-08-21", means: "One day. on:yesterday and on:8/21 work too" },
  { token: "after:2026-08-01", means: "From that day on. before: is the other end" },
  { token: "last:30d", means: "A recent stretch — 7d, 2w, 3m, year" },
  { token: "pain>7", means: "Days where a question you're asked went over a number. <, >=, <= and = all work" },
];
