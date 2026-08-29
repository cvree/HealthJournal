/* Shared data model for Bellwether.
   These types describe the shapes that already exist at runtime in App.tsx —
   they are the contract, verified against live data by src/lib/validate.ts and
   the test suite. New code must import from here; App.tsx adopts them
   incrementally (it still carries @ts-nocheck until fully migrated). */

import type { HealthEpisode } from "../lib/episodes";
import type { ContextConsent, DayContext } from "../lib/context";
import type { Experiment } from "../lib/experiments";
import type { LabResult } from "../lib/labs";
import type { SunProfile, SunSession } from "../lib/sun";
import type { AutomationSettings } from "../lib/automation";
import type { Ritual, RitualReview, RitualRun } from "../lib/rituals";
import type { Cadence } from "../lib/cadence";

/* ---------- questions ---------- */

export type FieldType =
  | "scale" // 1–10 rating
  | "toggle" // yes/no
  | "chips" // single or multi choice (also body-area under the hood)
  | "number"
  | "text"
  | "time"
  | "date"
  | "photo";

export type FieldDirection = "sym" | "pos" | "neutral";

/** One question in the daily survey — from a built-in pack or user-created. */
export interface SurveyQuestion {
  k: string; // stable key; also the entry answer key and export column
  label: string;
  type: FieldType;
  sec?: string; // section/pack label
  dir?: FieldDirection; // which direction is "worse" (sym = higher is worse)
  /* five independent visibility flags (all default true except quick) */
  quick?: boolean;
  detailed?: boolean;
  dashboard?: boolean;
  chart?: boolean;
  exportable?: boolean;
  /* chips */
  single?: boolean;
  options?: string[];
  /* number */
  unit?: string;
  step?: number;
  /* photo */
  category?: string;
  bodyPart?: string;
  side?: string;
  angle?: string;
  rated?: boolean;
  scaleMax?: number;
  autoRate?: boolean;
  requiredInSession?: boolean;
  linkedTo?: string | null; // rating writes to this answer key instead
  /* provenance */
  custom?: boolean;
}

/** A user-created question — same shape, marked custom with a c_ key. */
export interface CustomQuestion extends SurveyQuestion {
  custom: true;
}

/* ---------- answers & entries ---------- */

export type AnswerValue = number | boolean | string | string[] | null;

export interface PhotoEntryMeta {
  photoId: string;
  takenAt: string; // ISO
  comparedTo?: string | null;
  note?: string;
  rating?: number;
  ratingSource?: string; // "manual" | "linked:<key>" | ...
}

