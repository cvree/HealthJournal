/* Contract tests: the TypeScript model, runtime validators, question
   sanitizer, and answer helpers — all exercised against live Connor demo
   data so types can't drift from runtime reality. */
import { describe, it, expect } from "vitest";
import { __internals as I } from "../src/App";
import type { AppDatabase, DailyEntry, ReportCard, TrackingSetup } from "../src/types/models";
import { validateDatabase, validateReportModel, causalLanguageAudit } from "../src/lib/validate";
import { sanitizeCustomField, isVisibleOn } from "../src/lib/questions";
import { coerceAnswer, isValidAnswer, readAnswer, writeAnswer } from "../src/lib/answers";

const sample = (): AppDatabase => I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });

describe("type contract vs live data", () => {
  it("Connor demo database satisfies the AppDatabase validator", () => {
    const db = sample();
    const res = validateDatabase(db);
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
    // compile-time: these assignments only build if shapes agree
    const profile: TrackingSetup = db.profile;
    const entry: DailyEntry = db.entries[0];
    expect(profile.name).toBeTruthy();
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("buildReport output passes the report model validator and language audit", () => {
    const db = sample();
    const range = I.pickReportRange(db.entries, "week");
    const cards: ReportCard[] = I.buildReport(db, range);
    const res = validateReportModel(cards);
    expect(res.errors).toEqual([]);
    expect(causalLanguageAudit(cards)).toEqual([]);
  });

  it("validator rejects structurally broken databases", () => {
    expect(validateDatabase(null).ok).toBe(false);
    expect(validateDatabase({ profile: "nope", entries: [] }).ok).toBe(false);
    expect(validateDatabase({ profile: { name: "x" }, entries: "nope" }).ok).toBe(false);
    expect(validateDatabase({ profile: { name: "x" }, entries: [{ date: "junk" }] }).ok).toBe(false);
  });
});

describe("custom question sanitizer", () => {
  it("passes well-formed questions through", () => {
    const q = sanitizeCustomField({ k: "c_water", label: "Water intake", type: "scale", dir: "pos" });
    expect(q).toMatchObject({ k: "c_water", label: "Water intake", type: "scale", dir: "pos", custom: true });
  });
  it("degrades unknown types and optionless chips to text instead of crashing", () => {
    expect(sanitizeCustomField({ k: "c_x", label: "X", type: "hologram" })!.type).toBe("text");
    expect(sanitizeCustomField({ k: "c_y", label: "Y", type: "chips", options: [] })!.type).toBe("text");
    expect(sanitizeCustomField({ k: "c_z", label: "Z", type: "chips", options: ["A", 3, "", "B"] })!.options).toEqual(["A", "B"]);
  });
  it("drops unusable questions and never invents keys", () => {
    expect(sanitizeCustomField(null)).toBeNull();
    expect(sanitizeCustomField("string")).toBeNull();
    expect(sanitizeCustomField({ label: "no key" })).toBeNull();
    expect(sanitizeCustomField({ k: "   " })).toBeNull();
  });
  it("a malformed custom question in the profile degrades in the merged template", () => {
    const db = sample();
    db.profile.customQuestions = [
      ...(db.profile.customQuestions || []),
      { k: "c_bad", label: "Bad", type: "wat" } as any,
      { broken: true } as any,
    ];
    const tpl = I.getProfileTemplate({ ...db.profile });
    const bad = tpl.fields.find((f: any) => f.k === "c_bad");
    expect(bad.type).toBe("text"); // degraded, still usable
    expect(tpl.fields.some((f: any) => f.broken)).toBe(false); // dropped
  });
});

describe("surface visibility", () => {
  it("disabled questions are absent from every surface via the template", () => {
    const db = sample();
    const key = I.getProfileTemplate(db.profile).fields[0].k;
    const profile = { ...db.profile, disabledFields: [...(db.profile.disabledFields || []), key] };
    const tpl = I.getProfileTemplate(profile);
    expect(tpl.fields.some((f: any) => f.k === key)).toBe(false); // one source of truth
    expect(tpl.chartMetrics.includes(key)).toBe(false);
    expect(tpl.dashboardMetrics.includes(key)).toBe(false);
    const table = I.wideTable(profile, db.entries);
    expect(table.header.includes(key)).toBe(false); // exports too
  });
  it("visibility flags default to true and honor explicit false", () => {
    expect(isVisibleOn({ k: "a", label: "a", type: "scale" }, "chart")).toBe(true);
    expect(isVisibleOn({ k: "a", label: "a", type: "scale", chart: false }, "chart")).toBe(false);
    expect(isVisibleOn(null, "quick")).toBe(false);
  });
});

describe("answer helpers", () => {
  const scale: import("../src/types/models").SurveyQuestion = { k: "s", label: "s", type: "scale" };
  const chips: import("../src/types/models").SurveyQuestion = { k: "c", label: "c", type: "chips", options: ["A", "B"], single: false };

  it("validates and coerces per type", () => {
    expect(isValidAnswer(scale, 7)).toBe(true);
    expect(isValidAnswer(scale, "7")).toBe(false);
    expect(coerceAnswer(scale, "7")).toBe(7);
    expect(coerceAnswer(scale, 99)).toBe(10); // clamped
    expect(coerceAnswer(scale, "junk")).toBeNull();
    expect(coerceAnswer(chips, "A")).toEqual(["A"]);
    expect(coerceAnswer(chips, ["A", "Z"])).toEqual(["A"]); // unknown option filtered
    expect(coerceAnswer(chips, ["Z"])).toBeNull();
    expect(coerceAnswer({ type: "toggle" }, "true")).toBe(true);
  });

  it("readAnswer survives missing and legacy-shaped entries", () => {
    expect(readAnswer(null, scale)).toBeNull();
    expect(readAnswer({ answers: {} }, scale)).toBeNull();
    expect(readAnswer({ answers: { s: "5" } }, scale)).toBe(5);
  });

  it("writeAnswer is immutable and clears invalid values", () => {
    const a1 = writeAnswer(undefined, scale, 6);
    expect(a1).toEqual({ s: 6 });
    const a2 = writeAnswer(a1, scale, "junk");
    expect(a2).toEqual({});
    expect(a1).toEqual({ s: 6 }); // original untouched — safe past-entry editing
  });
});

describe("migration safety", () => {
  it("bumps schemaVersion and preserves entries for a legacy v1-shaped db", () => {
    const db = sample();
    const legacy = JSON.parse(JSON.stringify(db));
    delete legacy.schemaVersion;
    delete legacy.reports;
    const migrated = I.migrateDb(legacy);
    expect(migrated.schemaVersion).toBe(I.SCHEMA_VERSION);
    expect(migrated.entries.length).toBe(db.entries.length);
    expect(Array.isArray(migrated.reports)).toBe(true);
  });
});
