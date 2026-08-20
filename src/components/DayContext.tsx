/* The weather, living behind a day.

   Three pieces, all small, all optional, all designed to be *ignorable*:

   · `SkyGlyph` — eight shapes, drawn as line art at the size of a letter. Not
     an icon set. A day that was overcast should read as overcast out of the
     corner of an eye and never compete with the number the person logged.
   · `ContextWash` — the layer that sits behind a timeline day or a history
     row. Its colour comes from the day's own temperature and its opacity from
     how far that temperature sits from this journal's own middle, so an
     ordinary day is almost invisible and a 34°C one is not. That is the whole
     trick: the data decides how loud it is.
   · `ContextStrip` — the readable version, for when somebody actually wants
     the numbers.

   Everything here degrades to nothing when there is no context record, which
   is the normal case for anybody who has not switched the feature on. */

import React from "react";
import { C } from "../lib/theme";
import {
  AIR_LABEL, POLLEN_LABEL, airBand, formatTemp, pollenBand, pollenPeak,
  pressureLabel, skyKind, weatherLabel, type DayContext, type SkyKind,
} from "../lib/context";

/* ---------- the glyph ---------- */

export function SkyGlyph({ code, size = 16, color }: { code?: number; size?: number; color?: string }) {
  const kind = skyKind(code);
  if (!kind) return null;
  const stroke = color || C.subtle;
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  const cloud = <path d="M6.5 17.5h10a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-.9A3.3 3.3 0 0 0 6.5 17.5Z" />;
  return (
    <svg {...common} className="fhj-sky-glyph" data-sky={kind}>
      {kind === "clear" && (
        <>
          <circle cx="12" cy="12" r="4" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line
              key={a}
              x1={12 + Math.cos((a * Math.PI) / 180) * 6.5}
              y1={12 + Math.sin((a * Math.PI) / 180) * 6.5}
              x2={12 + Math.cos((a * Math.PI) / 180) * 8.5}
              y2={12 + Math.sin((a * Math.PI) / 180) * 8.5}
            />
          ))}
        </>
      )}
      {kind === "partly" && (
        <>
          <circle cx="9" cy="8.5" r="3" />
          {cloud}
        </>
      )}
      {kind === "cloudy" && cloud}
      {kind === "fog" && (
        <>
          {cloud}
          <line x1="5" y1="20.5" x2="19" y2="20.5" />
        </>
      )}
      {(kind === "drizzle" || kind === "rain") && (
        <>
          {cloud}
          {(kind === "rain" ? [8.5, 12, 15.5] : [10, 14]).map((x) => (
            <line key={x} x1={x} y1="19.5" x2={x - 1.2} y2="22.5" />
          ))}
        </>
      )}
      {kind === "snow" && (
        <>
          {cloud}
          {[9, 12, 15].map((x) => (
            <g key={x}>
              <line x1={x - 1.2} y1="21" x2={x + 1.2} y2="21" />
              <line x1={x} y1="19.8" x2={x} y2="22.2" />
            </g>
          ))}
        </>
      )}
      {kind === "storm" && (
        <>
          {cloud}
          <path d="M13 19l-3 2.5h2.6L11.4 24" />
        </>
      )}
    </svg>
  );
}

export const skyLabel = (code?: number): string => weatherLabel(code);

/* ---------- the wash ---------- */

/** Warm for hot, cool for cold, and quiet in the middle.

    The hue is fixed per band rather than interpolated, because a continuous
    hue ramp behind text is exactly the "meaningless gradient" this product
    doesn't do. The *opacity* is the continuous part, and it is driven by how
    unusual the day was against the journal's own spread — so in a mild climate
    a 26°C day still registers, and in Arizona it does not. */
export function contextWash(
  ctx: DayContext | undefined,
  scale?: { mid: number; spread: number }
): { background: string; opacity: number } | null {
  if (!ctx || ctx.tempMax === undefined) return null;
  const mid = scale?.mid ?? 15;
  const spread = Math.max(4, scale?.spread ?? 10);
  const z = (ctx.tempMax - mid) / spread;
  const strength = Math.min(1, Math.abs(z) / 1.8);
  if (strength < 0.12) return null;
  const warm = z > 0;
  return {
    background: warm
      ? `linear-gradient(100deg, rgba(214,138,74,0.9), rgba(214,138,74,0))`
      : `linear-gradient(100deg, rgba(120,158,214,0.9), rgba(120,158,214,0))`,
    opacity: 0.06 + strength * 0.16,
  };
}

/** How this journal's own temperatures are spread, so the wash can be relative
    to a life rather than to a constant. */
export function washScale(rows: DayContext[]): { mid: number; spread: number } {
  const temps = rows.map((r) => r.tempMax).filter((t): t is number => typeof t === "number");
  if (temps.length < 5) return { mid: 15, spread: 10 };
  const sorted = [...temps].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  return { mid, spread: Math.max(4, (p90 - p10) / 2) };
}

export function ContextWash({ ctx, scale }: { ctx?: DayContext; scale?: { mid: number; spread: number } }) {
  const wash = contextWash(ctx, scale);
  if (!wash) return null;
  return <span className="fhj-ctx-wash" aria-hidden style={wash} />;
}

/* ---------- the readable version ---------- */

type StripProps = {
  ctx?: DayContext;
  units?: "metric" | "imperial";
  /** `line` is one row for a timeline; `full` is the expanded card. */
  variant?: "line" | "full";
};

