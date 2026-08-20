/* Labs and measurements — the numbers somebody else took.

   Everything else in this journal is a person's own account of their day. This
   is the one collection that isn't: a ferritin of 18, a blood pressure of
   134/86, a weight. They arrive months apart, they are the numbers a clinician
   opens the conversation with, and in most people's lives they live in a
   drawer of paper and three different patient portals.

   Three decisions shape this module:

   **A lab value is a measurement and the app must never blur that.** The
   estimated vitamin D the sun feature produces is an estimate, in IU, of
   production. A 25(OH)D result is a measurement, in ng/mL, of a blood level.
   They belong on the same *screen*, because that is genuinely interesting, and
   they must never share an axis, a colour or a sentence. `LabResult.kind` is
   what enforces that downstream.

   **The lab's own reference range travels with the result.** Ranges differ
   between laboratories, between assays, and between countries, and an app that
   substitutes its own "normal" for the one printed on the report is telling
   somebody their result is abnormal on the strength of a constant in a file.
   So the range is a field on the record, captured from the report, and the
   catalog's typical range is a *prefill*, clearly labelled as one.

   **What else was happening is context, not explanation.** Between two vitamin
   D readings there was more sun, a supplement started, and a season change.
   Showing those under the line is the single most useful thing this screen
   does. Saying any of them moved the number is the single most dangerous, and
   the vocabulary in `CHANGE_COPY` is written so it cannot. */

import type { HealthEpisode } from "./episodes";
import type { RoutineItem } from "../types/models";
import type { SunSession } from "./sun";
import type { DayContext } from "./context";

/* ---------- the record ---------- */

/** What sort of number this is. Only `measurement` is a laboratory or device
    reading; `estimate` exists so the sunlight-derived vitamin D figure can be
    drawn beside one without ever being counted as one. */
export type LabKind = "measurement" | "estimate";

export interface LabResult {
  id: string;
  /** Catalog key ("vitamin_d", "ferritin") or `custom:<slug>`. */
  test: string;
  /** The name as it should be printed. Copied from the catalog at creation, or
      typed for a custom measurement — so renaming a catalog entry later cannot
      rewrite what a saved report says. */
  name: string;
  value: number;
  /** Second value, for the things that are two numbers: blood pressure. */
  value2?: number;
  unit: string;
  /** YYYY-MM-DD, local — the date of the draw, not the date it was typed in. */
  date: string;
  /** HH:MM, when it matters (a morning cortisol, a post-meal glucose). */
  time?: string;
  /** The range the *laboratory* printed. Either numeric bounds or free text
      ("Negative", "<5.0"). Both are kept; neither is invented. */
  refLow?: number;
  refHigh?: number;
  refText?: string;
  fasting?: boolean;
  /** Who ran it. */
  provider?: string;
  note?: string;
  /** A photo of the report, stored in the same blob store as everything else. */
  photoId?: string;
  kind: LabKind;
  createdAt: string;
  updatedAt: string;
}

/* ---------- the catalog ----------

   Not a medical reference. It is a *keyboard shortcut*: the twenty-odd tests
   people actually track, with the units they come in and the range most
   laboratories print, so that adding a result is three taps rather than four
   fields of typing. Every value is overridable and the range is always shown
   as the lab's own once one is entered. */

export interface LabUnit {
  unit: string;
  /** Multiply a value in this unit by this to get the catalog's base unit. */
  toBase: number;
  decimals?: number;
}

export interface LabTest {
  key: string;
  label: string;
  /** What people also call it, for the search box. */
  aliases?: string[];
  category: "vitamin" | "mineral" | "metabolic" | "hormone" | "lipid" | "blood" | "vital" | "body";
  /** First entry is the default and the base unit. */
  units: LabUnit[];
  /** Typical adult reference range in the base unit — a prefill, drawn as one,
      never presented as this person's own range. */
  typicalLow?: number;
  typicalHigh?: number;
  decimals: number;
  /** Which direction is generally better, where there is one. Used only for
      the arrow's colour and left `neutral` wherever the answer is "it
      depends", which is most of the time. */
  dir: "up" | "down" | "range" | "neutral";
  /** Two numbers rather than one. */
  paired?: boolean;
  pairedLabel?: string;
  /** A one-line note printed under the range prefill. */
  hint?: string;
}

