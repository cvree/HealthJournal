/* How the trend chart is drawn: the saved preference, its sanitiser and the
   line that describes it when the controls are folded away.

   This comes back off disk, where a hand-edited backup, an older build's
   option or a null can all turn up, so every field falls back on its own —
   one bad key must not throw the rest of somebody's choices away. */
import { describe, it, expect } from "vitest";
import {
  avgKeyOf, chartViewSummary, curveOf, DEFAULT_CHART_VIEW, sanitizeChartView,
} from "../src/lib/chartView";

describe("sanitizeChartView", () => {
  it("gives an untouched journal exactly what the chart has always done", () => {
    expect(sanitizeChartView(undefined)).toEqual(DEFAULT_CHART_VIEW);
    expect(sanitizeChartView(null)).toEqual(DEFAULT_CHART_VIEW);
    expect(sanitizeChartView("steps")).toEqual(DEFAULT_CHART_VIEW);
    expect(sanitizeChartView([])).toEqual(DEFAULT_CHART_VIEW);
  });

  it("keeps every field it recognises", () => {
    expect(sanitizeChartView({
      shape: "steps", avg: "only", breakGaps: true, apart: true, zoom: true,
    })).toEqual({ shape: "steps", avg: "only", breakGaps: true, apart: true, zoom: true });
  });

  it("replaces only the fields it cannot read", () => {
    const v = sanitizeChartView({ shape: "bars", avg: "only", breakGaps: "yes", zoom: true });
    expect(v.shape).toBe(DEFAULT_CHART_VIEW.shape);   // a shape this build doesn't have
    expect(v.breakGaps).toBe(DEFAULT_CHART_VIEW.breakGaps); // a string is not a choice
    expect(v.avg).toBe("only");                        // these two survive it
    expect(v.zoom).toBe(true);
  });
});

describe("chartViewSummary", () => {
  it("says what the closed row is hiding", () => {
    expect(chartViewSummary(DEFAULT_CHART_VIEW)).toBe("line · 7-day average");
    expect(chartViewSummary({ ...DEFAULT_CHART_VIEW, avg: "off" })).toBe("line");
    expect(chartViewSummary({
      shape: "dots", avg: "only", breakGaps: true, apart: true, zoom: true,
    })).toBe("dots · averages only · apart · gaps open · axis fitted");
  });
});

describe("the row keys and curves", () => {
  it("keeps an average out of the way of a real field key", () => {
    expect(avgKeyOf("avg")).not.toBe("avg");
    expect(avgKeyOf("severity")).toBe("avg~severity");
  });

  it("only steps step", () => {
    expect(curveOf("steps")).toBe("stepAfter");
    expect(curveOf("line")).toBe("monotone");
    expect(curveOf("area")).toBe("monotone");
    expect(curveOf("dots")).toBe("linear");
  });
});
