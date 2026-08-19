/* "How it's drawn" — the controls behind the trend chart.

   Five choices, all of them about the same set of numbers, none of them a
   preference in the decorative sense: each one changes what the chart claims.
   They live behind a disclosure whose closed row prints the current answer, so
   the screen stays calm for the many people who will never open it and the
   choice is never hidden from the ones who do.

   Each control says what it costs rather than what it is: "holds each day's
   value until the next one" is the difference between a line and steps, and it
   is the only part worth reading. The axis control is the one that can
   mislead, so it is last, its options are named plainly, and the chart itself
   prints what it did whenever the fitted axis is on. */

import React from "react";
import { C } from "../lib/theme";
import {
  AVG_LABEL, DEFAULT_CHART_VIEW, SHAPE_LABEL, SHAPE_NOTE,
  type AvgMode, type ChartShape, type ChartView,
} from "../lib/chartView";

type Props = {
  view: ChartView;
  onChange: (next: ChartView) => void;
  /** Hides the two rating-only rows when nothing on a 1–10 scale is pinned. */
  hasRatings?: boolean;
  /** "One axis or one chart each" means nothing with a single rating pinned. */
  ratingCount?: number;
  onFeedback?: (kind: string) => void;
};

function Row({ label, hint, options, value, onPick }: {
  label: string;
  hint?: string;
  options: { v: string; label: string }[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="fhj-view-row">
      <div className="fhj-eyebrow">{label}</div>
      <div className="fhj-segmented mt-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={value === o.v}
            onClick={() => onPick(o.v)}
            className={"fhj-segment" + (value === o.v ? " is-active" : "")}>
            {o.label}
          </button>
        ))}
      </div>
      {hint && <div className="fhj-caption mt-1.5">{hint}</div>}
    </div>
  );
}

export default function ChartViewControls({
  view, onChange, hasRatings = true, ratingCount = 0, onFeedback,
}: Props) {
  const set = (patch: Partial<ChartView>) => { onFeedback?.("select"); onChange({ ...view, ...patch }); };
  const isDefault = (Object.keys(DEFAULT_CHART_VIEW) as (keyof ChartView)[])
    .every((k) => view[k] === DEFAULT_CHART_VIEW[k]);

  return (
    <div className="fhj-view">
      <Row label="Shape" hint={SHAPE_NOTE[view.shape]}
        value={view.shape}
        options={(["line", "area", "steps", "dots"] as ChartShape[])
          .map((v) => ({ v, label: SHAPE_LABEL[v] }))}
        onPick={(v) => set({ shape: v as ChartShape })} />

      <Row label="7-day average"
        hint={view.avg === "only"
          ? "Every line is a 7-day average. Smoother, and a single terrible day disappears into it."
          : view.avg === "on"
            ? "Dashed, behind the day-to-day line: the direction rather than the reading."
            : "Just the days as you logged them."}
        value={view.avg}
        options={(["off", "on", "only"] as AvgMode[]).map((v) => ({ v, label: AVG_LABEL[v] }))}
        onPick={(v) => set({ avg: v as AvgMode })} />

      <Row label="Days you didn't log"
        hint={view.breakGaps
          ? "The line stops at a gap. Nothing is drawn where nothing was recorded."
          : "The line runs straight across a gap — quicker to read, and it invents the days between."}
        value={view.breakGaps ? "break" : "bridge"}
        options={[{ v: "bridge", label: "Join up" }, { v: "break", label: "Leave a gap" }]}
        onPick={(v) => set({ breakGaps: v === "break" })} />

      {hasRatings && ratingCount > 1 && (
        <Row label="Several ratings"
          hint={view.apart
            ? "One chart each, stacked on the same dates."
            : "Together on one 1–10 axis, where heights can honestly be compared."}
          value={view.apart ? "apart" : "together"}
          options={[{ v: "together", label: "One axis" }, { v: "apart", label: "One chart each" }]}
          onPick={(v) => set({ apart: v === "apart" })} />
      )}

      {hasRatings && (
        <Row label="Rating axis"
          hint={view.zoom
            ? "Fitted to the range you actually scored. Useful, and it makes small differences look large — the chart says so underneath."
            : "The whole 1–10, always. A calm fortnight looks calm."
          }
          value={view.zoom ? "fit" : "full"}
          options={[{ v: "full", label: "Full 1–10" }, { v: "fit", label: "Fit the data" }]}
          onPick={(v) => set({ zoom: v === "fit" })} />
      )}

      {!isDefault && (
        <button type="button" className="fhj-view-reset"
          onClick={() => { onFeedback?.("tap"); onChange({ ...DEFAULT_CHART_VIEW }); }}
          style={{ color: C.accentText }}>
          Put it back the way it started
        </button>
      )}
    </div>
  );
}
