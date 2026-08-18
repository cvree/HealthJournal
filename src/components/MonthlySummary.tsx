/* One month, answered the way people ask about it.

   "How was April?" is the question a journal exists to answer, and until now
   the app could only answer "the last 30 days" — a window that slides every
   morning and therefore never matches the month anyone is actually thinking
   about, or talking about at an appointment.

   The card leads with the sentence itself ("April average 4.37"), because a
   figure with its subject attached is a thing you can repeat out loud. The
   month is a two-arrow control, the arrows stop at the ends of the journal,
   and the coverage line is always present: an average over nine days and an
   average over thirty are different claims and the reader has to be able to
   tell them apart without asking. */

import React from "react";
import { C } from "../lib/theme";
import type { MonthOption, MonthSummary, SeverityStep } from "../lib/insights";
import { ChangeChip, NOTHING, StatGrid } from "./StatTiles";
import { headlineColor } from "./RangeSummary";

type Props = {
  summary: MonthSummary;
  /** Every month the journal covers, oldest first. */
  options: MonthOption[];
  onChange: (month: string) => void;
  /** Severity step for the month's average, from `severityStep`. */
  step: SeverityStep | null;
};

function Chevron({ dir, color }: { dir: "left" | "right"; color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={dir === "left" ? "M14 6l-6 6 6 6" : "M10 6l6 6-6 6"}
        fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export default function MonthlySummary({ summary, options, onChange, step }: Props) {
  const index = options.findIndex((o) => o.month === summary.month);
  const prev = index > 0 ? options[index - 1] : null;
  const next = index >= 0 && index < options.length - 1 ? options[index + 1] : null;

  return (
    <div className="fhj-card p-4">
      <div className="fhj-month-nav">
        <button
          type="button"
          className="fhj-month-btn"
          disabled={!prev}
          aria-label={prev ? `Show ${prev.label}` : "No earlier month"}
          onClick={() => prev && onChange(prev.month)}
        >
          <Chevron dir="left" color={C.ink} />
        </button>
        <div className="fhj-month-title">
          <div className="text-sm font-semibold truncate">{summary.label}</div>
          {/* The month picker's own coverage: months with nothing in them stay
              selectable and say so, rather than being skipped as if the gap
              never happened. */}
          <div className="fhj-caption">
            {summary.summary.coverage.loggedDays > 0
              ? `${summary.summary.coverage.loggedDays} logged`
              : "nothing logged"}
          </div>
        </div>
        <button
          type="button"
          className="fhj-month-btn"
          disabled={!next}
          aria-label={next ? `Show ${next.label}` : "No later month"}
          onClick={() => next && onChange(next.month)}
        >
          <Chevron dir="right" color={C.ink} />
        </button>
      </div>

      <div className="mt-4">
        <div
          className="font-display text-[2.5rem] leading-none tabular-nums"
          style={{ color: summary.hasData ? headlineColor(step) : C.muted }}
        >
          {summary.average ?? NOTHING}
        </div>
        <div className="text-[13px] font-medium mt-2" style={{ color: C.sub }}>
          {summary.headline}
        </div>
      </div>

      <div className="mt-3">
        <ChangeChip change={summary.change} />
      </div>

      <div className="fhj-caption mt-2.5">{summary.coverage}</div>

      <div className="mt-3.5">
        <StatGrid tiles={summary.tiles} columns={3} />
      </div>
    </div>
  );
}
