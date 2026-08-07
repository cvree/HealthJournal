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
  /** ISO timestamp of the last restorable backup the user downloaded. */
  lastBackupAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Daily check-in reminder. See src/lib/reminders.ts for why there are two layers. */
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

/* ---------- onboarding & database root ---------- */

export interface OnboardingState {
  ack: boolean; // disclaimer acknowledged
  onboarded: boolean; // wizard completed (or legacy install)
}

export interface AppDatabase extends OnboardingState {
  profile: TrackingSetup;
  entries: DailyEntry[];
  reports?: ReportModel[];
  schemaVersion?: number;
}
