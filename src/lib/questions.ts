/* Question hardening: validation for user-created questions and one shared
   visibility rule for every surface. App.tsx routes all custom questions
   through sanitizeCustomField() inside computeProfileTemplate(), so a
   malformed question (hand-edited backup, old schema, bad import) degrades
   safely instead of crashing Quick Log, charts, or exports. */

import type { FieldType, SurveyQuestion } from "../types/models";

export const FIELD_TYPES: FieldType[] = [
  "scale", "toggle", "chips", "number", "text", "time", "date", "photo",
];

const VISIBILITY_FLAGS = ["quick", "detailed", "dashboard", "chart", "exportable"] as const;
export type Surface = (typeof VISIBILITY_FLAGS)[number];

/** One rule for "does this question appear on this surface". Default true. */
export function isVisibleOn(field: Partial<SurveyQuestion> | null | undefined, surface: Surface): boolean {
  if (!field) return false;
  return field[surface] !== false;
}

/** Coerce unknown data into a safe SurveyQuestion, or null if unusable.
    Rules:
    - must be an object with a non-empty string key `k` and a label (label
      falls back to the key so old data still renders)
    - unknown/missing type falls back to "text" (never crashes an input renderer)
    - chips without usable options fall back to "text"
    - scale direction defaults to "sym"; numbers get finite step
    - photo questions keep only known metadata fields */
export function sanitizeCustomField(raw: unknown): SurveyQuestion | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const k = typeof r.k === "string" ? r.k.trim() : "";
  if (!k) return null;

  const label =
    typeof r.label === "string" && r.label.trim() ? r.label.trim() : k;
  let type: FieldType = FIELD_TYPES.includes(r.type as FieldType)
    ? (r.type as FieldType)
    : "text";

  const out: SurveyQuestion = {
    k,
    label,
    type,
    sec: typeof r.sec === "string" && r.sec.trim() ? r.sec : "Custom",
    custom: true,
  };

  // visibility flags: keep only explicit false (default is true everywhere)
  for (const flag of VISIBILITY_FLAGS) {
    if (r[flag] === false) (out as unknown as Record<string, unknown>)[flag] = false;
    if (flag === "quick" && typeof r.quick === "boolean") out.quick = r.quick;
  }

  if (type === "chips") {
    const options = Array.isArray(r.options)
      ? (r.options as unknown[]).filter((o): o is string => typeof o === "string" && o.trim() !== "")
      : [];
    if (options.length === 0) {
      out.type = "text"; // no options to choose from — degrade to a note
    } else {
      out.options = options;
      out.single = r.single === true;
    }
  }

  if (out.type === "scale") {
    out.dir = r.dir === "pos" || r.dir === "neutral" ? r.dir : "sym";
  }

  if (out.type === "number") {
    out.dir = "neutral";
    out.unit = typeof r.unit === "string" ? r.unit : undefined;
    out.step = typeof r.step === "number" && isFinite(r.step) && r.step > 0 ? r.step : 1;
  }

  if (out.type === "photo") {
    out.dir = "sym";
    out.category = typeof r.category === "string" && r.category ? r.category : "skin";
    out.bodyPart = typeof r.bodyPart === "string" ? r.bodyPart : "";
    out.side = typeof r.side === "string" ? r.side : "";
    out.angle = typeof r.angle === "string" ? r.angle : "";
    out.rated = r.rated !== false;
    out.scaleMax = typeof r.scaleMax === "number" && r.scaleMax >= 2 ? r.scaleMax : 10;
    out.autoRate = false; // AI auto-rate stays opt-in and is never restored implicitly
    out.requiredInSession = r.requiredInSession !== false;
    out.linkedTo = typeof r.linkedTo === "string" ? r.linkedTo : null;
  }

  return out;
}
