/* Rituals, on screen.

   Three surfaces, and the order they were designed in is the order of how
   often they are used:

   1. **The card on Today.** One row per ritual due today. Tapping the row says
      "did the whole thing" and tapping it again takes that back. That is the
      interaction the entire feature is built to protect — a shower is not a
      form, and on a normal day nobody should have to open anything.
   2. **The player.** Big steps, one thumb, tick as you go. For the days you
      want the process rather than the tick, and for the ritual you are still
      learning. It is a *list* rather than a one-step-at-a-time carousel
      because a list answers "how much is left" without being asked.
   3. **The weekly tune-up.** Opens with the week you had, then asks three
      one-tap questions, then offers to change the plan to match the answers.
      It shows up for one ritual at a time, on that ritual's own day, and the
      scheduler in ../lib/rituals is what guarantees they never arrive
      together.

   The tune-up is deliberately front-loaded with the reward. A popup that
   demands an answer before it gives you anything is a tax; one that shows you
   six green dots and a streak and *then* asks how it went is a gift with a
   question attached. Same three taps, completely different feeling. */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { C } from "../lib/theme";
import { feedback } from "../lib/feedback";
import { lockPageScroll, prefersReducedMotion } from "../lib/motion";
import { daySpan } from "../lib/episodes";
import { timeLabel } from "../lib/routine";
import type { RoutineItem, RoutineTime } from "../types/models";
import {
  FEELINGS, FRICTIONS, RITUAL_STARTERS, WEEKDAYS, WEEKDAYS_SHORT,
  celebrationFor, clearRun, completeRun, dayBoard, daysLabel, newRun, newRitual, newStep,
  nextReviewDate, requiredSteps, ritualFromStarter, ritualReport, runProgress, skipRun,
  suggestTweaks, toggleStep, tuneUpCards, weekDots, weekLine, weekdayOf,
} from "../lib/rituals";
import type {
  Ritual, RitualReview, RitualRow, RitualRun, RitualStep, Tweak, WeekDot,
} from "../lib/rituals";

/* ---------- the handful of glyphs this file needs ----------
   Inlined rather than imported: the app's icon set lives in App.tsx, and
   reaching back into it from a component would make the dependency run the
   wrong way. Same stroke weight and cap style, so they sit beside it. */

const G: Record<string, React.ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  right: <path d="M10 6l6 6-6 6" />,
  left: <path d="M14 6l-6 6 6 6" />,
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  list: <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />,
  trash: <path d="M5 7h14M10 7V5h4v2M8.5 7l.6 12h5.8l.6-12" />,
  timer: <g><circle cx="12" cy="13" r="7.5" /><path d="M12 9.5V13l2.4 1.6M9.5 3h5" /></g>,
  spark: <path d="M12 3.5l2.1 5.2a2 2 0 0 0 1.2 1.2l5.2 2.1-5.2 2.1a2 2 0 0 0-1.2 1.2L12 20.5l-2.1-5.2a2 2 0 0 0-1.2-1.2L3.5 12l5.2-2.1a2 2 0 0 0 1.2-1.2z" />,
  edit: <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17zM13.5 6.5l3 3" />,
  minus: <path d="M5 12h14" />,
};

function Glyph({ name, size = 18, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {G[name]}
    </svg>
  );
}

/* ---------- small shared pieces ---------- */

/** The seven-dot week strip. The most-looked-at object in the feature: it is
    on the card, in the player's header and at the top of the tune-up, and it
    is always the same seven dots meaning the same seven things. */
export function WeekStrip({ dots, size = 8, letters = false }: { dots: WeekDot[]; size?: number; letters?: boolean }) {
  const label = `${dots.filter((d) => d.state === "done").length} of ${dots.filter((d) => d.state !== "off" && d.state !== "future").length} days done this week`;
  return (
    <span className="fhj-week-strip" role="img" aria-label={label}>
      {dots.map((d) => (
        <span key={d.date} className="fhj-week-cell">
          <span className={`fhj-week-dot is-${d.state}`} style={{ width: size, height: size }} />
          {letters && <span className="fhj-week-letter">{d.letter}</span>}
        </span>
      ))}
    </span>
  );
}

/** A streak, when there is one worth printing. Two is the floor: "1 day in a
    row" is not a streak, it is a Tuesday. */
function Streak({ n }: { n: number }) {
  if (n < 2) return null;
  return <span className="fhj-streak" aria-label={`${n} day streak`}>🔥 {n}</span>;
}

/* =====================================================================
   1. The card on Today
   ===================================================================== */

export interface RitualsCardProps {
  rituals: Ritual[];
  runs: RitualRun[];
  date: string;
  viewer?: boolean;
  compact?: boolean;
  onComplete: (ritual: Ritual) => void;
  onClear: (ritual: Ritual) => void;
  onOpen: (ritual: Ritual) => void;
  onManage: () => void;
}

