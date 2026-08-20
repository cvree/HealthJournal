/* The pack, as it prints.

   This is the one screen in the app whose real output is paper. Everything
   about it is decided by that: one figure per idea, the caption under the
   figure rather than in a tooltip, no colour carrying meaning on its own, and
   no interaction required to read any of it. What is interactive here — the
   questions, the note and photo pickers — is marked `no-print` and disappears,
   leaving the thing itself.

   The order is the order a consultation runs in, and the last section is the
   person's own questions, printed with a rule under each one so there is
   somewhere to write the answer down. That last detail is the difference
   between a summary of an illness and a document somebody can use in a room. */

import React, { useState } from "react";
import {
  VERDICT_WORD, changeLabel, coverageLabel, pageLabel,
  type AppointmentPack, type PackPhotoSide,
} from "../lib/appointmentPack";

type Meta = {
  name: string;
  /** Whole years, when the journal knows it. The second thing every clinician
      asks for, printed before they have to ask. */
  age?: number | null;
  setup: string;
  appName: string;
  version: string;
  printedOn: string;
  disclaimer: string;
  patternNote: string;
};

type Props = {
  pack: AppointmentPack;
  meta: Meta;
  /** Draws one side of the photo pair. Omitted where photos can't be loaded. */
  renderPhoto?: (side: PackPhotoSide) => React.ReactNode;
  onQuestionsChange?: (questions: string[]) => void;
  onChooseNotes?: () => void;
  onChoosePhoto?: () => void;
  onFeedback?: (kind: string) => void;
};

const fmt1 = (x: number | null | undefined): string =>
  x == null ? "–" : (Math.round(x * 10) / 10).toString();

const fmtDate = (date: string): string => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const pctLabel = (ratio: number | null): string =>
  ratio == null ? "–" : `${Math.round(ratio * 100)}%`;

/** Suggestions, offered only while the list is empty. They are the questions
    people say afterwards that they wished they had asked. */
const STARTER_QUESTIONS = [
  "Is this the right treatment for me?",
  "What should I do when a flare starts?",
  "Should anything change before the next visit?",
];

function Figure({ label, value, caption }: {
  label: string; value: React.ReactNode; caption?: React.ReactNode;
}) {
  return (
    <div className="fhj-pack-fig">
      <div className="fhj-eyebrow leading-snug">{label}</div>
      <div className="fhj-pack-num">{value}</div>
      {caption ? <div className="fhj-pack-cap">{caption}</div> : null}
    </div>
  );
}

