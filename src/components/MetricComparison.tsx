/* Comparing metrics without lying about the axis.

   The old chart put every selected metric on one pair of axes and, when the
   units did not match, printed a note underneath asking the reader to "compare
   shapes, not heights". That note was doing work the chart should have done:
   with severity on 1–10 and step count in the thousands, the severity line is
   flat against the bottom edge and any relationship between them is invisible.
   Worse, weight in kg and severity 1–10 land in the *same* numeric range, so
   the chart looks perfectly reasonable and is completely meaningless.

   So: metrics that genuinely share a scale — the 1–10 ratings — share one chart
   with a fixed 1–10 axis, which is the only honest overlay in this app. Anything
   with its own unit gets its own small chart underneath, each with its own axis
   and its own label, all of them the same width and stacked on the same dates.
   One crosshair moves across all of them at once (recharts' `syncId`), so the
   thing an overlay was for — "what was happening on the day that spiked" — still
   works, and now works truthfully.

   This is also the Trend chart. It used to be a separate component that drew
   the primary metric and nothing else, which meant pinning four metrics and
   then watching one line — the picker above it promised a comparison the chart
   never made. The two are now one thing: `primaryKey` marks the metric the
   screen is about, and it is the one drawn heaviest, with its 7-day average
   dashed behind it. Everything else pinned is drawn beside it, on a shared
   axis where that is honest and on its own axis where it isn't. */

import React from "react";
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { C } from "../lib/theme";

export interface CompareField {
  k: string;
  label: string;
  type?: string;
  unit?: string;
  dir?: string;
}

export interface CompareRow {
  /** YYYY-MM-DD. */
  d: string;
  /** One key per field: values[field.k], plus the primary's rolling average. */
  [k: string]: string | number | null;
}

type Props = {
  fields: CompareField[];
  /** One row per date in the window, values keyed by field key. */
  data: CompareRow[];
  palette: string[];
  /** Shared with the rest of the app's charts. */
  tooltipProps: () => Record<string, unknown>;
  axisTick: () => Record<string, unknown>;
  chartAnim: () => Record<string, unknown>;
  fmtShort: (d: string) => string;
  fmtNice: (d: string) => string;
  /** Drawn behind every chart, so an episode lines up across all of them. */
  bands?: { id: string; from: string; to: string; open: boolean }[];
  /** The metric the screen is about: drawn heaviest, and the one whose 7-day
      average is dashed in behind it. Defaults to the first field. */
  primaryKey?: string;
  /** Row key holding the primary's rolling average, when there is one. */
  avgKey?: string;
  /** Height of the top chart — taller when this is the screen's main chart. */
  mainHeight?: number;
  /** Height of each own-unit chart underneath. */
  subHeight?: number;
  /** The app's chart empty state, so a thin window says so in the usual shape. */
  renderEmpty?: (title: string, height: number) => React.ReactNode;
  /** Printed under the primary's own chart — what its lines mean, in words. */
  note?: React.ReactNode;
};

const SYNC = "fhjCompare";

/** Is this metric on the 1–10 rating scale everything else in the app uses? */
export const isRating = (f: CompareField): boolean => f.type === "scale";

/** Episode shading, drawn as a plain SVG overlay rather than recharts
    ReferenceAreas: the bands have to sit behind the grid on every chart in the
    stack, and an overlay positioned from the same date arithmetic is both
    simpler and identical across charts of different heights. */
export function ChartBands({ data, bands, inset }: {
  data: CompareRow[];
  bands: NonNullable<Props["bands"]>;
  inset: { left: number; right: number };
}) {
  if (!bands.length || data.length < 2) return null;
  const index = new Map(data.map((r, i) => [r.d, i]));
  const last = data.length - 1;
  return (
    <div className="fhj-cmp-bands" aria-hidden="true"
      style={{ left: inset.left, right: inset.right }}>
      {bands.map((b) => {
        const a = index.get(b.from), z = index.get(b.to);
        if (a == null || z == null) return null;
        const left = (a / last) * 100;
        const width = Math.max(0.8, ((z - a) / last) * 100);
        return (
          <span key={b.id} style={{
            left: `${left}%`, width: `${width}%`,
            background: b.open ? C.alert : C.bad,
          }} />
        );
      })}
    </div>
  );
}

/** One dot and a name. The only legend this file draws — the charts below it
    are labelled in place, because a legend for a single line is furniture. */
