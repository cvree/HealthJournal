/* The one control that decides what every number on Insights is about.

   Before this, the screen was a pile of fixed windows: a 7-day average beside
   a 30-day average beside a 30-day chart beside a "this week vs last week"
   grid. Four windows meant four different answers to "how am I doing" on one
   screen, and none of them could be changed. One control, five choices, and
   everything below it moves together.

   It is a radiogroup, not five buttons: exactly one is active, arrow keys move
   between them, and the active one is announced. The row is thumb-height at
   phone width because it is the control people will touch most on this
   screen. */

import React from "react";
import { C } from "../lib/theme";
import { RANGE_KEYS, type RangeKey } from "../lib/analytics";

type Props = {
  value: RangeKey;
  onChange: (key: RangeKey) => void;
  /** Printed under the row: what the choice currently resolves to, e.g.
      "Apr 3 – May 2 · 18 of 30 days logged". The range is a claim about a span
      of real days, and this is where that span is stated. */
  hint?: string;
  label?: string;
};

const FULL_NAME: Record<RangeKey, string> = {
  "7D": "Last 7 days",
  "30D": "Last 30 days",
  "90D": "Last 90 days",
  "1Y": "Last 12 months",
  All: "All time",
};

export default function RangeControl({ value, onChange, hint, label = "Time range" }: Props) {
  const move = (from: RangeKey, step: -1 | 1) => {
    const i = RANGE_KEYS.indexOf(from);
    const next = RANGE_KEYS[Math.min(RANGE_KEYS.length - 1, Math.max(0, i + step))];
    if (next && next !== from) onChange(next);
  };

  return (
    <div>
      <div className="fhj-segmented" role="radiogroup" aria-label={label}>
        {RANGE_KEYS.map((key) => {
          const active = key === value;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              /* The pills read "7D"; a screen reader gets the whole phrase,
                 because "seven dee" is not a time range. */
              aria-label={FULL_NAME[key]}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(key)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(key, 1); }
                else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(key, -1); }
                else if (e.key === "Home") { e.preventDefault(); onChange(RANGE_KEYS[0]); }
                else if (e.key === "End") { e.preventDefault(); onChange(RANGE_KEYS[RANGE_KEYS.length - 1]); }
              }}
              className={"fhj-segment" + (active ? " is-active" : "")}
            >
              {key}
            </button>
          );
        })}
      </div>
      {hint && (
        <div className="fhj-caption mt-2" style={{ color: C.subtle }} aria-live="polite">
          {hint}
        </div>
      )}
    </div>
  );
}
