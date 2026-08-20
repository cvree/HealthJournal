/* Labs: the one collection somebody else measured, and the line the app must
   never cross between a measurement and an estimate. */
import { describe, it, expect } from "vitest";
import { causalLanguageAudit } from "../src/lib/validate";
import {
  changesBetween, CHANGE_COPY, convertValue, daysBetween, labSeries,
  labSummaryLine, labTest, labValueLabel, LAB_TESTS, labMetricsFor, newLabResult,
  RANGE_COPY, rangeStatus, sanitizeLabResults, searchTests, seriesLabel,
  testsHeld, vitaminDBesideSun, VITAMIN_D_PAIRING_NOTE,
} from "../src/lib/labs";

const vd = (date: string, value: number, extra: any = {}) =>
  newLabResult({ test: "vitamin_d", value, date, unit: "ng/mL", ...extra });

describe("the catalog", () => {
  it("gives every test a default unit and a decimals rule", () => {
    for (const t of LAB_TESTS) {
      expect(t.units.length).toBeGreaterThan(0);
      expect(t.units[0].toBase).toBe(1);
      expect(Number.isInteger(t.decimals)).toBe(true);
    }
  });

  it("has unique keys", () => {
    expect(new Set(LAB_TESTS.map((t) => t.key)).size).toBe(LAB_TESTS.length);
  });

  it("finds tests the way people type them", () => {
    expect(searchTests("vit d").map((t) => t.key)).toContain("vitamin_d");
    expect(searchTests("a1c").map((t) => t.key)).toContain("hba1c");
    expect(searchTests("bp").map((t) => t.key)).toContain("blood_pressure");
    expect(searchTests("").length).toBe(LAB_TESTS.length);
  });

  it("never states a range as this person's own", () => {
    for (const t of LAB_TESTS) {
      if (t.hint) expect(t.hint.toLowerCase()).toMatch(/vary|lab|report|number/);
    }
    expect(causalLanguageAudit(LAB_TESTS)).toEqual([]);
  });
});

describe("convertValue", () => {
  it("converts vitamin D between the two units labs report it in", () => {
    expect(convertValue("vitamin_d", 75, "nmol/L", "ng/mL")).toBeCloseTo(30.045, 2);
    expect(convertValue("vitamin_d", 30, "ng/mL", "nmol/L")).toBeCloseTo(74.888, 2);
  });

  it("converts cholesterol and glucose the way the reference tables do", () => {
    expect(convertValue("ldl", 3, "mmol/L", "mg/dL")).toBeCloseTo(116.01, 1);
    expect(convertValue("glucose", 5.5, "mmol/L", "mg/dL")).toBeCloseTo(99.09, 1);
  });

  it("returns nothing rather than a wrong number for units it doesn't know", () => {
    expect(convertValue("vitamin_d", 30, "ng/mL", "furlongs")).toBeNull();
    expect(convertValue("made_up", 30, "a", "b")).toBeNull();
    expect(convertValue("vitamin_d", 30, "ng/mL", "ng/mL")).toBe(30);
  });
});

describe("rangeStatus", () => {
  it("only ever judges against a range that was actually recorded", () => {
    expect(rangeStatus({ value: 20 })).toBe("unknown");
    expect(rangeStatus({ value: 20, refLow: 30, refHigh: 100 })).toBe("below");
    expect(rangeStatus({ value: 50, refLow: 30, refHigh: 100 })).toBe("in");
    expect(rangeStatus({ value: 150, refLow: 30, refHigh: 100 })).toBe("above");
  });

  it("handles a one-sided range", () => {
    expect(rangeStatus({ value: 250, refHigh: 200 })).toBe("above");
    expect(rangeStatus({ value: 150, refHigh: 200 })).toBe("in");
  });

  it("says whose range it is, every time", () => {
    for (const copy of Object.values(RANGE_COPY)) {
      expect(copy === RANGE_COPY.unknown || copy.includes("your lab")).toBe(true);
    }
  });
});

describe("labSeries", () => {
  it("orders oldest first and carries each change from the one before it", () => {
    const s = labSeries([vd("2026-03-01", 24), vd("2026-06-01", 31), vd("2026-09-01", 38)], "vitamin_d");
    expect(s.map((p) => p.value)).toEqual([24, 31, 38]);
    expect(s[0].delta).toBeUndefined();
    expect(s[1].delta).toBe(7);
    expect(s[2].gapDays).toBe(92);
  });

  it("puts a mixed-unit history onto the most recent unit, not the catalog's", () => {
    const s = labSeries(
      [vd("2026-03-01", 60, { unit: "nmol/L" }), vd("2026-06-01", 31)],
      "vitamin_d"
    );
    expect(s[0].unit).toBe("ng/mL");
    expect(s[0].value).toBeCloseTo(24.04, 1);
    expect(s[1].value).toBe(31);
  });

  it("converts the lab's own range along with the value", () => {
    const s = labSeries(
      [vd("2026-03-01", 60, { unit: "nmol/L", refLow: 75, refHigh: 250 }), vd("2026-06-01", 31)],
      "vitamin_d"
    );
    expect(s[0].refLow).toBeCloseTo(30.045, 1);
    expect(s[0].status).toBe("below");
  });

  it("drops a point it cannot convert rather than plotting it at the wrong height", () => {
    const odd = { ...vd("2026-03-01", 60), unit: "??" };
    const s = labSeries([odd, vd("2026-06-01", 31)], "vitamin_d");
    expect(s.length).toBe(1);
  });

  it("is empty for a test with no results", () => {
    expect(labSeries([], "ferritin")).toEqual([]);
  });

  it("writes the whole story in one line", () => {
    const s = labSeries([vd("2026-03-01", 24), vd("2026-06-01", 31), vd("2026-09-01", 38)], "vitamin_d");
    expect(seriesLabel(s)).toBe("24 → 31 → 38 ng/mL");
  });
});

