/* The top of Insights: one metric, one range, one honest number.

   What it replaced: a "today" figure that was blank until you had logged, a
   7-day average, a 30-day average, and a grid comparing this week with last
   week — four windows, four answers, none of them adjustable. This card
   answers the same question once, over whatever range the control above it is
   set to, and states in the same breath how many days that answer came from.

   The reading order is the order of the questions a person actually asks:
   what is my average → is that up or down → over how many days → what did the
   days look like. */

import React from "react";
import { C } from "../lib/theme";
import type { MetricChange, RangeInsights, SeverityStep } from "../lib/insights";
import { ChangeChip, NOTHING, StatGrid } from "./StatTiles";

const STEP_COLOR = (): Record<SeverityStep, string> => ({
  good: C.good, warn: C.warn, alert: C.alert, bad: C.bad,
});

export function headlineColor(step: SeverityStep | null): string {
  return step ? STEP_COLOR()[step] : C.ink;
}

type Props = {
  insights: RangeInsights;
  /** Severity step for the headline average, from `severityStep`. */
  step: SeverityStep | null;
  /** Rendered under the tiles — the log-today button, when there is one. */
  children?: React.ReactNode;
};

export default function RangeSummary({ insights, step, children }: Props) {
  const { metric, selection, headline, headlineCaption, change, coverage, tiles, hasData } = insights;
  return (
    <div className="fhj-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="fhj-eyebrow min-w-0 leading-snug pt-0.5">
          {metric.label}
        </div>
        <span className="text-[11px] shrink-0 pt-0.5" style={{ color: C.subtle }}>
          {selection.label}
        </span>
      </div>

      <div className="mt-2.5">
        <div
          className="font-display fhj-hero-value"
          style={{ color: hasData ? headlineColor(step) : C.muted }}
        >
          {headline ?? NOTHING}
        </div>
        <div className="text-[11.5px] mt-2" style={{ color: C.subtle }}>{headlineCaption}</div>
      </div>

      {/* The comparison is part of the headline, not a footnote: a 4.37 that
          is 0.6 lower than last month is a different fact from a 4.37 that is
          0.6 higher, and both are more useful than the bare number. */}
      <div className="mt-3">
        <ChangeChip change={change} />
      </div>

      <div className="fhj-caption mt-2.5">{coverage}</div>

      <div className="mt-3.5">
        <StatGrid tiles={tiles} />
      </div>

      {children}
    </div>
  );
}

/* ---------- the other tracked metrics, over the same range ---------- */

/** One card per dashboard metric: its average over the selected range and how
    that compares with the equal-length period before it. Metrics with nothing
    logged keep their card and say so — a card that quietly disappeared would
    read as "this is fine". */
export function MetricChangeGrid({ changes }: { changes: MetricChange[] }) {
  if (!changes.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {changes.map((c) => (
        <div key={c.metric.k} className="fhj-card" style={{ padding: "0.875rem" }}>
          <div className="text-xs font-medium truncate" style={{ color: C.sub }}>{c.metric.label}</div>
          <div
            className="font-display text-2xl leading-none mt-2 tabular-nums"
            style={{ color: c.value ? C.ink : C.muted }}
          >
            {c.value ?? NOTHING}
          </div>
          <div className="mt-1.5">
            <ChangeChip change={c.change} compact />
          </div>
          <div className="fhj-caption mt-1.5">{c.coverage}</div>
        </div>
      ))}
    </div>
  );
}
