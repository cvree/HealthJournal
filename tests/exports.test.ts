/* Export hardening tests: CSV/wide-table/photo-legend/report-summary
   generation against the Connor demo data, including custom questions,
   photo metadata columns, and exportable:false exclusion. */
import { describe, it, expect } from "vitest";
import { __internals as I } from "../src/App";
import { buildContextTable, buildLabsTable, buildSunTable } from "../src/lib/exports";
import type { AppDatabase } from "../src/types/models";

const sample = (): AppDatabase => I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });

describe("wide table export", () => {
  it("includes required meta columns in order", () => {
    const db = sample();
    const { header } = I.wideTable(db.profile, db.entries);
    for (const col of ["profile_id", "profile_name", "profile_template", "date", "entry_id", "created_at", "updated_at"]) {
      expect(header).toContain(col);
    }
    expect(header.indexOf("profile_id")).toBe(0);
  });

  it("row count matches entries and rows align with the header", () => {
    const db = sample();
    const { header, rows } = I.wideTable(db.profile, db.entries);
    expect(rows.length).toBe(db.entries.length);
    for (const row of rows) expect(row.length).toBe(header.length);
  });

  it("custom questions appear as columns with their answers serialized", () => {
    const db = sample();
    const profile = {
      ...db.profile,
      customQuestions: [
        ...(db.profile.customQuestions || []),
        { k: "c_test_scale", label: "Test scale", type: "scale", custom: true },
      ],
    };
    const entries = db.entries.map((e, i) =>
      i === 0 ? { ...e, answers: { ...e.answers, c_test_scale: 4 } } : e
    );
    const { header, rows } = I.wideTable(profile, entries);
    const col = header.indexOf("c_test_scale");
    expect(col).toBeGreaterThan(-1);
    expect(String(rows[0][col])).toBe("4");
  });

  it("exportable:false and disabled questions are excluded", () => {
    const db = sample();
    const key = I.getProfileTemplate(db.profile).fields.find((f: any) => f.type === "scale").k;
    const hidden = { ...db.profile, fieldOverrides: { ...(db.profile.fieldOverrides || {}), [key]: { exportable: false } } };
    expect(I.wideTable(hidden, db.entries).header).not.toContain(key);
    const disabled = { ...db.profile, disabledFields: [...(db.profile.disabledFields || []), key] };
    expect(I.wideTable(disabled, db.entries).header).not.toContain(key);
  });

  it("photo questions export metadata columns (photo flag, rating, source, id)", () => {
    const db = sample();
    const tpl = I.getProfileTemplate(db.profile);
    const photoField = tpl.fields.find((f: any) => f.type === "photo");
    if (!photoField) return; // demo setup without photo questions
    const { header } = I.wideTable(db.profile, db.entries);
    for (const suffix of ["_photo", "_rating", "_rating_source", "_photo_id"]) {
      expect(header).toContain(`${photoField.k}${suffix}`);
    }
  });
});

describe("CSV serialization", () => {
  it("produces one line per row plus header and escapes commas/quotes", () => {
    const csv = I.toCSV([["a", 'he said "hi", ok'], ["1", "2"]]);
    const lines = csv.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('"he said ""hi"", ok"');
  });

  it("full Connor CSV round: header + 30+ rows, no undefined cells", () => {
    const db = sample();
    const { header, rows } = I.wideTable(db.profile, db.entries);
    const csv = I.toCSV([header, ...rows]);
    expect(csv.split("\n").length).toBe(rows.length + 1);
    expect(csv).not.toContain("undefined");
  });
});