export interface DailyEntry {
  id: string;
  date: string; // YYYY-MM-DD (local)
  answers: Record<string, AnswerValue>;
  photos?: Record<string, PhotoEntryMeta>; // keyed by photo question key
  sources?: Record<string, string>; // answer key -> "fitbit" etc.
  notes?: string;
  quickLogCompleted?: boolean;
  detailedLogCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ---------- setup / profile ---------- */

export interface UserSettings {
  sound?: boolean;
  haptics?: boolean;
  /** How hard the vibration motor is driven. See HAPTIC_SCALE in App.tsx. */
  hapticStrength?: "soft" | "medium" | "strong" | "vivid";
  /** Legacy on/off switch for the ambient backdrop. The style (and "off") now
      live in localStorage via lib/theme, because they have to be readable
      before a profile exists — on the very first launch. Kept so an older
      journal that switched the backdrop off is still honoured once. */
  backdrop?: boolean;
}

/** The single person's tracking setup (named "profile" in App.tsx). */
export interface TrackingSetup {
  id: string;
  name: string;
  /** The year this person was born, from the age they gave during setup.
      Stored as a year rather than an age so it never goes stale on the
      documents it is printed on. Absent when they'd rather not say. */
  birthYear?: number;
  templateType: string; // primary pack key
  modules?: string[]; // enabled pack keys
  customQuestions?: CustomQuestion[];
  disabledFields?: string[];
  fieldOverrides?: Record<string, Partial<SurveyQuestion>>;
  fieldOrder?: string[];
  photoBaselines?: Record<string, string>; // photo field key -> photoId
  reportPrefs?: Record<string, boolean>; // report card key -> included
  prefs?: UserSettings;
  reminder?: DailyReminder;
  /** Multiple named reminders (check-in, meals). Supersedes `reminder`, which
      is kept so existing installs keep their setting. */
  reminders?: NamedReminder[];
  /** Optional daily nutrition targets. */
  goals?: NutritionGoals;
  /** The one number this journal is about: the Daily Pulse on Today, the hero
      on Insights, the metric the Appointment Pack leads with. Chosen during
      setup and changeable afterwards; falls back to the primary pack's own
      key metric when unset or no longer valid. */
  keyMetric?: string;
  /** Up to four metrics pinned to Insights, in order. The first is the one
      the hero and the main trend chart are about. */
  pinnedMetrics?: string[];
  /** How the trend chart is drawn — shape, the 7-day average, gaps, one axis
      or several, full 1–10 or fitted. See src/lib/chartView.ts; always read
      back through `sanitizeChartView`. */
  chartView?: {
    shape?: string;
    avg?: string;
    breakGaps?: boolean;
    apart?: boolean;
    zoom?: boolean;
  };
  /** Which Quick Add tiles the dashboard shows, in order. `undefined` means
      "never chosen" and gets the default four; an empty array is a real
      choice and hides the section. */
  quickAdd?: string[];
  /** How the row is ordered. "manual" — the buttons stay exactly where they
      were put — is the default and what both the editor and a dragged tile
      write; "auto" is the opt-in that lets the order follow what gets used.
      See src/lib/quickActions.ts and src/lib/dragOrder.ts. */
  quickAddOrder?: "auto" | "manual";
  /** True once somebody has moved a button by holding and dragging it, which
      is the only thing the hint under the row is waiting on. Absent until
      then rather than false. */
  quickAddDragged?: boolean;
  /** "done" once somebody has sent the "bring your old notes in" offer away.
      Absent until then, and a word rather than a boolean so a backup reads as
      something a person could understand. The offer also retires itself after
      a fortnight of logged days — see IMPORT_INVITE_UNTIL_DAYS. */
  importOffered?: "done";
  /** Use count and last-used date per action id, which is what the learned
      ordering and the one-tap repeats are ranked on. */
  actionStats?: Record<string, { n: number; at?: string }>;
  /** Whether daily environmental context is switched on, and how coarse the
      place it uses is. Off until somebody says otherwise. See lib/context. */
  context?: ContextConsent;
  /** Skin type, usual exposure and waking time — the three answers the vitamin
      D estimate personalises on. Asked once, all refusable. See lib/sun. */
  sun?: SunProfile;
  /** Which of the app's automations are allowed to run. Absent means nobody has
      expressed a view and each falls back to its own default. See
      lib/automation for the contract every one of them runs under. */
  automations?: AutomationSettings;
  /** How often this journal asks. Absent means every day, which is what every
      journal was before the choice existed. See src/lib/cadence.ts — the
      period, not the day, is the unit everything downstream counts in. */
  cadence?: Cadence;
  /** Questions that ask less often than the journal does, keyed by question.
      A weekly weight on a daily journal; a monthly tape measure. Absent, or a
      key absent from it, means "every time the journal asks". */
  fieldCadence?: Record<string, Cadence>;
  /** ISO timestamp of the last restorable backup the user downloaded. */
  lastBackupAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/* Reminders. See src/lib/reminders.ts for why there are two delivery layers. */

/** One entry in the reminder list. A journal needs nudging at more than one
    moment — a check-in at night, meals during the day — and a single daily
    time cannot express that. */
export interface NamedReminder {
  id: string;
  label: string;
  /** "HH:MM", 24-hour, local wall-clock time. */
  time: string;
  enabled: boolean;
  /** Which part of the app this nudges toward, for the notification copy. */
  kind?: "checkin" | "food" | "bowel" | "custom";
}

export interface DailyReminder {
  enabled: boolean;
  /** "HH:MM", 24-hour, local wall-clock time. */
  time: string;
  /** Fire a browser Notification too (needs granted permission). */
  notify: boolean;
}

/* ---------- photos (blob index) ---------- */

/** Metadata stored in the fhj_photoIndex; blobs live under fhj_photo:/fhj_thumb:. */
export interface PhotoMetadata {
  id: string;
  fieldKey?: string;
  date?: string;
  takenAt?: string;
  bytes?: number;
  thumbBytes?: number;
}

/* ---------- reports ---------- */

export interface ReportRange {
  start: string;
  end: string;
  type: "week" | "month";
  label?: string;
}

export type ReportCardType =
  | "header"
  | "empty"
  | "streak"
  | "bestWorst"
  | "averages"
  | "mostImproved"
  | "mostCommon"
  | "trends"
  | "routines"
  | "notes"
  | "patterns"
  | "photoCompare";

/** Serializable report card descriptor produced by buildReport(). */
export interface ReportCard {
  type: ReportCardType;
  [key: string]: unknown; // per-type payload; validated in validate.ts
}

/** A saved report snapshot (db.reports[]). */
export interface ReportModel {
  id: string;
  type: "week" | "month";
  range: ReportRange;
  createdAt: string;
  model: ReportCard[];
}

/* ---------- export ---------- */

export interface ExportRange {
  start: string | null; // null = all time
  end: string | null;
}

/** One row of the wide CSV/XLSX table (header + row arrays of cells). */
export type ExportCell = string | number | boolean | null | undefined;
export interface ExportTable {
  header: string[];
  rows: ExportCell[][];
}

/* ---------- food & bowel logs ----------

   These two categories don't fit the daily-survey shape the rest of the app is
   built on: a day has one severity rating but four meals and two bowel
   movements. So they live in their own top-level arrays keyed by date rather
   than as answers on a DailyEntry, and the trend system reads *derived* daily
   aggregates off them (see src/lib/tracking.ts).

   The load-bearing rule in both shapes: **what the person entered and what a
   model guessed are never stored in the same field.** `nutrition` holds only
   values the user typed or explicitly edited; `ai` holds the untouched model
   response. The effective value is the user's if present and the estimate
   otherwise, and the UI can always say which it showed. Blending them on write
   would make "is this number mine?" permanently unanswerable. */

export type MealCategory = "breakfast" | "lunch" | "dinner" | "snack" | "drink";

export type AiConfidence = "low" | "medium" | "high";

/** Nutrition figures. Every field optional — a partial estimate is normal and
    more honest than a zero-filled one. */
export interface NutritionValues {
  calories?: number;
  protein?: number; // g
  carbs?: number; // g
  fat?: number; // g
  fiber?: number; // g
  sugar?: number; // g
  sodium?: number; // mg
  /** Anything else worth surfacing, e.g. { label: "Iron", amount: "2.1 mg" }. */
  micros?: { label: string; amount: string }[];
}

/** A model's reading of a meal. Stored verbatim, never merged into the user's
    own figures. */
export interface FoodAiResult {
  at: string; // ISO
  model: string;
  /** Which inputs the model actually got. `library` is the odd one out: no
      model ran, the numbers were carried forward from a saved food whose
      figures were an estimate the user never confirmed. Keeping that
      distinction alive across re-use is the whole point — otherwise logging a
      saved food quietly launders a guess into a measurement. */
  source: "text" | "photo" | "photo+text" | "library";
  /** What the model thinks the food is — only meaningful on a photo path. */
  identified?: string;
  nutrition: NutritionValues;
  confidence: AiConfidence;
  /** The model's own caveat, shown under the estimate. */
  note?: string;
}

/** A food the user has saved, so they never type it twice.

    This is the local-first stand-in for a nutrition database: there is no
    server to hold one, but in practice people eat the same thirty or forty
    things on repeat, so a library built from their own logs covers almost
    every meal after the first week. `nutrition` describes exactly one
    `serving`; logging scales it. */
export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  /** The serving `nutrition` describes, e.g. "1 bowl" or "100 g". */
  serving: string;
  nutrition: NutritionValues;
  /** True when these figures began life as a model estimate the user never
      confirmed. Carried into every log made from this item. */
  estimated?: boolean;
  favorite?: boolean;
  /** How many times it has been logged, for the "Frequent" list. */
  useCount: number;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Optional daily targets. Every field optional — someone tracking protein
    only should not have to invent a calorie goal to do it. */
export interface NutritionGoals {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

export interface FoodLog {
  id: string;
  date: string; // YYYY-MM-DD (local)
  time: string; // HH:MM (local, 24h)
  meal: MealCategory;
  /** What the user called it. May be empty on a photo-only log. */
  description: string;
  /** Set when this came from the library; lets the diary show "2 × 1 bowl"
      and lets the library count its uses. The log still stores its own scaled
      figures, so editing a saved food never rewrites history. */
  foodId?: string;
  servings?: number;
  /** Free text, e.g. "1 bowl", "2 slices". */
  serving?: string;
  /** Numeric weight/volume, paired with `unit`. */
  quantity?: number;
  unit?: string; // g | oz | ml | cup | serving …
  notes?: string;
  photoId?: string;
  /** The user's own figures. Only ever written by the user. */
  nutrition?: NutritionValues;
  /** The model's figures, kept whole and separate. */
  ai?: FoodAiResult;
  createdAt: string;
  updatedAt: string;
}

export type BowelAmount = "small" | "medium" | "large";

/** A model's reading of a stool photo. Observable attributes only — the prompt
    and the normaliser both refuse anything diagnostic. */
export interface BowelAiResult {
  at: string;
  model: string;
  bristol?: number; // 1–7
  /** Relative volume, in the same three buckets the form offers. Judged from
      the photo like everything else here, and just as skippable. */
  amount?: BowelAmount;
  color?: string;
  consistency?: string;
  form?: string;
  confidence: AiConfidence;
  note?: string;
}

export interface BowelLog {
  id: string;
  date: string; // YYYY-MM-DD (local)
  time: string; // HH:MM (local, 24h)
  /** Bristol Stool Scale, 1 (hard lumps) – 7 (entirely liquid). */
  bristol?: number;
  amount?: BowelAmount;
  color?: string;
  consistency?: string;
  /** 0 none – 3 severe, on all three. */
  urgency?: number;
  straining?: number;
  discomfort?: number;
  notes?: string;
  photoId?: string;
  ai?: BowelAiResult;
  createdAt: string;
  updatedAt: string;
}

/* ---------- the routine: medications, supplements, creams, products ----------

   The third shape that doesn't fit the daily survey, and the one people ask
   for first. A survey question can record *that* you moisturised; it cannot
   record that you used 2 pumps of the CeraVe in the morning, skipped the
   evening one, and have been on 10 mg of the antihistamine since Tuesday.

   Two objects, and the split is the whole design:

   - `RoutineItem` is the *thing* — a medication, a supplement, a cream, a
     shampoo, a shake. It carries the usual dose and when in the day it
     belongs. Editing it changes what today's checklist asks for.
   - `RoutineLog` is one *use* of that thing at one moment. It carries its own
     copy of the name, kind and dose, so renaming an item or deleting it
     outright can never rewrite what a past day says happened. That is the same
     rule the food diary follows, for the same reason: history is a record, not
     a view.

   The dose is a string on purpose. "500 mg", "2 pumps", "a pea-sized amount"
   and "1 scoop" are all things people actually take, and forcing them through
   a number and a unit picker would make the common case slower to serve a
   tidiness nobody asked for. */

export type RoutineKind =
  | "med" // prescription or over-the-counter medication
  | "supplement" // vitamins, minerals, powders
  | "topical" // creams, moisturisers, ointments, balms
  | "product" // shampoo, soap, sunscreen — anything applied that isn't a treatment
  | "food" // a daily driver you eat or drink: shake, kefir, electrolytes
  | "other";

/** Which part of the day an item belongs to. An item with no times is simply
    "anytime today" and appears in its own group. */
export type RoutineTime = "morning" | "midday" | "evening" | "bed";

export interface RoutineItem {
  id: string;
  name: string;
  kind: RoutineKind;
  /** Brand, strength, or whatever distinguishes this tub from the other one. */
  brand?: string;
  /** One dose, in the user's own words: "500 mg", "2 pumps", "1 scoop". */
  dose?: string;
  /** Which slots this belongs to. Empty means anytime. Ignored when
      `daily` is false — an as-needed item has no schedule to miss. */
  times: RoutineTime[];
  /** True for a daily driver (the checklist asks for it every day); false for
      something taken only when needed, which is offered but never chased. */
  daily: boolean;
  notes?: string;
  /** Off the checklist without losing its history. Deleting is also offered;
      this is for the course that finished. */
  archived?: boolean;
  /** How many times it has been logged, and when last — drives ordering in the
      as-needed row. */
  useCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineLog {
  id: string;
  date: string; // YYYY-MM-DD (local)
  time: string; // HH:MM (local, 24h)
  /** The item this came from. Kept even after the item is deleted, so an undo
      or a re-import can still line them back up. */
  itemId: string;
  /** Snapshots, written at log time. See the note above: these are what make
      a past day immune to an edit made today. */
  name: string;
  kind: RoutineKind;
  dose?: string;
  /** Which slot this use satisfies, when the item has any. */
  slot?: RoutineTime;
  /** A deliberate miss, recorded as one. Distinct from an absent log, which
      only ever means "nothing was said". */
  skipped?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------- onboarding & database root ---------- */

export interface OnboardingState {
  ack: boolean; // disclaimer acknowledged
  onboarded: boolean; // wizard completed (or legacy install)
}

export interface AppDatabase extends OnboardingState {
  profile: TrackingSetup;
  entries: DailyEntry[];
  reports?: ReportModel[];
  /** Meals, newest-last. Many per day. */
  food?: FoodLog[];
  /** Saved foods, reusable across days. */
  foods?: FoodItem[];
  /** Bowel movements, newest-last. Many per day. */
  bowel?: BowelLog[];
  /** The routine: what the person takes, applies or uses. */
  routineItems?: RoutineItem[];
  /** One row per use of a routine item. Many per day. */
  routine?: RoutineLog[];
  /** Rituals: the routine as a process — a shower and what follows it, the
      morning handful, the wind-down. See src/lib/rituals.ts. */
  rituals?: Ritual[];
  /** One row per ritual per day. */
  ritualRuns?: RitualRun[];
  /** One row per answered (or dismissed) weekly tune-up. Also the scheduler's
      memory — it is what stops the same ritual being asked about twice. */
  ritualReviews?: RitualReview[];
  /** Flares and bad stretches, marked by the user. See src/lib/episodes.ts. */
  episodes?: HealthEpisode[];
  /** Time outside, with the sun's own arithmetic attached. See src/lib/sun.ts. */
  sun?: SunSession[];
  /** Blood work and measurements somebody else took. See src/lib/labs.ts. */
  labs?: LabResult[];
  /** Running comparisons the person asked for. See src/lib/experiments.ts. */
  experiments?: Experiment[];
  /** One environmental record per day, fetched with permission. Weather, not
      whereabouts — see the header of src/lib/context.ts. */
  context?: DayContext[];
  schemaVersion?: number;
}

/* ---------- episodes ----------

   The shape lives in src/lib/episodes.ts next to the arithmetic that reads it —
   that module is pure and self-contained, and splitting a twelve-line interface
   away from the two hundred lines that use it would help nobody. It is
   re-exported here so `types/models` remains the one import for the data
   contract. */
export type { HealthEpisode };

/* Same reasoning for the five shapes 1.21 added: each lives next to the
   arithmetic that reads it, and is re-exported here so `types/models` stays
   the one import for the data contract. */
export type { Cadence, CadencePause, CadenceUnit } from "../lib/cadence";
export type { ContextConsent, DayContext };
export type { Experiment };
export type { LabResult };
export type { SunProfile, SunSession };
export type { Ritual, RitualReview, RitualRun, RitualStep } from "../lib/rituals";
