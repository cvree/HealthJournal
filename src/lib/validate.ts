/* Runtime validation: the bridge between the TypeScript contract in
   types/models.ts and untrusted data (local storage, restored backups).
   Used by the corrupted-data recovery flow in App.tsx and by the tests,
   which run every validator against live Connor demo data so the types
   can never drift from reality. */

import type { AppDatabase, ReportCard } from "../types/models";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** Structural check for a parsed database object. Non-destructive: reports
    problems, never mutates. `ok` means safe to hand to migrateDb(). */
export function validateDatabase(data: unknown): ValidationResult {
  const errors: string[] = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, errors: ["Root is not an object."] };
  }
  const d = data as Partial<AppDatabase> & Record<string, unknown>;

  if (!d.profile || typeof d.profile !== "object") errors.push("Missing tracking setup (profile).");
  else {
    const p = d.profile as unknown as Record<string, unknown>;
    if (typeof p.name !== "string") errors.push("Setup name is not a string.");
    if (p.customQuestions !== undefined && !Array.isArray(p.customQuestions))
      errors.push("customQuestions is not an array.");
    if (p.disabledFields !== undefined && !Array.isArray(p.disabledFields))
      errors.push("disabledFields is not an array.");
  }

  if (!Array.isArray(d.entries)) errors.push("Entries is not an array.");
  else {
    d.entries.forEach((e: unknown, i: number) => {
      if (!e || typeof e !== "object") { errors.push(`Entry ${i} is not an object.`); return; }
      const en = e as Record<string, unknown>;
      if (typeof en.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(en.date))
        errors.push(`Entry ${i} has an invalid date.`);
      if (en.answers !== undefined && (typeof en.answers !== "object" || en.answers === null || Array.isArray(en.answers)))
        errors.push(`Entry ${i} answers is not an object.`);
    });
  }

  if (d.reports !== undefined && !Array.isArray(d.reports)) errors.push("Reports is not an array.");

  /* Episodes carry dates that drive every duration in Insights, so a malformed
     one is worth naming rather than silently dropping — `sanitizeEpisodes`
     will still drop it, but the recovery screen gets to say what was wrong. */
  if (d.episodes !== undefined) {
    if (!Array.isArray(d.episodes)) errors.push("Episodes is not an array.");
    else {
      d.episodes.forEach((e: unknown, i: number) => {
        if (!e || typeof e !== "object") { errors.push(`Episode ${i} is not an object.`); return; }
        const ep = e as Record<string, unknown>;
        if (typeof ep.start !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ep.start))
          errors.push(`Episode ${i} has an invalid start date.`);
        if (ep.end != null && (typeof ep.end !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ep.end)))
          errors.push(`Episode ${i} has an invalid end date.`);
        if (typeof ep.metric !== "string" || !ep.metric)
          errors.push(`Episode ${i} has no metric.`);
      });
    }
  }

  /* The 1.21 collections. Each is only checked for *shape* here — the
     per-row repair lives in each module's own sanitizer, and this exists so
     the recovery screen can say "your lab results are not an array" instead of
     handing somebody a journal that quietly lost them. */
  for (const key of ["sun", "labs", "experiments", "context",
    "rituals", "ritualRuns", "ritualReviews"] as const) {
    if (d[key] !== undefined && !Array.isArray(d[key])) {
      errors.push(`${key} is not an array.`);
    }
  }
  if (Array.isArray(d.labs)) {
    (d.labs as unknown[]).forEach((r: unknown, i: number) => {
      if (!r || typeof r !== "object") { errors.push(`Lab result ${i} is not an object.`); return; }
      const lab = r as Record<string, unknown>;
      if (typeof lab.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(lab.date))
        errors.push(`Lab result ${i} has an invalid date.`);
      if (typeof lab.value !== "number" || !Number.isFinite(lab.value))
        errors.push(`Lab result ${i} has no numeric value.`);
    });
  }

  return { ok: errors.length === 0, errors };
}

const CARD_TYPES = new Set([
  "header", "empty", "streak", "bestWorst", "averages", "mostImproved",
  "mostCommon", "trends", "routines", "notes", "patterns", "photoCompare",
]);

export function isReportCard(card: unknown): card is ReportCard {
  return !!card && typeof card === "object" && !Array.isArray(card) &&
    typeof (card as Record<string, unknown>).type === "string" &&
    CARD_TYPES.has((card as Record<string, unknown>).type as string);
}

/** Validate a buildReport() output (or a saved snapshot model). */
export function validateReportModel(cards: unknown): ValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(cards)) return { ok: false, errors: ["Report model is not an array."] };
  cards.forEach((c, i) => {
    if (!isReportCard(c)) errors.push(`Card ${i} has an unknown shape or type.`);
  });
  if (cards.length && (cards[0] as ReportCard).type !== "header")
    errors.push("First card is not the header.");
  return { ok: errors.length === 0, errors };
}

/** Audit serializable content for causal/medical language. Returns offending
    matches (empty array = clean). Used in tests over report output. */
export function causalLanguageAudit(content: unknown): string[] {
  const text = JSON.stringify(content).toLowerCase();
  const banned = ["caused by", "causes your", "cures", "diagnos", "you should take", "treatment success"];
  return banned.filter((b) => text.includes(b));
}