export function ContextStrip({ ctx, units = "metric", variant = "line" }: StripProps) {
  if (!ctx) return null;
  const pollen = pollenPeak(ctx);
  const air = airBand(ctx.aqi);
  const pb = pollenBand(pollen);
  const pressure = pressureLabel(ctx.pressureChange);

  if (variant === "line") {
    return (
      <div className="fhj-ctx-line">
        <SkyGlyph code={ctx.weatherCode} size={14} />
        {ctx.tempMax !== undefined && <span>{formatTemp(ctx.tempMax, units)}</span>}
        {ctx.humidityMean !== undefined && <span>{Math.round(ctx.humidityMean)}%</span>}
        {pressure && !pressure.endsWith("steady") && <span>{pressure.replace("Pressure ", "")}</span>}
        {ctx.uvMax !== undefined && ctx.uvMax >= 3 && <span>UV {Math.round(ctx.uvMax)}</span>}
      </div>
    );
  }

  return (
    <div className="fhj-ctx-grid">
      <Cell label="Temperature" value={
        ctx.tempMax !== undefined
          ? `${formatTemp(ctx.tempMax, units)}${ctx.tempMin !== undefined ? ` / ${formatTemp(ctx.tempMin, units)}` : ""}`
          : "—"
      } />
      <Cell label="Sky" value={weatherLabel(ctx.weatherCode) || "—"} glyph={<SkyGlyph code={ctx.weatherCode} size={15} />} />
      <Cell label="Humidity" value={ctx.humidityMean !== undefined ? `${Math.round(ctx.humidityMean)}%` : "—"} />
      <Cell
        label="Pressure"
        value={ctx.pressureMean !== undefined ? `${Math.round(ctx.pressureMean)} hPa` : "—"}
        sub={pressure || undefined}
      />
      <Cell label="UV (peak)" value={ctx.uvMax !== undefined ? String(Math.round(ctx.uvMax * 10) / 10) : "—"} />
      <Cell
        label="Daylight"
        value={ctx.daylightMinutes !== undefined
          ? `${Math.floor(ctx.daylightMinutes / 60)}h ${ctx.daylightMinutes % 60}m`
          : "—"}
      />
      {air && (
        <Cell
          label="Air quality"
          value={AIR_LABEL[air]}
          sub={[ctx.pm25 !== undefined ? `PM2.5 ${Math.round(ctx.pm25)}` : null, ctx.pm10 !== undefined ? `PM10 ${Math.round(ctx.pm10)}` : null]
            .filter(Boolean)
            .join(" · ") || undefined}
        />
      )}
      {pb && <Cell label="Pollen" value={POLLEN_LABEL[pb]} sub={pollen !== undefined ? `${Math.round(pollen)} grains/m³` : undefined} />}
      {ctx.precipitation !== undefined && ctx.precipitation > 0 && (
        <Cell label="Rain" value={`${Math.round(ctx.precipitation * 10) / 10} mm`} />
      )}
    </div>
  );
}

function Cell({ label, value, sub, glyph }: { label: string; value: string; sub?: string; glyph?: React.ReactNode }) {
  return (
    <div className="fhj-ctx-cell">
      <div className="fhj-eyebrow">{label}</div>
      <div className="fhj-ctx-val">
        {glyph}
        <span>{value}</span>
      </div>
      {sub && <div className="fhj-ctx-sub">{sub}</div>}
    </div>
  );
}

/* ---------- the temperature trace ----------

   A month of highs and lows as one shape. Deliberately not a chart — no axes,
   no gridlines, no tooltip. It is a texture that says "this is what the
   weather has been doing while you have been logging", and the day the user is
   looking at is the one marked. */

export function TempTrace({
  rows,
  units = "metric",
  height = 46,
  markDate,
  highlight,
}: {
  rows: DayContext[];
  units?: "metric" | "imperial";
  height?: number;
  markDate?: string;
  /** Dates to illuminate — how an insight lights up the weather behind it. */
  highlight?: Set<string>;
}) {
  const points = rows.filter((r) => r.tempMax !== undefined);
  if (points.length < 3) return null;
  const w = 100;
  const highs = points.map((r) => r.tempMax as number);
  const lows = points.map((r) => (r.tempMin ?? r.tempMax) as number);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const span = Math.max(1, max - min);
  const x = (i: number) => (i / Math.max(1, points.length - 1)) * w;
  const y = (v: number) => height - 4 - ((v - min) / span) * (height - 10);

  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const band = `${line(highs)} L${x(points.length - 1).toFixed(2)},${y(lows[lows.length - 1]).toFixed(2)} ${lows
    .map((v, i) => `L${x(points.length - 1 - i).toFixed(2)},${y(lows[lows.length - 1 - i]).toFixed(2)}`)
    .join(" ")} Z`;

  return (
    <svg
      className="fhj-temp-trace"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Temperature between ${formatTemp(min, units)} and ${formatTemp(max, units)} across ${points.length} days`}
    >
      <path d={band} fill={C.accentSoft} stroke="none" />
      <path d={line(highs)} fill="none" stroke={C.clay} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      <path d={line(lows)} fill="none" stroke={C.accentLine} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {highlight &&
        points.map((r, i) =>
          highlight.has(r.date) ? (
            <line key={r.date} x1={x(i)} y1={0} x2={x(i)} y2={height} stroke={C.accent} strokeWidth={1.5} opacity={0.35} vectorEffect="non-scaling-stroke" />
          ) : null
        )}
      {markDate &&
        points.map((r, i) =>
          r.date === markDate ? (
            <circle key={r.date} cx={x(i)} cy={y(r.tempMax as number)} r={2.4} fill={C.ink} />
          ) : null
        )}
    </svg>
  );
}

export type { DayContext, SkyKind };
