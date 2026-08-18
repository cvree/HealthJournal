/* The small shared pieces every Insights card is built from: a figure with a
   name under it, and a change stated as movement rather than as cause.

   They live in one file because their job is consistency. A median on the
   range card, a median in the monthly summary and a median in an episode
   detail are the same claim, and if they were written three times they would
   drift into three sizes, three placeholders and three ways of saying "not
   enough days yet". */

import React from "react";
import { C } from "../lib/theme";
import type { ChangeLine, StatTile, Tone } from "../lib/insights";

const toneColor = (tone: Tone | undefined): string =>
  tone === "good" ? C.good : tone === "bad" ? C.bad : C.ink;

/** The placeholder for a figure that does not exist yet. An em-dash, never a
    zero: the whole point is that nothing was logged. */
export const NOTHING = "—";

export function StatCell({ tile }: { tile: StatTile }) {
  const empty = tile.value == null;
  return (
    <div className="fhj-stat">
      <div className="fhj-stat-label">{tile.label}</div>
      <div
        className={"fhj-stat-value" + (empty ? " is-empty" : "")}
        style={empty ? undefined : { color: toneColor(tile.tone) }}
      >
        {tile.value ?? NOTHING}
      </div>
      {tile.sub && <div className="fhj-stat-sub">{empty ? "nothing logged yet" : tile.sub}</div>}
    </div>
  );
}

/** A grid of figures. Two columns on a phone, three when the caller has six
    of them and the labels are short. */
export function StatGrid({ tiles, columns = 2 }: { tiles: StatTile[]; columns?: 2 | 3 }) {
  return (
    <div className={"fhj-stat-grid" + (columns === 3 ? " fhj-stat-grid-3" : "")}>
      {tiles.map((t) => <StatCell key={t.id} tile={t} />)}
    </div>
  );
}

/** An arrow whose *direction* is the movement and whose *colour* is whether
    that movement is welcome. Drawn rather than typed so it inherits the line
    weight of the rest of the app's icons. */
function ChangeArrow({ direction, color }: { direction: ChangeLine["direction"]; color: string }) {
  const d =
    direction === "up" ? "M12 19V5M6 11l6-6 6 6" :
    direction === "down" ? "M12 5v14M6 13l6 6 6-6" :
    "M5 12h14";
  return (
    <span className="fhj-change-arrow" aria-hidden="true">
      <svg width="13" height="13" viewBox="0 0 24 24">
        <path d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** "↓ 0.63 lower than the previous 30 days".

    Never says one thing caused another, and never hides itself when the
    comparison is thin — it goes quiet and says so, because "we compared four
    days with thirty" is information the reader needs to weigh the number.

    `compact` keeps the arrow and the figure and drops the rest, for a
    two-column grid whose heading already names what the comparison is
    against. The full sentence stays as the accessible name, so nothing is
    lost to anyone reading it aloud. */
export function ChangeChip({ change, compact = false }: { change: ChangeLine; compact?: boolean }) {
  const color = change.tone === "good" ? C.good : change.tone === "bad" ? C.bad : C.sub;
  const thin = !change.reliable;
  /* One word for the flat case: at two cards per phone-width row, "about the
     same" wraps onto a second line and pushes every card in the row taller. */
  const short = change.magnitude == null
    ? "no comparison"
    : change.direction === "flat" ? "steady" : change.magnitude;
  return (
    <span
      className={"fhj-change" + (thin ? " is-thin" : "")}
      style={{ color: change.tone === "neutral" ? C.sub : color }}
      aria-label={compact ? change.text : undefined}
      title={compact ? change.text : undefined}
    >
      <ChangeArrow direction={change.direction} color={color} />
      <span className="min-w-0">{compact ? short : change.text}</span>
    </span>
  );
}

/** The line that always appears under a figure: how many of the range's days
    it was computed from. Unflattering coverage is the reason this exists. */
export function CoverageNote({ text }: { text: string }) {
  return <div className="fhj-caption mt-2" style={{ color: C.subtle }}>{text}</div>;
}