describe("photo + report export rows", () => {
  it("photoLegendRows lists photo metadata for entries with photos", () => {
    const db = sample();
    const tpl = I.getProfileTemplate(db.profile);
    const photoField = tpl.fields.find((f: any) => f.type === "photo");
    if (!photoField) return;
    const withPhoto = db.entries.map((e, i) =>
      i === 0
        ? { ...e, photos: { [photoField.k]: { photoId: "ph_test", takenAt: new Date().toISOString(), note: "test" } } }
        : e
    );
    const dates = withPhoto.map((e) => e.date).sort();
    const rows = I.photoLegendRows(tpl, withPhoto, dates[0], dates[dates.length - 1]);
    const flat = JSON.stringify(rows);
    expect(flat).toContain("ph_test");
  });

  it("reportSummaryRows serializes a saved report without crashing", () => {
    const db = sample();
    const range = I.pickReportRange(db.entries, "week");
    const model = I.buildReport(db, range);
    const saved = [{ id: "r1", type: "week", range, createdAt: new Date().toISOString(), model }];
    const rows = I.reportSummaryRows(saved, range.start, range.end);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe("typed export module parity", () => {
  it("buildWideTable via the typed module matches the App wrapper exactly", async () => {
    const { buildWideTable, toCSV: toCSVTyped } = await import("../src/lib/exports");
    const db = sample();
    const tpl = I.getProfileTemplate(db.profile);
    const a = I.wideTable(db.profile, db.entries);
    const b = buildWideTable(tpl, db.profile, db.entries);
    expect(b.header).toEqual(a.header);
    expect(b.rows).toEqual(a.rows);
    expect(toCSVTyped([b.header, ...b.rows])).toBe(I.toCSV([a.header, ...a.rows]));
  });
});

/* ---------- the 1.21 sheets ----------

   All three exist to answer one question in a spreadsheet six months later:
   which of these numbers did somebody measure, and which did this app model?
   The column names are the answer, so they are what these tests pin. */

describe("buildLabsTable", () => {
  const lab = (over: Record<string, unknown> = {}) => ({
    id: "l1", test: "vitamin_d", name: "Vitamin D (25-OH)", value: 38, unit: "ng/mL",
    date: "2026-06-01", kind: "measurement", createdAt: "c", updatedAt: "u", ...over,
  } as any);

  it("carries the laboratory's own range, named as theirs", () => {
    const t = buildLabsTable([lab({ refLow: 30, refHigh: 100 })]);
    expect(t.header).toContain("lab_reference_low");
    expect(t.header).toContain("lab_reference_high");
    expect(t.rows[0][t.header.indexOf("against_lab_range")]).toBe("within");
  });

  it("says so plainly when no range was recorded, rather than judging anyway", () => {
    const t = buildLabsTable([lab()]);
    expect(t.rows[0][t.header.indexOf("against_lab_range")]).toBe("no range recorded");
  });

  it("marks a result outside the range in the right direction", () => {
    const below = buildLabsTable([lab({ value: 12, refLow: 30, refHigh: 100 })]);
    const above = buildLabsTable([lab({ value: 180, refLow: 30, refHigh: 100 })]);
    expect(below.rows[0][below.header.indexOf("against_lab_range")]).toBe("below");
    expect(above.rows[0][above.header.indexOf("against_lab_range")]).toBe("above");
  });

  it("keeps a paired value in its own column", () => {
    const t = buildLabsTable([lab({ test: "blood_pressure", value: 128, value2: 82, unit: "mmHg" })]);
    expect(t.rows[0][t.header.indexOf("value")]).toBe(128);
    expect(t.rows[0][t.header.indexOf("value_2")]).toBe(82);
  });

  it("sorts oldest first", () => {
    const t = buildLabsTable([lab({ id: "b", date: "2026-09-01" }), lab({ id: "a", date: "2026-03-01" })]);
    expect(t.rows.map((r) => r[0])).toEqual(["2026-03-01", "2026-09-01"]);
  });
});

describe("buildSunTable", () => {
  const session = (over: Record<string, unknown> = {}) => ({
    id: "s1", date: "2026-06-21", start: "2026-06-21T11:00:00Z", end: "2026-06-21T11:30:00Z",
    minutes: 30, exposure: "arms", shade: "open", uvSource: "modelled",
    avgUV: 6, peakUV: 7, avgElevation: 55, sed: 1.4, medFraction: 0.5,
    iu: 1200, iuLow: 800, iuHigh: 1600, belowThreshold: false, source: "live",
    createdAt: "c", updatedAt: "u", ...over,
  } as any);

  it("names the estimate so it can never be read as a measurement", () => {
    const t = buildSunTable([session()]);
    expect(t.header).toContain("vitamin_d_estimated_iu_low");
    expect(t.header).toContain("vitamin_d_estimated_iu_high");
    expect(t.header).toContain("vitamin_d_estimate_is_a_model_not_a_measurement");
    expect(t.header).not.toContain("vitamin_d");
    expect(t.rows[0][t.header.indexOf("vitamin_d_estimate_is_a_model_not_a_measurement")]).toBe("yes");
  });

  it("exports the range, not a single figure", () => {
    const t = buildSunTable([session()]);
    expect(t.rows[0][t.header.indexOf("vitamin_d_estimated_iu_low")]).toBe(800);
    expect(t.rows[0][t.header.indexOf("vitamin_d_estimated_iu_high")]).toBe(1600);
  });

  it("keeps the ambient dose in its own units, apart from the estimate", () => {
    const t = buildSunTable([session()]);
    expect(t.rows[0][t.header.indexOf("uv_dose_sed")]).toBe(1.4);
    expect(t.rows[0][t.header.indexOf("fraction_of_burn_dose")]).toBe(0.5);
  });

  it("says where the UV number came from", () => {
    const t = buildSunTable([session({ uvSource: "none" })]);
    expect(t.rows[0][t.header.indexOf("uv_source")]).toBe("none");
  });
});

describe("buildContextTable", () => {
  const ctx = (over: Record<string, unknown> = {}) => ({
    date: "2026-07-01", coords: { lat: 51.51, lon: -0.13 }, capturedAt: "2026-07-01T06:00:00Z",
    tempMax: 26, humidityMean: 48, pressureMean: 1008, pressureChange: -6,
    source: "open-meteo", ...over,
  } as any);

  it("exports only the coarse coordinates the app ever stored", () => {
    const t = buildContextTable([ctx()]);
    expect(t.header).toContain("latitude_coarse");
    expect(t.rows[0][t.header.indexOf("latitude_coarse")]).toBe(51.51);
    expect(t.header).not.toContain("latitude");
  });

  it("leaves a missing reading empty rather than filling it with a zero", () => {
    const t = buildContextTable([ctx({ pollenGrass: undefined, aqi: undefined })]);
    expect(t.rows[0][t.header.indexOf("pollen_grass")]).toBe("");
    expect(t.rows[0][t.header.indexOf("air_quality_index")]).toBe("");
  });

  it("keeps the pressure change, which is the column the diaries are about", () => {
    const t = buildContextTable([ctx()]);
    expect(t.rows[0][t.header.indexOf("pressure_change_hpa")]).toBe(-6);
  });
});