export const LAB_TESTS: LabTest[] = [
  {
    key: "vitamin_d",
    label: "Vitamin D (25-OH)",
    aliases: ["25(OH)D", "vit d", "calcidiol", "vitamin d3"],
    category: "vitamin",
    units: [
      { unit: "ng/mL", toBase: 1 },
      { unit: "nmol/L", toBase: 0.4006 },
    ],
    typicalLow: 30,
    typicalHigh: 100,
    decimals: 1,
    dir: "range",
    hint: "Ranges vary between labs; many report 30–100 ng/mL as sufficient.",
  },
  {
    key: "ferritin",
    label: "Ferritin",
    aliases: ["iron stores"],
    category: "mineral",
    units: [{ unit: "ng/mL", toBase: 1 }, { unit: "µg/L", toBase: 1 }],
    typicalLow: 15,
    typicalHigh: 200,
    decimals: 0,
    dir: "range",
  },
  {
    key: "b12",
    label: "Vitamin B12",
    aliases: ["cobalamin"],
    category: "vitamin",
    units: [{ unit: "pg/mL", toBase: 1 }, { unit: "pmol/L", toBase: 1.355 }],
    typicalLow: 200,
    typicalHigh: 900,
    decimals: 0,
    dir: "range",
  },
  {
    key: "folate",
    label: "Folate",
    category: "vitamin",
    units: [{ unit: "ng/mL", toBase: 1 }, { unit: "nmol/L", toBase: 0.4413 }],
    typicalLow: 3,
    typicalHigh: 20,
    decimals: 1,
    dir: "range",
  },
  {
    key: "hba1c",
    label: "HbA1c",
    aliases: ["a1c", "glycated haemoglobin"],
    category: "metabolic",
    units: [{ unit: "%", toBase: 1 }, { unit: "mmol/mol", toBase: 0.0915 }],
    typicalLow: 4,
    typicalHigh: 5.6,
    decimals: 1,
    dir: "down",
  },
  {
    key: "glucose",
    label: "Glucose (fasting)",
    category: "metabolic",
    units: [{ unit: "mg/dL", toBase: 1 }, { unit: "mmol/L", toBase: 18.016 }],
    typicalLow: 70,
    typicalHigh: 99,
    decimals: 0,
    dir: "range",
  },
  {
    key: "tsh",
    label: "TSH",
    aliases: ["thyroid stimulating hormone"],
    category: "hormone",
    units: [{ unit: "mIU/L", toBase: 1 }, { unit: "µIU/mL", toBase: 1 }],
    typicalLow: 0.4,
    typicalHigh: 4,
    decimals: 2,
    dir: "range",
  },
  {
    key: "free_t4",
    label: "Free T4",
    category: "hormone",
    units: [{ unit: "ng/dL", toBase: 1 }, { unit: "pmol/L", toBase: 0.0777 }],
    typicalLow: 0.8,
    typicalHigh: 1.8,
    decimals: 2,
    dir: "range",
  },
  {
    key: "free_t3",
    label: "Free T3",
    category: "hormone",
    units: [{ unit: "pg/mL", toBase: 1 }, { unit: "pmol/L", toBase: 0.651 }],
    typicalLow: 2.3,
    typicalHigh: 4.2,
    decimals: 2,
    dir: "range",
  },
  {
    key: "crp",
    label: "CRP",
    aliases: ["c-reactive protein", "inflammation"],
    category: "blood",
    units: [{ unit: "mg/L", toBase: 1 }, { unit: "mg/dL", toBase: 10 }],
    typicalLow: 0,
    typicalHigh: 3,
    decimals: 1,
    dir: "down",
  },
  {
    key: "cholesterol_total",
    label: "Total cholesterol",
    category: "lipid",
    units: [{ unit: "mg/dL", toBase: 1 }, { unit: "mmol/L", toBase: 38.67 }],
    typicalHigh: 200,
    decimals: 0,
    dir: "down",
  },
  {
    key: "ldl",
    label: "LDL cholesterol",
    category: "lipid",
    units: [{ unit: "mg/dL", toBase: 1 }, { unit: "mmol/L", toBase: 38.67 }],
    typicalHigh: 100,
    decimals: 0,
    dir: "down",
  },
  {
    key: "hdl",
    label: "HDL cholesterol",
    category: "lipid",
    units: [{ unit: "mg/dL", toBase: 1 }, { unit: "mmol/L", toBase: 38.67 }],
    typicalLow: 40,
    decimals: 0,
    dir: "up",
  },
  {
    key: "triglycerides",
    label: "Triglycerides",
    category: "lipid",
    units: [{ unit: "mg/dL", toBase: 1 }, { unit: "mmol/L", toBase: 88.57 }],
    typicalHigh: 150,
    decimals: 0,
    dir: "down",
  },
  {
    key: "hemoglobin",
    label: "Haemoglobin",
    aliases: ["hgb", "hemoglobin"],
    category: "blood",
    units: [{ unit: "g/dL", toBase: 1 }, { unit: "g/L", toBase: 0.1 }],
    typicalLow: 12,
    typicalHigh: 17,
    decimals: 1,
    dir: "range",
  },
  {
    key: "iron",
    label: "Serum iron",
    category: "mineral",
    units: [{ unit: "µg/dL", toBase: 1 }, { unit: "µmol/L", toBase: 5.587 }],
    typicalLow: 60,
    typicalHigh: 170,
    decimals: 0,
    dir: "range",
  },
  {
    key: "magnesium",
    label: "Magnesium",
    category: "mineral",
    units: [{ unit: "mg/dL", toBase: 1 }, { unit: "mmol/L", toBase: 2.43 }],
    typicalLow: 1.7,
    typicalHigh: 2.2,
    decimals: 2,
    dir: "range",
  },
  {
    key: "blood_pressure",
    label: "Blood pressure",
    aliases: ["bp", "systolic", "diastolic"],
    category: "vital",
    units: [{ unit: "mmHg", toBase: 1 }],
    decimals: 0,
    dir: "down",
    paired: true,
    pairedLabel: "Diastolic",
    hint: "Systolic over diastolic — the two numbers a cuff gives you.",
  },
  {
    key: "resting_hr",
    label: "Resting heart rate",
    category: "vital",
    units: [{ unit: "bpm", toBase: 1 }],
    decimals: 0,
    dir: "neutral",
  },
  {
    key: "weight",
    label: "Weight",
    category: "body",
    units: [{ unit: "kg", toBase: 1 }, { unit: "lb", toBase: 0.4536 }],
    decimals: 1,
    dir: "neutral",
  },
  {
    key: "body_temp",
    label: "Body temperature",
    category: "vital",
    units: [{ unit: "°C", toBase: 1 }],
    decimals: 1,
    dir: "neutral",
  },
];

