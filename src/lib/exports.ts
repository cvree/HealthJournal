/* Export system, extracted from App.tsx as the first fully-typed module.
   Everything here is pure: template + entries in, header/rows/CSV text out.
   App.tsx keeps thin wrappers with the old signatures so no call site or
   saved workflow changes. Covered end-to-end by tests/exports.test.ts. */

import type {
  DailyEntry,
  ExportCell,
  ExportTable,
  SurveyQuestion,
  TrackingSetup,
} from "../types/models";

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
    source of truth for those values). */
export function buildWideTable(tpl: TemplateLike, profile: TrackingSetup, entries: DailyEntry[]): ExportTable {
  const efields = tpl.fields.filter((f) => f.exportable !== false);
  const header: string[] = [...META_HEADERS];
  for (const f of efields) {
    if (f.type === "photo") header.push(`${f.k}_photo`, `${f.k}_rating`, `${f.k}_rating_source`, `${f.k}_note`, `${f.k}_photo_id`);
    else header.push(f.k);
  }
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
    row.push(Object.entries(e.sources || {}).filter(([, v]) => v === "fitbit").map(([k]) => k).join("|"));
    row.push(e.notes || "");
    return row;
  });

  return { header, rows };
}