describe("testsHeld", () => {
  it("lists what the journal holds, most recently measured first", () => {
    const held = testsHeld([
      vd("2026-03-01", 24),
      newLabResult({ test: "ferritin", value: 40, date: "2026-08-01" }),
    ]);
    expect(held.map((t) => t.key)).toEqual(["ferritin", "vitamin_d"]);
    expect(held[1].count).toBe(1);
  });
});

describe("labValueLabel", () => {
  it("prints a paired value as two numbers", () => {
    expect(labValueLabel({ value: 128, value2: 82, unit: "mmHg" })).toBe("128/82 mmHg");
    expect(labValueLabel({ value: 38, unit: "ng/mL" })).toBe("38 ng/mL");
  });
});

describe("sanitizeLabResults", () => {
  it("drops rows without a date or a number", () => {
    expect(sanitizeLabResults([{ test: "vitamin_d", value: 30, date: "soon" }])).toEqual([]);
    expect(sanitizeLabResults([{ test: "vitamin_d", value: "lots", date: "2026-03-01" }])).toEqual([]);
    expect(sanitizeLabResults(null)).toEqual([]);
  });

  it("keeps a result whose test is not in the catalog — custom measurements are the point", () => {
    const rows = sanitizeLabResults([
      { test: "custom:oxalate", name: "Urine oxalate", value: 41, unit: "mg/24h", date: "2026-03-01" },
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Urine oxalate");
  });

  it("never promotes an estimate to a measurement", () => {
    const [row] = sanitizeLabResults([{ ...vd("2026-03-01", 30), kind: "estimate" }]);
    expect(row.kind).toBe("estimate");
    const [row2] = sanitizeLabResults([{ ...vd("2026-03-01", 30), kind: "totally_measured" }]);
    expect(row2.kind).toBe("measurement");
  });

  it("de-duplicates ids and sorts by date", () => {
    const a = vd("2026-06-01", 31);
    expect(sanitizeLabResults([a, a]).length).toBe(1);
    expect(sanitizeLabResults([vd("2026-09-01", 38), vd("2026-03-01", 24)]).map((r) => r.date)).toEqual([
      "2026-03-01", "2026-09-01",
    ]);
  });
});

describe("changesBetween", () => {
  const sunDays = (from: number, to: number, minutes: number) =>
    Array.from({ length: to - from }, (_, i) => ({
      id: `s${from + i}`,
      date: `2026-0${Math.floor((from + i) / 28) + 4}-${String(((from + i) % 28) + 1).padStart(2, "0")}`,
      start: "2026-05-01T10:00:00Z",
      minutes,
      exposure: "arms" as const,
      shade: "open" as const,
      samples: [],
      uvSource: "modelled" as const,
      avgUV: 5, peakUV: 6, avgElevation: 40, sed: 1, medFraction: 0.3,
      iu: 800, iuLow: 500, iuHigh: 1100, belowThreshold: false,
      source: "live" as const, createdAt: "", updatedAt: "",
    }));

  it("notes more time outside only when there really was more than before", () => {
    const events = changesBetween("2026-04-01", "2026-06-01", { sun: sunDays(0, 40, 60) });
    expect(events.some((e) => e.kind === "sun" && e.label.includes("increased"))).toBe(true);
  });

  it("notes a supplement that started inside the window, not one that predates it", () => {
    const items = [
      { id: "a", name: "Vitamin D3", kind: "supplement" as const, dose: "2000 IU", times: [], daily: true, useCount: 1, createdAt: "2026-05-02T09:00:00Z", updatedAt: "" },
      { id: "b", name: "Old thing", kind: "supplement" as const, times: [], daily: true, useCount: 1, createdAt: "2024-01-01T09:00:00Z", updatedAt: "" },
    ];
    const events = changesBetween("2026-04-01", "2026-06-01", { routineItems: items });
    const names = events.map((e) => e.label);
    expect(names).toContain("Vitamin D3 started");
    expect(names).not.toContain("Old thing started");
  });

  it("notes a season turning, in the right hemisphere", () => {
    const north = changesBetween("2026-02-01", "2026-05-01", {
      context: [{ date: "2026-03-01", coords: { lat: 51, lon: 0 }, capturedAt: "", source: "t" }],
    });
    expect(north.find((e) => e.kind === "season")?.label).toContain("winter to spring");
    const south = changesBetween("2026-02-01", "2026-05-01", {
      context: [{ date: "2026-03-01", coords: { lat: -34, lon: 151 }, capturedAt: "", source: "t" }],
    });
    expect(south.find((e) => e.kind === "season")?.label).toContain("summer to autumn");
  });

  it("notes a real move and ignores a walk down the road", () => {
    const near = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-05-0${i + 1}`, coords: { lat: 51.5 + i * 0.01, lon: -0.13 }, capturedAt: "", source: "t",
    }));
    const far = near.map((c, i) => (i > 2 ? { ...c, coords: { lat: 41.9, lon: 12.5 } } : c));
    expect(changesBetween("2026-04-01", "2026-06-01", { context: near }).some((e) => e.kind === "travel")).toBe(false);
    expect(changesBetween("2026-04-01", "2026-06-01", { context: far }).some((e) => e.kind === "travel")).toBe(true);
  });

  it("caps how many marks a long gap can produce", () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      id: `r${i}`, name: `Thing ${i}`, kind: "supplement" as const, times: [], daily: true,
      useCount: 1, createdAt: `2026-05-${String((i % 28) + 1).padStart(2, "0")}T09:00:00Z`, updatedAt: "",
    }));
    expect(changesBetween("2026-04-01", "2026-06-01", { routineItems: items }).length).toBeLessThanOrEqual(8);
  });

  it("says out loud that this is a memory aid, not an explanation", () => {
    expect(CHANGE_COPY.caveat.toLowerCase()).toContain("not an explanation");
    expect(causalLanguageAudit(CHANGE_COPY)).toEqual([]);
  });
});

describe("vitaminDBesideSun", () => {
  const sun = Array.from({ length: 20 }, (_, i) => ({
    id: `s${i}`,
    date: `2026-05-${String(i + 1).padStart(2, "0")}`,
    start: "2026-05-01T10:00:00Z",
    minutes: 30,
    exposure: "arms" as const, shade: "open" as const, samples: [],
    uvSource: "modelled" as const, avgUV: 6, peakUV: 7, avgElevation: 50,
    sed: 1.2, medFraction: 0.4, iu: 1000, iuLow: 650, iuHigh: 1350,
    belowThreshold: false, source: "live" as const, createdAt: "", updatedAt: "",
  }));

  it("sums only the sunlight in the window before each draw", () => {
    const pairs = vitaminDBesideSun([vd("2026-06-01", 38)], sun, 56);
    expect(pairs[0].daysOutside).toBe(20);
    expect(pairs[0].estimatedIU).toBe(20000);
    const narrow = vitaminDBesideSun([vd("2026-06-01", 38)], sun, 7);
    expect(narrow[0].daysOutside).toBeLessThan(20);
  });

  it("carries a note that keeps the two kinds of number apart", () => {
    expect(VITAMIN_D_PAIRING_NOTE).toContain("measurement");
    expect(VITAMIN_D_PAIRING_NOTE).toContain("estimate");
    expect(VITAMIN_D_PAIRING_NOTE).toContain("never drawn on one axis");
    expect(causalLanguageAudit(VITAMIN_D_PAIRING_NOTE)).toEqual([]);
  });
});

describe("labMetricsFor", () => {
  const labs = [vd("2026-03-01", 24), vd("2026-06-01", 31)];

  it("only offers tests with more than one result", () => {
    expect(labMetricsFor([vd("2026-03-01", 24)])).toEqual([]);
    expect(labMetricsFor(labs).map((m) => m.k)).toEqual(["lab_vitamin_d"]);
  });

  it("carries a value forward, because a March result is still the last thing known in April", () => {
    const [m] = labMetricsFor(labs);
    expect(m.value({ labs, date: "2026-02-01" })).toBeNull();
    expect(m.value({ labs, date: "2026-04-15" })).toBe(24);
    expect(m.value({ labs, date: "2026-07-01" })).toBe(31);
  });
});

describe("labSummaryLine", () => {
  it("leads with the value, the change and whose range it was", () => {
    const s = labSeries([vd("2026-03-01", 24, { refLow: 30, refHigh: 100 }), vd("2026-06-01", 38, { refLow: 30, refHigh: 100 })], "vitamin_d");
    const line = labSummaryLine(s);
    expect(line).toContain("38 ng/mL");
    expect(line).toContain("up 14 over 92 days");
    expect(line).toContain("your lab");
    expect(causalLanguageAudit(line)).toEqual([]);
  });

  it("is empty with nothing to say", () => {
    expect(labSummaryLine([])).toBe("");
  });
});

describe("daysBetween", () => {
  it("counts calendar days across a month boundary", () => {
    expect(daysBetween("2026-02-26", "2026-03-02")).toBe(4);
    expect(daysBetween("2026-03-02", "2026-02-26")).toBe(-4);
  });
});

describe("labTest", () => {
  it("returns nothing for a key it doesn't know rather than a default", () => {
    expect(labTest("nope")).toBeUndefined();
    expect(labTest("hba1c")?.label).toBe("HbA1c");
  });
});
