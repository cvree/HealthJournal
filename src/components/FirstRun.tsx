/* The first thirty seconds.

   Somebody has just installed a health journal, which means something is
   wrong — or they are afraid something might be. They do not want a product
   tour. They want to believe this will be worth the effort, and then they want
   to put something down.

   So this is not a wizard. It is four acts, and the fourth one is the point:

     1. **The promise.** One line, and a glimpse of a journal already alive —
        a rating, a photograph, a note, a trend, a flare that ended. The claim
        the app is making, shown rather than explained.
     2. **The only question that cannot be defaulted.** What are you tracking?
        Everything else this app used to ask on first run — which questions,
        which body spots, weight, progress photos, a name — has a sensible
        default and a settings screen. Asking for them here costs the thing
        they were meant to protect.
     3. **The first entry.** Real, not a demo. The number they pick is written
        to their journal.
     4. **The journal beginning.** The card they just filled in physically
        becomes the first card on their timeline, the rail draws itself
        downward into the days they have not lived yet, and the streak counts
        to one.

   The fourth act is the whole argument. A journal is a promise about the
   future — keep writing this down and in six months it will tell you something
   — and no paragraph of copy makes that promise the way watching your own
   first entry turn into the first thing on a timeline does.

   Every animation here is a no-op under `prefers-reduced-motion`, and each act
   is composed so the still frame *is* the finished layout. Nothing is animated
   into existence that is not already laid out where it belongs. */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { C, readableInk } from "../lib/theme";
import { feedback, place } from "../lib/feedback";
import { scoreWord } from "../lib/pulse";
import {
  actIn, bloom, buildTimeline, countUp, heroIn, landCard, liftCard, readoutSwap, rungPop,
  type CardFlight,
} from "../lib/intro";

export interface FirstRunScale {
  k: string;
  label: string;
  dir?: string;
  /** The question, as a question. "How is your skin today?" */
  ask?: string;
}

export interface FirstRunPack {
  key: string;
  label: string;
  color: string;
  blurb: string;
  icon: string;
  keyMetric: string;
  scales: FirstRunScale[];
}

export interface FirstRunChoice {
  modules: string[];
  keyMetric: string | null;
  score: number | null;
  note: string;
}

type Props = {
  packs: FirstRunPack[];
  onComplete: (choice: FirstRunChoice) => void;
  onLoadSample: () => void;
  /** The long form, for people who want to build the whole survey now. */
  onDetailed: () => void;
  /** The app's icon set, passed in so this file draws nothing of its own. */
  Icon: React.ComponentType<{ name: string; size?: number; color?: string }>;
  appName: string;
  disclaimer: string;
};

type Act = "hero" | "focus" | "entry" | "born";

const ramp = (v: number, dir?: string): string => {
  const bad = dir === "pos" ? 11 - v : v;
  if (bad <= 3) return C.good;
  if (bad <= 5) return C.warn;
  if (bad <= 7) return C.alert;
  return C.bad;
};

const todayLabel = (): string =>
  new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/* ---------- act one ---------- */

/** The glimpse. Six fragments of a journal that already has a history — a
    rating, a photograph, a note, a trend with a flare shaded behind it, a dose
    ticked off, a flare that ended. Between them they name everything the app
    records, without a word of explanation. */
