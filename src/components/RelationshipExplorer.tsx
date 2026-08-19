/* "Possible relationships" — the most careful screen in the app.

   Two pickers, one comparison, and a great deal of restraint. See
   src/lib/relationships.ts for why the floors are where they are; this file's
   job is to make sure the restraint is *visible*: the sample size is printed
   before the result, the not-proof line is always on screen rather than folded
   away, and below the threshold there is no chart at all — just a sentence
   saying how many more days it needs. A greyed-out chart would still be a
   chart, and people read charts.

   The two pickers are the app's own control (components/FieldSelect), not a
   native select: this list is two dozen metrics long, and it wants grouping,
   units and a filter — none of which a <select> can carry.

   The default shape is the grouped comparison, not the scatter. "On the days
   you logged more of this, that averaged 6.8 instead of 4.1" is a sentence a
   person can act on carefully; a cloud of dots with a correlation coefficient
   is a sentence they will act on confidently, which is worse. */

import React, { useMemo, useState } from "react";
import {
  CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { C } from "../lib/theme";
import FieldSelect from "./FieldSelect";
import {
  MIN_PAIRS, needsLine, relationship, RELATIONSHIP_COPY, STRENGTH_COPY,
  type Entryish, type RelationshipResult,
} from "../lib/relationships";

export interface ExplorerField {
  k: string;
  label: string;
  type?: string;
  unit?: string;
  dir?: string;
}

type Props = {
  entries: Entryish[];
  /** 1–10 ratings, the only things offered as an outcome. */
  outcomes: ExplorerField[];
  /** Anything numeric or yes/no. */
  factors: ExplorerField[];
  start?: string;
  end?: string;
  tint: string;
  tooltipProps: () => Record<string, unknown>;
  axisTick: () => Record<string, unknown>;
  onFeedback?: (kind: string) => void;
};

const fmt1 = (x: number | null) => (x == null ? "–" : (Math.round(x * 10) / 10).toString());

function GroupBars({ result, tint, outcomeLabel }: {
  result: RelationshipResult; tint: string; outcomeLabel: string;
}) {
  if (result.groups.length !== 2) return null;
  const max = Math.max(10, ...result.groups.map((g) => g.mean));
  return (
    <div className="mt-3.5">
      {result.groups.map((g, i) => (
        <div key={g.label} className={i ? "mt-2.5" : ""}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-[12px] font-medium truncate" style={{ color: C.sub }}>{g.label}</span>
            <span className="text-[11px] shrink-0 tabular-nums" style={{ color: C.subtle }}>
              {g.n} {g.n === 1 ? "day" : "days"}
            </span>
          </div>
          <div className="fhj-rel-row">
            <span className="fhj-rel-bar" style={{ background: C.faint }}>
              <span style={{ width: `${(g.mean / max) * 100}%`, background: i ? tint : C.sub }} />
            </span>
            {/* Outside the fill, not on it: a number printed over a bar has to
                clear contrast against both the fill and the track, in two
                themes, at every width the bar can be. */}
            <b className="tabular-nums" style={{ color: C.ink }}>{fmt1(g.mean)}</b>
          </div>
        </div>
      ))}
      <div className="fhj-caption mt-2">
        Average {outcomeLabel.toLowerCase()} on each half of the days, split at your own middle value.
      </div>
    </div>
  );
}

export default function RelationshipExplorer({
  entries, outcomes, factors, start, end, tint, tooltipProps, axisTick, onFeedback,
}: Props) {
  const [outcomeKey, setOutcomeKey] = useState(() => outcomes[0]?.k || "");
  const [factorKey, setFactorKey] = useState(() =>
    factors.find((f) => f.k !== outcomes[0]?.k)?.k || factors[0]?.k || "");
  const [lag, setLag] = useState(0);
  const [showScatter, setShowScatter] = useState(false);

  const outcome = outcomes.find((f) => f.k === outcomeKey) || outcomes[0];
  /* A metric compared with itself is a perfect correlation and a wasted screen,
     so the thing being looked at is never also on offer as the factor. */
  const factorOptions = useMemo(
    () => factors.filter((f) => f.k !== (outcome?.k ?? outcomeKey)),
    [factors, outcome, outcomeKey]
  );
  const factor = factorOptions.find((f) => f.k === factorKey) || factorOptions[0];

  const result = useMemo(() => {
    if (!outcome || !factor) return null;
    return relationship({
      entries, outcomeKey: outcome.k, factorKey: factor.k, lag, start, end,
      groupLabels: [`Lower ${factor.label.toLowerCase()} days`, `Higher ${factor.label.toLowerCase()} days`],
    });
  }, [entries, outcome, factor, lag, start, end]);

  if (!outcome || !factor) {
    return (
      <p className="text-sm leading-relaxed" style={{ color: C.sub }}>
        This needs at least two things being tracked — one to look at, and one to compare it with.
      </p>
    );
  }

  const scatter = result?.pairs.map((p) => ({ x: p.x, y: p.y })) || [];

  return (
    <div>
      <p className="text-sm leading-relaxed mb-3.5" style={{ color: C.sub }}>
        {RELATIONSHIP_COPY.intro}
      </p>

      <div className="fhj-rel-pickers">
        <FieldSelect label="I want to look at" value={outcome.k} options={outcomes}
          tint={tint} hint="Ratings only — this is the thing being explained."
          onChange={setOutcomeKey} onFeedback={onFeedback} />
        <FieldSelect label="Compared with" value={factor.k} options={factorOptions}
          hint="Anything else you log a number or a yes/no for."
          onChange={setFactorKey} onFeedback={onFeedback} />
      </div>

      <div className="fhj-segmented mt-2.5" role="radiogroup" aria-label="When to compare">
        {([[0, "Same day"], [1, "The day after"]] as [number, string][]).map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={lag === v}
            onClick={() => { onFeedback?.("select"); setLag(v); }}
            className={"fhj-segment" + (lag === v ? " is-active" : "")}>
            {label}
          </button>
        ))}
      </div>
      <div className="fhj-caption mt-1.5">
        {lag ? RELATIONSHIP_COPY.lagOn : RELATIONSHIP_COPY.lagOff}
      </div>

      {/* Sample size before result, always — it is the thing that decides
          whether the result means anything, so it cannot be a footnote. */}
      <div className="fhj-rel-sample mt-3.5" style={{ background: C.faint }}>
        <span className="font-display text-[1.375rem] leading-none tabular-nums" style={{ color: C.ink }}>
          {result!.n}
        </span>
        <span className="text-[11.5px] leading-snug" style={{ color: C.subtle }}>
          {result!.n === 1 ? "day where both were logged" : "days where both were logged"}
          {result!.outcomeDays > 0 && (
            <> · {Math.round(result!.coverage * 100)}% of your {outcome.label.toLowerCase()} days</>
          )}
        </span>
      </div>

      {!result!.enough ? (
        <div className="rounded-xl px-4 py-5 mt-3 text-center"
          style={{ background: C.faint, border: `1.5px dashed ${C.line}` }}>
          <div className="text-sm leading-relaxed" style={{ color: C.sub }}>{needsLine(result!)}</div>
          <div className="text-[11px] mt-2" style={{ color: C.subtle }}>
            Nothing is shown below {MIN_PAIRS} paired days — a handful of days can look
            related by chance, and it would read as a finding.
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold" style={{ color: C.ink }}>
                {STRENGTH_COPY[result!.strength]}
              </span>
              <span className="text-[11px] shrink-0 tabular-nums" style={{ color: C.subtle }}>
                rho {result!.rho == null ? "–" : result!.rho.toFixed(2)}
              </span>
            </div>
            {result!.strength !== "none" && result!.groupDelta != null && (
              <p className="text-[12.5px] leading-relaxed mt-1.5" style={{ color: C.sub }}>
                On the higher-{factor.label.toLowerCase()} half of these days,{" "}
                {outcome.label.toLowerCase()} averaged{" "}
                <b style={{ color: C.ink }}>{fmt1(result!.groups[1].mean)}</b> rather than{" "}
                <b style={{ color: C.ink }}>{fmt1(result!.groups[0].mean)}</b>.
              </p>
            )}
          </div>

          <GroupBars result={result!} tint={tint} outcomeLabel={outcome.label} />

          <button type="button" className="fhj-disclose mt-3.5" aria-expanded={showScatter}
            onClick={() => { onFeedback?.("tap"); setShowScatter((o) => !o); }}>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold" style={{ color: C.ink }}>
                See every day as a dot
              </span>
              <span className="block text-[11.5px] truncate mt-0.5" style={{ color: C.subtle }}>
                One dot per paired day
              </span>
            </span>
            <span className="fhj-disclose-chev" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
          {showScatter && (
            <div className="fhj-disclose-panel">
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 10, right: 10, left: -8, bottom: 4 }}>
                    <CartesianGrid stroke={C.grid} strokeDasharray="2 5" />
                    <XAxis type="number" dataKey="x" name={factor.label} domain={["auto", "auto"]}
                      tick={axisTick()} axisLine={false} tickLine={false} tickMargin={6} />
                    <YAxis type="number" dataKey="y" name={outcome.label} domain={[1, 10]} ticks={[1, 4, 7, 10]}
                      tick={axisTick()} axisLine={false} tickLine={false} width={34} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }}
                      formatter={(v, name) => [v, name === "x" ? factor.label : outcome.label]}
                      {...tooltipProps()} />
                    <Scatter data={scatter} fill={tint} fillOpacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-[11.5px] leading-relaxed mt-3.5" style={{ color: C.subtle }}>
        {RELATIONSHIP_COPY.notProof}
      </p>
    </div>
  );
}
