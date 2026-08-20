/* The sun's own path, drawn from the sun's own position.

   This is the app's answer to "make the data create the visual experience".
   Nothing in this component is decorative: the curve is the actual elevation
   of the actual sun at this actual latitude on this actual day, sampled every
   ten minutes; the shaded band is the stretch where there is enough UVB to
   make vitamin D; the thicker overlay is the part of it the person has spent
   outside; the disc is where the sun is right now.

   Which means it *looks different in December*, and different in Tromsø from
   in Singapore, without a single conditional about seasons. A flat winter arc
   that barely clears the horizon with no shaded band on it says "there is no
   vitamin D to be had today" better than any sentence could.

   Motion: the sun disc animates along the path while a session runs, at one
   frame every few seconds — the sun moves 15° an hour, so anything faster is
   a lie about the sky. Under `prefers-reduced-motion` it simply sits at the
   right place. */

import React, { useMemo } from "react";
import { C } from "../lib/theme";
import {
  clockLabel, dayLight, daySamples, uvbFraction,
  type Coords,
} from "../lib/solar";

type Props = {
  coords: Coords | null;
  /** The day to draw. */
  day: Date;
  /** Where the sun is now — drawn as the disc. Omit for a day in the past. */
  now?: Date | null;
  /** A session's span, as [start, end] — drawn thicker over the path. */
  span?: [Date, Date] | null;
  /** Cloud cover, so the UV shading is honest about the sky. */
  cloudCover?: number;
  height?: number;
  /** Draw the times under the horizon. */
  labels?: boolean;
  /** The big one on the session screen, versus the small one on a card. */
  variant?: "hero" | "card";
};

const PAD_X = 6;

