/* The main trend chart, rebuilt.

   What was wrong with the old one, in the order it mattered:

   · **It joined across missing days.** `connectNulls` drew a straight line
     from Monday's 8 to Friday's 3, which reads as four days of steady
     improvement that nobody logged. A day nobody logged is now a gap you can
     see, and the caption says so.
   · **The rolling average was the thin dashed line.** The 7-day average is the
     answer to "how am I doing"; the daily value is the texture around it. So
     the rolling line is now the bold one and the daily values sit behind it,
     which is also the reading order of the tooltip.
   · **There was no way to see a longer trend.** An optional 30-day average
     answers "is this month better than last month" without changing the range.
   · **The tooltip was Recharts' default**: a value and a key name, on a panel
     that ignored the theme, with no date you could act on and no sight of the
     note you wrote that day. The note is usually the answer to "why was that
     day an 8", and it was one tap away on a different screen.

   Touch is the first-class input: the container claims horizontal gestures and
   leaves vertical ones to the page, so scrubbing a day's values never fights
   scrolling the screen. */

import React, { useMemo, useState } from "react";
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { C } from "../lib/theme";
import { prefersReducedMotion } from "../lib/motion";
import { SCALE_MAX, SCALE_MIN } from "../lib/analytics";
import { formatAverage, type MetricInfo, type TrendRow } from "../lib/insights";

type Props = {
  rows: TrendRow[];
  metric: MetricInfo;
  /** The metric's own colour — the app's accent, or the user's tint. */
  color: string;
  /** A sentence describing the same figures, for assistive tech. */
  description: string;
  /** Start with the 30-day average drawn. Off by default: two rolling lines on
      a 7-day range is more ink than information. */
  show30?: boolean;
  /** True for a 1–10 question, which fixes the axis to the whole scale so two
      calm weeks don't get magnified into a crisis by an auto axis. */
  scale?: boolean;
  height?: number;
};

/** The panel shown while a finger is on the chart. Reading order: which day,
    what you scored, what the averages were around it, what you wrote. */
function TrendTooltip({
  active, payload, color, metric, show30,
}: {
  active?: boolean;
  payload?: { payload: TrendRow }[];
  color: string;
  metric: MetricInfo;
  show30: boolean;
}) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  if (!row) return null;
  const unit = metric.unit ? ` ${metric.unit}` : "";
  return (
    <div className="fhj-trend-tip">
      <div className="fhj-trend-tip-date">{row.longLabel}</div>
      <div className="fhj-trend-tip-row">
        <span className="fhj-trend-tip-swatch" style={{ background: color }} />
        <span>{metric.label}</span>
        <span className="fhj-trend-tip-value">
          {row.value != null ? `${row.value}${unit}` : "not logged"}
        </span>
      </div>
      <div className="fhj-trend-tip-row">
        <span className="fhj-trend-tip-swatch" style={{ background: color, opacity: 0.45 }} />
        <span>7-day average</span>
        <span className="fhj-trend-tip-value">
          {row.rolling7 != null ? formatAverage(row.rolling7, 1) : "—"}
        </span>
      </div>
      {show30 && (
        <div className="fhj-trend-tip-row">
          <span className="fhj-trend-tip-swatch" style={{ background: C.avgLine }} />
          <span>30-day average</span>
          <span className="fhj-trend-tip-value">
            {row.rolling30 != null ? formatAverage(row.rolling30, 1) : "—"}
          </span>
        </div>
      )}
      {row.note && <div className="fhj-trend-tip-note">“{row.note}”</div>}
    </div>
  );
}

/** One of the layer toggles under the chart. Doubles as the legend: the line
    it draws is the mark on the chip, so nothing has to be matched up by
    memory. */
