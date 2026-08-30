/* Every flare on one rail, then the same flares as rows you can open.

   Two representations of one list, on purpose. The rail answers "how much of
   this year was I unwell, and were the bad stretches clustered" in about a
   second and cannot be read precisely. The rows answer "which one was that, and
   how bad did it get" precisely and cannot be read in a second. Neither is the
   redundant one — a phone has room for both because the rail is 40px tall. */

import React from "react";
import { C } from "../lib/theme";
import {
  daySpan, durationLabel, type EpisodeStats,
} from "../lib/episodes";

type Props = {
  /** Newest first — the order the rows are shown in. */
  stats: EpisodeStats[];
  /** Inclusive window the rail covers. */
  from: string;
  to: string;
  onOpen: (id: string) => void;
  onFeedback?: (kind: string) => void;
  /** Highlighted row, when one is selected elsewhere. */
  activeId?: string | null;
};

const fmtDay = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const fmtMonth = (date: string) => {
  const [y, m] = date.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
};

/** Month ticks across the rail, so a block's position means something. */
function railTicks(from: string, to: string) {
  const out: { key: string; left: number; label: string }[] = [];
  const total = daySpan(from, to);
  let [y, m] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  for (let i = 0; i < 400; i++) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    const key = `${y}-${String(m).padStart(2, "0")}-01`;
    if (key > to) break;
    out.push({
      key,
      left: ((daySpan(from, key) - 1) / total) * 100,
      label: fmtMonth(key),
    });
  }
  return out;
}

export default function EpisodeTimeline({
  stats, from, to, onOpen, onFeedback, activeId,
}: Props) {
  const total = Math.max(1, daySpan(from, to));
  const ticks = railTicks(from, to);

  const blocks = stats
    .map((s) => {
      const a = s.start > from ? s.start : from;
      const b0 = s.end || to;
      const b = b0 < to ? b0 : to;
      if (a > b) return null;
      return {
        s,
        left: ((daySpan(from, a) - 1) / total) * 100,
        /* A one-day flare would be 0.3% of a year and invisible, so a block is
           never allowed to be thinner than something a thumb can find. */
        width: Math.max(1.6, (daySpan(a, b) / total) * 100),
      };
    })
    .filter(Boolean) as { s: EpisodeStats; left: number; width: number }[];

  return (
    <div>
      <div className="fhj-ep-rail" style={{ background: C.faint }} aria-hidden="true">
        {ticks.map((t) => (
          <span key={t.key} className="fhj-ep-tick" style={{ left: `${t.left}%`, background: C.line }} />
        ))}
        {blocks.map(({ s, left, width }) => (
          <button
            key={s.id}
            type="button"
            tabIndex={-1}
            className={"fhj-ep-block" + (s.id === activeId ? " is-active" : "")}
            style={{
              left: `${left}%`, width: `${width}%`,
              background: s.open ? C.alert : C.bad,
              opacity: s.id === activeId ? 1 : 0.88,
            }}
            onClick={() => { onFeedback?.("nav"); onOpen(s.id); }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px]" style={{ color: C.subtle }} aria-hidden="true">
        <span>{fmtDay(from)}</span>
        <span>{fmtDay(to)}</span>
      </div>

      <div className="fhj-ep-rows mt-3.5" style={{ borderColor: C.line }}>
        {stats.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => { onFeedback?.("nav"); onOpen(s.id); }}
            className="fhj-row w-full flex items-center gap-3 px-3.5 py-3 text-left"
            style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}
          >
            <span className="fhj-ep-dot shrink-0" style={{ background: s.open ? C.alert : C.bad }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold truncate" style={{ color: C.ink }}>
                {s.title}
              </span>
              <span className="block text-[11px] mt-0.5" style={{ color: C.subtle }}>
                {/* A flare marked on the day it happened is one date, said
                    once. "30 Aug – 30 Aug · 1 day" is the same fact three
                    times, and it is now the common case. */}
                {s.end === s.start
                  ? fmtDay(s.start)
                  : <>
                    {fmtDay(s.start)}
                    {s.end ? ` – ${fmtDay(s.end)}` : " – now"}
                    {" · "}{durationLabel(s.days)}
                    {s.open && " · ongoing"}
                  </>}
              </span>
            </span>
            <span className="text-right shrink-0">
              <span className="block font-display text-lg leading-none tabular-nums"
                style={{ color: s.peak != null ? C.ink : C.muted }}>
                {s.peak ?? "–"}
              </span>
              <span className="block text-[10px] mt-1" style={{ color: C.subtle }}>peak</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
