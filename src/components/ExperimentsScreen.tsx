/* Experiments — the screen where a journal turns into a question.

   The card is the feature. It has four states and they are visibly the same
   object at four ages, not four different designs: the title stays put, the
   ladder underneath it fills, and the sentence appears when the ladder says it
   may. Watching one move from Collecting to Emerging over a fortnight is the
   reward the whole thing is built around, so the transitions are the part that
   got the attention.

   The paired-day dots are the other half. Every day the experiment has is a
   dot, placed by its factor value along the horizontal and its outcome value
   along the vertical, split at the threshold. Two clouds that sit at different
   heights *is* the finding, drawn — and when the clouds overlap, that is the
   null result, drawn just as plainly. It is the same picture in both cases,
   which is exactly the point: the app is not more excited about a positive. */

import React, { useMemo, useState } from "react";
import { C } from "../lib/theme";
import EvidenceMeter from "./EvidenceMeter";
import { EXPERIMENT_COPY, type ExperimentResult, type Suggestion } from "../lib/experiments";
import type { StarterQuestion } from "../lib/experiments";
import type { Variable } from "../lib/series";

type Props = {
  results: ExperimentResult[];
  suggestions: Suggestion[];
  starters: (StarterQuestion & { resolvedOutcome: string })[];
  variables: Variable[];
  viewer?: boolean;
  onCreate: (input: { factor: string; outcome: string; lag: number; title: string; source: "user" | "suggested"; kind?: "split" | "beforeAfter"; changedOn?: string }) => void;
  onArchive: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  /** Tapping a result lights its days up across the app. */
  onHighlight: (dates: string[], label: string) => void;
  onFeedback?: (kind: string) => void;
};