function LayerKey({
  on, onToggle, label, color, dashed = false, locked = false,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  color: string;
  dashed?: boolean;
  locked?: boolean;
}) {
  const mark = (
    <span
      className="fhj-trend-key-mark"
      style={{ borderTopColor: color, borderTopStyle: dashed ? "dashed" : "solid" }}
      aria-hidden="true"
    />
  );
  if (locked) {
    return (
      <span className="fhj-trend-key is-on" style={{ cursor: "default" }}>
        {mark}{label}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={"fhj-trend-key" + (on ? " is-on" : "")}
    >
      {mark}{label}
    </button>
  );
}

export default function MetricTrendChart({
  rows, metric, color, description, show30 = false, scale, height = 224,
}: Props) {
  const [showDaily, setShowDaily] = useState(true);
  const [show30d, setShow30d] = useState(show30);

  const logged = useMemo(() => rows.filter((r) => r.value != null).length, [rows]);
  const gaps = rows.length - logged;
  const isScale = scale ?? metric.scale ?? metric.unit == null;

  const anim = prefersReducedMotion()
    ? { isAnimationActive: false as const }
    : { isAnimationActive: true as const, animationDuration: 620, animationEasing: "ease-out" as const };

  if (logged === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center px-6 rounded-xl"
        style={{ height, background: C.faint, border: `1.5px dashed ${C.line}` }}
      >
        <div className="text-sm" style={{ color: C.sub }}>
          No “{metric.label}” answers in this range.
        </div>
        <div className="fhj-caption mt-1">Pick a longer range, or log today.</div>
      </div>
    );
  }

  /* Gradient ids have to be unique per chart or a second chart on the page
     inherits the first one's fill. */
  const fadeId = `fhjTrend_${String(metric.k).replace(/\W/g, "_")}`;

  return (
    <div>
      <div className="fhj-trend" style={{ width: "100%", height }} role="img" aria-label={description}>
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 10, right: 8, left: -2, bottom: 0 }}>
            <defs>
              <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.grid} vertical={false} strokeDasharray="2 5" />
            <XAxis
              dataKey="label"
              minTickGap={34}
              tick={{ fontSize: 10, fill: C.subtle }}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              domain={isScale ? [SCALE_MIN, SCALE_MAX] : ["auto", "auto"]}
              ticks={isScale ? [1, 4, 7, 10] : undefined}
              tick={{ fontSize: 10, fill: C.subtle }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              /* A crosshair rather than a shaded band: on a 340px-wide chart a
                 band covers three days and the reader can't tell which one the
                 panel is describing. */
              cursor={{ stroke: C.lineStrong, strokeWidth: 1.5, strokeDasharray: "3 4" }}
              wrapperStyle={{ outline: "none", zIndex: 20 }}
              content={
                <TrendTooltip color={color} metric={metric} show30={show30d} /> as React.ReactElement
              }
            />
            {/* The wash sits under the *rolling* line, not the daily one. Under
                the daily values it has to stop and restart at every gap, and
                each restart draws a vertical edge down to the axis — two of
                those in a month read as mysterious dark columns. The rolling
                line is continuous, so its fill is too. */}
            <Area
              type="monotone"
              dataKey="rolling7"
              stroke="none"
              fill={`url(#${fadeId})`}
              connectNulls
              {...anim}
            />
            {show30d && (
              <Line
                type="monotone"
                dataKey="rolling30"
                stroke={C.avgLine}
                strokeWidth={1.75}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
                {...anim}
              />
            )}
            {showDaily && (
              /* Daily values sit *behind* the average, thinner and quieter: they
                 are the texture, not the answer. Dots are drawn on every logged
                 day so a day standing alone between two gaps is still visible —
                 without them an isolated reading draws nothing at all. */
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeOpacity={0.5}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={{ r: 2, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 5.5, fill: color, stroke: C.card, strokeWidth: 2.5 }}
                connectNulls={false}
                {...anim}
              />
            )}
            <Line
              type="monotone"
              dataKey="rolling7"
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 4.5, fill: color, stroke: C.card, strokeWidth: 2 }}
              connectNulls
              {...anim}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="fhj-trend-keys">
        <LayerKey locked on label="7-day average" color={color} onToggle={() => {}} />
        <LayerKey on={showDaily} onToggle={() => setShowDaily((v) => !v)} label="Daily" color={color} />
        <LayerKey on={show30d} onToggle={() => setShow30d((v) => !v)} label="30-day average" color={C.avgLine} dashed />
      </div>

      <div className="fhj-caption mt-2">
        {gaps > 0
          ? `Touch the chart for a day's values · ${gaps === 1
              ? "1 day with nothing logged is left as a gap"
              : `${gaps} days with nothing logged are left as gaps`}`
          : "Touch the chart for a day's values · every day in this range is logged"}
      </div>
    </div>
  );
}