function Key({ color, label, unit, faded }: {
  color: string; label: string; unit?: string; faded?: boolean;
}) {
  return (
    <span className="fhj-cmp-key" style={{ color: faded ? C.subtle : C.sub }}>
      <span className="fhj-cmp-key-dot" style={{ background: color }} />
      <span className="truncate">{label}</span>
      {unit && <span style={{ color: C.subtle }}>{unit}</span>}
    </span>
  );
}

export default function MetricComparison({
  fields, data, palette, tooltipProps, axisTick, chartAnim, fmtShort, fmtNice,
  bands = [], primaryKey, avgKey = "avg", mainHeight = 200, subHeight = 104,
  renderEmpty, note,
}: Props) {
  const ratings = fields.filter(isRating);
  const others = fields.filter((f) => !isRating(f));
  const colorOf = (f: CompareField) => palette[fields.indexOf(f) % palette.length];
  const primary = fields.find((f) => f.k === primaryKey) || fields[0];
  const isPrimary = (f: CompareField) => !!primary && f.k === primary.k;
  const inset = { left: 34, right: 8 };

  /** How many days of this metric are actually in the window. */
  const points = (k: string) =>
    data.reduce((n, r) => n + (typeof r[k] === "number" ? 1 : 0), 0);
  /** A line needs three days before it is a line rather than a coincidence. */
  const drawable = (f: CompareField) => points(f.k) >= 3;

  const hasAvg = data.some((r) => typeof r[avgKey] === "number");
  /* The dashed average belongs to the primary metric, so it is drawn on
     whichever of the two chart kinds the primary lives on. */
  const avgOnRatings = hasAvg && !!primary && isRating(primary);

  const empty = (title: string, height: number) =>
    renderEmpty ? renderEmpty(title, height) : (
      <div className="fhj-cmp-empty" style={{ height }}>{title}</div>
    );

  const thinLine = (f: CompareField) => {
    const n = points(f.k);
    return n === 0
      ? `No “${f.label}” answers in this range.`
      : `Only ${n} day${n === 1 ? "" : "s"} of “${f.label}” here — the line appears at 3.`;
  };

  const plottedRatings = ratings.filter(drawable);
  /* A single rating carries a soft fill under it; four overlaid do not, because
     four translucent washes stacked on one axis is a colour nobody chose. */
  const fillPrimary = plottedRatings.length === 1 && !!primary && isRating(primary);
  const fadeId = `fhjCmpMain_${String(primary?.k || "x").replace(/\W/g, "_")}`;
  const dotted = data.length <= 62;

  return (
    <div>
      {ratings.length > 0 && (
        <>
          <div className="fhj-cmp-keys">
            {ratings.map((f) => (
              <Key key={f.k} color={colorOf(f)} label={f.label} faded={!drawable(f)} />
            ))}
          </div>
          {plottedRatings.length === 0 ? (
            empty(thinLine(ratings.find(isPrimary) || ratings[0]), mainHeight)
          ) : (
            <div className="fhj-cmp-plot" style={{ height: mainHeight }}>
              <ChartBands data={data} bands={bands} inset={inset} />
              <ResponsiveContainer>
                <ComposedChart data={data} syncId={SYNC}
                  margin={{ top: 10, right: inset.right, left: -2, bottom: 0 }}>
                  <defs>
                    <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={primary ? colorOf(primary) : C.accent} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={primary ? colorOf(primary) : C.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} vertical={false} strokeDasharray="2 5" />
                  <XAxis dataKey="d" tickFormatter={fmtShort} minTickGap={30}
                    tick={axisTick()} axisLine={false} tickLine={false} tickMargin={8} />
                  <YAxis domain={[1, 10]} ticks={[1, 4, 7, 10]}
                    tick={axisTick()} axisLine={false} tickLine={false} width={inset.left} />
                  <Tooltip labelFormatter={(d) => fmtNice(String(d))}
                    formatter={(v, name) => {
                      if (name === avgKey) return [v, "7-day avg"];
                      const f = ratings.find((x) => x.k === name);
                      return [v, f ? f.label : String(name)];
                    }}
                    {...tooltipProps()} />
                  {/* tooltipType="none": the line below already reports this
                      series, and the fill would print it a second time. */}
                  {fillPrimary && primary && (
                    <Area type="monotone" dataKey={primary.k} stroke="none" fill={`url(#${fadeId})`}
                      tooltipType="none" connectNulls {...chartAnim()} />
                  )}
                  {avgOnRatings && (
                    <Line type="monotone" dataKey={avgKey} stroke={C.avgLine} strokeWidth={1.5}
                      strokeOpacity={0.85} strokeDasharray="4 5" dot={false} connectNulls
                      {...chartAnim()} />
                  )}
                  {plottedRatings.map((f, j) => {
                    const lead = isPrimary(f);
                    const color = colorOf(f);
                    return (
                      <Line key={f.k} type="monotone" dataKey={f.k} stroke={color}
                        strokeWidth={lead ? 2.5 : 2}
                        strokeOpacity={lead || plottedRatings.length === 1 ? 1 : 0.78}
                        strokeLinecap="round" strokeLinejoin="round"
                        /* A dot per day is fine over a month and is 365 marks
                           over a year — and only the lead line earns them once
                           there is more than one. */
                        dot={lead && dotted && plottedRatings.length === 1
                          ? { r: 2, fill: color, strokeWidth: 0 } : false}
                        activeDot={{ r: lead ? 5 : 4, fill: color, stroke: C.card, strokeWidth: 2 }}
                        connectNulls {...chartAnim()} animationBegin={j * 90} />
                    );
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {(note && avgOnRatings) || (ratings.length > 1 && plottedRatings.length > 1) ? (
            <div className="fhj-caption mt-1.5">
              {ratings.length > 1 && plottedRatings.length > 1 && (
                <>All on the same 1–10 scale, so heights are comparable. </>
              )}
              {avgOnRatings && note}
            </div>
          ) : null}
        </>
      )}

      {others.map((f, j) => {
        const subFadeId = `fhjCmpFade_${f.k.replace(/\W/g, "_")}`;
        const color = colorOf(f);
        const lead = isPrimary(f);
        const last = j === others.length - 1;
        return (
          <div key={f.k} className={ratings.length || j ? "mt-4" : ""}>
            <div className="fhj-cmp-keys fhj-cmp-keys-row">
              <Key color={color} label={f.label} faded={!drawable(f)} />
              {f.unit && (
                <span className="text-[10px] shrink-0" style={{ color: C.subtle }}>{f.unit}</span>
              )}
            </div>
            {!drawable(f) ? (
              empty(thinLine(f), subHeight)
            ) : (
              <div className="fhj-cmp-plot" style={{ height: lead ? mainHeight : subHeight }}>
                <ChartBands data={data} bands={bands} inset={inset} />
                <ResponsiveContainer>
                  <ComposedChart data={data} syncId={SYNC} margin={{ top: 6, right: inset.right, left: -2, bottom: 0 }}>
                    <defs>
                      <linearGradient id={subFadeId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.grid} vertical={false} strokeDasharray="2 5" />
                    {/* The date axis is drawn once, under the last chart: three
                        identical rows of dates is three times the ink for the
                        same information, and the crosshair already ties them. */}
                    <XAxis dataKey="d" tickFormatter={fmtShort} minTickGap={30}
                      tick={last ? axisTick() : false}
                      height={last ? 24 : 4}
                      axisLine={false} tickLine={false} tickMargin={8} />
                    <YAxis domain={["auto", "auto"]} tick={axisTick()} axisLine={false}
                      tickLine={false} width={inset.left} />
                    <Tooltip labelFormatter={(d) => fmtNice(String(d))}
                      formatter={(v, name) => (name === avgKey
                        ? [f.unit ? `${v} ${f.unit}` : v, "7-day avg"]
                        : [f.unit ? `${v} ${f.unit}` : v, f.label])}
                      {...tooltipProps()} />
                    <Area type="monotone" dataKey={f.k} stroke="none" fill={`url(#${subFadeId})`}
                      tooltipType="none" connectNulls {...chartAnim()} />
                    {lead && hasAvg && !avgOnRatings && (
                      <Line type="monotone" dataKey={avgKey} stroke={C.avgLine} strokeWidth={1.5}
                        strokeOpacity={0.85} strokeDasharray="4 5" dot={false} connectNulls
                        {...chartAnim()} />
                    )}
                    <Line type="monotone" dataKey={f.k} stroke={color} strokeWidth={lead ? 2.5 : 2}
                      strokeLinecap="round" strokeLinejoin="round"
                      dot={lead && dotted ? { r: 2, fill: color, strokeWidth: 0 } : false}
                      activeDot={{ r: lead ? 5 : 4, fill: color, stroke: C.card, strokeWidth: 2 }}
                      connectNulls {...chartAnim()} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            {lead && note && !avgOnRatings && <div className="fhj-caption mt-1.5">{note}</div>}
          </div>
        );
      })}

      {others.length > 0 && (
        <div className="fhj-caption mt-2">
          {others.length === 1
            ? "That one has its own unit, so it gets its own axis."
            : "Those have their own units, so each gets its own axis."}
          {fields.length > 1 && " Touch any chart — the crosshair moves across all of them on the same day."}
        </div>
      )}
    </div>
  );
}
