/* Export system, extracted from App.tsx as the first fully-typed module.
   Everything here is pure: template + entries in, header/rows/CSV text out.
   App.tsx keeps thin wrappers with the old signatures so no call site or
   saved workflow changes. Covered end-to-end by tests/exports.test.ts. */

import type {
  BowelLog,
  DailyEntry,
  ExportCell,
  ExportTable,
  FoodLog,
  RoutineItem,
  RoutineLog,
  SurveyQuestion,
  TrackingSetup,
} from "../types/models";
import { NUTRIENT_KEYS, dayTotals, mealLabel, resolveNutrient } from "./tracking";
import { kindLabel, routineOn, timeLabel } from "./routine";

/** Minimal view of the merged template this module needs. */
export interface TemplateLike {
  label: string;
  fields: SurveyQuestion[];
}

/** Human/spreadsheet-friendly cell text: booleans → yes/no, arrays joined. */
export function serialize(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.join("; ");
  return String(v);
}

export function csvEscape(s: ExportCell): string {
  const str = String(s ?? "");
  return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

export function toCSV(rows: ExportCell[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

export const META_HEADERS = [
  "profile_id", "profile_name", "profile_template", "date", "entry_id",
  "quick_log_completed", "detailed_log_completed", "created_at", "updated_at",
] as const;

export function metaCols(profile: TrackingSetup, tpl: TemplateLike, e: DailyEntry): ExportCell[] {
  return [profile.id, profile.name, tpl.label, e.date, e.id,
    serialize(e.quickLogCompleted), serialize(e.detailedLogCompleted), e.createdAt, e.updatedAt];
}

/** Wide table: one row per day, one column per exportable question.
    Photo questions expand into flag/rating/rating-source/note/photo-id
    columns; linked ratings read from the linked answer key (the single
    source of truth for those values).

    When `food` is supplied, each row also carries that day's nutrition totals.
    Per-meal detail doesn't fit a one-row-per-day table and lives in
    `buildFoodTable` instead — this is the daily summary that belongs beside
    the survey answers. */
export function buildWideTable(
  tpl: TemplateLike, profile: TrackingSetup, entries: DailyEntry[],
  food: FoodLog[] = [], routine: RoutineLog[] = []
): ExportTable {
  const efields = tpl.fields.filter((f) => f.exportable !== false);
  const header: string[] = [...META_HEADERS];
  for (const f of efields) {
    if (f.type === "photo") header.push(`${f.k}_photo`, `${f.k}_rating`, `${f.k}_rating_source`, `${f.k}_note`, `${f.k}_photo_id`);
    else header.push(f.k);
  }
  const withFood = food.length > 0;
  if (withFood) {
    header.push("food_meals", ...NUTRIENT_KEYS.map((k) => `food_${k}`), "food_partly_estimated");
  }
  /* The routine's daily summary. Per-dose detail doesn't fit one row per day
     and lives in `buildRoutineTable`; what belongs beside the survey answers is
     "how many, which ones" — the two columns somebody correlating a symptom
     against a cream actually sorts by. */
  const withRoutine = routine.length > 0;
  if (withRoutine) header.push("routine_taken", "routine_skipped", "routine_items");
  header.push("imported_fields", "notes");

  const rows: ExportCell[][] = entries.map((e) => {
    const row: ExportCell[] = metaCols(profile, tpl, e);
    for (const f of efields) {
      if (f.type === "photo") {
        const p = e.photos?.[f.k];
        const ratingVal = f.linkedTo ? e.answers?.[f.linkedTo] : p?.rating;
        const ratingSrc = f.linkedTo ? `linked:${f.linkedTo}` : (p?.ratingSource || "");
        row.push(p?.photoId ? "y" : "", (ratingVal as ExportCell) ?? "", ratingSrc, p?.note || "", p?.photoId || "");
      } else {
        row.push(serialize(e.answers?.[f.k]));
      }
    }
    if (withFood) {
      const t = dayTotals(food, e.date);
      row.push(t.meals || "");
      for (const k of NUTRIENT_KEYS) row.push(t[k] == null ? "" : t[k]);
      row.push(t.partlyEstimated ? "y" : "");
    }
    if (withRoutine) {
      const doses = routineOn(routine, e.date);
      const taken = doses.filter((r) => !r.skipped);
      row.push(taken.length || "", doses.filter((r) => r.skipped).length || "");
      row.push(taken.map((r) => (r.dose ? `${r.name} (${r.dose})` : r.name)).join("; "));
    }
    row.push(Object.entries(e.sources || {}).filter(([, v]) => v === "fitbit").map(([k]) => k).join("|"));
    row.push(e.notes || "");
    return row;
  });

  return { header, rows };
}

/* ---------- food & bowel ----------

   One row per log, not per day. Every nutrient gets two columns — the value
   and where it came from — because an export that flattens "I weighed this"
   and "a model guessed this" into one number destroys the distinction the
   whole feature is built to preserve, and a spreadsheet is exactly where
   someone would go looking for it. */

export function buildFoodTable(food: FoodLog[]): ExportTable {
  const header = [
    "date", "time", "meal", "description", "serving", "quantity", "unit",
    ...NUTRIENT_KEYS.flatMap((k) => [k, `${k}_source`]),
    "micronutrients", "ai_identified", "ai_source", "ai_confidence", "ai_note",
    "photo_id", "notes", "log_id", "created_at", "updated_at",
  ];

  const rows: ExportCell[][] = [...food]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map((f) => {
      const row: ExportCell[] = [
        f.date, f.time, mealLabel(f.meal), f.description || "",
        f.serving || "", f.quantity ?? "", f.unit || "",
      ];
      for (const k of NUTRIENT_KEYS) {
        const r = resolveNutrient(f, k);
        row.push(r.value ?? "", r.value == null ? "" : r.source);
      }
      const micros = f.nutrition?.micros || f.ai?.nutrition?.micros || [];
      row.push(micros.map((m) => `${m.label}: ${m.amount}`).join("; "));
      row.push(f.ai?.identified || "", f.ai?.source || "", f.ai?.confidence || "", f.ai?.note || "");
      row.push(f.photoId || "", f.notes || "", f.id, f.createdAt, f.updatedAt);
      return row;
    });

  return { header, rows };
}

export function buildBowelTable(bowel: BowelLog[]): ExportTable {
  const header = [
    "date", "time", "bristol_type", "amount", "color", "consistency",
    "urgency_0_3", "straining_0_3", "discomfort_0_3",
    "ai_bristol", "ai_color", "ai_consistency", "ai_form", "ai_confidence",
    "photo_id", "notes", "log_id", "created_at", "updated_at",
  ];

  const rows: ExportCell[][] = [...bowel]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map((b) => [
      b.date, b.time, b.bristol ?? "", b.amount || "", b.color || "", b.consistency || "",
      b.urgency ?? "", b.straining ?? "", b.discomfort ?? "",
      b.ai?.bristol ?? "", b.ai?.color || "", b.ai?.consistency || "", b.ai?.form || "",
      b.ai?.confidence || "",
      b.photoId || "", b.notes || "", b.id, b.createdAt, b.updatedAt,
    ]);

  return { header, rows };
}

/** Rows inside a date range, for the export screen's range filter. */
export const logsInRange = <T extends { date: string }>(rows: T[], start: string, end: string): T[] =>
  (rows || []).filter((r) => r.date >= start && r.date <= end);

/* ---------- the routine ----------

   One row per dose, not per day, and every row carries the name, kind and dose
   *as they were written at the time* — the same snapshot the log holds. An
   export that resolved names through the item list would quietly rewrite six
   months of history the first time somebody corrected a spelling, which is
   exactly what a record is not allowed to do.

   `items` is optional and only supplies the columns describing the plan
   (what the item usually is, when it is asked for) for rows whose item still
   exists. Nothing is filled in from it that the log already answers. */

export function buildRoutineTable(routine: RoutineLog[], items: RoutineItem[] = []): ExportTable {
  const header = [
    "date", "time", "item", "kind", "dose", "when", "status", "notes",
    "usual_dose", "brand", "item_id", "log_id", "created_at", "updated_at",
  ];
  const byId = new Map(items.map((i) => [i.id, i]));

  const rows: ExportCell[][] = [...routine]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map((r) => {
      const item = byId.get(r.itemId);
      return [
        r.date, r.time, r.name, kindLabel(r.kind), r.dose || "",
        r.slot ? timeLabel(r.slot) : "", r.skipped ? "skipped" : "taken", r.notes || "",
        item?.dose || "", item?.brand || "",
        r.itemId, r.id, r.createdAt, r.updatedAt,
      ];
    });

  return { header, rows };
}

/** The plan itself: what is tracked, how much, and when it is asked for. A
    small sheet, and the one somebody prints to take to an appointment. */
export function buildRoutineItemsTable(items: RoutineItem[]): ExportTable {
  const header = [
    "item", "kind", "brand", "dose", "schedule", "when", "archived",
    "times_logged", "last_used", "notes", "item_id", "created_at", "updated_at",
  ];
  const rows: ExportCell[][] = [...items]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((i) => [
      i.name, kindLabel(i.kind), i.brand || "", i.dose || "",
      i.daily ? "daily" : "as needed",
      (i.times || []).map((t) => timeLabel(t)).join("; "),
      i.archived ? "y" : "",
      i.useCount ?? 0, i.lastUsedAt || "", i.notes || "",
      i.id, i.createdAt, i.updatedAt,
    ]);
  return { header, rows };
}
