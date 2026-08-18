/* Pure tests for the year heatmap: grid shape, direction-aware summaries and
   the ten-step colour ramp. No DOM, no clock — every case pins its own
   "today". */
import { describe, it, expect } from "vitest";
import {
  buildHeatmap, daysInMonth, heatColor, heatExtremeLabels, heatLegendEnds,
  heatRamp, heatSummary, mixHex, monthsEnding, rampBetween,
  type HeatMonth,
} from "../src/lib/heatmap";

const TOKENS = {
  good: "#000000", warn: "#555555", alert: "#AAAAAA", bad: "#FFFFFF",
  accent: "#3D6AAF", faint: "#EDE9E1",
};

/** A grid where the value is the day-of-month, capped at 10, on logged days. */
const grid = (today: string, values: Record<string, number> = {}, logged = Object.keys(values)) =>
  buildHeatmap({
    today,
    valueOn: (d) => (d in values ? values[d] : null),
    loggedOn: (d) => logged.includes(d),
  });

describe("month rows", () => {
  it("ends on today's month and runs twelve rows, oldest first", () => {
    const months = monthsEnding("2026-08-18", 12);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ year: 2025, month: 8 });   // September 2025
    expect(months[11]).toEqual({ year: 2026, month: 7 });  // August 2026
  });
  it("crosses the year boundary backwards", () => {
    const months = monthsEnding("2026-01-05", 3);
    expect(months.map((m) => `${m.year}-${m.month}`)).toEqual(["2025-10", "2025-11", "2026-0"]);
  });
  it("knows February in a leap year", () => {
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2025, 1)).toBe(28);
  });
});

describe("grid", () => {
  const months = grid("2026-08-18", { "2026-08-03": 7, "2026-08-04": 2 }, ["2026-08-03", "2026-08-04", "2026-08-05"]);
  const aug = months[11] as HeatMonth;

  it("gives every row 31 slots, padding short months with null", () => {
    for (const m of months) expect(m.days).toHaveLength(31);
    const feb = months.find((m) => m.key === "2026-02")!;
    expect(feb.days.filter(Boolean)).toHaveLength(28);
    expect(feb.days[28]).toBeNull();
  });
  it("labels rows for the reader, not the machine", () => {
    expect(aug.label).toBe("Aug");
    expect(aug.full).toBe("August 2026");
    expect(aug.key).toBe("2026-08");
  });
  it("marks days after today as future, with no value", () => {
    expect(aug.days[17]!.future).toBe(false);   // the 18th
    expect(aug.days[18]!.future).toBe(true);    // the 19th
    expect(aug.days[18]!.value).toBeNull();
    expect(aug.days[18]!.logged).toBe(false);
  });
  it("separates 'logged' from 'has a value for this metric'", () => {
    expect(aug.days[2]!.value).toBe(7);
    expect(aug.days[4]!.value).toBeNull();
    expect(aug.days[4]!.logged).toBe(true);
    expect(aug.days[5]!.logged).toBe(false);
  });
  it("never asks for a value it will not draw", () => {
    const asked: string[] = [];
    buildHeatmap({ today: "2026-08-18", months: 1, valueOn: (d) => { asked.push(d); return null; } });
    expect(asked).toHaveLength(18);
    expect(asked[asked.length - 1]).toBe("2026-08-18");
  });
});

