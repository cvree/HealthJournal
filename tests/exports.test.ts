/* Export hardening tests: CSV/wide-table/photo-legend/report-summary
   generation against the Connor demo data, including custom questions,
   photo metadata columns, and exportable:false exclusion. */
import { describe, it, expect } from "vitest";
import { __internals as I } from "../src/App";
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
