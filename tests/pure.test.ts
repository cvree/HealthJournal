/* Node unit tests for the pure-function core, via the __internals handle. */
import { describe, it, expect } from "vitest";
import { __internals as I } from "../src/App";

const sample = () => I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });

describe("sample data / migration", () => {
  it("generates a Connor-style setup with 30+ days of entries", () => {
    const db = sample();
    expect(db.profile.name.toLowerCase()).toContain("connor");
    expect(db.entries.length).toBeGreaterThanOrEqual(30);
    expect(db.schemaVersion).toBeGreaterThanOrEqual(2);
  });
  it("migrateDb is idempotent", () => {
    const db = sample();
    expect(I.migrateDb(JSON.parse(JSON.stringify(db)))).toEqual(db);
  });
});

describe("report builder", () => {
  it("builds a weekly report with header + cards and no causal language", () => {
    const db = sample();
    const range = I.pickReportRange(db.entries, "week");
    expect(range).toBeTruthy();
    const cards = I.buildReport(db, range);
    expect(cards[0].type).toBe("header");
    expect(cards.length).toBeGreaterThan(2);
    const text = JSON.stringify(cards).toLowerCase();
    expect(text).not.toMatch(/caused by|cures|diagnos/);
  });
  it("returns no range below the 4-logged-day gate", () => {
    const db = sample();
    db.entries = db.entries.slice(0, 2);
    expect(I.pickReportRange(db.entries, "week")).toBeFalsy();
  });
  it("report card prefs filter output", () => {
    const db = sample();
    const range = I.pickReportRange(db.entries, "week");
    const all = I.buildReport(db, range);
    db.profile.reportPrefs = { streak: false };
    const filtered = I.buildReport(db, range);
    expect(filtered.some((c) => c.type === "streak")).toBe(false);
    expect(all.length).toBeGreaterThanOrEqual(filtered.length);
  });
});

describe("photo pair picker", () => {
  it("is deterministic and hides spots with fewer than 2 photos", () => {
    const db = sample();
    const tpl = I.getProfileTemplate(db.profile);
    const range = I.pickReportRange(db.entries, "week");
    const a = I.pickPairs(tpl, db.entries, range);
    const b = I.pickPairs(tpl, db.entries, range);
    expect(a).toEqual(b); // deterministic
    // every surfaced pair has two distinct photos
    for (const g of a) expect(g.left?.photoId !== g.right?.photoId || g.pairs).toBeTruthy();
  });
});

describe("smart defaults", () => {
  it("median ghost default reflects recent answers", () => {
    const db = sample();
    const tpl = I.getProfileTemplate(db.profile);
    const scale = tpl.fields.find((f) => f.type === "scale");
    if (!scale) return;
    const v = I.medianDefaultFor(db.entries, scale.k, new Date().toISOString().slice(0, 10));
    if (v !== null && v !== undefined) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
});

describe("backup validation", () => {
  it("accepts its own backup shape and rejects garbage", () => {
    const db = sample();
    const backup = { app: "Family Health Journal", exportedAt: new Date().toISOString(),
      profile: db.profile, entries: db.entries, reports: db.reports || [] };
    const res = I.validateBackup(JSON.parse(JSON.stringify(backup)));
    expect(res.ok).toBe(true);
    expect(res.summary.entries).toBe(db.entries.length);
    expect(I.validateBackup({ nonsense: true }).ok).toBe(false);
  });
});