describe("summary", () => {
  const months = grid("2026-08-18", {
    "2026-08-01": 8, "2026-08-02": 2, "2026-08-03": 5,
    "2026-07-10": 9,
  });
  it("counts only days inside the range and not in the future", () => {
    const s = heatSummary(months, "sym");
    expect(s.logged).toBe(4);
    expect(s.days).toBe(365 - 13);   // Sep 1 2025 → Aug 18 2026
    expect(s.coverage).toBeCloseTo(4 / s.days, 6);
    expect(s.average).toBeCloseTo(6, 6);
  });
  it("reads best and hardest through the metric's direction", () => {
    const sym = heatSummary(months, "sym");
    expect(sym.best).toEqual({ date: "2026-08-02", value: 2 });
    expect(sym.hardest).toEqual({ date: "2026-07-10", value: 9 });

    const pos = heatSummary(months, "pos");
    expect(pos.best).toEqual({ date: "2026-07-10", value: 9 });
    expect(pos.hardest).toEqual({ date: "2026-08-02", value: 2 });
  });
  it("summarizes each month on its own terms", () => {
    const s = heatSummary(months, "sym");
    const aug = s.months[11];
    expect(aug.full).toBe("August 2026");
    expect(aug.year).toBe(2026);
    expect(aug.logged).toBe(3);
    expect(aug.days).toBe(18);
    expect(aug.average).toBeCloseTo(5, 6);
    expect(aug.best!.value).toBe(2);
    const may = s.months.find((m) => m.key === "2026-05")!;
    expect(may.logged).toBe(0);
    expect(may.average).toBeNull();
    expect(may.best).toBeNull();
  });
  it("stays defined on an empty journal", () => {
    const s = heatSummary(grid("2026-08-18"), "sym");
    expect(s.logged).toBe(0);
    expect(s.coverage).toBe(0);
    expect(s.average).toBeNull();
    expect(s.best).toBeNull();
    expect(s.months).toHaveLength(12);
  });
});

describe("colour ramp", () => {
  it("mixes two colours, clamped at both ends", () => {
    expect(mixHex("#000000", "#FFFFFF", 0)).toBe("#000000");
    expect(mixHex("#000000", "#FFFFFF", 1)).toBe("#FFFFFF");
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mixHex("#000000", "#FFFFFF", 5)).toBe("#FFFFFF");
  });
  it("spreads anchors over ten distinct steps", () => {
    const ramp = rampBetween([TOKENS.good, TOKENS.warn, TOKENS.alert, TOKENS.bad], 10);
    expect(ramp).toHaveLength(10);
    expect(ramp[0]).toBe("#000000");
    expect(ramp[9]).toBe("#FFFFFF");
    expect(new Set(ramp).size).toBe(10);
  });
  it("gives a symptom metric its worst colour at 10 and a positive one at 1", () => {
    const sym = heatRamp("sym", TOKENS);
    const pos = heatRamp("pos", TOKENS);
    expect(sym[0]).toBe(TOKENS.good);
    expect(sym[9]).toBe(TOKENS.bad);
    expect(pos[0]).toBe(TOKENS.bad);
    expect(pos[9]).toBe(TOKENS.good);
  });
  it("uses one hue when nothing is better or worse", () => {
    const neutral = heatRamp("neutral", TOKENS);
    expect(neutral).toHaveLength(10);
    expect(neutral[9]).toBe(TOKENS.accent.toUpperCase());
  });
  it("maps each score to its own shade, and nothing to none", () => {
    const ramp = heatRamp("sym", TOKENS);
    expect(heatColor(1, ramp)).toBe(ramp[0]);
    expect(heatColor(10, ramp)).toBe(ramp[9]);
    expect(heatColor(4.4, ramp)).toBe(ramp[3]);
    expect(heatColor(null, ramp)).toBeNull();
    expect(heatColor(undefined, ramp)).toBeNull();
  });
  it("clamps a score from outside the scale rather than dropping it", () => {
    const ramp = heatRamp("sym", TOKENS);
    expect(heatColor(0, ramp)).toBe(ramp[0]);
    expect(heatColor(99, ramp)).toBe(ramp[9]);
  });
});

describe("wording", () => {
  it("names the ends of the scale in the metric's own direction", () => {
    expect(heatLegendEnds("sym")).toEqual({ low: "1 · mild", high: "10 · severe" });
    expect(heatLegendEnds("pos")).toEqual({ low: "1 · poor", high: "10 · great" });
    expect(heatLegendEnds(undefined).high).toBe("10 · severe");
  });
  it("does not call a neutral metric's extremes best and worst", () => {
    expect(heatExtremeLabels("sym")).toEqual({ best: "Best", hardest: "Hardest" });
    expect(heatExtremeLabels("neutral")).toEqual({ best: "Lowest", hardest: "Highest" });
  });
});
