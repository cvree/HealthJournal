/* The trend chart, which is also the comparison, and is drawn the way the
   reader asked for it.

   Three ideas stacked on each other, in the order they were learned:

   1. **Never put two units on one axis.** The old chart put every selected
      metric on one pair of axes and printed a note underneath asking the
      reader to "compare shapes, not heights". With severity on 1–10 and step
      count in the thousands the severity line is flat against the bottom edge;
      worse, weight in kg and severity 1–10 land in the *same* numeric range,
      so the chart looks perfectly reasonable and is meaningless. Metrics that
      genuinely share a scale — the 1–10 ratings — share one chart. Everything
      else gets its own, at the same width, on the same dates, with one
      crosshair moving across all of them (recharts' `syncId`).

   2. **Draw everything that was pinned.** This absorbed the old MainTrendChart,
      which drew the first pinned metric and left the other three changing the
      colour of a chip. `primaryKey` is the metric the screen is about: it
      leads, it is drawn tallest and heaviest, and its 7-day average is the one
      dashed in behind it.

   3. **How it is drawn is a choice.** See src/lib/chartView.ts. Line, filled,
      steps or bare dots; the average behind, off, or instead; gaps bridged or
      left open; one shared axis or one chart each; the full 1–10 or an axis
      fitted to the data. The last of those is the only one that can mislead,
      so while it is on the chart prints what it did. */

import React from "react";
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { C } from "../lib/theme";
import {
  avgKeyOf, curveOf, DEFAULT_CHART_VIEW, type ChartView,
} from "../lib/chartView";

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
  /** field.k → that day's value, plus `avg~field.k` → its trailing 7-day mean. */
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
  /** The metric the screen is about. Defaults to the first field. */
  primaryKey?: string;
  /** How the reader asked for it. */
  view?: ChartView;
  /** Height of the primary's chart — taller when this is the screen's main one. */
  mainHeight?: number;
  /** Height of every other chart in the stack. */
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

/** One dot and a name. Every chart is labelled in place rather than by a
    legend off to one side, because the stack can be five charts tall. */
function Key({ color, label, faded }: { color: string; label: string; faded?: boolean }) {
  return (
    <span className="fhj-cmp-key" style={{ color: faded ? C.subtle : C.sub }}>
      <span className="fhj-cmp-key-dot" style={{ background: color }} />
      <span className="truncate">{label}</span>
    </span>
  );
}

type Panel = {
  id: string;
  fields: CompareField[];
  rating: boolean;
  unit?: string;
  lead: boolean;
};