function HeroCollage({ Icon }: { Icon: Props["Icon"] }) {
  return (
    <div className="fhj-fr-collage" aria-hidden="true">
      <span className="fhj-fr-rail" data-hero-rail />

      <div className="fhj-fr-strip">
        <div className="fhj-fr-row is-a" data-hero-card>
          <span className="fhj-fr-node" style={{ background: C.alert }} />
          <div className="fhj-fr-frag is-rating">
            <span className="fhj-fr-frag-eyebrow">Tue 12</span>
            <span className="fhj-fr-frag-row">
              <span className="fhj-fr-frag-score" style={{ color: C.alert }}>7</span>
              <span className="fhj-fr-frag-meta">overall severity<br />itch 6 · sleep 4</span>
            </span>
          </div>
        </div>

        <div className="fhj-fr-row is-b" data-hero-card>
          <span className="fhj-fr-node is-soft" />
          <div className="fhj-fr-frag is-photo">
            <span className="fhj-fr-photo" />
            <span className="fhj-fr-frag-meta">Neck · 14 days apart</span>
          </div>
        </div>

        <div className="fhj-fr-row is-c" data-hero-card>
          <span className="fhj-fr-node is-soft" />
          <div className="fhj-fr-frag is-note">
            <span className="fhj-fr-frag-eyebrow">Wed 13 · note</span>
            <span className="fhj-fr-frag-note">“Slept badly. Flared after the gym.”</span>
          </div>
        </div>

        <div className="fhj-fr-row is-d" data-hero-card>
          <span className="fhj-fr-node is-soft" />
          <div className="fhj-fr-chips">
            <span className="fhj-fr-chip">
              <Icon name="check" size={11} color={C.good} /> CeraVe · 2 pumps
            </span>
            <span className="fhj-fr-chip">
              <Icon name="spark" size={11} color={C.warn} /> Flare ended · 9 days
            </span>
          </div>
        </div>

        <div className="fhj-fr-row is-e" data-hero-card>
          <span className="fhj-fr-node" style={{ background: C.accent }} />
          <div className="fhj-fr-frag is-trend">
            <svg viewBox="0 0 160 44" preserveAspectRatio="none" className="fhj-fr-spark">
              <rect x="58" y="0" width="34" height="44" fill={C.bad} opacity="0.18" rx="3" />
              <path d="M2 32 L18 27 L34 31 L50 21 L66 9 L82 7 L98 17 L114 26 L130 31 L158 34"
                fill="none" stroke={C.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="fhj-fr-frag-meta">3 months · the flare, shaded</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- the scale, at hero size ---------- */

/**
 * Ten targets, and a thumb can also just slide across them.
 *
 * Tapping is the contract; dragging is the thing nobody expects and everybody
 * tries a second time. The value is read straight off the pointer's x within
 * the row, so a slow drag walks the number up with a tick at every rung — ten
 * buttons become one control.
 *
 * Two details make it behave. It does not capture the pointer, because capture
 * retargets the click and the plain tap — the contract — would stop working.
 * And a drag suppresses the click that ends it, or lifting your thumb over the
 * rung you just dragged to would toggle that value straight back off.
 */
function BigScale({ label, dir, value, onPick }: {
  label: string; dir?: string; value: number | null; onPick: (n: number, el: HTMLElement) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);
  const justDragged = useRef(false);
  const last = useRef<number | null>(null);

  const rungAt = (n: number): HTMLElement | null =>
    rowRef.current?.querySelector<HTMLElement>(`[data-rung="${n}"]`) ?? null;

  const drag = (clientX: number) => {
    const row = rowRef.current;
    if (!row) return;
    const r = row.getBoundingClientRect();
    if (!r.width) return;
    const n = Math.min(10, Math.max(1, Math.floor(((clientX - r.left) / r.width) * 10) + 1));
    if (n === last.current) return;
    last.current = n;
    const el = rungAt(n);
    if (el) onPick(n, el);
  };

  const end = () => {
    if (dragging.current) justDragged.current = true;
    dragging.current = false;
    startX.current = null;
    last.current = null;
  };

  return (
    <div className="fhj-fr-scale" role="group" aria-label={label} ref={rowRef}
      onPointerDown={(e) => {
        /* Cleared here rather than when the click consumes it: a drag that
           ends off a rung produces no click at all, and a stale flag would
           silently eat the *next* tap. */
        justDragged.current = false;
        startX.current = e.clientX;
        last.current = value;
      }}
      onPointerMove={(e) => {
        if (startX.current == null) return;
        if (!dragging.current && Math.abs(e.clientX - startX.current) < 6) return;
        dragging.current = true;
        drag(e.clientX);
      }}
      onPointerUp={end} onPointerCancel={end} onPointerLeave={end}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const filled = value != null && n <= value;
        return (
          <button key={n} type="button" data-rung={n}
            aria-label={`${label} ${n} out of 10`} aria-pressed={value === n}
            onClick={(e) => {
              if (justDragged.current) return;   // the click that ends a drag
              onPick(n, e.currentTarget);
            }}
            className={"fhj-fr-rung" + (filled ? " is-filled" : "") + (value === n ? " is-picked" : "")}
            style={filled ? ({ "--fhj-rung": ramp(value!, dir) } as React.CSSProperties) : undefined}>
            {n}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- the component ---------- */

export default function FirstRun({
  packs, onComplete, onLoadSample, onDetailed, Icon, appName, disclaimer,
}: Props) {
  const [act, setAct] = useState<Act>("hero");
  const [mods, setMods] = useState<string[]>([]);
  const [metricKey, setMetricKey] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [showAllPacks, setShowAllPacks] = useState(false);
  const [promises, setPromises] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);
  const actRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const landingRef = useRef<HTMLDivElement>(null);
  const bornRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef<HTMLSpanElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const flight = useRef<CardFlight | null>(null);

  const chosen = useMemo(() => packs.filter((p) => mods.includes(p.key)), [packs, mods]);

  /* Every 1–10 question the chosen packs bring, de-duplicated, headline first.
     The main number is a default with an escape hatch, not an interrogation:
     the pack's own answer is pre-selected and swapping it is one tap. */
  const scales = useMemo(() => {
    const seen = new Set<string>();
    const out: FirstRunScale[] = [];
    for (const p of chosen) {
      for (const s of p.scales) {
        if (seen.has(s.k)) continue;
        seen.add(s.k);
        out.push(s);
      }
    }
    return out;
  }, [chosen]);

  const metric = useMemo(
    () => scales.find((s) => s.k === metricKey) || scales.find((s) => s.k === chosen[0]?.keyMetric) || scales[0] || null,
    [scales, metricKey, chosen]
  );

  /* ---------- choreography ---------- */

  useLayoutEffect(() => {
    if (act !== "hero") return;
    return heroIn(heroRef.current);
  }, [act]);

  useLayoutEffect(() => {
    if (act === "hero" || act === "born") return;
    return actIn(actRef.current);
  }, [act]);

  useLayoutEffect(() => {
    if (act !== "born") return;
    const stop = landCard(flight.current, landingRef.current, () => {
      flight.current = null;
      buildTimeline(bornRef.current);
      countUp(streakRef.current, 1, 0.8);
      bloom(bloomRef.current);
    });
    return () => { stop(); flight.current = null; };
  }, [act]);

  /* The hero is a full-bleed screen; nothing behind it should scroll. */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = act === "hero" ? "hidden" : prev;
    return () => { document.body.style.overflow = prev; };
  }, [act]);

  /* ---------- actions ---------- */

  const start = () => { feedback("complete"); setAct("focus"); };

  const togglePack = (key: string) => {
    feedback("select");
    setMods((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const toEntry = () => { feedback("nav"); setAct("entry"); };

  const pick = (n: number, el: HTMLElement) => {
    if (score === n) { feedback("erase"); setScore(null); return; }
    feedback("quickadd", { el });
    place("scale", n, 10);
    setScore(n);
    rungPop(el);
    readoutSwap(readoutRef.current);
  };

  const save = () => {
    feedback("milestone");
    flight.current = liftCard(cardRef.current);
    setAct("born");
  };

  const finish = () => {
    feedback("complete");
    onComplete({ modules: mods, keyMetric: metric?.k ?? null, score, note: note.trim() });
  };

  /* ---------- act one: the promise ---------- */

  if (act === "hero") {
    return (
      <div className="fhj-fr fhj-fr-hero" ref={heroRef}>
        <HeroCollage Icon={Icon} />

        <div className="fhj-fr-hero-body">
          <div className="fhj-fr-eyebrow" data-hero-cta>{appName}</div>
          <h1 className="fhj-fr-display">
            <span className="fhj-fr-mask"><span data-hero-line>Your health,</span></span>
            <span className="fhj-fr-mask"><span data-hero-line>remembered.</span></span>
          </h1>
          <p className="fhj-fr-sub" data-hero-cta>
            How you felt. What happened. What changed —
            <span style={{ color: C.subtle }}> kept, in your own words, on this device.</span>
          </p>

          <div className="fhj-fr-actions" data-hero-cta>
            <button type="button" onClick={start} className="fhj-fr-primary">
              <span>Start my journal</span>
              <Icon name="right" size={17} color={C.onAccent} />
            </button>
            <button type="button" onClick={() => { feedback("nav"); onLoadSample(); }} className="fhj-fr-ghost">
              Look around with example data
            </button>
          </div>

          <div className="fhj-fr-fine" data-hero-cta>
            <button type="button" className="fhj-fr-fine-btn"
              aria-expanded={promises}
              onClick={() => { feedback("tap"); setPromises((v) => !v); }}>
              No account · stays on this device · not medical advice
              <Icon name={promises ? "up" : "down"} size={12} color={C.subtle} />
            </button>
            {promises && (
              <p className="fhj-fr-fine-body">{disclaimer}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- act two: the only question ---------- */

  if (act === "focus") {
    const shown = showAllPacks ? packs : packs.slice(0, 6);
    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <div className="fhj-fr-step" data-act-block>Step 1 of 2</div>
          <h1 className="fhj-fr-display is-small" data-act-block>What are you tracking?</h1>
          <p className="fhj-fr-sub" data-act-block>
            Pick one or more. It only sets your starting questions — everything is changeable later.
          </p>

          <div className="fhj-fr-packs" data-act-block>
            {shown.map((p) => {
              const on = mods.includes(p.key);
              return (
                <button key={p.key} type="button" onClick={() => togglePack(p.key)} aria-pressed={on}
                  className={"fhj-fr-pack" + (on ? " is-on" : "")}
                  style={on ? ({ "--fhj-pack": p.color } as React.CSSProperties) : undefined}>
                  <span className="fhj-fr-pack-mark">
                    <Icon name={on ? "check" : p.icon} size={16}
                      color={on ? readableInk(p.color) : C.sub} />
                  </span>
                  <span className="fhj-fr-pack-name">{p.label}</span>
                  <span className="fhj-fr-pack-blurb">{p.blurb}</span>
                </button>
              );
            })}
          </div>

          {!showAllPacks && packs.length > 6 && (
            <button type="button" data-act-block className="fhj-fr-more"
              onClick={() => { feedback("tap"); setShowAllPacks(true); }}>
              Something else — show all {packs.length}
            </button>
          )}
        </div>

        <div className="fhj-fr-foot">
          <button type="button" onClick={toEntry} disabled={!mods.length}
            className="fhj-fr-primary">
            <span>{mods.length ? "Continue" : "Pick what you're tracking"}</span>
            {mods.length ? <Icon name="right" size={17} color={C.onAccent} /> : null}
          </button>
          <button type="button" className="fhj-fr-ghost"
            onClick={() => { feedback("nav"); onDetailed(); }}>
            Set everything up in detail instead
          </button>
        </div>
      </div>
    );
  }

  /* ---------- act three: the first entry ---------- */

  if (act === "entry") {
    const ask = metric?.ask || (metric ? `${metric.label} today?` : "How is today?");
    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <div className="fhj-fr-step" data-act-block>Step 2 of 2</div>
          <h1 className="fhj-fr-display is-small" data-act-block>{ask}</h1>

          {/* This card is the thing that flies. It is laid out here exactly as
              it will look on the timeline, because the trick only works if the
              two are the same object. */}
          <div className={"fhj-fr-card" + (score != null ? " is-live" : "")} ref={cardRef} data-act-block
            style={score != null ? ({ "--fhj-day": ramp(score, metric?.dir) } as React.CSSProperties) : undefined}>
            <div className="fhj-fr-card-head">
              <span className="fhj-fr-card-date">{todayLabel()}</span>
              <span className="fhj-fr-card-badge"
                style={score != null
                  ? { background: ramp(score, metric?.dir), color: readableInk(ramp(score, metric?.dir)) }
                  : { background: C.faint, color: C.subtle }}>
                {score != null ? `${score}/10` : "—"}
              </span>
            </div>
            <div className="fhj-fr-readout" ref={readoutRef}>
              {score != null ? (
                <>
                  <span className="fhj-fr-readout-num" style={{ color: ramp(score, metric?.dir) }}>{score}</span>
                  <span className="fhj-fr-readout-word">{scoreWord(score, metric?.dir as never)}</span>
                </>
              ) : (
                <span className="fhj-fr-readout-hint">Tap a number. That is the whole entry.</span>
              )}
            </div>
            <BigScale label={metric?.label || "Today"} dir={metric?.dir} value={score} onPick={pick} />
            <div className="fhj-fr-scale-ends">
              <span>{metric?.dir === "pos" ? "1 · low" : "1 · none"}</span>
              <span>{metric?.dir === "pos" ? "10 · great" : "10 · severe"}</span>
            </div>
            {(noteOpen || note) && (
              <div className="fhj-fr-note">
                <textarea rows={2} autoFocus value={note} maxLength={400}
                  aria-label="Note for today"
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What happened today?" />
              </div>
            )}
          </div>

          {!noteOpen && !note && (
            <button type="button" data-act-block className="fhj-fr-more"
              onClick={() => { feedback("tap"); setNoteOpen(true); }}>
              + Add a note
            </button>
          )}

          {scales.length > 1 && (
            <div className="fhj-fr-swap" data-act-block>
              <span className="fhj-fr-swap-label">Rather track</span>
              <div className="fhj-fr-swap-chips">
                {scales.slice(0, 6).map((s) => (
                  <button key={s.k} type="button" aria-pressed={metric?.k === s.k}
                    onClick={() => { feedback("select"); setMetricKey(s.k); }}
                    className={"fhj-fr-swap-chip" + (metric?.k === s.k ? " is-on" : "")}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="fhj-fr-foot">
          <button type="button" onClick={save} disabled={score == null} className="fhj-fr-primary">
            <span>{score == null ? "Pick a number to save it" : "Save my first entry"}</span>
            {score != null ? <Icon name="check" size={17} color={C.onAccent} /> : null}
          </button>
          <button type="button" className="fhj-fr-ghost" onClick={() => { feedback("nav"); setAct("focus"); }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  /* ---------- act four: the journal begins ---------- */

  return (
    <div className="fhj-fr" ref={bornRef}>
      <div className="fhj-fr-act is-born">
        <div className="fhj-fr-bloom" ref={bloomRef} aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => <span key={i} data-bloom-dot />)}
        </div>

        <div className="fhj-fr-timeline">
          <span className="fhj-fr-tl-rail" data-tl-rail aria-hidden="true" />
          <div className="fhj-fr-tl-row">
            <span className="fhj-fr-tl-dot" data-tl-dot aria-hidden="true"
              style={{ background: score != null ? ramp(score, metric?.dir) : C.accent }} />
            {/* Where the card lands. Identical markup to the one in act three,
                which is what makes the flight read as one object moving. */}
            <div className="fhj-fr-card is-landed" ref={landingRef}>
              <div className="fhj-fr-card-head">
                <span className="fhj-fr-card-date">{todayLabel()}</span>
                <span className="fhj-fr-card-badge"
                  style={score != null
                    ? { background: ramp(score, metric?.dir), color: readableInk(ramp(score, metric?.dir)) }
                    : { background: C.faint, color: C.subtle }}>
                  {score != null ? `${score}/10` : "—"}
                </span>
              </div>
              <div className="fhj-fr-card-body">
                <span className="fhj-fr-card-metric">{metric?.label}</span>
                {note.trim() && <span className="fhj-fr-card-note">“{note.trim()}”</span>}
              </div>
            </div>
          </div>

          {/* The days not lived yet. Drawn as the faintest possible thing on
              the screen — the future is the product, and it is empty on
              purpose. */}
          {["Tomorrow", "Thursday", "Friday"].map((d) => (
            <div className="fhj-fr-tl-row is-ghost" key={d} data-tl-ghost aria-hidden="true">
              <span className="fhj-fr-tl-dot is-ghost" />
              <div className="fhj-fr-ghost-card"><span>{d}</span></div>
            </div>
          ))}
        </div>

        <div className="fhj-fr-born-copy">
          <div className="fhj-fr-streak" data-tl-line>
            <span className="fhj-fr-streak-num" ref={streakRef}>1</span>
            <span className="fhj-fr-streak-label">day on the record</span>
          </div>
          <h1 className="fhj-fr-display is-small" data-tl-line>Your journal has begun.</h1>
          <p className="fhj-fr-sub" data-tl-line>
            Keep going and it answers what memory cannot.
          </p>
          <ol className="fhj-fr-beats">
            {[
              ["spark", "How you felt", "one number, every day"],
              ["note", "What happened", "notes, meals, doses, photos"],
              ["trends", "What changed", "trends, flares, a page for your doctor"],
            ].map(([icon, title, sub]) => (
              <li key={title} data-tl-line>
                <span className="fhj-fr-beat-mark"><Icon name={icon} size={13} color={C.accentText} /></span>
                <span>
                  <b>{title}</b>
                  <span>{sub}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="fhj-fr-foot">
        <button type="button" onClick={finish} className="fhj-fr-primary">
          <span>Open my journal</span>
          <Icon name="right" size={17} color={C.onAccent} />
        </button>
      </div>
    </div>
  );
}