function Section({ title, action, children, className = "" }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`fhj-pack-section ${className}`.trim()}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="fhj-pack-head">{title}</h2>
        {action ? <div className="no-print">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export default function AppointmentPackView({
  pack, meta, renderPhoto, onQuestionsChange, onChooseNotes, onChoosePhoto, onFeedback,
}: Props) {
  const [draft, setDraft] = useState("");
  const editable = !!onQuestionsChange;

  const addQuestion = (text: string) => {
    const q = text.trim();
    if (!q || !onQuestionsChange) return;
    onFeedback?.("select");
    onQuestionsChange([...pack.questions, q].slice(0, 10));
    setDraft("");
  };
  const removeQuestion = (i: number) => {
    if (!onQuestionsChange) return;
    onFeedback?.("nav");
    onQuestionsChange(pack.questions.filter((_, x) => x !== i));
  };

  const h = pack.headline;

  return (
    <div className="fhj-pack print-area">
      <div className="fhj-pack-masthead print-masthead print-only">
        <div className="fhj-pack-title print-title">Appointment pack</div>
        <div className="fhj-pack-meta print-meta">
          <span>{meta.name || meta.setup}</span>
          {meta.age != null && <span>{meta.age} years old</span>}
          <span>{pack.range.label} · {pack.range.start} to {pack.range.end}</span>
          <span>Printed {fmtDate(meta.printedOn)}</span>
        </div>
      </div>

      {h && (
        <Section title="How it's been">
          <div className="fhj-pack-figs">
            <Figure
              label={h.label}
              value={h.average == null ? "–" : fmt1(h.average)}
              caption={h.average == null
                ? `Fewer than 3 days rated in this range`
                : `average · ${coverageLabel(h.loggedDays, h.rangeDays)}`}
            />
            <Figure
              label="Since last time"
              value={changeLabel(h.change, h.unit)}
              caption={h.change == null
                ? `${h.previousLabel} has ${h.previousLoggedDays} logged ${h.previousLoggedDays === 1 ? "day" : "days"}`
                : `vs ${fmt1(h.previousAverage)} over ${h.previousLabel}${
                  VERDICT_WORD[h.verdict] ? ` · ${VERDICT_WORD[h.verdict]}` : ""}`}
            />
            <Figure
              label="Days logged"
              value={`${h.entryDays}`}
              caption={`of ${h.rangeDays} days in this range`}
            />
          </div>
        </Section>
      )}

      {pack.scores && (
        <Section title="Best, hardest, usual">
          <div className="fhj-pack-figs">
            <Figure label="Best day" value={fmt1(pack.scores.best)}
              caption={pack.scores.calmDays
                ? `${pack.scores.calmDays} ${pack.scores.calmDays === 1 ? "day" : "days"} at ${pack.scores.calmAt}`
                : "the kindest rating reached"} />
            <Figure label="Hardest day" value={fmt1(pack.scores.hardest)}
              caption={`${pack.scores.hardDays} ${pack.scores.hardDays === 1 ? "day" : "days"} at ${pack.scores.hardAt}`} />
            <Figure label="Most common" value={fmt1(pack.scores.mostCommon)}
              caption={`on ${pack.scores.mostCommonDays} of ${pack.scores.total} rated days`} />
          </div>
        </Section>
      )}

      {pack.flares && (
        <Section title="Flares">
          <div className="fhj-pack-figs">
            <Figure label="Flares" value={`${pack.flares.count}`}
              caption={pack.flares.ongoing ? `${pack.flares.ongoing} still going` : "all ended"} />
            <Figure label="Flare days" value={`${pack.flares.flareDays}`}
              caption={`of ${pack.range.days} days in this range`} />
            <Figure label="Average length"
              value={pack.flares.avgDuration == null ? "–" : `${Math.round(pack.flares.avgDuration)}d`}
              caption={pack.flares.longestDuration != null
                ? `longest ${pack.flares.longestDuration} days`
                : undefined} />
            <Figure label="Severity"
              value={fmt1(pack.flares.avgSeverity)}
              caption={pack.flares.peakSeverity != null
                ? `average · peaked at ${fmt1(pack.flares.peakSeverity)}${pack.flares.peakDate ? ` on ${fmtDate(pack.flares.peakDate)}` : ""}`
                : "average across the flares"} />
          </div>
          {pack.flares.items.length > 0 && (
            <ul className="fhj-pack-list">
              {pack.flares.items.map((f) => (
                <li key={f.id}>
                  <span className="fhj-pack-list-name">{f.title}</span>
                  <span className="fhj-pack-list-meta">
                    {fmtDate(f.start)} – {f.open ? "ongoing" : f.end ? fmtDate(f.end) : "—"} ·{" "}
                    {f.days} {f.days === 1 ? "day" : "days"}
                    {f.average != null ? ` · avg ${fmt1(f.average)}` : ""}
                    {f.peak != null ? ` · peak ${fmt1(f.peak)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {pack.changes.length > 0 && (
        <Section title="Biggest changes">
          <ul className="fhj-pack-list">
            {pack.changes.map((c) => (
              <li key={c.key}>
                <span className="fhj-pack-list-name">{c.label}</span>
                <span className="fhj-pack-list-meta">
                  {fmt1(c.previous)} → {fmt1(c.current)}{c.unit ? ` ${c.unit}` : ""} ·{" "}
                  {changeLabel(c.delta, c.unit)}
                  {VERDICT_WORD[c.verdict] ? ` · ${VERDICT_WORD[c.verdict]}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {pack.routine && (
        <Section title="Routine">
          <div className="fhj-pack-figs">
            <Figure label="Doses taken" value={`${pack.routine.taken}`}
              caption={pack.routine.planned
                ? `of ${pack.routine.planned} the plan asked for · ${pctLabel(pack.routine.adherence)}`
                : "no daily plan set"} />
            <Figure label="Skipped" value={`${pack.routine.skipped}`}
              caption="recorded as a deliberate miss" />
          </div>
          <ul className="fhj-pack-list">
            {pack.routine.items.map((r) => (
              <li key={r.id}>
                <span className="fhj-pack-list-name">
                  {r.name}{r.dose ? ` · ${r.dose}` : ""}
                </span>
                <span className="fhj-pack-list-meta">
                  {r.asNeeded
                    ? `${r.kindLabel} · as needed · used ${r.taken} ${r.taken === 1 ? "time" : "times"}`
                    : `${r.kindLabel} · ${r.taken} of ${r.planned} (${pctLabel(r.adherence)})${
                      r.skipped ? ` · ${r.skipped} skipped` : ""}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="fhj-pack-note">
            Counted against the plan as it stands today, from the day each item was added.
          </p>
        </Section>
      )}

      {pack.sections.photos && (pack.photo || onChoosePhoto) && (
        <Section
          title="Photos"
          className={pack.photo ? "" : "no-print"}
          action={onChoosePhoto ? (
            <button type="button" onClick={onChoosePhoto} className="fhj-btn fhj-btn-ghost fhj-btn-sm">
              {pack.photo ? "Change pair" : "Choose"}
            </button>
          ) : null}>
          {pack.photo ? (
            <>
              <div className="fhj-pack-photos">
                {([["Before", pack.photo.before], ["After", pack.photo.after]] as const).map(([side, s]) => (
                  <figure key={side} className="fhj-pack-photo">
                    {renderPhoto ? renderPhoto(s) : null}
                    <figcaption>
                      <b>{side}</b> · {fmtDate(s.date)}
                      {s.rating != null ? ` · ${pack.photo!.ratingLabel || "rated"} ${s.rating}` : ""}
                    </figcaption>
                  </figure>
                ))}
              </div>
              <p className="fhj-pack-note">
                {pack.photo.spot} · {pack.photo.apart} days apart
              </p>
            </>
          ) : (
            <p className="fhj-pack-note no-print">No pair chosen.</p>
          )}
        </Section>
      )}

      {pack.sections.notes && (pack.notes.length > 0 || onChooseNotes) && (
        <Section
          title="Notes"
          className={pack.notes.length ? "" : "no-print"}
          action={onChooseNotes ? (
            <button type="button" onClick={onChooseNotes} className="fhj-btn fhj-btn-ghost fhj-btn-sm">
              {pack.notes.length ? "Change" : "Choose notes"}
            </button>
          ) : null}>
          {pack.notes.length ? (
            <ul className="fhj-pack-notes">
              {pack.notes.map((n) => (
                <li key={n.date}>
                  <span className="fhj-pack-list-meta">{fmtDate(n.date)}</span>
                  <span className="fhj-pack-note-text">{n.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fhj-pack-note no-print">
              Pick out the days worth reading aloud — nothing is chosen for you.
            </p>
          )}
        </Section>
      )}

      {pack.sections.questions && (
        <Section title="Questions for my appointment">
          {pack.questions.length > 0 && (
            <ol className="fhj-pack-questions">
              {pack.questions.map((q, i) => (
                <li key={`${i}-${q}`}>
                  <span className="fhj-pack-q">{q}</span>
                  {editable && (
                    <button type="button" onClick={() => removeQuestion(i)}
                      aria-label={`Remove question: ${q}`}
                      className="fhj-pack-q-x no-print">×</button>
                  )}
                </li>
              ))}
            </ol>
          )}
          {editable && (
            <div className="no-print">
              <form className="fhj-pack-add" onSubmit={(e) => { e.preventDefault(); addQuestion(draft); }}>
                <input className="fhj-input" value={draft} maxLength={200}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="Add a question for your appointment"
                  placeholder="Add a question…" />
                <button type="submit" className="fhj-btn fhj-btn-secondary fhj-btn-sm"
                  disabled={!draft.trim() || pack.questions.length >= 10}>Add</button>
              </form>
              {pack.questions.length === 0 && (
                <div className="fhj-pack-starters">
                  {STARTER_QUESTIONS.map((q) => (
                    <button key={q} type="button" className="fhj-chip" onClick={() => addQuestion(q)}>
                      + {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {pack.questions.length === 0 && !editable && (
            <p className="fhj-pack-note">Nothing written down yet.</p>
          )}
        </Section>
      )}

      <div className="fhj-pack-foot print-footnote">
        <p><b>{meta.patternNote}</b></p>
        <p>{meta.disclaimer}</p>
        <p>
          Self-reported daily ratings recorded in {meta.appName} {meta.version}, on the author's own device.
          {" "}{pageLabel(pack)}.
        </p>
      </div>
    </div>
  );
}
