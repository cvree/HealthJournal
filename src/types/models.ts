/* Shared data model for Health Journal.
   These types describe the shapes that already exist at runtime in App.tsx —
   they are the contract, verified against live data by src/lib/validate.ts and
   the test suite. New code must import from here; App.tsx adopts them
   incrementally (it still carries @ts-nocheck until fully migrated). */

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
  backdrop?: boolean;
}

/** The single person's tracking setup (named "profile" in App.tsx). */
export interface TrackingSetup {
  id: string;
  name: string;
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
  schemaVersion?: number;
}
