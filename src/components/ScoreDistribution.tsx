/* How the days were spread across 1–10.

   The trend chart shows the shape of a month; this shows its *composition*.
   They answer different questions and people ask the second one more often than
   they realise: "how many days were actually bad" is a count, not a curve, and
   no amount of staring at a line gives it to you.

   Ten columns, one per score, sharing the year heatmap's colour ramp so a red
   column here and a red square there mean the same thing. Counts sit above the
   columns rather than in a tooltip, because the whole point is the count. */

import React, { useMemo, useState } from "react";
import { C } from "../lib/theme";
import {
  calmLabel, hardLabel, pct, VARIABILITY_COPY,
  type Direction, type DistributionStats,
} from "../lib/distribution";
import { heatColor, heatRamp } from "../lib/heatmap";

type Props = {
  stats: DistributionStats;
  dir?: Direction;
  metricLabel: string;
  /** Days in the range that carry no score — printed so coverage is never
      implied by omission. */
  rangeDays?: number;
  onFeedback?: (kind: string) => void;
};

const fmt1 = (x: number | null) => (x == null ? "–" : (Math.round(x * 10) / 10).toString());

/** One of the four figures under the chart. */
function Stat({ label, value, detail, tone }: {
  label: string; value: React.ReactNode; detail?: string; tone?: string;
}) {
  return (
    <div className="fhj-dist-stat" style={{ background: C.faint }}>
      <div className="fhj-eyebrow leading-snug">{label}</div>
      <div className="font-display text-[1.5rem] leading-none mt-1.5 tabular-nums"
        style={{ color: tone || C.ink }}>{value}</div>
      {detail && (
        <div className="text-[11px] mt-1.5 leading-snug" style={{ color: C.subtle }}>{detail}</div>
      )}
    </div>
  );
}

export default function ScoreDistribution({
  stats, dir, metricLabel, rangeDays, onFeedback,
}: Props) {
  const ramp = useMemo(() => heatRamp(dir, C), [dir, C.good, C.bad, C.accent]);
  const [picked, setPicked] = useState<number | null>(null);

  if (!stats.total) {
    return (
      <div className="rounded-xl px-6 py-8 text-center"
        style={{ background: C.faint, border: `1.5px dashed ${C.line}` }}>
        <div className="text-sm" style={{ color: C.sub }}>
          No “{metricLabel}” ratings in this range yet.
        </div>
      </div>
    );
  }

  const tallest = Math.max(...stats.buckets.map((b) => b.days));
  const bucket = picked ? stats.buckets[picked - 1] : null;
  const variability = stats.variability ? VARIABILITY_COPY[stats.variability] : null;

  return (
    <div>
      <div className="fhj-dist" role="group"
        aria-label={`${metricLabel}: days at each score from 1 to 10`}>
        {stats.buckets.map((b) => {
          const color = heatColor(b.score, ramp)!;
          const isPicked = b.score === picked;
          return (
            <button
              key={b.score}
              type="button"
              className={"fhj-dist-col" + (isPicked ? " is-picked" : "")}
              aria-pressed={isPicked}
              aria-label={`${b.score} out of 10 — ${b.days} ${b.days === 1 ? "day" : "days"}, ${pct(b.share)} of logged days`}
              onClick={() => {
                onFeedback?.("tap");
                setPicked((p) => (p === b.score ? null : b.score));
              }}
            >
              <span className="fhj-dist-count tabular-nums"
                style={{ color: b.days ? C.sub : "transparent" }}>{b.days}</span>
              <span className="fhj-dist-track">
                {/* A zero keeps a hairline so the column still reads as a
                    column — an absent bar and a bar of nothing look identical
                    otherwise, and only one of them is information. */}
                <span className="fhj-dist-bar" style={{
                  height: b.days ? `${Math.max(6, (b.days / tallest) * 100)}%` : "2px",
                  background: b.days ? color : C.line,
                }} />
              </span>
              <span className="fhj-dist-score tabular-nums"
                style={{ color: isPicked ? C.ink : C.subtle }}>{b.score}</span>
            </button>
          );
        })}
      </div>

      {/* One line, two states — same as the year block, so the two sections
          behave the same way under a thumb. */}
      <div className="fhj-dist-readout mt-2.5" style={{ background: C.faint }}>
        {bucket ? (
          <>
            <span className="fhj-dist-swatch" style={{ background: heatColor(bucket.score, ramp)! }} />
            <span className="text-[13px] font-semibold" style={{ color: C.ink }}>
              {bucket.days} {bucket.days === 1 ? "day" : "days"} at {bucket.score}
            </span>
            <span className="text-[11.5px]" style={{ color: C.subtle }}>
              {pct(bucket.share)} of logged days
            </span>
          </>
        ) : (
          <span className="text-[11.5px]" style={{ color: C.subtle }}>
            {stats.total} {stats.total === 1 ? "day" : "days"} rated
            {rangeDays ? ` of ${rangeDays} in range` : ""} · tap a column for its share
          </span>
        )}
      </div>

      <div className="fhj-dist-stats mt-3">
        <Stat label="Typical day" value={fmt1(stats.median)}
          detail="half your days above, half below" />
        <Stat label="Most common" value={stats.mode ?? "–"}
          detail={`${stats.modeDays} ${stats.modeDays === 1 ? "day" : "days"} · ${pct(stats.modeShare)}`} />
        <Stat label="Spread" value={variability ? variability.label : "–"}
          detail={variability ? variability.detail : undefined} />
        <Stat label="Hard days" value={stats.hardDays}
          tone={stats.hardDays ? C.bad : undefined}
          detail={`${hardLabel(dir)} · ${pct(stats.hardShare)} of rated days`} />
      </div>

      <p className="text-[11.5px] leading-relaxed mt-3" style={{ color: C.subtle }}>
        {stats.calmDays === 0
          ? `No days were ${calmLabel(dir)}`
          : `${stats.calmDays} ${stats.calmDays === 1 ? "day was" : "days were"} ${calmLabel(dir)}`}
        {stats.best != null && stats.worst != null && stats.best !== stats.worst && (
          <> · every day landed between {Math.min(stats.best, stats.worst)} and {Math.max(stats.best, stats.worst)}</>
        )}.
      </p>
    </div>
  );
}