export const labTest = (key: string): LabTest | undefined =>
  LAB_TESTS.find((t) => t.key === key);

export const CATEGORY_LABEL: Record<LabTest["category"], string> = {
  vitamin: "Vitamins",
  mineral: "Minerals & iron",
  metabolic: "Metabolic",
  hormone: "Hormones & thyroid",
  lipid: "Cholesterol",
  blood: "Blood & inflammation",
  vital: "Vitals",
  body: "Body",
};

/** Search the catalog the way people type: "vit d", "a1c", "bp". */
export function searchTests(query: string): LabTest[] {
  const q = query.trim().toLowerCase();
  if (!q) return LAB_TESTS;
  return LAB_TESTS.filter((t) => {
    const hay = [t.label, t.key, ...(t.aliases || [])].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

/** Convert between the units one test is reported in. Returns null when the
    units aren't both known for that test — better a blank than a number that
    is wrong by a factor of 2.5. */
export function convertValue(
  testKey: string,
  value: number,
  from: string,
  to: string
): number | null {
  if (from === to) return value;
  const t = labTest(testKey);
  if (!t) return null;
  const a = t.units.find((u) => u.unit === from);
  const b = t.units.find((u) => u.unit === to);
  if (!a || !b || !b.toBase) return null;
  const base = value * a.toBase;
  return Math.round((base / b.toBase) * 1000) / 1000;
}

/* ---------- reading results ---------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const stamp = () => new Date().toISOString();
const rand = () => Math.random().toString(36).slice(2, 9);

export const newLabId = (): string => `lab_${Date.now().toString(36)}${rand()}`;

export interface NewLabInput {
  test: string;
  name?: string;
  value: number;
  value2?: number;
  unit?: string;
  date: string;
  time?: string;
  refLow?: number;
  refHigh?: number;
  refText?: string;
  fasting?: boolean;
  provider?: string;
  note?: string;
  photoId?: string;
}

export function newLabResult(input: NewLabInput): LabResult {
  const t = labTest(input.test);
  const at = stamp();
  return {
    id: newLabId(),
    test: input.test,
    name: (input.name || t?.label || input.test).slice(0, 80),
    value: input.value,
    value2: input.value2,
    unit: (input.unit || t?.units[0].unit || "").slice(0, 16),
    date: input.date,
    time: input.time && TIME_RE.test(input.time) ? input.time : undefined,
    refLow: Number.isFinite(Number(input.refLow)) ? Number(input.refLow) : undefined,
    refHigh: Number.isFinite(Number(input.refHigh)) ? Number(input.refHigh) : undefined,
    refText: input.refText?.slice(0, 60) || undefined,
    fasting: input.fasting,
    provider: input.provider?.slice(0, 80) || undefined,
    note: input.note?.slice(0, 500) || undefined,
    photoId: input.photoId,
    kind: "measurement",
    createdAt: at,
    updatedAt: at,
  };
}

export function sanitizeLabResults(rows: unknown): LabResult[] {
  if (!Array.isArray(rows)) return [];
  const out: LabResult[] = [];
  const seen = new Set<string>();
  for (const r of rows as any[]) {
    if (!r || typeof r !== "object" || !DATE_RE.test(r.date)) continue;
    const value = Number(r.value);
    if (!Number.isFinite(value)) continue;
    const id = typeof r.id === "string" && r.id ? r.id : newLabId();
    if (seen.has(id)) continue;
    seen.add(id);
    const test = typeof r.test === "string" && r.test ? r.test.slice(0, 60) : "custom";
    const t = labTest(test);
    const value2 = Number(r.value2);
    out.push({
      id,
      test,
      name: (typeof r.name === "string" && r.name ? r.name : t?.label || test).slice(0, 80),
      value: Math.round(value * 1000) / 1000,
      value2: Number.isFinite(value2) ? Math.round(value2 * 1000) / 1000 : undefined,
      unit: (typeof r.unit === "string" ? r.unit : t?.units[0].unit || "").slice(0, 16),
      date: r.date,
      time: typeof r.time === "string" && TIME_RE.test(r.time) ? r.time : undefined,
      refLow: Number.isFinite(Number(r.refLow)) ? Number(r.refLow) : undefined,
      refHigh: Number.isFinite(Number(r.refHigh)) ? Number(r.refHigh) : undefined,
      refText: typeof r.refText === "string" ? r.refText.slice(0, 60) : undefined,
      fasting: typeof r.fasting === "boolean" ? r.fasting : undefined,
      provider: typeof r.provider === "string" ? r.provider.slice(0, 80) : undefined,
      note: typeof r.note === "string" ? r.note.slice(0, 500) : undefined,
      photoId: typeof r.photoId === "string" ? r.photoId : undefined,
      kind: r.kind === "estimate" ? "estimate" : "measurement",
      createdAt: typeof r.createdAt === "string" ? r.createdAt : stamp(),
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : stamp(),
    });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* ---------- series ---------- */

/** Where a value sits against the range that came with it. `unknown` is the
    honest answer when no range was captured, and the UI draws nothing rather
    than guessing from the catalog. */
export type RangeStatus = "below" | "in" | "above" | "unknown";

export function rangeStatus(r: Pick<LabResult, "value" | "refLow" | "refHigh">): RangeStatus {
  const { value, refLow, refHigh } = r;
  if (refLow === undefined && refHigh === undefined) return "unknown";
  if (refLow !== undefined && value < refLow) return "below";
  if (refHigh !== undefined && value > refHigh) return "above";
  return "in";
}

export const RANGE_COPY: Record<RangeStatus, string> = {
  below: "Below the range your lab printed",
  in: "Inside the range your lab printed",
  above: "Above the range your lab printed",
  unknown: "No reference range recorded",
};

export interface LabPoint extends LabResult {
  /** Change from the previous result of the same test, in the same unit. */
  delta?: number;
  /** Days since the previous result. */
  gapDays?: number;
  status: RangeStatus;
}

/** Every result for one test, oldest first, each carrying its change from the
    one before it.

    Results in different units are converted onto the *most recent* result's
    unit, because that is the one the person is currently reading — a series
    that flips between nmol/L and ng/mL halfway along is unreadable, and
    forcing everything onto the catalog's base unit would silently redraw a
    value they typed. Anything that cannot be converted is dropped from the
    line rather than plotted at the wrong height. */
export function labSeries(results: LabResult[], testKey: string): LabPoint[] {
  const rows = results
    .filter((r) => r.test === testKey)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!rows.length) return [];
  const unit = rows[rows.length - 1].unit;
  const points: LabPoint[] = [];
  for (const r of rows) {
    let value = r.value;
    let refLow = r.refLow;
    let refHigh = r.refHigh;
    if (r.unit !== unit) {
      const v = convertValue(testKey, r.value, r.unit, unit);
      if (v == null) continue;
      value = v;
      refLow = refLow === undefined ? undefined : convertValue(testKey, refLow, r.unit, unit) ?? undefined;
      refHigh = refHigh === undefined ? undefined : convertValue(testKey, refHigh, r.unit, unit) ?? undefined;
    }
    const prev = points[points.length - 1];
    points.push({
      ...r,
      value,
      unit,
      refLow,
      refHigh,
      delta: prev ? Math.round((value - prev.value) * 1000) / 1000 : undefined,
      gapDays: prev ? daysBetween(prev.date, r.date) : undefined,
      status: rangeStatus({ value, refLow, refHigh }),
    });
  }
  return points;
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round(
    (new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000
  );
}

/** Which tests this journal actually holds, most-recently-measured first —
    the order the labs screen lists them in. */
export function testsHeld(results: LabResult[]): { key: string; name: string; count: number; latest: LabPoint }[] {
  const keys = [...new Set(results.map((r) => r.test))];
  return keys
    .map((key) => {
      const series = labSeries(results, key);
      return { key, name: series[series.length - 1].name, count: series.length, latest: series[series.length - 1] };
    })
    .filter((t) => t.latest)
    .sort((a, b) => (a.latest.date < b.latest.date ? 1 : -1));
}

/** "24 → 31 → 38 ng/mL" — the whole story of a test in one line. */
export function seriesLabel(points: LabPoint[], max = 4): string {
  if (!points.length) return "";
  const shown = points.slice(-max);
  const fmt = (p: LabPoint) => trimNum(p.value);
  return `${shown.map(fmt).join(" → ")} ${points[points.length - 1].unit}`.trim();
}

export function trimNum(v: number): string {
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}

/** The value as it should be printed, including the paired second number. */
export function labValueLabel(r: Pick<LabResult, "value" | "value2" | "unit">): string {
  const v = trimNum(r.value);
  return r.value2 !== undefined ? `${v}/${trimNum(r.value2)} ${r.unit}` : `${v} ${r.unit}`.trim();
}

/* ---------- what else happened ----------

   The band under the line. Between two readings there was a season, a course
   of something, a fortnight of sunshine, a flare. Those get drawn as small
   marks in the gap, and the copy below is the entire vocabulary they are
   allowed to speak in — declarative, past tense, no verbs of influence. This
   list is exported so the causal-language audit can read it. */

export type ChangeEventKind = "sun" | "routine" | "episode" | "season" | "travel" | "note";

export interface ChangeEvent {
  kind: ChangeEventKind;
  /** YYYY-MM-DD. */
  date: string;
  label: string;
  detail?: string;
}

export const CHANGE_COPY = {
  heading: "What else was in your journal during this period",
  caveat:
    "These happened in the same period. A lab value moves for many reasons, and this list is a memory aid, not an explanation.",
};

const MONTH_SEASONS: Record<number, string> = {
  0: "winter", 1: "winter", 2: "spring", 3: "spring", 4: "spring", 5: "summer",
  6: "summer", 7: "summer", 8: "autumn", 9: "autumn", 10: "autumn", 11: "winter",
};

const seasonOf = (date: string, lat: number): string => {
  const m = Number(date.slice(5, 7)) - 1;
  const north = MONTH_SEASONS[m];
  if (lat >= 0) return north;
  return { winter: "summer", spring: "autumn", summer: "winter", autumn: "spring" }[north] || north;
};

export interface ChangeSources {
  sun?: SunSession[];
  routineItems?: RoutineItem[];
  episodes?: HealthEpisode[];
  context?: DayContext[];
  entries?: { date: string; notes?: string }[];
}

/** Everything worth a mark between two dates. Bounded and deduplicated — the
    band under a two-year gap should be six marks, not four hundred. */
export function changesBetween(from: string, to: string, src: ChangeSources): ChangeEvent[] {
  const out: ChangeEvent[] = [];
  const within = (d: string) => d > from && d <= to;

  /* Sun: only worth a mark when the period is genuinely sunnier than the one
     before it, which is what "outdoor light increased" has to mean to be worth
     printing at all. */
  const sun = src.sun || [];
  const span = Math.max(1, daysBetween(from, to));
  const inWindow = sun.filter((s) => within(s.date));
  const priorFrom = shiftDate(from, -span);
  const prior = sun.filter((s) => s.date > priorFrom && s.date <= from);
  const minutes = inWindow.reduce((a, s) => a + s.minutes, 0);
  const priorMinutes = prior.reduce((a, s) => a + s.minutes, 0);
  if (minutes > 0 && minutes > priorMinutes * 1.3 && minutes - priorMinutes > 120) {
    out.push({
      kind: "sun",
      date: inWindow[Math.floor(inWindow.length / 2)]?.date || to,
      label: "Time outside increased",
      detail: `${Math.round(minutes / 60)}h across this period, against ${Math.round(priorMinutes / 60)}h in the period before it`,
    });
  } else if (minutes > 0 && priorMinutes > 0 && priorMinutes > minutes * 1.3) {
    out.push({
      kind: "sun",
      date: inWindow[Math.floor(inWindow.length / 2)]?.date || to,
      label: "Time outside decreased",
      detail: `${Math.round(minutes / 60)}h across this period, against ${Math.round(priorMinutes / 60)}h in the period before it`,
    });
  }

  /* Routine: things that *started* inside the window. A supplement that has
     been taken for three years is not news. */
  for (const item of src.routineItems || []) {
    const started = item.createdAt?.slice(0, 10);
    if (!started || !within(started)) continue;
    out.push({
      kind: "routine",
      date: started,
      label: `${item.name} started`,
      detail: [item.dose, item.brand].filter(Boolean).join(" · ") || undefined,
    });
  }

  /* Flares that began or ended inside the window. */
  for (const ep of src.episodes || []) {
    if (within(ep.start)) out.push({ kind: "episode", date: ep.start, label: `${ep.title} began` });
    if (ep.end && within(ep.end)) out.push({ kind: "episode", date: ep.end, label: `${ep.title} ended` });
  }

  /* Season, when the window crosses one. The most under-rated line on a
     vitamin D chart in the northern half of the world. */
  const lat = (src.context || [])[0]?.coords.lat ?? 0;
  const s1 = seasonOf(from, lat);
  const s2 = seasonOf(to, lat);
  if (s1 !== s2) {
    out.push({ kind: "season", date: to, label: `Season changed — ${s1} to ${s2}` });
  }

  /* A meaningful move in where the days were recorded. Coarse coordinates
     moving by more than a degree is a different climate, not a different
     street, which is exactly the threshold worth a mark and not one below it. */
  const ctx = (src.context || []).filter((c) => within(c.date));
  if (ctx.length > 2) {
    const first = ctx[0].coords;
    const moved = ctx.find(
      (c) => Math.abs(c.coords.lat - first.lat) > 1 || Math.abs(c.coords.lon - first.lon) > 1
    );
    if (moved) out.push({ kind: "travel", date: moved.date, label: "Days recorded somewhere else" });
  }

  return out
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 8);
}

function shiftDate(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/* ---------- vitamin D, measured beside estimated ----------

   The one place the two kinds of number are drawn together, and the place the
   distinction has to be loudest. What goes on the second track is *not* a
   predicted blood level — no model in this app can produce one. It is the sum
   of estimated production over the weeks before each draw, which is a
   different quantity in different units, and the label says so. */

export interface VitaminDPairing {
  /** The lab result. */
  point: LabPoint;
  /** Estimated IU produced from sunlight in the window before this draw. */
  estimatedIU: number;
  estimatedLow: number;
  estimatedHigh: number;
  /** Days outside in that window. */
  daysOutside: number;
  windowDays: number;
}

export const VITAMIN_D_PAIRING_NOTE =
  "Blood level is a measurement. Sunlight production is a research-model estimate of a different quantity, in different units. They sit side by side here because the story is interesting — the two lines are not comparable and are never drawn on one axis.";

/** Pair each 25(OH)D result with the sunlight recorded in the weeks before it.
    Eight weeks by default, which is roughly the half-life of 25(OH)D and the
    window a clinician would think in. */
export function vitaminDBesideSun(
  results: LabResult[],
  sun: SunSession[],
  windowDays = 56
): VitaminDPairing[] {
  return labSeries(results, "vitamin_d").map((point) => {
    const from = shiftDate(point.date, -windowDays);
    const rows = sun.filter((s) => s.date > from && s.date <= point.date);
    const days = new Set(rows.map((s) => s.date));
    return {
      point,
      estimatedIU: rows.reduce((a, s) => a + s.iu, 0),
      estimatedLow: rows.reduce((a, s) => a + s.iuLow, 0),
      estimatedHigh: rows.reduce((a, s) => a + s.iuHigh, 0),
      daysOutside: days.size,
      windowDays,
    };
  });
}

/* ---------- downstream ---------- */

export interface LabMetricCtx {
  labs?: LabResult[];
  date: string;
}

/** Lab results as chartable metrics. Only tests with at least two results get
    offered — a single point is not a trend and a picker full of them is
    noise. Values are carried forward: a ferritin taken in March is still the
    last thing anybody knows in April, and a chart that shows one dot and
    nothing else answers no question at all. */
export function labMetricsFor(results: LabResult[]) {
  const held = testsHeld(results).filter((t) => t.count >= 2);
  return held.map((t) => ({
    k: `lab_${t.key}`,
    label: t.name,
    unit: t.latest.unit,
    dir: "neutral" as const,
    sec: "Labs",
    value: ({ labs = [], date }: LabMetricCtx): number | null => {
      const series = labSeries(labs, t.key).filter((p) => p.date <= date);
      return series.length ? series[series.length - 1].value : null;
    },
  }));
}

/** The one-line summary an appointment pack leads a lab section with. */
export function labSummaryLine(points: LabPoint[]): string {
  if (!points.length) return "";
  const last = points[points.length - 1];
  const bits = [`${labValueLabel(last)} on ${last.date}`];
  if (last.delta !== undefined && last.gapDays !== undefined) {
    const dir = last.delta > 0 ? "up" : last.delta < 0 ? "down" : "unchanged";
    bits.push(
      dir === "unchanged"
        ? `unchanged over ${last.gapDays} days`
        : `${dir} ${trimNum(Math.abs(last.delta))} over ${last.gapDays} days`
    );
  }
  if (last.status !== "unknown") bits.push(RANGE_COPY[last.status].toLowerCase());
  return bits.join(" · ");
}
