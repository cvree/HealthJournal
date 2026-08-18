/* The year, in one block.

   Twelve rows, one per month; thirty-one columns, one per day-of-month. A
   colour for every score from 1 to 10, nothing at all for a day that was never
   logged. See src/lib/heatmap.ts for why the rows are months rather than weeks.

   Two things this component takes seriously:

   · A day square is about nine pixels wide, because that is what a year on a
     phone costs. So a tap does not open the entry straight away — it *names*
     the day, in a readout under the grid, next to a full-width button that
     opens it. Landing on the 14th when you meant the 15th is then a thing you
     can see and correct, instead of a screen you have to back out of. Tapping
     the same square again opens it too, so the fast path is still two taps.
   · Colour is the only channel the grid has, so it cannot be the only channel
     the section has. Every square carries its date and score as an accessible
     name, the whole grid is one tab stop with arrow-key movement, and a
     month-by-month list sits under it saying the same thing in words. */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C } from "../lib/theme";
import {
  heatColor, heatExtremeLabels, heatLegendEnds, heatRamp, heatSummary,
  type HeatDirection, type HeatMonth,
} from "../lib/heatmap";

type Props = {
  months: HeatMonth[];
  /** Which way better points, for the ramp and the wording. */
  dir?: HeatDirection;
  /** The metric's name, used in the readout and the accessible names. */
  metricLabel: string;
  /** Opens a day's entry. Omitted in the read-only viewer, which makes every
      square inert and drops the readout's button. */
  onOpenDay?: (date: string) => void;
  /** Today, YYYY-MM-DD — ringed in the grid. */
  today: string;
  /** Light haptic/sound tick, threaded in so this file stays presentational. */
  onFeedback?: (kind: string) => void;
};

const fmtDay = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
};
const fmtLong = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
};
const fmt1 = (x: number | null) => (x == null ? "–" : (Math.round(x * 10) / 10).toString());