export default function ExperimentsScreen({
  results, suggestions, starters, variables, viewer = false,
  onCreate, onArchive, onPin, onHighlight, onFeedback,
}: Props) {
  const [building, setBuilding] = useState(false);

  return (
    <div className="fhj-exp">
      <header className="fhj-exp-head">
        <h1 className="fhj-page-title">Experiments</h1>
        <p className="fhj-exp-lede">
          Ask your journal a real question. It builds the smallest comparison that could answer it, and
          says nothing until it has enough of your own days to say something.
        </p>
      </header>

      {!viewer && (
        <button type="button" className="fhj-btn fhj-btn-primary fhj-btn-block fhj-pop" onClick={() => setBuilding(true)}>
          Ask a question
        </button>
      )}

      {results.length === 0 && starters.length > 0 && (
        <section className="fhj-card fhj-exp-starters">
          <div className="fhj-eyebrow">Questions your journal can already answer</div>
          <ul>
            {starters.slice(0, 4).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="fhj-exp-starter"
                  disabled={viewer}
                  onClick={() => {
                    onCreate({
                      factor: s.factor,
                      outcome: s.resolvedOutcome,
                      lag: s.lag,
                      title: s.question,
                      source: "suggested",
                    });
                    onFeedback?.("select");
                  }}
                >
                  {s.question}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="fhj-exp-list">
        {results.map((r) => (
          <ExperimentCard
            key={r.experiment.id}
            result={r}
            viewer={viewer}
            onArchive={() => onArchive(r.experiment.id)}
            onPin={() => onPin(r.experiment.id, !r.experiment.pinned)}
            onHighlight={onHighlight}
          />
        ))}
      </div>

      {results.length === 0 && (
        <div className="fhj-empty">
          <div className="fhj-empty-title">Nothing running yet</div>
          <p>
            An experiment is a factor, an outcome and a way of splitting your days in two. Pick a question
            above, or build one of your own.
          </p>
        </div>
      )}

      {suggestions.length > 0 && !viewer && (
        <section className="fhj-card fhj-exp-suggest">
          <div className="fhj-eyebrow">Worth exploring</div>
          <ul>
            {suggestions.map((s) => (
              <li key={`${s.factor}|${s.outcome}|${s.lag}`}>
                <div>
                  <div className="fhj-exp-suggest-title">{s.title}</div>
                  <div className="fhj-exp-suggest-why">{s.reason}</div>
                </div>
                <button
                  type="button"
                  className="fhj-btn fhj-btn-outline fhj-btn-sm"
                  onClick={() => {
                    onCreate({ factor: s.factor, outcome: s.outcome, lag: s.lag, title: s.title, source: "suggested" });
                    onFeedback?.("select");
                  }}
                >
                  Start
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {building && (
        <BuilderSheet
          variables={variables}
          onClose={() => setBuilding(false)}
          onCreate={(input) => {
            onCreate(input);
            setBuilding(false);
            onFeedback?.("save");
          }}
        />
      )}
    </div>
  );
}

/* ---------- the card ---------- */

function ExperimentCard({
  result, viewer, onArchive, onPin, onHighlight,
}: {
  result: ExperimentResult;
  viewer: boolean;
  onArchive: () => void;
  onPin: () => void;
  onHighlight: (dates: string[], label: string) => void;
}) {
  const { experiment: exp, evidence, factorVar, outcomeVar } = result;
  const [open, setOpen] = useState(false);
  const stage = evidence.stage;

  return (
    <article className="fhj-exp-card" data-stage={stage} data-flat={result.flat ? "true" : undefined}>
      <header className="fhj-exp-card-head">
        <div>
          <h2 className="fhj-exp-title">{exp.title}</h2>
          <div className="fhj-exp-pair">
            {factorVar?.label || exp.factor} <span aria-hidden>×</span> {outcomeVar?.label || exp.outcome}
            {exp.lag > 0 && <em> · {exp.lag === 1 ? "next day" : `${exp.lag} days later`}</em>}
          </div>
        </div>
        {!viewer && (
          <button
            type="button"
            className={"fhj-exp-pin" + (exp.pinned ? " is-on" : "")}
            aria-pressed={!!exp.pinned}
            aria-label={exp.pinned ? "Unpin from Today" : "Pin to Today"}
            onClick={onPin}
          >
            <PinMark />
          </button>
        )}
      </header>

      <EvidenceMeter evidence={evidence} report={open ? result.report : undefined} />

      {result.headline && (
        <p className="fhj-exp-headline" data-kind={result.flat ? "flat" : stage}>
          {result.headline}
        </p>
      )}
      <p className="fhj-exp-subline">{result.subline}</p>

      {result.pairs.length > 0 && (
        <PairedDots result={result} onHighlight={onHighlight} />
      )}

      {stage !== "collecting" && result.threshold != null && (
        <div className="fhj-exp-compare">
          <Half
            label={result.experiment.kind === "beforeAfter" ? "Before" : "Lower days"}
            n={result.low.n}
            mean={result.low.mean}
            unit={outcomeVar?.unit}
            onTap={() => onHighlight(result.low.dates, `${exp.title} — lower days`)}
          />
          <div className="fhj-exp-gap" aria-hidden>
            {result.difference > 0 ? "+" : ""}
            {result.difference}
          </div>
          <Half
            label={result.experiment.kind === "beforeAfter" ? "After" : "Higher days"}
            n={result.high.n}
            mean={result.high.mean}
            unit={outcomeVar?.unit}
            onTap={() => onHighlight(result.high.dates, `${exp.title} — higher days`)}
          />
        </div>
      )}

      <footer className="fhj-exp-card-foot">
        <button type="button" className="fhj-linkish" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide the working" : "Show the working"}
        </button>
        {!viewer && (
          <button type="button" className="fhj-linkish fhj-linkish-quiet" onClick={onArchive}>
            Archive
          </button>
        )}
      </footer>
    </article>
  );
}

function Half({
  label, n, mean, unit, onTap,
}: { label: string; n: number; mean: number; unit?: string; onTap: () => void }) {
  return (
    <button type="button" className="fhj-exp-half" onClick={onTap}>
      <span className="fhj-eyebrow">{label}</span>
      <span className="fhj-exp-half-mean">
        {mean}
        {unit ? <em>{unit}</em> : null}
      </span>
      <span className="fhj-exp-half-n">{n} days</span>
    </button>
  );
}

/* ---------- the dots ----------

   One dot per paired day. Position is data; nothing else is. The two clouds
   are drawn in the same ink at different opacities rather than in two hues,
   because a red half and a green half would be the app deciding which side of
   somebody's own life is the bad one. */

function PairedDots({
  result, onHighlight,
}: {
  result: ExperimentResult;
  onHighlight: (dates: string[], label: string) => void;
}) {
  const { pairs, threshold, factorVar, outcomeVar } = result;
  const geo = useMemo(() => {
    const xs = pairs.map((p) => p.x);
    const ys = pairs.map((p) => p.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    return {
      xMin, xMax: xMax === xMin ? xMin + 1 : xMax,
      yMin, yMax: yMax === yMin ? yMin + 1 : yMax,
    };
  }, [pairs]);

  const W = 100;
  const H = 54;
  const px = (v: number) => 3 + ((v - geo.xMin) / (geo.xMax - geo.xMin)) * (W - 6);
  const py = (v: number) => H - 5 - ((v - geo.yMin) / (geo.yMax - geo.yMin)) * (H - 10);

  const highMean = result.high.n ? result.high.mean : null;
  const lowMean = result.low.n ? result.low.mean : null;

  return (
    <div className="fhj-exp-dots">
      <div className="fhj-exp-plot">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ height: 96 }}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${pairs.length} paired days. ${outcomeVar?.label || "Outcome"} against ${factorVar?.label || "factor"}.`}
      >
        {/* The split. */}
        {threshold != null && (
          <line
            x1={px(threshold)} y1={0} x2={px(threshold)} y2={H}
            stroke={C.lineStrong} strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke"
          />
        )}
        {/* Each half's average, drawn as the level the dots sit around. */}
        {lowMean != null && (
          <line
            x1={2} y1={py(lowMean)} x2={threshold != null ? px(threshold) : W / 2} y2={py(lowMean)}
            stroke={C.accent} strokeWidth={1.4} opacity={0.6} vectorEffect="non-scaling-stroke"
          />
        )}
        {highMean != null && (
          <line
            x1={threshold != null ? px(threshold) : W / 2} y1={py(highMean)} x2={W - 2} y2={py(highMean)}
            stroke={C.accent} strokeWidth={1.4} opacity={0.9} vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* The dots are positioned over the SVG rather than drawn inside it.

          The chart stretches horizontally (preserveAspectRatio="none"), which
          is right for the split line and the two averages — they are lines
          across a width — and wrong for a dot: a circle in that viewBox comes
          out an ellipse four times wider than it is tall. Percentages over the
          same box give identical coordinates and round dots. */}
      <div className="fhj-exp-dot-layer" aria-hidden>
        {pairs.map((p, i) => (
          <span
            key={`${p.date}-${i}`}
            className="fhj-exp-dot"
            data-side={p.side}
            style={{
              left: `${px(p.x)}%`,
              top: `${(py(p.y) / H) * 100}%`,
              animationDelay: `${Math.min(600, i * 12)}ms`,
            }}
          />
        ))}
      </div>
      </div>
      <div className="fhj-exp-dots-axes">
        <span>{factorVar?.label || "Factor"} →</span>
        <button
          type="button"
          className="fhj-linkish fhj-linkish-quiet"
          onClick={() => onHighlight(result.dates, result.experiment.title)}
        >
          Light these days up
        </button>
      </div>
    </div>
  );
}

/* ---------- building one ---------- */

function BuilderSheet({
  variables, onClose, onCreate,
}: {
  variables: Variable[];
  onClose: () => void;
  onCreate: (input: { factor: string; outcome: string; lag: number; title: string; source: "user"; kind?: "split" | "beforeAfter"; changedOn?: string }) => void;
}) {
  const outcomes = variables.filter((v) => v.kind === "answer" || v.kind === "lab");
  const [outcome, setOutcome] = useState(outcomes[0]?.k || "");
  const factors = variables.filter((v) => v.k !== outcome);
  const [factor, setFactor] = useState(factors[0]?.k || "");
  const [lag, setLag] = useState(0);

  const f = variables.find((v) => v.k === factor);
  const o = variables.find((v) => v.k === outcome);
  const title = f && o ? `${f.label} × ${o.label}` : "New experiment";

  const grouped = useMemo(() => groupBySection(factors), [factors]);

  return (
    <div className="fhj-scrim" role="dialog" aria-modal="true" aria-label="Build an experiment">
      <div className="fhj-sheet">
        <div className="fhj-sheet-grab" aria-hidden />
        <div className="fhj-sheet-head">
          <h2 className="fhj-page-title" style={{ fontSize: 22 }}>Ask a question</h2>
        </div>
        <div className="fhj-sheet-body">
        <div className="fhj-label" id="exp-outcome">What do you want to understand?</div>
        <select
          className="fhj-input"
          aria-labelledby="exp-outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        >
          {groupBySection(outcomes).map(([sec, vars]) => (
            <optgroup key={sec} label={sec}>
              {vars.map((v) => (
                <option key={v.k} value={v.k}>{v.label}</option>
              ))}
            </optgroup>
          ))}
        </select>

        <div className="fhj-label" id="exp-factor">What might line up with it?</div>
        <select
          className="fhj-input"
          aria-labelledby="exp-factor"
          value={factor}
          onChange={(e) => setFactor(e.target.value)}
        >
          {grouped.map(([sec, vars]) => (
            <optgroup key={sec} label={sec}>
              {vars.map((v) => (
                <option key={v.k} value={v.k}>{v.label}</option>
              ))}
            </optgroup>
          ))}
        </select>

        <div className="fhj-label">When would you expect to notice it?</div>
        <div className="fhj-segmented" role="group" aria-label="Lag">
          {[0, 1, 2].map((n) => (
            <button
              key={n}
              type="button"
              className={"fhj-segment" + (lag === n ? " is-active" : "")}
              onClick={() => setLag(n)}
            >
              {n === 0 ? "Same day" : n === 1 ? "Next day" : `${n} days later`}
            </button>
          ))}
        </div>

        <p className="fhj-note" style={{ marginTop: 12 }}>
          Your days will be split at your own middle value, so both halves exist. Nothing is reported until
          there are enough of them.
        </p>
        </div>

        <div className="fhj-sheet-actions">
          <button type="button" className="fhj-btn fhj-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="fhj-btn fhj-btn-primary"
            disabled={!factor || !outcome}
            onClick={() => onCreate({ factor, outcome, lag, title, source: "user" })}
          >
            Start collecting
          </button>
        </div>
      </div>
    </div>
  );
}

function groupBySection(vars: Variable[]): [string, Variable[]][] {
  const map = new Map<string, Variable[]>();
  for (const v of vars) {
    const list = map.get(v.sec) || [];
    list.push(v);
    map.set(v.sec, list);
  }
  return [...map.entries()];
}

function PinMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 17v5" />
      <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
    </svg>
  );
}

export { EXPERIMENT_COPY };
