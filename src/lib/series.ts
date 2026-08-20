/* One question, asked of everything: what was this on that day?

   The journal now holds seven different shapes of data — survey answers,
   meals, bowel movements, doses, sun sessions, environmental context, lab
   results — and every one of them reduces to a number per day in its own way.
   Before this module, each surface that wanted to compare two of them had to
   know about all seven.

   So this is the seam. Hand it the slices of the database and it hands back a
   flat list of *variables*, each with a label, a unit, a direction and one
   method: `value(date)`. From there an experiment comparing morning sunlight
   against sleep quality does not know or care that one side came from a GPS
   and a solar model and the other from somebody tapping a 7.

   It sits above `./metrics` (which already unified food, bowel and routine)
   rather than replacing it, because that registry is what the chart and the
   metric picker already read and there was no reason to move them. */

import type { AnswerValue, BowelLog, FoodLog, RoutineItem, RoutineLog } from "../types/models";
import type { DayContext } from "./context";
import type { LabResult } from "./labs";
import type { SunSession } from "./sun";
import { CONTEXT_METRICS } from "./context";
import { DERIVED_METRICS, metricCtx } from "./metrics";
import { labMetricsFor } from "./labs";
import { SUN_METRICS } from "./sun";

export type VarKind = "answer" | "food" | "bowel" | "routine" | "sun" | "environment" | "lab";

export interface Variable {
  k: string;
  label: string;
  unit?: string;
  /** Which way is worse, in the app's existing vocabulary. */
  dir: "sym" | "pos" | "neutral";
  /** Section heading in a picker. */
  sec: string;
  kind: VarKind;
  value: (date: string) => number | null;
}

export interface Entryish {
  date: string;
  answers?: Record<string, AnswerValue>;
}

/** The template fields a caller wants offered, in as much detail as this
    module needs. */
export interface FieldLike {
  k: string;
  label: string;
  type: string;
  dir?: "sym" | "pos" | "neutral";
  unit?: string;
  sec?: string;
}

export interface SeriesSources {
  entries?: Entryish[];
  fields?: FieldLike[];
  food?: FoodLog[];
  bowel?: BowelLog[];
  routine?: RoutineLog[];
  routineItems?: RoutineItem[];
  sun?: SunSession[];
  context?: DayContext[];
  labs?: LabResult[];
}

const toNum = (v: AnswerValue | undefined): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  return null;
};

/** Every variable this journal can currently produce, in picker order:
    the person's own questions first, then what the app derived, then what it
    fetched, then what a laboratory measured. That order is the app's opinion —
    your own answers are the thing you are actually tracking. */
export function variables(src: SeriesSources): Variable[] {
  const byDate = new Map((src.entries || []).map((e) => [e.date, e] as const));
  const out: Variable[] = [];

  for (const f of src.fields || []) {
    /* Only the types that reduce to a number. A free-text note and a photo are
       real data and belong nowhere near a comparison of averages. */
    if (!["scale", "toggle", "number"].includes(f.type)) continue;
    out.push({
      k: f.k,
      label: f.label,
      unit: f.unit,
      dir: f.dir || "sym",
      sec: f.sec || "Your check-in",
      kind: "answer",
      value: (date) => toNum(byDate.get(date)?.answers?.[f.k]),
    });
  }

  const derivedSource = {
    food: src.food || [],
    bowel: src.bowel || [],
    routine: src.routine || [],
    routineItems: src.routineItems || [],
  };
  for (const m of DERIVED_METRICS) {
    out.push({
      k: m.k,
      label: m.label,
      unit: m.unit,
      dir: m.dir,
      sec: m.sec,
      kind: m.k.startsWith("food_") ? "food" : m.k.startsWith("bm_") ? "bowel" : "routine",
      value: (date) => m.value(metricCtx(derivedSource, date)),
    });
  }

  for (const m of SUN_METRICS) {
    out.push({
      k: m.k,
      label: m.label,
      unit: m.unit,
      dir: m.dir,
      sec: m.sec,
      kind: "sun",
      value: (date) => m.value({ sun: src.sun || [], date }),
    });
  }

  for (const m of CONTEXT_METRICS) {
    out.push({
      k: m.k,
      label: m.label,
      unit: m.unit,
      dir: m.dir,
      sec: m.sec,
      kind: "environment",
      value: (date) => m.value({ context: src.context || [], date }),
    });
  }

  for (const m of labMetricsFor(src.labs || [])) {
    out.push({
      k: m.k,
      label: m.label,
      unit: m.unit,
      dir: m.dir,
      sec: m.sec,
      kind: "lab",
      value: (date) => m.value({ labs: src.labs || [], date }),
    });
  }

  return out;
}

/** A lookup by key, built once per render rather than searched per day. */
export function variableMap(src: SeriesSources): Map<string, Variable> {
  return new Map(variables(src).map((v) => [v.k, v] as const));
}

export const findVariable = (vars: Variable[], k: string): Variable | undefined =>
  vars.find((v) => v.k === k);

/** Which variables have enough days behind them to be worth offering. A picker
    full of options that produce an empty chart is worse than a short one. */
export function usableVariables(src: SeriesSources, dates: string[], minDays = 8): Variable[] {
  return variables(src).filter((v) => {
    let n = 0;
    for (const d of dates) {
      if (v.value(d) != null) n += 1;
      if (n >= minDays) return true;
    }
    return false;
  });
}

/** Every date in the journal that has anything on it at all, oldest first —
    the spine every comparison runs along. */
export function journalDates(src: SeriesSources): string[] {
  const set = new Set<string>();
  for (const e of src.entries || []) set.add(e.date);
  for (const f of src.food || []) set.add(f.date);
  for (const b of src.bowel || []) set.add(b.date);
  for (const r of src.routine || []) set.add(r.date);
  for (const s of src.sun || []) set.add(s.date);
  for (const c of src.context || []) set.add(c.date);
  return [...set].sort();
}

/** Every date between two bounds, inclusive — used when a comparison needs a
    continuous spine rather than only the days something was written down. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const [y, m, d] = start.split("-").map(Number);
  const cur = new Date(y, m - 1, d);
  const stop = (() => {
    const [ey, em, ed] = end.split("-").map(Number);
    return new Date(ey, em - 1, ed);
  })();
  const pad = (n: number) => String(n).padStart(2, "0");
  let guard = 0;
  while (cur <= stop && guard < 4000) {
    out.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return out;
}

export function shiftDate(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