export function RitualsCard({
  rituals, runs, date, viewer = false, compact = false, onComplete, onClear, onOpen, onManage,
}: RitualsCardProps) {
  const rows = useMemo(() => dayBoard(rituals, runs, date), [rituals, runs, date]);
  const done = rows.filter((r) => r.complete).length;

  if (!rituals.length) {
    return (
      <>
        <div className="fhj-section mt-6 fhj-cat-routine">
          <h2 className="fhj-section-title">Rituals</h2>
          <button type="button" onClick={() => { feedback("nav"); onManage(); }}
            className="fhj-link-btn" aria-label="Set up a ritual">
            Set up
            <Glyph name="right" size={12} color="currentColor" />
          </button>
        </div>
        <button type="button" onClick={() => { feedback("nav"); onManage(); }}
          className="fhj-ritual-empty w-full text-left" aria-label="Set up a ritual">
          <span className="fhj-ritual-empty-emoji" aria-hidden="true">🚿</span>
          <span>
            <strong>A shower is not one tick.</strong> It is the wash and the three
            minutes after, and the three minutes are the part that slips. Set one up
            and the whole thing becomes a single tap a day.
          </span>
          <Glyph name="right" size={16} color={C.sub} />
        </button>
      </>
    );
  }

  /* The heading row is `.fhj-section` and the list is its *sibling*, exactly
     as the routine's card is built. `.fhj-section` is a horizontal flex header
     — wrapping the rows in it lays the whole list out sideways. */
  return (
    <>
      <div className="fhj-section mt-6 fhj-cat-routine">
        {/* The literal space between the two spans is load-bearing and free:
            a whitespace-only text node between flex items is not rendered as
            one, and without it the heading's accessible name comes out as
            "Rituals0 of 2". */}
        <h2 className="fhj-section-title">
          <span>Rituals</span>{" "}
          {rows.length > 0 && (
            <span className="fhj-section-count tabular-nums">{done} of {rows.length}</span>
          )}
        </h2>
        <button type="button" onClick={() => { feedback("nav"); onManage(); }}
          className="fhj-link-btn" aria-label="Manage your rituals">
          Manage
          <Glyph name="right" size={12} color="currentColor" />
        </button>
      </div>

      <div className="fhj-cat-routine">
        {!rows.length ? (
          <p className="fhj-quiet">Nothing asked for today. Enjoy it.</p>
        ) : rows.map((row) => (
          <RitualRowView key={row.ritual.id} row={row} runs={runs} date={date} viewer={viewer}
            compact={compact} onComplete={onComplete} onClear={onClear} onOpen={onOpen} />
        ))}
      </div>
    </>
  );
}

function RitualRowView({
  row, runs, date, viewer, compact, onComplete, onClear, onOpen,
}: {
  row: RitualRow; runs: RitualRun[]; date: string; viewer?: boolean; compact?: boolean;
  onComplete: (r: Ritual) => void; onClear: (r: Ritual) => void; onOpen: (r: Ritual) => void;
}) {
  const { ritual, complete, skipped, done, total, ratio } = row;
  const dots = useMemo(() => weekDots(ritual, runs, date), [ritual, runs, date]);
  const part = !complete && !skipped && done > 0;

  const meta = complete
    ? ["Done", ritual.slot ? timeLabel(ritual.slot) : null].filter(Boolean).join(" · ")
    : skipped
      ? "Not today"
      : part
        ? `${done} of ${total} steps`
        : [ritual.slot ? timeLabel(ritual.slot) : null, `${total} step${total === 1 ? "" : "s"}`]
            .filter(Boolean).join(" · ");

  return (
    <div className="fhj-ritual-line">
      <button type="button" disabled={viewer}
        onClick={() => { feedback(complete ? "tap" : "save"); complete ? onClear(ritual) : onComplete(ritual); }}
        aria-pressed={complete}
        aria-label={`${complete ? "Undo" : "Mark done"}: ${ritual.name}`}
        className={"fhj-ritual-row fhj-pop" + (complete ? " is-done" : "") + (skipped ? " is-skipped" : "")
          + (compact ? " is-compact" : "")}>
        <span className="fhj-ritual-emoji" aria-hidden="true">
          {complete ? "✅" : ritual.emoji || "•"}
        </span>
        <span className="fhj-ritual-body">
          <span className="fhj-ritual-name">{ritual.name}</span>
          <span className="fhj-ritual-meta">
            {meta}
            <Streak n={row.streak} />
          </span>
          {/* The progress hairline only exists part-way through. A bar sitting
              at zero under every unstarted row is decoration that reads as
              failure. */}
          {part && (
            <span className="fhj-ritual-bar" aria-hidden="true">
              <span className="fhj-ritual-bar-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
            </span>
          )}
        </span>
        <WeekStrip dots={dots} size={compact ? 6 : 7} />
      </button>
      <button type="button" onClick={() => { feedback("tap"); onOpen(ritual); }}
        aria-label={`Open ${ritual.name} step by step`}
        className="fhj-icon-btn shrink-0"
        style={{ width: compact ? "2.25rem" : "2.5rem", height: compact ? "2.25rem" : "2.5rem" }}>
        <Glyph name="list" size={compact ? 14 : 16} color={C.sub} />
      </button>
    </div>
  );
}

/* =====================================================================
   2. The player
   ===================================================================== */

/** A step's own countdown. Only on the steps that carry one — "lukewarm, ten
    minutes" and "moisturise within three minutes" are instructions with a
    number in them, and a number in an instruction wants a button. Nothing is
    ever blocked on it; it is a stopwatch, not a gate. */
function StepTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState<number | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (left == null) return undefined;
    if (left <= 0) {
      if (!done.current) { done.current = true; feedback("save"); onDone(); }
      return undefined;
    }
    const t = setTimeout(() => setLeft((n) => (n == null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [left, onDone]);

  const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;

  if (left == null) {
    return (
      <button type="button" className="fhj-step-timer"
        onClick={(e) => { e.stopPropagation(); feedback("tap"); done.current = false; setLeft(seconds); }}>
        <Glyph name="timer" size={13} color="currentColor" /> {mmss(seconds)}
      </button>
    );
  }
  return (
    <button type="button" className="fhj-step-timer is-running" aria-live="polite"
      onClick={(e) => { e.stopPropagation(); feedback("tap"); setLeft(null); }}>
      <Glyph name="timer" size={13} color="currentColor" /> {mmss(Math.max(0, left))}
    </button>
  );
}

export interface RitualPlayerProps {
  ritual: Ritual;
  run?: RitualRun;
  date: string;
  /** The week behind this ritual, for the strip at the foot of the sheet. */
  runs?: RitualRun[];
  viewer?: boolean;
  onSaveRun: (run: RitualRun) => void;
  /** Fired when a step that points at a routine item is ticked or unticked, so
      the dose lands in the medication history too. The seam is explicit on
      purpose: this component writes rituals, and something else owns the
      routine. */
  onStepLogged?: (step: RitualStep, ticked: boolean) => void;
  onEdit?: (ritual: Ritual) => void;
  onClose: () => void;
}

export function RitualPlayer({
  ritual, run, date, runs = [], viewer = false, onSaveRun, onStepLogged, onEdit, onClose,
}: RitualPlayerProps) {
  const [draft, setDraft] = useState<RitualRun>(() => run || newRun(ritual, date));
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => lockPageScroll(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const write = (next: RitualRun) => { setDraft(next); onSaveRun(next); };

  const { done, total, ratio } = runProgress(draft, ritual);
  const finished = total > 0 && done >= total;
  const dots = weekDots(ritual, runs, date);

  const tick = (step: RitualStep) => {
    if (viewer) return;
    const was = draft.done.includes(step.id);
    const next = toggleStep(draft, ritual, step.id);
    /* The tick that finishes the whole thing gets the bigger noise. Everything
       is one register louder here than on the card because the player is the
       screen somebody chose to open. */
    const nowFinished = runProgress(next, ritual).done >= runProgress(next, ritual).total;
    feedback(was ? "tap" : nowFinished ? "finish" : "save");
    write(next);
    if (step.itemId) onStepLogged?.(step, !was);
  };

  const finishAll = () => {
    if (viewer) return;
    const before = new Set(draft.done);
    const next = completeRun(draft, ritual);
    feedback("complete");
    write(next);
    for (const s of ritual.steps) {
      if (s.itemId && !before.has(s.id) && next.done.includes(s.id)) onStepLogged?.(s, true);
    }
  };

  const undoAll = () => {
    if (viewer) return;
    feedback("tap");
    write(clearRun(draft));
  };

  return (
    <div className="fhj-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panelRef} className="fhj-sheet fhj-cat-routine" role="dialog" aria-modal="true"
        data-lenis-prevent tabIndex={-1} aria-label={ritual.name} style={{ outline: "none" }}>
        <div className="fhj-sheet-grab" aria-hidden="true" />

        <div className="fhj-sheet-head">
          <div className="min-w-0 flex items-center gap-2.5">
            <span className="fhj-ritual-emoji is-lg" aria-hidden="true">{ritual.emoji || "•"}</span>
            <div className="min-w-0">
              <div className="fhj-eyebrow mb-0.5">
                {finished ? "All done" : total ? `${done} of ${total}` : "No steps yet"}
                {ritual.slot ? ` · ${timeLabel(ritual.slot)}` : ""}
              </div>
              <h2 className="font-display text-xl leading-snug truncate">{ritual.name}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="fhj-icon-btn shrink-0" style={{ width: "2.5rem", height: "2.5rem" }}>
            <Glyph name="x" size={16} color={C.sub} />
          </button>
        </div>

        {/* The one bar in the app that fills as you work. It is above the list
            rather than under it so the thumb never covers the thing it is
            moving. */}
        <div className="fhj-ritual-progress" aria-hidden="true">
          <div className="fhj-ritual-progress-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>

        <div className="fhj-sheet-body">
          {!ritual.steps.length ? (
            <p className="fhj-quiet py-4">
              This ritual has no steps yet. Add them and it becomes a checklist you
              can walk down half-awake.
            </p>
          ) : (
            <ol className="fhj-step-list">
              {ritual.steps.map((step, i) => {
                const on = draft.done.includes(step.id);
                /* The next thing to do, marked. Exactly one row carries it, and
                   it moves as you tick — which is the whole reason a list beats
                   a carousel here: you can see where you are *and* what's
                   coming. */
                const next = !on && ritual.steps.slice(0, i).every((s) => draft.done.includes(s.id));
                return (
                  <li key={step.id}>
                    <button type="button" disabled={viewer} onClick={() => tick(step)}
                      aria-pressed={on}
                      className={"fhj-step-row fhj-pop" + (on ? " is-done" : "") + (next ? " is-next" : "")}>
                      <span className="fhj-step-box" aria-hidden="true">
                        <Glyph name="check" size={16} color={on ? C.onAccent : "transparent"} />
                      </span>
                      <span className="fhj-step-body">
                        <span className="fhj-step-label">
                          {step.label}
                          {step.optional && <span className="fhj-step-optional">optional</span>}
                        </span>
                        {step.hint && <span className="fhj-step-hint">{step.hint}</span>}
                      </span>
                      {step.seconds ? (
                        <StepTimer seconds={step.seconds} onDone={() => { if (!on) tick(step); }} />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="fhj-ritual-week mt-4">
            <span className="fhj-eyebrow">This week</span>
            <WeekStrip dots={dots} size={10} letters />
          </div>

          {!viewer && (
            <div className="flex items-center gap-2 mt-4">
              {onEdit && (
                <button type="button" className="fhj-link-btn"
                  onClick={() => { feedback("tap"); onEdit(ritual); }}>Edit steps</button>
              )}
              <span className="flex-1" />
              <button type="button" className="fhj-link-btn"
                onClick={() => { feedback("tap"); write(skipRun(draft)); onClose(); }}>
                Not today
              </button>
            </div>
          )}
        </div>

        {!viewer && (
          <div className="fhj-sheet-actions">
            {finished ? (
              <button type="button" className="fhj-btn fhj-btn-primary w-full fhj-pop"
                onClick={() => { feedback("nav"); onClose(); }}>
                <span className="fhj-finish-line">🎉 {ritual.name} — done</span>
              </button>
            ) : (
              <button type="button" className="fhj-btn fhj-btn-primary w-full fhj-pop" onClick={finishAll}>
                {done > 0 ? "Tick the rest" : "Did it all"}
              </button>
            )}
            {done > 0 && (
              <button type="button" className="fhj-btn fhj-btn-ghost w-full mt-2" onClick={undoAll}>
                Start over
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================================================================
   3. The weekly tune-up
   ===================================================================== */

type Stage = "week" | "felt" | "friction" | "tweak" | "done";

export interface RitualTuneUpProps {
  ritual: Ritual;
  runs: RitualRun[];
  date: string;
  onFinish: (review: Partial<RitualReview>, tweak?: Tweak) => void;
  onSnooze: () => void;
}

export function RitualTuneUp({ ritual, runs, date, onFinish, onSnooze }: RitualTuneUpProps) {
  const report = useMemo(() => ritualReport(ritual, runs, date), [ritual, runs, date]);
  const cards = useMemo(() => tuneUpCards(report), [report]);
  const tweaks = useMemo(() => suggestTweaks(report, runs), [report, runs]);
  const cheer = useMemo(() => celebrationFor(report), [report]);

  const asks = useMemo<Stage[]>(() => {
    const out: Stage[] = ["week"];
    if (cards.some((c) => c.id === "felt")) out.push("felt");
    if (cards.some((c) => c.id === "friction")) out.push("friction");
    if (tweaks.length) out.push("tweak");
    out.push("done");
    return out;
  }, [cards, tweaks]);

  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Partial<RitualReview>>({});
  const [chosen, setChosen] = useState<Tweak | undefined>(undefined);
  const panelRef = useRef<HTMLDivElement>(null);
  const stage = asks[Math.min(at, asks.length - 1)];

  useEffect(() => lockPageScroll(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onSnooze(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onSnooze]);

  /* The dots animate in one at a time on the opening card. It is three hundred
     milliseconds of theatre and it is the reason the popup reads as a reward
     rather than a form — so it is also the first thing switched off when
     somebody has asked for less motion. */
  const [lit, setLit] = useState(() => (prefersReducedMotion() ? 7 : 0));
  useEffect(() => {
    if (stage !== "week" || lit >= 7) return undefined;
    const t = setTimeout(() => setLit((n) => n + 1), 90);
    return () => clearTimeout(t);
  }, [stage, lit]);

  const advance = () => setAt((n) => n + 1);

  const finish = (extra: Partial<RitualReview> = {}, tweak?: Tweak) => {
    const merged = { ...answers, ...extra };
    setAnswers(merged);
    onFinish(merged, tweak || chosen);
  };

  const shownDots = report.dots.slice(0, Math.max(0, lit)).length
    ? report.dots.map((d, i) => (i < lit ? d : { ...d, state: "future" as const }))
    : report.dots.map((d) => ({ ...d, state: "future" as const }));

  return (
    <div className="fhj-scrim">
      <div ref={panelRef} className="fhj-sheet fhj-tune fhj-cat-routine" role="dialog" aria-modal="true"
        data-lenis-prevent tabIndex={-1} aria-label={`Weekly tune-up: ${ritual.name}`}
        style={{ outline: "none" }}>
        <div className="fhj-sheet-grab" aria-hidden="true" />

        <div className="fhj-sheet-head">
          <div className="min-w-0">
            <div className="fhj-eyebrow mb-0.5">Weekly tune-up · {WEEKDAYS[weekdayOf(date)]}</div>
            <h2 className="font-display text-xl leading-snug truncate">
              <span aria-hidden="true">{ritual.emoji || "•"}</span> {ritual.name}
            </h2>
          </div>
          <button type="button" onClick={() => { feedback("tap"); onSnooze(); }}
            className="fhj-icon-btn shrink-0" aria-label="Not now — ask me in a couple of days"
            style={{ width: "2.5rem", height: "2.5rem" }}>
            <Glyph name="x" size={16} color={C.sub} />
          </button>
        </div>

        {/* Where you are, in four dots. Progress on a survey is not decoration:
            it is the promise that this ends. */}
        <div className="fhj-tune-pips" aria-hidden="true">
          {asks.map((s, i) => (
            <span key={s} className={"fhj-tune-pip" + (i <= at ? " is-on" : "")} />
          ))}
        </div>

        <div className="fhj-sheet-body">
          {stage === "week" && (
            <div className="fhj-tune-stage">
              <div className="fhj-tune-week">
                <WeekStrip dots={shownDots} size={22} letters />
              </div>
              <div className="fhj-tune-stat">
                <span className="fhj-tune-big">{report.completed}<span className="fhj-tune-of">/{report.asked}</span></span>
                <span className="fhj-tune-stat-label">days</span>
              </div>
              <h3 className="fhj-tune-title">{cheer.title}</h3>
              <p className="fhj-tune-line">{cheer.line}</p>
              {report.best >= 3 && (
                <p className="fhj-tune-sub">Best run so far: {report.best} days.</p>
              )}
            </div>
          )}

          {stage === "felt" && (
            <div className="fhj-tune-stage">
              <h3 className="fhj-tune-q">{cards.find((c) => c.id === "felt")?.question}</h3>
              <p className="fhj-tune-sub">{weekLine(report)}</p>
              <div className="fhj-face-grid">
                {FEELINGS.map((f) => (
                  <button key={f.v} type="button" className="fhj-face fhj-pop"
                    aria-label={f.label}
                    onClick={() => { feedback("select"); setAnswers((a) => ({ ...a, felt: f.v })); advance(); }}>
                    <span className="fhj-face-emoji" aria-hidden="true">{f.emoji}</span>
                    <span className="fhj-face-label">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {stage === "friction" && (
            <div className="fhj-tune-stage">
              <h3 className="fhj-tune-q">What got in the way?</h3>
              <p className="fhj-tune-sub">One tap, or skip it — this only ever shapes what gets suggested next.</p>
              <div className="fhj-chip-wrap">
                {FRICTIONS.map((f) => (
                  <button key={f.v} type="button" className="fhj-chip fhj-pop"
                    onClick={() => { feedback("select"); setAnswers((a) => ({ ...a, friction: f.v })); advance(); }}>
                    <span aria-hidden="true">{f.emoji}</span> {f.label}
                  </button>
                ))}
              </div>
              <button type="button" className="fhj-link-btn mt-3"
                onClick={() => { feedback("tap"); advance(); }}>Skip this</button>
            </div>
          )}

          {stage === "tweak" && (
            <div className="fhj-tune-stage">
              <h3 className="fhj-tune-q">Change anything?</h3>
              <p className="fhj-tune-sub">
                Written from your own week. Tapping one applies it — nothing here is
                permanent, and the ritual screen can undo all of it.
              </p>
              <div className="fhj-tweak-list">
                {tweaks.map((t) => (
                  <button key={t.id} type="button" className="fhj-tweak fhj-pop"
                    onClick={() => {
                      feedback(t.action.type === "keep" ? "select" : "save");
                      setChosen(t);
                      setAnswers((a) => ({ ...a, tweak: t.id }));
                      advance();
                    }}>
                    <span className="fhj-tweak-emoji" aria-hidden="true">{t.emoji}</span>
                    <span className="min-w-0">
                      <span className="fhj-tweak-label">{t.label}</span>
                      {t.detail && <span className="fhj-tweak-detail">{t.detail}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {stage === "done" && (
            <div className="fhj-tune-stage fhj-tune-end">
              <span className="fhj-tune-end-emoji" aria-hidden="true">{ritual.emoji || "✨"}</span>
              <h3 className="fhj-tune-title">Logged.</h3>
              <p className="fhj-tune-line">
                {chosen && chosen.action.type !== "keep"
                  ? "Your plan just changed to match your week."
                  : "Same plan, one more week of it written down."}
              </p>
              <p className="fhj-tune-sub">
                Next tune-up for this one: {WEEKDAYS[ritual.reviewDay]}. Nothing else will
                ask you anything for at least a couple of days.
              </p>
            </div>
          )}
        </div>

        <div className="fhj-sheet-actions">
          {stage === "week" && (
            <button type="button" className="fhj-btn fhj-btn-primary w-full fhj-pop"
              onClick={() => { feedback("nav"); setLit(7); advance(); }}>
              {asks.length > 2 ? "Two quick questions" : "Nice"}
            </button>
          )}
          {stage === "done" && (
            <button type="button" className="fhj-btn fhj-btn-primary w-full fhj-pop"
              onClick={() => { feedback("complete"); finish(); }}>Done</button>
          )}
          {(stage === "felt" || stage === "friction" || stage === "tweak") && (
            <button type="button" className="fhj-btn fhj-btn-ghost w-full"
              onClick={() => { feedback("tap"); onSnooze(); }}>Not now</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   4. Managing them
   ===================================================================== */

export interface RitualsScreenProps {
  rituals: Ritual[];
  runs: RitualRun[];
  reviews: RitualReview[];
  items?: RoutineItem[];
  date: string;
  viewer?: boolean;
  onSave: (ritual: Ritual) => void;
  onDelete: (ritual: Ritual) => void;
  onOpen: (ritual: Ritual) => void;
}

export function RitualsScreen({
  rituals, runs, reviews, items = [], date, viewer = false, onSave, onDelete, onOpen,
}: RitualsScreenProps) {
  const [editing, setEditing] = useState<Ritual | null>(null);
  const [picking, setPicking] = useState(false);
  const live = rituals.filter((r) => !r.archived);

  return (
    <div className="px-4 pb-8 pt-3 fhj-cat-routine">
      <p className="fhj-quiet mb-4">
        A ritual is a process with one name on it. Ticking it is one tap a day; the
        steps are there for the days you want them. Once a week the app asks how one
        of them is going — one at a time, never two on the same day.
      </p>

      {!live.length ? (
        <div className="fhj-ritual-empty-panel">
          <span className="fhj-ritual-empty-emoji" aria-hidden="true">🚿</span>
          <h2 className="font-display text-lg">Nothing set up yet</h2>
          <p className="fhj-quiet mt-1 mb-3">
            Start from one of these — they are already written out, steps and all.
          </p>
        </div>
      ) : (
        <ul className="fhj-ritual-manage">
          {live.map((ritual) => {
            const report = ritualReport(ritual, runs, date);
            const next = nextReviewDate(ritual, reviews);
            return (
              <li key={ritual.id} className="fhj-ritual-manage-row">
                <button type="button" className="fhj-ritual-manage-main fhj-pop"
                  onClick={() => { feedback("nav"); onOpen(ritual); }}
                  aria-label={`Open ${ritual.name}`}>
                  <span className="fhj-ritual-emoji" aria-hidden="true">{ritual.emoji || "•"}</span>
                  {/* The strip sits *under* the text rather than beside it on
                      this screen: here the two metadata lines are the point,
                      and squeezing them next to seven dots truncated both. */}
                  <span className="fhj-ritual-manage-body">
                    <span className="fhj-ritual-name">{ritual.name}</span>
                    <span className="fhj-ritual-meta">
                      {[
                        `${requiredSteps(ritual).length} step${requiredSteps(ritual).length === 1 ? "" : "s"}`,
                        daysLabel(ritual.days),
                        ritual.slot ? timeLabel(ritual.slot) : null,
                      ].filter(Boolean).join(" · ")}
                    </span>
                    <span className="fhj-ritual-meta">
                      Tune-up {WEEKDAYS[ritual.reviewDay]} · {whenNext(next, date)}
                    </span>
                    <span className="fhj-ritual-manage-strip">
                      <WeekStrip dots={report.dots} size={9} letters />
                    </span>
                  </span>
                </button>
                {!viewer && (
                  <button type="button" className="fhj-icon-btn shrink-0"
                    style={{ width: "2.5rem", height: "2.5rem" }}
                    onClick={() => { feedback("tap"); setEditing(ritual); }}
                    aria-label={`Edit ${ritual.name}`}>
                    <Glyph name="edit" size={16} color={C.sub} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!viewer && (
        <div className="mt-4 flex gap-2">
          <button type="button" className="fhj-btn fhj-btn-primary flex-1 fhj-pop"
            onClick={() => { feedback("nav"); setPicking(true); }}>
            <Glyph name="plus" size={16} color="currentColor" /> Add a ritual
          </button>
        </div>
      )}

      {picking && (
        <StarterPicker rituals={rituals} items={items} date={date}
          /* Picking a starter opens it in the editor rather than writing it
             straight down. Same two taps either way, and nothing lands in the
             journal that somebody did not confirm — which also means the
             blank path and the starter path behave identically. */
          onPick={(r) => { setPicking(false); setEditing(r); }}
          onBlank={() => {
            const r = newRitual({ name: "", steps: [], reviewDay: weekdayOf(date) });
            setPicking(false);
            setEditing(r);
          }}
          onClose={() => setPicking(false)} />
      )}

      {editing && (
        <RitualEditor initial={editing} existing={rituals} items={items} date={date}
          onSave={(r) => { onSave(r); setEditing(null); }}
          onDelete={(r) => { onDelete(r); setEditing(null); }}
          onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

/** "due now" / "tomorrow" / "in 5 days". A tune-up date is only ever read as a
    distance from today — nobody wants an ISO string on this line. */
function whenNext(next: string, today: string): string {
  if (next <= today) return "due now";
  const days = daySpan(today, next) - 1;
  if (days === 1) return "tomorrow";
  if (days <= 7) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
}

/** The starter gallery. A blank form is a wall; six written-out rituals are a
    menu, and the meds ones quietly fill themselves in from the routine that is
    already there. */
function StarterPicker({
  rituals, items, date, onPick, onBlank, onClose,
}: {
  rituals: Ritual[]; items: RoutineItem[]; date: string;
  onPick: (r: Ritual) => void; onBlank: () => void; onClose: () => void;
}) {
  useEffect(() => lockPageScroll(), []);
  const taken = new Set(rituals.filter((r) => !r.archived).map((r) => r.name.toLowerCase()));

  return (
    <div className="fhj-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fhj-sheet fhj-cat-routine" role="dialog" aria-modal="true" data-lenis-prevent
        aria-label="Add a ritual">
        <div className="fhj-sheet-grab" aria-hidden="true" />
        <div className="fhj-sheet-head">
          <div className="min-w-0">
            <div className="fhj-eyebrow mb-0.5">Already written out</div>
            <h2 className="font-display text-xl leading-snug">Add a ritual</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="fhj-icon-btn shrink-0"
            style={{ width: "2.5rem", height: "2.5rem" }}>
            <Glyph name="x" size={16} color={C.sub} />
          </button>
        </div>
        <div className="fhj-sheet-body">
          <div className="fhj-starter-grid">
            {RITUAL_STARTERS.map((s) => {
              const already = taken.has(s.name.toLowerCase());
              const linked = s.fromSlot
                ? items.filter((i) => !i.archived && i.daily && (i.times || []).includes(s.fromSlot!)).length
                : 0;
              return (
                <button key={s.id} type="button" className="fhj-starter fhj-pop" disabled={already}
                  onClick={() => {
                    feedback("save");
                    onPick(ritualFromStarter(s, { items, existing: rituals, today: date }));
                  }}>
                  <span className="fhj-starter-emoji" aria-hidden="true">{s.emoji}</span>
                  <span className="min-w-0">
                    <span className="fhj-starter-name">{s.name}{already ? " · added" : ""}</span>
                    <span className="fhj-starter-blurb">{s.blurb}</span>
                    <span className="fhj-starter-count">
                      {s.steps.length + linked} steps
                      {linked ? ` · ${linked} from your routine` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="fhj-sheet-actions">
          <button type="button" className="fhj-btn fhj-btn-ghost w-full"
            onClick={() => { feedback("nav"); onBlank(); }}>Start from blank</button>
        </div>
      </div>
    </div>
  );
}

/** The editor. Name, face, when, and the steps — nothing else, because every
    field added here is a field somebody has to get past to record a shower. */
function RitualEditor({
  initial, existing, items, date, onSave, onDelete, onClose,
}: {
  initial: Ritual; existing: Ritual[]; items: RoutineItem[]; date: string;
  onSave: (r: Ritual) => void; onDelete: (r: Ritual) => void; onClose: () => void;
}) {
  const [r, setR] = useState<Ritual>(initial);
  const isNew = !existing.some((x) => x.id === initial.id);
  useEffect(() => lockPageScroll(), []);

  const patch = (p: Partial<Ritual>) => setR((cur) => ({ ...cur, ...p, updatedAt: new Date().toISOString() }));
  const setStep = (id: string, p: Partial<RitualStep>) =>
    patch({ steps: r.steps.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const moveStep = (i: number, dir: -1 | 1) => {
    const next = r.steps.slice();
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    feedback("tap");
    patch({ steps: next });
  };

  const toggleDay = (d: number) => {
    const base = r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6];
    const next = base.includes(d) ? base.filter((x) => x !== d) : [...base, d].sort((a, b) => a - b);
    feedback("select");
    patch({ days: next.length === 7 ? [] : next });
  };
  const active = (d: number) => !r.days.length || r.days.includes(d);

  const save = () => {
    const name = r.name.trim();
    if (!name) { feedback("error"); return; }
    feedback("save");
    onSave({
      ...r,
      name,
      steps: r.steps.filter((s) => s.label.trim()).map((s) => ({ ...s, label: s.label.trim() })),
      reviewDay: r.reviewDay,
    });
  };

  const SLOTS: { id: RoutineTime | ""; label: string }[] = [
    { id: "", label: "Any" },
    { id: "morning", label: "Morning" },
    { id: "midday", label: "Midday" },
    { id: "evening", label: "Evening" },
    { id: "bed", label: "Bed" },
  ];

  return (
    <div className="fhj-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fhj-sheet fhj-cat-routine" role="dialog" aria-modal="true" data-lenis-prevent
        aria-label={isNew ? "New ritual" : `Edit ${initial.name}`}>
        <div className="fhj-sheet-grab" aria-hidden="true" />
        <div className="fhj-sheet-head">
          <div className="min-w-0">
            <div className="fhj-eyebrow mb-0.5">
              Tune-up lands on {WEEKDAYS[r.reviewDay]}
            </div>
            <h2 className="font-display text-xl leading-snug">{isNew ? "New ritual" : "Edit ritual"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="fhj-icon-btn shrink-0"
            style={{ width: "2.5rem", height: "2.5rem" }}>
            <Glyph name="x" size={16} color={C.sub} />
          </button>
        </div>

        <div className="fhj-sheet-body">
          <div className="flex gap-2 items-end">
            <label className="shrink-0">
              <span className="fhj-eyebrow block mb-1">Face</span>
              <input className="fhj-input fhj-emoji-input" value={r.emoji || ""} maxLength={4}
                onChange={(e) => patch({ emoji: e.target.value })} aria-label="Emoji" />
            </label>
            <label className="flex-1 min-w-0">
              <span className="fhj-eyebrow block mb-1">Name</span>
              <input className="fhj-input" value={r.name} placeholder="Shower &amp; after"
                onChange={(e) => patch({ name: e.target.value })} aria-label="Ritual name" />
            </label>
          </div>

          <div className="mt-3">
            <span className="fhj-eyebrow block mb-1">Days</span>
            <div className="fhj-day-row" role="group" aria-label="Days this ritual is asked for">
              {WEEKDAYS_SHORT.map((label, d) => (
                <button key={d} type="button" onClick={() => toggleDay(d)}
                  aria-pressed={active(d)} aria-label={WEEKDAYS[d]}
                  className={"fhj-day-btn fhj-pop" + (active(d) ? " is-on" : "")}>
                  {label[0]}
                </button>
              ))}
            </div>
            <p className="fhj-quiet mt-1">{daysLabel(r.days)}</p>
          </div>

          <div className="mt-3">
            <span className="fhj-eyebrow block mb-1">Part of the day</span>
            <div className="fhj-chip-wrap">
              {SLOTS.map((s) => (
                <button key={s.id || "any"} type="button"
                  className={"fhj-chip fhj-pop" + ((r.slot || "") === s.id ? " is-active" : "")}
                  aria-pressed={(r.slot || "") === s.id}
                  onClick={() => { feedback("select"); patch({ slot: (s.id || undefined) as RoutineTime | undefined }); }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <span className="fhj-eyebrow block mb-1">Steps</span>
            <ul className="fhj-step-edit-list">
              {r.steps.map((s, i) => (
                <li key={s.id} className="fhj-step-edit">
                  <div className="flex gap-1.5 items-center">
                    <input className="fhj-input flex-1 min-w-0" value={s.label}
                      placeholder="What happens next"
                      onChange={(e) => setStep(s.id, { label: e.target.value })}
                      aria-label={`Step ${i + 1}`} />
                    <button type="button" className="fhj-icon-btn shrink-0" aria-label={`Move step ${i + 1} up`}
                      style={{ width: "2rem", height: "2rem" }} onClick={() => moveStep(i, -1)}>
                      <Glyph name="up" size={14} color={C.sub} />
                    </button>
                    <button type="button" className="fhj-icon-btn shrink-0" aria-label={`Move step ${i + 1} down`}
                      style={{ width: "2rem", height: "2rem" }} onClick={() => moveStep(i, 1)}>
                      <Glyph name="down" size={14} color={C.sub} />
                    </button>
                    <button type="button" className="fhj-icon-btn shrink-0" aria-label={`Remove step ${i + 1}`}
                      style={{ width: "2rem", height: "2rem" }}
                      onClick={() => { feedback("erase"); patch({ steps: r.steps.filter((x) => x.id !== s.id) }); }}>
                      <Glyph name="trash" size={14} color={C.sub} />
                    </button>
                  </div>
                  <div className="flex gap-1.5 items-center mt-1">
                    <input className="fhj-input flex-1 min-w-0 fhj-input-sm" value={s.hint || ""}
                      placeholder="Why, in a few words (optional)"
                      onChange={(e) => setStep(s.id, { hint: e.target.value })}
                      aria-label={`Note for step ${i + 1}`} />
                    <button type="button"
                      className={"fhj-chip fhj-chip-sm" + (s.optional ? " is-active" : "")}
                      aria-pressed={!!s.optional}
                      onClick={() => { feedback("select"); setStep(s.id, { optional: !s.optional || undefined }); }}>
                      optional
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="fhj-btn fhj-btn-ghost w-full mt-2"
              onClick={() => { feedback("tap"); patch({ steps: [...r.steps, newStep({ label: "" })] }); }}>
              <Glyph name="plus" size={15} color="currentColor" /> Add a step
            </button>

            {/* Pulling in a routine item is the one shortcut that matters here:
                it means the morning handful is typed once, in the place it was
                already typed. */}
            {items.filter((i) => !i.archived).length > 0 && (
              <details className="fhj-details mt-2">
                <summary className="fhj-link-btn">Add from your routine</summary>
                <div className="fhj-chip-wrap mt-2">
                  {items.filter((i) => !i.archived).slice(0, 30).map((i) => (
                    <button key={i.id} type="button" className="fhj-chip fhj-pop"
                      onClick={() => {
                        feedback("save");
                        patch({
                          steps: [...r.steps, newStep({
                            label: i.name,
                            hint: [i.dose?.trim(), i.brand?.trim()].filter(Boolean).join(" · ") || undefined,
                            itemId: i.id,
                          })],
                        });
                      }}>
                      + {i.name}
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>

          {!isNew && (
            <button type="button" className="fhj-btn fhj-btn-danger w-full mt-5"
              onClick={() => { feedback("erase"); onDelete(r); }}>
              <Glyph name="trash" size={15} color="currentColor" /> Delete this ritual
            </button>
          )}
        </div>

        <div className="fhj-sheet-actions">
          <button type="button" className="fhj-btn fhj-btn-primary w-full fhj-pop"
            disabled={!r.name.trim()} onClick={save}>
            {isNew ? "Add it" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RitualsCard;