export default function SolarArc({
  coords, day, now = null, span = null, cloudCover, height = 150, labels = true, variant = "card",
}: Props) {
  const model = useMemo(() => {
    if (!coords) return null;
    const samples = daySamples(day, coords, 10, { cloudCover });
    const light = dayLight(day, coords);
    const peak = Math.max(2, ...samples.map((s) => s.elevation));
    return { samples, light, peak };
  }, [coords?.lat, coords?.lon, day.getFullYear(), day.getMonth(), day.getDate(), cloudCover]);

  if (!model) {
    return (
      <div className="fhj-arc-empty" style={{ height }}>
        <span style={{ color: C.subtle }}>Turn on daily context to draw the sun where you are.</span>
      </div>
    );
  }

  const { samples, light, peak } = model;
  const w = 100;
  const horizon = height - (variant === "hero" ? 30 : 20);
  const top = variant === "hero" ? 22 : 12;
  const x = (d: Date) => PAD_X + ((d.getHours() * 60 + d.getMinutes()) / 1440) * (w - PAD_X * 2);
  const y = (el: number) => horizon - Math.max(0, el / peak) * (horizon - top);

  const above = samples.filter((s) => s.elevation > -1);
  const path = above.map((s, i) => `${i ? "L" : "M"}${x(s.at).toFixed(2)},${y(s.elevation).toFixed(2)}`).join(" ");
  const fill = above.length
    ? `${path} L${x(above[above.length - 1].at).toFixed(2)},${horizon} L${x(above[0].at).toFixed(2)},${horizon} Z`
    : "";

  /* The vitamin D band: contiguous samples with usable UVB. Drawn as a region
     under the curve rather than a highlight on it, because what it marks is a
     window of *time*, and time is the horizontal axis. */
  const uvbRows = samples.filter((s) => uvbFraction(s.elevation) > 0.02);
  const uvbSpan = uvbRows.length > 1 ? ([uvbRows[0].at, uvbRows[uvbRows.length - 1].at] as const) : null;

  const spanRows =
    span && span[1] > span[0]
      ? samples.filter((s) => s.at >= span[0] && s.at <= span[1])
      : [];
  const spanPath = spanRows.length > 1
    ? spanRows.map((s, i) => `${i ? "L" : "M"}${x(s.at).toFixed(2)},${y(s.elevation).toFixed(2)}`).join(" ")
    : "";

  const nowSample = now
    ? { at: now, elevation: sampleAt(samples, now) }
    : null;
  const sunUp = nowSample ? nowSample.elevation > -0.5 : false;

  const id = `arc${Math.abs(Math.round(peak * 100))}${variant}`;

  return (
    <div className="fhj-arc" data-variant={variant}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        /* Stretched horizontally, fixed vertically — see the note on
           `.fhj-arc svg`. The viewBox is 100 units wide whatever the screen
           is, so every x below is a percentage of the day. */
        style={{ height }}
        preserveAspectRatio="none"
        role="img"
        aria-label={
          light.polar
            ? light.daylightMinutes
              ? "The sun does not set today."
              : "The sun does not rise today."
            : `The sun's path today: up at ${clockLabel(light.sunrise)}, highest ${Math.round(peak)} degrees, down at ${clockLabel(light.sunset)}.`
        }
      >
        <defs>
          <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity={0.34} />
            <stop offset="100%" stopColor={C.accent} stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id={`${id}uvb`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.warn} stopOpacity={0.32} />
            <stop offset="100%" stopColor={C.warn} stopOpacity={0.06} />
          </linearGradient>
          <clipPath id={`${id}clip`}>
            <path d={fill || "M0,0"} />
          </clipPath>
        </defs>

        {/* Sky under the curve. */}
        {fill && <path d={fill} fill={`url(#${id}sky)`} />}

        {/* The vitamin D window, clipped to the sky so it reads as part of the
            day rather than a rectangle laid over it. */}
        {uvbSpan && (
          <g clipPath={`url(#${id}clip)`}>
            <rect
              x={x(uvbSpan[0])}
              y={0}
              width={Math.max(0.5, x(uvbSpan[1]) - x(uvbSpan[0]))}
              height={horizon}
              fill={`url(#${id}uvb)`}
            />
            {/* Two hairlines at the edges: without them the band blends into
                the sky and stops reading as a *window* — which is the one
                thing it is there to say. */}
            {[uvbSpan[0], uvbSpan[1]].map((edge, i) => (
              <line
                key={i}
                x1={x(edge)} y1={0} x2={x(edge)} y2={horizon}
                stroke={C.warn} strokeWidth={1} opacity={0.55}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        )}

        {/* The path itself. */}
        {path && (
          <path
            d={path}
            fill="none"
            stroke={C.accentLine}
            strokeWidth={variant === "hero" ? 1.6 : 1.2}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
        )}

        {/* The part of it spent outside. */}
        {spanPath && (
          <path
            className="fhj-arc-span"
            d={spanPath}
            fill="none"
            stroke={C.warn}
            strokeWidth={variant === "hero" ? 4 : 3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Horizon. */}
        <line x1={0} y1={horizon} x2={w} y2={horizon} stroke={C.line} strokeWidth={1} vectorEffect="non-scaling-stroke" />

        {/* Sunrise and sunset feet. */}
        {light.sunrise && <Foot x={x(light.sunrise)} y={horizon} />}
        {light.sunset && <Foot x={x(light.sunset)} y={horizon} />}

      </svg>

      {/* The sun is drawn *over* the SVG rather than inside it.

          The arc stretches horizontally (preserveAspectRatio="none"), which is
          right for a path — a day is a percentage of a width — and wrong for a
          disc: a circle in that viewBox comes out an ellipse four times wider
          than it is tall. Positioning it in percentages over the same box gives
          the same coordinates and a round sun. */}
      {nowSample && (
        <span
          className={"fhj-arc-sun" + (sunUp ? " is-up" : "")}
          aria-hidden
          style={{
            left: `${x(nowSample.at)}%`,
            top: `${(y(Math.max(0, nowSample.elevation)) / height) * 100}%`,
          }}
        />
      )}

      {labels && (
        <div className="fhj-arc-feet">
          <span>{light.sunrise ? clockLabel(light.sunrise) : light.daylightMinutes ? "No sunset" : "No sunrise"}</span>
          <span className="fhj-arc-peak">{light.polar ? "" : `${Math.round(peak)}° at ${clockLabel(light.solarNoon)}`}</span>
          <span>{light.sunset ? clockLabel(light.sunset) : ""}</span>
        </div>
      )}
    </div>
  );
}

function Foot({ x, y }: { x: number; y: number }) {
  return <line x1={x} y1={y - 2.5} x2={x} y2={y + 2.5} stroke={C.lineStrong} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
}

/** Elevation at a moment, read off the sampled curve rather than recomputed —
    the disc must sit exactly on the line it is travelling along. */
function sampleAt(samples: { at: Date; elevation: number }[], now: Date): number {
  if (!samples.length) return 0;
  const t = now.getTime();
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i].at.getTime() >= t) {
      const a = samples[i - 1];
      const b = samples[i];
      const f = (t - a.at.getTime()) / Math.max(1, b.at.getTime() - a.at.getTime());
      return a.elevation + (b.elevation - a.elevation) * f;
    }
  }
  return samples[samples.length - 1].elevation;
}