export default function YearHeatmap({
  months, dir, metricLabel, onOpenDay, today, onFeedback,
}: Props) {
  const ramp = useMemo(() => heatRamp(dir, C), [dir, C.good, C.bad, C.accent]);
  const summary = useMemo(() => heatSummary(months, dir), [months, dir]);
  const ends = heatLegendEnds(dir);
  const extremes = heatExtremeLabels(dir);

  const [selected, setSelected] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const listId = React.useId();

  /* A day that scrolls out of existence — the metric changed, or a new month
     started — must not leave a stale readout behind. */
  useEffect(() => {
    if (!selected) return;
    const still = months.some((m) => m.days.some((d) => d && d.date === selected));
    if (!still) setSelected(null);
  }, [months, selected]);

  const flat = useMemo(
    () => months.flatMap((m) => m.days.filter((d): d is NonNullable<typeof d> => !!d && !d.future)),
    [months]
  );
  const byDate = useMemo(() => new Map(flat.map((d) => [d.date, d])), [flat]);

  /* One tab stop for 365 squares. The roving target is the selected day, else
     today, else the last day with anything on it. */
  const rovingDate = selected
    || (byDate.has(today) ? today : null)
    || [...flat].reverse().find((d) => d.value != null)?.date
    || flat[flat.length - 1]?.date
    || null;

  const focusCell = useCallback((date: string) => {
    const el = gridRef.current?.querySelector<HTMLButtonElement>(`[data-heat-date="${date}"]`);
    el?.focus();
  }, []);

  const move = useCallback((from: string, delta: number) => {
    const i = flat.findIndex((d) => d.date === from);
    if (i < 0) return;
    const next = flat[Math.min(flat.length - 1, Math.max(0, i + delta))];
    if (!next || next.date === from) return;
    setSelected(next.date);
    focusCell(next.date);
  }, [flat, focusCell]);

  const onKeyDown = (e: React.KeyboardEvent, date: string) => {
    const keys: Record<string, number> = {
      ArrowRight: 1, ArrowLeft: -1, ArrowDown: 31, ArrowUp: -31,
    };
    if (e.key in keys) { e.preventDefault(); move(date, keys[e.key]); return; }
    if (e.key === "Home") { e.preventDefault(); setSelected(flat[0]?.date ?? null); focusCell(flat[0]?.date); return; }
    if (e.key === "End") {
      e.preventDefault();
      const last = flat[flat.length - 1];
      if (last) { setSelected(last.date); focusCell(last.date); }
    }
  };

  const tapDay = (date: string) => {
    onFeedback?.("tap");
    if (selected === date && onOpenDay) { onOpenDay(date); return; }
    setSelected(date);
  };

  const sel = selected ? byDate.get(selected) : null;
  const selColor = sel ? heatColor(sel.value, ramp) : null;

  const cellName = (date: string, value: number | null, logged: boolean) =>
    `${fmtLong(date)} — ${
      value != null ? `${metricLabel} ${value} out of 10`
        : logged ? "logged, no rating"
        : "nothing logged"}`;

  return (
    <div>
      {/* the grid — bled to the card's edges, because every pixel of width is
          another tenth of a millimetre on each of 365 squares */}
      <div ref={gridRef} className="fhj-heat" role="group"
        aria-label={`${metricLabel}, last ${months.length} months, one square per day`}>
        {months.map((m) => (
          <div key={m.key} className="fhj-heat-row">
            {/* The year is only worth printing when it turns over. */}
            <div className="fhj-heat-month" style={{ color: C.subtle }} aria-hidden="true">
              {m.month === 0 || m.key === months[0].key ? `${m.label} ${String(m.year).slice(2)}` : m.label}
            </div>
            <div className="fhj-heat-days">
              {m.days.map((d, i) => {
                if (!d) return <span key={`_${i}`} className="fhj-heat-pad" aria-hidden="true" />;
                if (d.future) return <span key={d.date} className="fhj-heat-pad" aria-hidden="true" />;
                const color = heatColor(d.value, ramp);
                const isSel = d.date === selected;
                return (
                  <button
                    key={d.date}
                    type="button"
                    data-heat-date={d.date}
                    tabIndex={d.date === rovingDate ? 0 : -1}
                    aria-pressed={isSel}
                    aria-label={cellName(d.date, d.value, d.logged)}
                    onClick={() => tapDay(d.date)}
                    onKeyDown={(e) => onKeyDown(e, d.date)}
                    className={"fhj-heat-day" + (isSel ? " is-selected" : "")}
                    style={{
                      /* Three states, three treatments: a score is a filled
                         square, a logged day with no score for this metric is
                         an outline, and a day with nothing on it is a whisper
                         of the grid — present enough to count along, quiet
                         enough that a sparse year still reads as sparse. */
                      background: color || (d.logged ? "transparent" : C.faint),
                      border: color || !d.logged ? "none" : `1px solid ${C.sub}`,
                      boxShadow: d.date === today ? `0 0 0 1.5px ${C.accent}` : undefined,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* One strip, two jobs: the year's headline until a day is picked, then
          that day. Same height either way, so the card never jumps. */}
      <div className="fhj-heat-readout mt-3" style={{ background: C.faint }}>
        {sel ? (
          <>
            <span className="fhj-heat-readout-swatch" style={{
              background: selColor || "transparent",
              border: selColor ? "none" : `1.5px solid ${C.sub}`,
            }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold truncate" style={{ color: C.ink }}>
                {fmtDay(sel.date)}
                {sel.value != null && <span className="tabular-nums"> · {sel.value}/10</span>}
              </span>
              <span className="block text-[11px] truncate" style={{ color: C.subtle }}>
                {sel.value != null ? metricLabel
                  : sel.logged ? `logged, no ${metricLabel.toLowerCase()} rating`
                  : "nothing logged this day"}
              </span>
            </span>
            {onOpenDay && (
              <button type="button" onClick={() => { onFeedback?.("nav"); onOpenDay(sel.date); }}
                className="fhj-btn fhj-btn-secondary fhj-btn-sm shrink-0">
                {sel.logged || sel.value != null ? "Open" : "Log it"}
              </button>
            )}
          </>
        ) : (
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold" style={{ color: C.ink }}>
              {summary.logged
                ? <>{summary.logged} of {summary.days} days logged<span className="tabular-nums"> · avg {fmt1(summary.average)}</span></>
                : "Nothing logged in the last 12 months"}
            </span>
            <span className="block text-[11px]" style={{ color: C.subtle }}>
              {summary.logged ? "Tap any square to see its day" : `Squares fill in as you log ${metricLabel.toLowerCase()}`}
            </span>
          </span>
        )}
      </div>

      {/* legend — the ramp itself, labelled at both ends, plus the two ways a
          square can be empty */}
      <div className="fhj-heat-legend mt-3.5">
        <span className="text-[10.5px] shrink-0" style={{ color: C.subtle }}>{ends.low}</span>
        <span className="fhj-heat-ramp" aria-hidden="true">
          {ramp.map((c, i) => <span key={i} style={{ background: c }} />)}
        </span>
        <span className="text-[10.5px] shrink-0" style={{ color: C.subtle }}>{ends.high}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10.5px]" style={{ color: C.subtle }}>
        <span className="flex items-center gap-1.5">
          <span className="fhj-heat-key" style={{ border: `1px solid ${C.sub}` }} />logged, no rating
        </span>
        <span className="flex items-center gap-1.5">
          <span className="fhj-heat-key" style={{ background: C.faint }} />not logged
        </span>
      </div>

      {/* the non-chart fallback: the same numbers, in words, for anyone who
          cannot use colour — and, as it turns out, for anyone who wants the
          monthly figures without doing the arithmetic by eye */}
      <button type="button" className="fhj-disclose mt-3.5" aria-expanded={listOpen} aria-controls={listId}
        onClick={() => { onFeedback?.("tap"); setListOpen((o) => !o); }}>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold" style={{ color: C.ink }}>Read it month by month</span>
          <span className="block text-[11.5px] truncate mt-0.5" style={{ color: C.subtle }}>
            The same year, in numbers
          </span>
        </span>
        <span className="fhj-disclose-chev" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {listOpen && (
        <div id={listId} className="fhj-disclose-panel">
          <table className="fhj-heat-table">
            <caption className="sr-only">
              {metricLabel} by month over the last {months.length} months
            </caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Logged</th>
                <th scope="col">Avg</th>
                <th scope="col">{extremes.best}</th>
                <th scope="col">{extremes.hardest}</th>
              </tr>
            </thead>
            <tbody>
              {[...summary.months].reverse().map((m) => (
                <tr key={m.key}>
                  <th scope="row">{m.label} {m.year}</th>
                  <td className="tabular-nums">{m.logged}/{m.days}</td>
                  <td className="tabular-nums">{fmt1(m.average)}</td>
                  <td className="tabular-nums">{m.best ? m.best.value : "–"}</td>
                  <td className="tabular-nums">{m.hardest ? m.hardest.value : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.best && summary.hardest && (
            <p className="text-[11.5px] leading-relaxed mt-2.5" style={{ color: C.subtle }}>
              {extremes.best}: {fmtDay(summary.best.date)} at {summary.best.value} · {" "}
              {extremes.hardest.toLowerCase()}: {fmtDay(summary.hardest.date)} at {summary.hardest.value}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