export default function MetricComparison({
  fields, data, palette, tooltipProps, axisTick, chartAnim, fmtShort, fmtNice,
  bands = [], primaryKey, view = DEFAULT_CHART_VIEW, mainHeight = 200,
  subHeight = 104, renderEmpty, note,
}: Props) {
  const colorOf = (f: CompareField) => palette[fields.indexOf(f) % palette.length];
  const primary = fields.find((f) => f.k === primaryKey) || fields[0];
  const isPrimary = (f: CompareField) => !!primary && f.k === primary.k;
  const inset = { left: 34, right: 8 };

  /** How many days of this metric are actually in the window. */
  const points = (k: string) =>
    data.reduce((n, r) => n + (typeof r[k] === "number" ? 1 : 0), 0);
  /** A line needs three days before it is a line rather than a coincidence. */
  const drawable = (f: CompareField) => points(f.k) >= 3;

  const ratings = fields.filter(isRating);
  const others = fields.filter((f) => !isRating(f));

  /* One panel per axis. Apart: every metric gets its own. Together: the
     ratings share theirs, and each own-unit metric keeps its own regardless —
     that part was never a preference. */
  const panels: Panel[] = view.apart
    ? fields.map((f) => ({
        id: f.k, fields: [f], rating: isRating(f), unit: f.unit, lead: isPrimary(f),
      }))
    : [
        ...(ratings.length
          ? [{ id: "__ratings", fields: ratings, rating: true, lead: ratings.some(isPrimary) }]
          : []),
        ...others.map((f) => ({
          id: f.k, fields: [f], rating: false, unit: f.unit, lead: isPrimary(f),
        })),
      ];
  /* The chart the screen is about goes first. Without this, picking an
     own-unit metric as the primary buried it under the ratings. */
  const ordered = [...panels].sort((a, b) => Number(b.lead) - Number(a.lead));

  const drawn = ordered.filter((p) => p.fields.some(drawable));
  const lastDrawn = drawn.length ? drawn[drawn.length - 1].id : null;

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

  /* Fitting the axis to the data is a real request and a real risk, so it is
     only ever applied to the 1–10 charts (own-unit charts have always been
     auto-scaled — there is no "full scale" for kilograms) and it says so. */
  const fitted = (p: Panel): [number, number] | null => {
    if (!p.rating || !view.zoom) return null;
    let lo = Infinity, hi = -Infinity;
    for (const r of data) {
      for (const f of p.fields) {
        const v = r[f.k];
        if (typeof v === "number") { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      }
    }
    if (!isFinite(lo) || !isFinite(hi)) return null;
    lo = Math.max(1, Math.floor(lo) - 1);
    hi = Math.min(10, Math.ceil(hi) + 1);
    return hi - lo >= 2 ? [lo, hi] : null;
  };

  const curve = curveOf(view.shape);
  const bare = view.shape === "dots";
  const filled = view.shape === "area";
  const connect = !view.breakGaps;
  const dotted = data.length <= 62;

  const labelFor = (name: string): string => {
    for (const f of fields) {
      if (name === f.k) return f.label;
      if (name === avgKeyOf(f.k)) {
        return fields.length > 1 ? `${f.label} · 7-day avg` : "7-day avg";
      }
    }
    return name;
  };

  return (
    <div>
      {ordered.map((p, pi) => {
        const usable = p.fields.filter(drawable);
        const lead = p.lead;
        const height = lead ? mainHeight : subHeight;
        const range = fitted(p);
        const showDates = p.id === lastDrawn;

        return (
          <div key={p.id} className={pi ? "mt-4" : ""}>
            <div className={"fhj-cmp-keys" + (p.unit ? " fhj-cmp-keys-row" : "")}>
              <span className="fhj-cmp-keyset">
                {p.fields.map((f) => (
                  <Key key={f.k} color={colorOf(f)} label={f.label} faded={!drawable(f)} />
                ))}
              </span>
              {p.unit && (
                <span className="text-[10px] shrink-0" style={{ color: C.subtle }}>{p.unit}</span>
              )}
            </div>

            {usable.length === 0 ? (
              empty(thinLine(p.fields.find(isPrimary) || p.fields[0]), height)
            ) : (
              <div className="fhj-cmp-plot" style={{ height }}>
                <ChartBands data={data} bands={bands} inset={inset} />
                <ResponsiveContainer>
                  <ComposedChart data={data} syncId={SYNC}
                    margin={{ top: 10, right: inset.right, left: -2, bottom: 0 }}>
                    <defs>
                      {usable.map((f) => (
                        <linearGradient key={f.k} id={`fhjCmpFade_${p.id}_${f.k}`.replace(/\W/g, "_")}
                          x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={colorOf(f)}
                            stopOpacity={usable.length > 1 ? 0.14 : 0.22} />
                          <stop offset="100%" stopColor={colorOf(f)} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid stroke={C.grid} vertical={false} strokeDasharray="2 5" />
                    {/* The date axis is drawn once, under the last chart: five
                        identical rows of dates is five times the ink for the
                        same information, and the crosshair already ties them. */}
                    <XAxis dataKey="d" tickFormatter={fmtShort} minTickGap={30}
                      tick={showDates ? axisTick() : false} height={showDates ? 24 : 4}
                      axisLine={false} tickLine={false} tickMargin={8} />
                    <YAxis
                      domain={p.rating ? (range || [1, 10]) : ["auto", "auto"]}
                      ticks={p.rating && !range ? [1, 4, 7, 10] : undefined}
                      allowDecimals={!p.rating}
                      tick={axisTick()} axisLine={false} tickLine={false} width={inset.left} />
                    <Tooltip labelFormatter={(d) => fmtNice(String(d))}
                      formatter={(v, name) => {
                        const f = p.fields.find((x) => x.k === name || avgKeyOf(x.k) === name);
                        return [f?.unit ? `${v} ${f.unit}` : v, labelFor(String(name))];
                      }}
                      {...tooltipProps()} />

                    {/* Fills first, so every line sits on top of every wash. The fill
                        follows whatever the line is drawing — the daily values,
                        or their average when that is all that is on screen. */}
                    {filled && usable.map((f) => (
                      <Area key={`a_${f.k}`} type={curve}
                        dataKey={view.avg === "only" ? avgKeyOf(f.k) : f.k} stroke="none"
                        fill={`url(#${`fhjCmpFade_${p.id}_${f.k}`.replace(/\W/g, "_")})`}
                        tooltipType="none" connectNulls={connect} {...chartAnim()} />
                    ))}

                    {/* The average, behind the day-to-day line and quieter than
                        it — it is the direction, not the reading. */}
                    {view.avg === "on" && usable.filter(isPrimary).map((f) => (
                      <Line key={`v_${f.k}`} type="monotone" dataKey={avgKeyOf(f.k)}
                        stroke={C.avgLine} strokeWidth={1.5} strokeOpacity={0.85}
                        strokeDasharray="4 5" dot={false} connectNulls {...chartAnim()} />
                    ))}

                    {usable.map((f, j) => {
                      const color = colorOf(f);
                      const heavy = isPrimary(f);
                      /* "Only" swaps each metric's daily line for its own
                         7-day average — the same chart, smoothed, rather than
                         one dashed line and three raw ones. */
                      const key = view.avg === "only" ? avgKeyOf(f.k) : f.k;
                      return (
                        <Line key={`l_${f.k}`} type={curve} dataKey={key} stroke={color}
                          strokeWidth={bare ? 0 : heavy ? 2.5 : 2}
                          strokeOpacity={bare ? 0 : heavy || usable.length === 1 ? 1 : 0.78}
                          strokeLinecap="round" strokeLinejoin="round"
                          /* A dot per day is fine over a month and is 365 marks
                             over a year — so they are the reader's choice, or
                             the lead line's alone on a short window. */
                          dot={bare
                            ? { r: 2.2, fill: color, strokeWidth: 0 }
                            : heavy && dotted && usable.length === 1
                              ? { r: 2, fill: color, strokeWidth: 0 }
                              : false}
                          activeDot={{ r: heavy ? 5 : 4, fill: color, stroke: C.card, strokeWidth: 2 }}
                          connectNulls={connect} {...chartAnim()} animationBegin={j * 90} />
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* What this particular chart is doing, said under it. */}
            {usable.length > 0 && (range || (p.rating && usable.length > 1) || (lead && note)) && (
              <div className="fhj-caption mt-1.5">
                {range && (
                  <>
                    Axis fitted to {range[0]}–{range[1]} of 1–10, so differences look
                    bigger than they are.{" "}
                  </>
                )}
                {p.rating && usable.length > 1 && !range && (
                  <>All on the same 1–10 scale, so heights are comparable. </>
                )}
                {lead && note}
              </div>
            )}
          </div>
        );
      })}

      {others.length > 0 && !view.apart && (
        <div className="fhj-caption mt-2">
          {others.length === 1
            ? "That one has its own unit, so it gets its own axis."
            : "Those have their own units, so each gets its own axis."}
          {fields.length > 1 && " Touch any chart — the crosshair moves across all of them on the same day."}
        </div>
      )}
      {view.apart && fields.length > 1 && (
        <div className="fhj-caption mt-2">
          One chart each, on the same dates. Touch any of them — the crosshair
          moves across all of them on the same day.
        </div>
      )}
    </div>
  );
}
