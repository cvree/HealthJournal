/* How the trend chart is drawn — the reader's choice, not the app's.

   The trend chart answers one question ("what has this been doing") and there
   is more than one honest way to draw the answer. A line implies the days
   between two ratings; steps do not. A 7-day average is the only way to see a
   direction through a noisy fortnight, and the only way to miss a single awful
   day. Four ratings on one axis is a comparison; four ratings on four axes is
   four answers. None of these is wrong, and which one is useful depends
   entirely on what the person is looking for today.

   So they are settings, they are remembered, and each one says plainly what it
   costs. The one that can mislead — fitting the axis to the data instead of
   holding the full 1–10 — prints what it did underneath the chart for as long
   as it is on, because an axis that starts at 4 makes a flat fortnight look
   like a mountain range and nobody reads axis labels.

   Pure, and separate from the components, so the defaults, the sanitiser (this
   comes back off disk, where anything can happen to it) and the summary line
   can be tested without a chart. */

export type ChartShape = "line" | "area" | "steps" | "dots";
/** Off, drawn behind the daily line, or the only thing drawn. */
export type AvgMode = "off" | "on" | "only";

export type ChartView = {
  shape: ChartShape;
  avg: AvgMode;
  /** Leave a break where a day wasn't logged instead of bridging it. */
  breakGaps: boolean;
  /** Every metric on its own chart, rather than ratings sharing the 1–10 axis. */
  apart: boolean;
  /** Fit the rating axis to the data instead of holding the full 1–10. */
  zoom: boolean;
};

/** What the chart has always done, so an existing journal opens unchanged. */
export const DEFAULT_CHART_VIEW: ChartView = {
  shape: "line",
  avg: "on",
  breakGaps: false,
  apart: false,
  zoom: false,
};

const SHAPES: ChartShape[] = ["line", "area", "steps", "dots"];
const AVGS: AvgMode[] = ["off", "on", "only"];

/** The row key carrying one metric's trailing 7-day average.

    Prefixed rather than suffixed so it can never collide with a real field key
    (`avg` was a field key waiting to happen), and shared by whoever builds the
    rows and whoever draws them. */
export const avgKeyOf = (k: string): string => `avg~${k}`;

/** Anything can be on disk: a hand-edited backup, a value from a build that
    offered a shape this one doesn't, a null where an object should be. Each
    field falls back on its own, so one bad key doesn't discard the rest. */
export function sanitizeChartView(raw: unknown): ChartView {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    shape: SHAPES.includes(v.shape as ChartShape) ? (v.shape as ChartShape) : DEFAULT_CHART_VIEW.shape,
    avg: AVGS.includes(v.avg as AvgMode) ? (v.avg as AvgMode) : DEFAULT_CHART_VIEW.avg,
    breakGaps: typeof v.breakGaps === "boolean" ? v.breakGaps : DEFAULT_CHART_VIEW.breakGaps,
    apart: typeof v.apart === "boolean" ? v.apart : DEFAULT_CHART_VIEW.apart,
    zoom: typeof v.zoom === "boolean" ? v.zoom : DEFAULT_CHART_VIEW.zoom,
  };
}

export const SHAPE_LABEL: Record<ChartShape, string> = {
  line: "Line",
  area: "Filled",
  steps: "Steps",
  dots: "Dots",
};

/** What each shape claims about the days between two entries. Printed under
    the control, because that is the whole difference between them. */
export const SHAPE_NOTE: Record<ChartShape, string> = {
  line: "A straight run between two days you logged.",
  steps: "Holds each day's value until the next one — claims nothing in between.",
  area: "The line, with the ground under it filled in.",
  dots: "One mark per logged day and nothing joining them.",
};

export const AVG_LABEL: Record<AvgMode, string> = {
  off: "Off",
  on: "Behind",
  only: "Only",
};

/** The closed disclosure row has to say what is folded inside it, or folding it
    away costs the reader the answer. */
export function chartViewSummary(v: ChartView): string {
  const parts = [SHAPE_LABEL[v.shape].toLowerCase()];
  if (v.avg === "on") parts.push("7-day average");
  else if (v.avg === "only") parts.push("averages only");
  if (v.apart) parts.push("apart");
  if (v.breakGaps) parts.push("gaps open");
  if (v.zoom) parts.push("axis fitted");
  return parts.join(" · ");
}

/** recharts' interpolation for a shape. `dots` still needs a curve type — the
    line under it is simply drawn at zero width. */
export const curveOf = (shape: ChartShape): "monotone" | "stepAfter" | "linear" =>
  shape === "steps" ? "stepAfter" : shape === "dots" ? "linear" : "monotone";
