/* How sure the journal is, drawn.

   Four rungs, one bar, and a disclosure that shows the working. The bar is the
   only place in this app where a progress indicator is honest, because it is
   measuring something real and finite: paired days, counted, against a
   threshold printed next to it.

   What this component deliberately does *not* do is shade toward green as
   confidence rises. A finding that reaches "Well established" is not good news
   — it might be that heat reliably wrecks your afternoons — and colouring it
   like a completed task would tell people the wrong thing about their own
   health. The rungs are drawn in the neutral accent, and only the *fill*
   changes, so what the eye reads is "more", not "better". */

import React, { useState } from "react";
import { C } from "../lib/theme";
import type { Evidence, EvidenceReport } from "../lib/evidence";

type Props = {
  evidence: Evidence;
  report?: EvidenceReport;
  /** Compact drops the detail line — used inside a dense card. */
  compact?: boolean;
  /** Rendered above the disclosure, e.g. the comparison the finding is about. */
  children?: React.ReactNode;
};

const RUNGS = 4;
const STAGE_INDEX = { collecting: 0, emerging: 1, useful: 2, established: 3 } as const;

export default function EvidenceMeter({ evidence, report, compact = false, children }: Props) {
  const [open, setOpen] = useState(false);
  const filled = STAGE_INDEX[evidence.stage];

  return (
    <div className="fhj-ev">
      <div className="fhj-ev-head">
        <span className="fhj-ev-stage" data-stage={evidence.stage}>
          {evidence.label}
        </span>
        <span className="fhj-ev-count">{evidence.count}</span>
      </div>

      {/* Four segments. The one being worked on fills partway; the ones behind
          it are solid; the ones ahead are the track. */}
      <div
        className="fhj-ev-bar"
        role="img"
        aria-label={`${evidence.label}. ${evidence.count}. ${
          evidence.toNext != null && evidence.nextLabel
            ? `${evidence.toNext} more paired days to ${evidence.nextLabel}.`
            : "This is as far as the ladder goes."
        }`}
      >
        {Array.from({ length: RUNGS }, (_, i) => (
          <span key={i} className="fhj-ev-seg" data-state={i < filled ? "done" : i === filled ? "active" : "todo"}>
            <span
              className="fhj-ev-seg-fill"
              style={{ transform: `scaleX(${i < filled ? 1 : i === filled ? Math.max(0.06, evidence.progress) : 0})` }}
            />
          </span>
        ))}
      </div>

      {!compact && <p className="fhj-ev-detail">{evidence.detail}</p>}
      {children}

      {report && (
        <>
          <button
            type="button"
            className="fhj-ev-why"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide the working" : "Why am I seeing this?"}
          </button>
          {open && (
            <div className="fhj-ev-panel">
              <dl className="fhj-ev-rows">
                <Row label="Usable observations" value={`${report.usable}`} />
                <Row label="Days missing one side" value={`${report.missing}`} />
                <Row label="Comparison window" value={report.windowLabel} />
                <Row label="How the days were split" value={report.comparison} />
                <Row label="Consistency" value={report.consistency} />
                <Row label="Lag used" value={report.lagLabel} />
              </dl>
              <div className="fhj-ev-lims">
                <div className="fhj-eyebrow" style={{ marginBottom: 6 }}>What this cannot tell you</div>
                <ul>
                  {report.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="fhj-ev-row">
      <dt style={{ color: C.subtle }}>{label}</dt>
      <dd style={{ color: C.ink }}>{value}</dd>
    </div>
  );
}
