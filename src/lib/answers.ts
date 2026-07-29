/* Answer hardening: one place that knows what a valid answer looks like for
   each question type. Used when reading old entries (types may have changed
   since the answer was written) and when writing new ones. Invalid values
   never crash a renderer — they read as null. */

import type { AnswerValue, DailyEntry, SurveyQuestion } from "../types/models";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Is `value` a well-formed answer for this question type? */
export function isValidAnswer(field: Pick<SurveyQuestion, "type" | "options">, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  switch (field.type) {
    case "scale":
      return typeof value === "number" && isFinite(value) && value >= 1 && value <= 10;
    case "number":
      return typeof value === "number" && isFinite(value);
    case "toggle":
      return typeof value === "boolean";
    case "chips":
      if (typeof value === "string") return value.trim() !== "";
      return Array.isArray(value) && value.every((v) => typeof v === "string");
    case "text":
    case "time":
    case "date":
      return typeof value === "string";
    case "photo":
      return false; // photos live in entry.photos, never in answers
    default:
      return false;
  }
}

/** Coerce a raw value into a valid answer for the field, or null.
    Lossy inputs are salvaged where unambiguous (numeric strings, out-of-range
    scales clamped, single string for a multi-chip wrapped in an array). */
export function coerceAnswer(field: Pick<SurveyQuestion, "type" | "options" | "single">, value: unknown): AnswerValue {
  if (value === null || value === undefined) return null;
  switch (field.type) {
    case "scale": {
      const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
      return isFinite(n) ? clamp(Math.round(n), 1, 10) : null;
    }
    case "number": {
      const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
      return isFinite(n) ? n : null;
    }
    case "toggle":
      if (typeof value === "boolean") return value;
      if (value === "true" || value === 1) return true;
      if (value === "false" || value === 0) return false;
      return null;
    case "chips": {
      const arr = Array.isArray(value) ? value : typeof value === "string" ? [value] : null;
      if (!arr) return null;
      let picked = arr.filter((v): v is string => typeof v === "string" && v.trim() !== "");
      if (field.options && field.options.length) picked = picked.filter((v) => field.options!.includes(v));
      if (picked.length === 0) return null;
      if (field.single) return [picked[0]];
      return picked;
    }
    case "text":
    case "time":
    case "date":
      return typeof value === "string" ? value : String(value);
    default:
      return null;
  }
}

/** Read an answer from an entry, returning null for missing/invalid values. */
export function readAnswer(entry: Pick<DailyEntry, "answers"> | null | undefined, field: SurveyQuestion): AnswerValue {
  const raw = entry?.answers?.[field.k];
  return isValidAnswer(field, raw) ? (raw as AnswerValue) : coerceAnswer(field, raw);
}

/** Return a new answers map with the value written (or cleared with null).
    Never mutates; safe for editing past entries. */
export function writeAnswer(
  answers: Record<string, AnswerValue> | undefined,
  field: SurveyQuestion,
  value: unknown
): Record<string, AnswerValue> {
  const next = { ...(answers || {}) };
  const coerced = coerceAnswer(field, value);
  if (coerced === null) delete next[field.k];
  else next[field.k] = coerced;
  return next;
}
