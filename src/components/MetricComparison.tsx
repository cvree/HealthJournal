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
   works, and now works truthfully. */

import React from "react";
import {
  Area, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer,
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
  /** One key per field: values[field.k]. */
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

export default function MetricComparison({
  fields, data, palette, tooltipProps, axisTick, chartAnim, fmtShort, fmtNice, bands = [],
}: Props) {
  const ratings = fields.filter(isRating);
  const others = fields.filter((f) => !isRating(f));
  const colorOf = (f: CompareField) => palette[fields.indexOf(f) % palette.length];
  const inset = { left: 34, right: 8 };

  return (
    <div>
      {ratings.length > 0 && (
        <>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 mb-2">
            {ratings.map((f) => (
              <span key={f.k} className="flex items-center gap-1.5 text-[11px]" style={{ color: C.sub }}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(f) }} />
                {f.label}
              </span>
            ))}
          </div>
          <div className="fhj-cmp-plot" style={{ height: 200 }}>
            <ChartBands data={data} bands={bands} inset={inset} />
            <ResponsiveContainer>
              <LineChart data={data} syncId={SYNC} margin={{ top: 8, right: inset.right, left: -2, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} strokeDasharray="2 5" />
                <XAxis dataKey="d" tickFormatter={fmtShort} minTickGap={30}
                  tick={axisTick()} axisLine={false} tickLine={false} tickMargin={8} />
                <YAxis domain={[1, 10]} ticks={[1, 4, 7, 10]}
                  tick={axisTick()} axisLine={false} tickLine={false} width={inset.left} />
                <Tooltip labelFormatter={(d) => fmtNice(String(d))}
                  formatter={(v, name) => {
                    const f = ratings.find((x) => x.k === name);
                    return [v, f ? f.label : String(name)];
                  }}
                  {...tooltipProps()} />
                {ratings.map((f, j) => (
                  <Line key={f.k} type="monotone" dataKey={f.k} stroke={colorOf(f)} strokeWidth={2.25}
                    strokeLinecap="round" strokeLinejoin="round" dot={false}
                    activeDot={{ r: 4, fill: colorOf(f), stroke: C.card, strokeWidth: 2 }}
                    connectNulls {...chartAnim()} animationBegin={j * 90} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {ratings.length > 1 && (
            <div className="fhj-caption mt-1.5">
              All on the same 1–10 scale, so heights are comparable.
            </div>
          )}
        </>
      )}

      {others.map((f, j) => {
        const fadeId = `fhjCmpFade_${f.k.replace(/\W/g, "_")}`;
        const color = colorOf(f);
        return (
          <div key={f.k} className={ratings.length || j ? "mt-4" : ""}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="flex items-center gap-1.5 text-[11px] min-w-0" style={{ color: C.sub }}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="truncate">{f.label}</span>
              </span>
              {f.unit && (
                <span className="text-[10px] shrink-0" style={{ color: C.subtle }}>{f.unit}</span>
              )}
            </div>
            <div className="fhj-cmp-plot" style={{ height: 104 }}>
              <ChartBands data={data} bands={bands} inset={inset} />
              <ResponsiveContainer>
                <ComposedChart data={data} syncId={SYNC} margin={{ top: 6, right: inset.right, left: -2, bottom: 0 }}>
                  <defs>
                    <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} vertical={false} strokeDasharray="2 5" />
                  {/* The date axis is drawn once, under the last chart: three
                      identical rows of dates is three times the ink for the
                      same information, and the crosshair already ties them. */}
                  <XAxis dataKey="d" tickFormatter={fmtShort} minTickGap={30}
                    tick={j === others.length - 1 ? axisTick() : false}
                    height={j === others.length - 1 ? 24 : 4}
                    axisLine={false} tickLine={false} tickMargin={8} />
                  <YAxis domain={["auto", "auto"]} tick={axisTick()} axisLine={false}
                    tickLine={false} width={inset.left} />
                  <Tooltip labelFormatter={(d) => fmtNice(String(d))}
                    formatter={(v) => [f.unit ? `${v} ${f.unit}` : v, f.label]}
                    {...tooltipProps()} />
                  {/* The line already carries this series into the tooltip; without
                      `tooltipType="none"` the fill under it prints the value a
                      second time. */}
                  <Area type="monotone" dataKey={f.k} stroke="none" fill={`url(#${fadeId})`}
                    tooltipType="none" connectNulls {...chartAnim()} />
                  <Line type="monotone" dataKey={f.k} stroke={color} strokeWidth={2}
                    strokeLinecap="round" dot={false}
                    activeDot={{ r: 4, fill: color, stroke: C.card, strokeWidth: 2 }}
                    connectNulls {...chartAnim()} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}

      {others.length > 0 && (
        <div className="fhj-caption mt-2">
          {others.length === 1
            ? "That one has its own unit, so it gets its own axis."
            : "Those have their own units, so each gets its own axis."}
          {" "}Touch any chart — the crosshair moves across all of them on the same day.
        </div>
      )}
    </div>
  );
}
