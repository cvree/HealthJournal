/* The first two minutes.

   Somebody has just installed a health journal, which means something is
   wrong — or they are afraid something might be. They do not want a product
   tour. They want to believe this will be worth the effort, and then they want
   to put something down.

   So this is not a wizard, and there is no longer a door marked "set
   everything up in detail instead". A door like that is an admission: it says
   the fast path is the cheap one and the real setup is somewhere else, and it
   makes the person who most needs help choose, on screen two, between being
   rushed and being buried. There is one path now, it is the good one, and it
   is composed as six acts:

     1. **The promise.** One line, and a glimpse of a journal already alive —
        a rating, a photograph, a note, a trend, a flare that ended. The claim
        the app is making, shown rather than explained. The privacy facts are
        one tap below it, before anything has been typed.
     2. **The only question that cannot be defaulted.** What are you tracking?
     3. **What it will ask you.** Their check-in, in their own words, with a
        live count of how long a day will take and their own questions welcome
        at the bottom. Everything is already answered — this is somebody
        adjusting a thing that works, never filling in a form.
     4. **What else it should keep.** Photos, meals, doses, flares, a nudge in
        the evening. Every choice here lights up a one-tap button on their
        dashboard, and the row of buttons assembles under their thumb as they
        pick — the app being built in front of them out of their own answers.
     5. **The first entry.** Real, not a demo. The number they pick is written
        to their journal.
     6. **The journal beginning.** The card they just filled in physically
        becomes the first card on their timeline, the rail draws itself
        downward into the days they have not lived yet, and the streak counts
        to one.

   Two rules hold the middle three together, and they are the reason this can
   be four steps without feeling like four steps:

   - **Nothing is ever demanded.** Every screen after the first arrives already
     answered with a sensible default, so Continue is always live and a person
     who wants to be through in thirty seconds still can be.
   - **Every choice shows its consequence immediately.** Switching a question
     off changes the "about 25 seconds a day" line under it. Ticking Photos
     puts a camera button in the preview row. Nothing is filed away to be
     discovered later; the app is assembled in front of the person making it.

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

/** One thing a check-in can ask, as the tuning act needs to draw it. */
export interface FirstRunQuestion {
  k: string;
  label: string;
  type: string;
  sec?: string;
  /** In the pack's own everyday set — what "balanced" means. */
  quick?: boolean;
  dir?: string;
}

export interface FirstRunPack {
  key: string;
  label: string;
  color: string;
  blurb: string;
  icon: string;
  keyMetric: string;
  scales: FirstRunScale[];
  /** Everything this pack can ask, minus photos and weight — those are
      choices in act four, not questions in act three. */
  questions: FirstRunQuestion[];
  /** "skin" packs photograph body areas; everything else photographs
      progress. Decides which face the Photos choice wears. */
  photoKind?: "skin" | "progress";
}

/** Something a journal can hold that is not a daily question: photos, meals,
    doses, flares. Each one that is switched on turns into a one-tap button. */
export interface FirstRunExtra {
  id: string;
  label: string;
  blurb: string;
  icon: string;
  /** The Quick Add button it lights up, for the preview row. */
  tile?: { label: string; icon: string };
  /** Modules this is pre-ticked for. Everything is always *offered*. */
  suggest?: string[];
  /** Photos: opens the body map underneath when it is on. */
  spots?: boolean;
}

export interface FirstRunCustom {
  id: string;
  label: string;
  type: string;
}

export interface FirstRunSpot {
  part: string;
  side: string;
}

export interface FirstRunChoice {
  modules: string[];
  keyMetric: string | null;
  score: number | null;
  note: string;
  /** Question keys left switched on. */
  enabledKeys: string[];
  /** Questions the person wrote themselves. */
  customQuestions: { label: string; type: string }[];
  extras: string[];
  spots: FirstRunSpot[];
  /** "HH:MM" for a daily nudge, or null for none. */
  reminder: string | null;
}

type Props = {
  packs: FirstRunPack[];
  extras: FirstRunExtra[];
  onComplete: (choice: FirstRunChoice) => void;
  onLoadSample: () => void;
  /** The app's icon set, passed in so this file draws nothing of its own. */
  Icon: React.ComponentType<{ name: string; size?: number; color?: string }>;
  /** The tappable body map, for the packs that photograph body areas. */
  BodyMap?: React.ComponentType<{
    spots: FirstRunSpot[];
    onToggle: (s: FirstRunSpot) => void;
    tint: string;
  }>;
  spotLabel?: (s: FirstRunSpot) => string;
  appName: string;
  disclaimer: string;
  /** The checkable facts about this build. Shown on the hero, before
      anything has been typed. */
  promises?: [string, string][];
};

type Act = "hero" | "focus" | "tune" | "extras" | "entry" | "born";

/** The numbered part of the flow. The hero is before it and the birth is
    after it — neither is a step somebody is being walked through. */
const FLOW: Act[] = ["focus", "tune", "extras", "entry"];

const ramp = (v: number, dir?: string): string => {
  const bad = dir === "pos" ? 11 - v : v;
  if (bad <= 3) return C.good;
  if (bad <= 5) return C.warn;
  if (bad <= 7) return C.alert;
  return C.bad;
};

const todayLabel = (): string =>
  new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/* ---------- how long a day will take ----------

   The honest cost of a check-in, in seconds, so that "switch this on" and
   "this costs you something" are the same gesture. The numbers are a
   deliberately blunt model — a 1–10 row is a tap, a text box is a sentence —
   and it is rounded hard on the way out, because a readout that says "27
   seconds" is claiming a precision nobody has and a readout that says "about
   half a minute" is telling the truth. */
const SECONDS_PER: Record<string, number> = {
  scale: 4, toggle: 2, chips: 7, number: 5, text: 14, time: 5, date: 5,
};

export function checkInSeconds(qs: { type: string }[]): number {
  return qs.reduce((n, q) => n + (SECONDS_PER[q.type] ?? 4), 0);
}

export function checkInTimeLabel(seconds: number): string {
  if (seconds <= 0) return "no time at all";
  if (seconds < 75) return `about ${Math.max(5, Math.round(seconds / 5) * 5)} seconds`;
  const mins = Math.round((seconds / 60) * 2) / 2;
  return `about ${mins % 1 ? mins : Math.round(mins)} minute${mins > 1 ? "s" : ""}`;
}

/** What each kind of question feels like to answer, said in the words
    somebody would use rather than the type name in the data model. */
const TYPE_HINT: Record<string, string> = {
  scale: "1–10", toggle: "yes / no", chips: "pick any", number: "a number",
  text: "a few words", time: "a time", date: "a date",
};

const CUSTOM_TYPES: [string, string, string][] = [
  ["scale", "1–10", "A severity or a rating"],
  ["toggle", "Yes / no", "Did it happen or not"],
  ["number", "A number", "Counts, minutes, anything measured"],
];

const REMINDERS: [string | null, string, string][] = [
  ["08:00", "Morning", "8:00 am"],
  ["20:00", "Evening", "8:00 pm"],
  ["22:00", "Night", "10:00 pm"],
  [null, "Not now", "Ask me later"],
];

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

/* ---------- the rail across the top of the numbered acts ---------- */

/** Where you are, and how much is left, without a number nobody trusts.

    Four segments, filled behind you and hollow ahead — the same shape as the
    timeline the last act draws, which is not an accident: this app's one
    picture is a line of days, and its progress indicator is a short one. */
function StepRail({ index, labels }: { index: number; labels: string[] }) {
  return (
    <div className="fhj-fr-rail-steps" aria-hidden="true">
      {labels.map((l, i) => (
        <span key={l} className={"fhj-fr-rail-seg" + (i < index ? " is-done" : i === index ? " is-now" : "")}>
          <span className="fhj-fr-rail-bar" />
          <span className="fhj-fr-rail-label">{l}</span>
        </span>
      ))}
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
  packs, extras, onComplete, onLoadSample, Icon, BodyMap, spotLabel, appName, disclaimer, promises = [],
}: Props) {
  const [act, setAct] = useState<Act>("hero");
  const [mods, setMods] = useState<string[]>([]);
  const [metricKey, setMetricKey] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [showAllPacks, setShowAllPacks] = useState(false);
  const [openPromises, setOpenPromises] = useState(false);

  /* Act three. `depth` is the preset somebody is on; `hand` is what they did
     to it afterwards. Null means "still following the preset", which is what
     lets changing a pack on the screen before this one re-derive the whole
     list instead of stranding a set of answers about questions that no longer
     exist. */
  const [depth, setDepth] = useState<"light" | "balanced" | "full">("balanced");
  const [hand, setHand] = useState<Set<string> | null>(null);
  const [customs, setCustoms] = useState<FirstRunCustom[]>([]);
  const [writing, setWriting] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftType, setDraftType] = useState("scale");
  const [openSecs, setOpenSecs] = useState<Set<string> | null>(null);

  /* Act four. */
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [spots, setSpots] = useState<FirstRunSpot[]>([]);
  const [reminder, setReminder] = useState<string | null>("20:00");

  const heroRef = useRef<HTMLDivElement>(null);
  const actRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const landingRef = useRef<HTMLDivElement>(null);
  const bornRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef<HTMLSpanElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const costRef = useRef<HTMLDivElement>(null);
  const flight = useRef<CardFlight | null>(null);
  const dir = useRef<1 | -1>(1);

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

  /* Every question the chosen packs can ask, de-duplicated, in pack order —
     plus the ones this person wrote themselves, which always sit last because
     they are the newest thing on the screen. */
  const catalogue = useMemo(() => {
    const seen = new Set<string>();
    const out: FirstRunQuestion[] = [];
    for (const p of chosen) {
      for (const q of p.questions) {
        if (seen.has(q.k)) continue;
        seen.add(q.k);
        out.push(q);
      }
    }
    for (const c of customs) {
      out.push({ k: c.id, label: c.label, type: c.type, sec: "Your own questions", quick: true });
    }
    return out;
  }, [chosen, customs]);

  const defaultMetric = chosen[0]?.keyMetric ?? null;
  const activeMetric = metricKey ?? defaultMetric;

  /** Which questions a depth preset means. The main number is in all three:
      a journal with no number is not a journal. */
  const presetKeys = (mode: "light" | "balanced" | "full"): Set<string> => {
    if (mode === "full") return new Set(catalogue.map((q) => q.k));
    const out = new Set<string>();
    if (activeMetric) out.add(activeMetric);
    const quick = catalogue.filter((q) => q.quick && q.k !== activeMetric);
    for (const q of mode === "light" ? quick.slice(0, 3) : quick) out.add(q.k);
    for (const c of customs) out.add(c.id);
    return out;
  };

  const enabled = useMemo(() => {
    const base = hand ?? presetKeys(depth);
    const out = new Set<string>();
    for (const q of catalogue) if (base.has(q.k)) out.add(q.k);
    if (activeMetric) out.add(activeMetric); // never switchable off
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue, depth, hand, activeMetric, customs]);

  const enabledQs = useMemo(() => catalogue.filter((q) => enabled.has(q.k)), [catalogue, enabled]);
  const seconds = useMemo(() => checkInSeconds(enabledQs), [enabledQs]);

  /* Sections, in the order the packs put them in. */
  const sections = useMemo(() => {
    const map = new Map<string, FirstRunQuestion[]>();
    for (const q of catalogue) {
      const sec = q.sec || "Other";
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(q);
    }
    return [...map.entries()];
  }, [catalogue]);

  /* The everyday sections stand open and the long tail is folded, so the
     screen is a page rather than a scroll. Which ones those are is derived
     from the packs, so it follows a change of mind on the screen before. */
  const defaultOpen = useMemo(() => {
    const out = new Set<string>();
    sections.forEach(([sec, qs], i) => {
      /* Open: the first couple, whichever holds the daily number, and — always
         — anything this person wrote themselves. A question somebody has just
         typed disappearing behind a fold is the app losing their work in front
         of them. */
      if (i < 2
        || qs.some((q) => q.k === activeMetric)
        || qs.some((q) => customs.some((c) => c.id === q.k))) out.add(sec);
    });
    return out;
  }, [sections, activeMetric, customs]);
  const openNow = openSecs ?? defaultOpen;

  /* Which extras start ticked: the ones this person's own conditions reach
     for. Recomputed while `picked` is still null so that going back a step and
     changing a pack updates it, and frozen the moment they touch one. */
  const suggestedExtras = useMemo(() => {
    const out = new Set<string>();
    for (const e of extras) {
      if ((e.suggest || []).some((m) => mods.includes(m))) out.add(e.id);
    }
    return out;
  }, [extras, mods]);
  const chosenExtras = picked ?? suggestedExtras;

  const wantsSpots = useMemo(
    () => chosenExtras.has("photos") && chosen.some((p) => p.photoKind === "skin") && !!BodyMap,
    [chosenExtras, chosen, BodyMap]
  );

  /* The row of one-tap buttons this setup is building, drawn as it is chosen.
     Check-in always leads it — it is the one thing worth doing every day. */
  const previewTiles = useMemo(() => {
    const out = [{ label: "Check-in", icon: "log" }];
    for (const e of extras) {
      if (e.tile && chosenExtras.has(e.id)) out.push(e.tile);
    }
    return out;
  }, [extras, chosenExtras]);

  const metric = useMemo(
    () => scales.find((s) => s.k === activeMetric) || scales.find((s) => enabled.has(s.k)) || scales[0] || null,
    [scales, activeMetric, enabled]
  );

  /* Only the questions that survived act three can be the main number — a
     journal pointed at a question it never asks is worse than one that falls
     back to its pack's default. */
  const metricChoices = useMemo(
    () => scales.filter((s) => enabled.has(s.k)).slice(0, 6),
    [scales, enabled]
  );

  /* ---------- choreography ---------- */

  useLayoutEffect(() => {
    if (act !== "hero") return;
    return heroIn(heroRef.current);
  }, [act]);

  useLayoutEffect(() => {
    if (act === "hero" || act === "born") return;
    return actIn(actRef.current, dir.current);
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

  /* The cost line answers back whenever the cost changes, so switching a
     question off is felt rather than merely recorded. */
  useEffect(() => {
    if (act === "tune") readoutSwap(costRef.current);
  }, [seconds, act]);

  /* The hero is a full-bleed screen; nothing behind it should scroll. */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = act === "hero" ? "hidden" : prev;
    return () => { document.body.style.overflow = prev; };
  }, [act]);

  /* Each numbered act starts at its own top. Without this, arriving at a long
     question list halfway down it reads as a broken screen. */
  useEffect(() => {
    if (act !== "hero") window.scrollTo?.(0, 0);
  }, [act]);

  /* ---------- moving between acts ---------- */

  const go = (next: Act, back = false) => {
    dir.current = back ? -1 : 1;
    feedback(back ? "tap" : "nav");
    setAct(next);
  };

  const stepIndex = FLOW.indexOf(act);

  /* ---------- actions ---------- */

  const start = () => { feedback("complete"); dir.current = 1; setAct("focus"); };

  const togglePack = (key: string) => {
    feedback("select");
    setMods((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    /* A different set of packs is a different set of questions, so any
       hand-made list is about a screen that no longer exists. The preset is
       re-derived rather than patched. */
    setHand(null);
    setOpenSecs(null);
  };

  /* A preset is a starting point, not a mode: the first tap on a question
     lifts the list out of the preset and into the person's own hands, and the
     preset chips stop claiming to describe it. */
  const toggleQuestion = (q: FirstRunQuestion) => {
    if (q.k === activeMetric) return; // the daily number stays
    feedback("select");
    setHand(() => {
      const next = new Set(enabled);
      if (next.has(q.k)) next.delete(q.k);
      else next.add(q.k);
      return next;
    });
  };

  const setPreset = (mode: "light" | "balanced" | "full") => {
    feedback("select");
    setDepth(mode);
    setHand(null);
  };

  const addCustom = () => {
    const label = draftLabel.trim();
    if (!label) return;
    feedback("save");
    const id = `own_${customs.length}_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 16)}`;
    setCustoms((prev) => [...prev, { id, label, type: draftType }]);
    /* A question somebody just wrote is on. Obviously — but only obvious if
       the hand-made list is told about it. */
    setHand((prev) => (prev ? new Set([...prev, id]) : prev));
    setOpenSecs((prev) => (prev ? new Set([...prev, "Your own questions"]) : prev));
    setDraftLabel("");
    setWriting(false);
  };

  const toggleExtra = (id: string) => {
    feedback("select");
    setPicked((prev) => {
      const next = new Set(prev ?? suggestedExtras);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSpot = (s: FirstRunSpot) => {
    feedback("select");
    setSpots((prev) => {
      const hit = prev.find((x) => x.part === s.part && (x.side || "") === (s.side || ""));
      return hit
        ? prev.filter((x) => x !== hit)
        : [...prev, { part: s.part, side: s.side || "" }];
    });
  };

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
    dir.current = 1;
    setAct("born");
  };

  const finish = () => {
    feedback("complete");
    onComplete({
      modules: mods,
      keyMetric: metric?.k ?? null,
      score,
      note: note.trim(),
      enabledKeys: enabledQs.filter((q) => !q.k.startsWith("own_")).map((q) => q.k),
      customQuestions: customs
        .filter((c) => enabled.has(c.id))
        .map((c) => ({ label: c.label, type: c.type })),
      extras: [...chosenExtras],
      spots: wantsSpots ? spots : [],
      reminder,
    });
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
              aria-expanded={openPromises}
              onClick={() => { feedback("tap"); setOpenPromises((v) => !v); }}>
              No account · stays on this device · not medical advice
              <Icon name={openPromises ? "up" : "down"} size={12} color={C.subtle} />
            </button>
            {openPromises && (
              <div className="fhj-fr-fine-body">
                {/* Five checkable facts about this build, before anything has
                    been typed. A privacy paragraph is read by nobody; a list
                    somebody could go and verify is the only kind of trust
                    claim worth making to a stranger. */}
                <ul className="fhj-fr-promises">
                  {promises.map(([icon, text]) => (
                    <li key={text}>
                      <span className="fhj-fr-promise-mark">
                        <Icon name={icon} size={12} color={C.accentText} />
                      </span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
                <p>{disclaimer}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- act two: the only question ---------- */

  if (act === "focus") {
    const shown = showAllPacks ? packs : packs.slice(0, 6);
    const questionCount = catalogue.length;
    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <StepRail index={0} labels={["Tracking", "Questions", "Extras", "First entry"]} />
          <div className="fhj-fr-step" data-act-block>Step 1 of 4</div>
          <h1 className="fhj-fr-display is-small" data-act-block>What are you tracking?</h1>
          <p className="fhj-fr-sub" data-act-block>
            Pick one or more. It only sets your starting questions — you'll shape them on the
            next screen, and change them any time after that.
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

          {/* The consequence of the choice, immediately. Two packs is not an
              abstraction once it says what it brings with it. */}
          {mods.length > 0 && (
            <p className="fhj-fr-hint" aria-live="polite">
              {questionCount} questions to start from, and you choose which of them get asked.
            </p>
          )}
        </div>

        <div className="fhj-fr-foot">
          <button type="button" onClick={() => go("tune")} disabled={!mods.length}
            className="fhj-fr-primary">
            <span>{mods.length ? "Continue" : "Pick what you're tracking"}</span>
            {mods.length ? <Icon name="right" size={17} color={C.onAccent} /> : null}
          </button>
        </div>
      </div>
    );
  }

  /* ---------- act three: what it will ask you ---------- */

  if (act === "tune") {
    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <StepRail index={1} labels={["Tracking", "Questions", "Extras", "First entry"]} />
          <div className="fhj-fr-step" data-act-block>Step 2 of 4</div>
          <h1 className="fhj-fr-display is-small" data-act-block>What should it ask you?</h1>
          <p className="fhj-fr-sub" data-act-block>
            This is your daily check-in. It's already set up — adjust it if you want to, or keep
            going and change it later.
          </p>

          {/* The cost of the thing being built, live. A journal is abandoned
              because it got long, and the only defence is showing the length
              while it is being chosen rather than on day nine. */}
          <div className="fhj-fr-cost" data-act-block>
            <div ref={costRef} className="fhj-fr-cost-read">
              <span className="fhj-fr-cost-num">{enabledQs.length}</span>
              <span className="fhj-fr-cost-word">
                question{enabledQs.length === 1 ? "" : "s"}<br />
                <b>{checkInTimeLabel(seconds)} a day</b>
              </span>
            </div>
            <div className="fhj-fr-depth" role="group" aria-label="How much to ask">
              {([["light", "Quick"], ["balanced", "Balanced"], ["full", "Thorough"]] as const).map(([m, l]) => (
                <button key={m} type="button" aria-pressed={depth === m && !hand}
                  onClick={() => setPreset(m)}
                  className={"fhj-fr-depth-btn" + (depth === m && !hand ? " is-on" : "")}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="fhj-fr-qs" data-act-block>
            {sections.map(([sec, qs]) => {
              const onCount = qs.filter((q) => enabled.has(q.k)).length;
              const open = openNow.has(sec);
              return (
                <div key={sec} className="fhj-fr-qsec">
                  <button type="button" className="fhj-fr-qsec-head"
                    aria-expanded={open}
                    onClick={() => {
                      feedback("tap");
                      setOpenSecs(() => {
                        const next = new Set(openNow);
                        if (open) next.delete(sec);
                        else next.add(sec);
                        return next;
                      });
                    }}>
                    <span className="fhj-fr-qsec-name">{sec}</span>
                    <span className="fhj-fr-qsec-count">{onCount} of {qs.length}</span>
                    <Icon name={open ? "up" : "down"} size={13} color={C.subtle} />
                  </button>
                  {open && (
                    <div className="fhj-fr-qlist">
                      {qs.map((q) => {
                        const on = enabled.has(q.k);
                        const isMetric = q.k === activeMetric;
                        return (
                          <button key={q.k} type="button" role="switch" aria-checked={on}
                            disabled={isMetric}
                            onClick={() => toggleQuestion(q)}
                            className={"fhj-fr-q" + (on ? " is-on" : "") + (isMetric ? " is-locked" : "")}>
                            <span className="fhj-fr-q-mark">
                              {on ? <Icon name="check" size={12} color={C.onAccent} /> : null}
                            </span>
                            <span className="fhj-fr-q-body">
                              <span className="fhj-fr-q-label">{q.label}</span>
                              <span className="fhj-fr-q-type">
                                {isMetric ? "your daily number · always asked" : TYPE_HINT[q.type] || q.type}
                              </span>
                            </span>
                            {customs.some((c) => c.id === q.k) && (
                              <span className="fhj-fr-q-own">yours</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Somebody's own question, in their own words. The packs are a
              starting point and this is the line that says so out loud. */}
          {writing ? (
            <div className="fhj-fr-own" data-act-block>
              <label className="fhj-fr-own-label" htmlFor="fhj-own-q">Your question</label>
              <input id="fhj-own-q" autoFocus value={draftLabel} maxLength={60}
                onChange={(e) => setDraftLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
                placeholder="e.g. Hands · how bad today?" />
              <div className="fhj-fr-own-types" role="group" aria-label="Answer type">
                {CUSTOM_TYPES.map(([t, l, hint]) => (
                  <button key={t} type="button" aria-pressed={draftType === t}
                    onClick={() => { feedback("select"); setDraftType(t); }}
                    className={"fhj-fr-own-type" + (draftType === t ? " is-on" : "")}>
                    <b>{l}</b>
                    <span>{hint}</span>
                  </button>
                ))}
              </div>
              <div className="fhj-fr-own-actions">
                <button type="button" className="fhj-fr-ghost"
                  onClick={() => { feedback("tap"); setWriting(false); setDraftLabel(""); }}>
                  Cancel
                </button>
                <button type="button" className="fhj-fr-mini" disabled={!draftLabel.trim()} onClick={addCustom}>
                  Add it
                </button>
              </div>
            </div>
          ) : (
            <button type="button" data-act-block className="fhj-fr-more"
              onClick={() => { feedback("tap"); setWriting(true); }}>
              + Ask me something of my own
            </button>
          )}
        </div>

        <div className="fhj-fr-foot">
          <button type="button" onClick={() => go("extras")} className="fhj-fr-primary">
            <span>Continue</span>
            <Icon name="right" size={17} color={C.onAccent} />
          </button>
          <button type="button" className="fhj-fr-ghost" onClick={() => go("focus", true)}>Back</button>
        </div>
      </div>
    );
  }

  /* ---------- act four: what else it should keep ---------- */

  if (act === "extras") {
    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <StepRail index={2} labels={["Tracking", "Questions", "Extras", "First entry"]} />
          <div className="fhj-fr-step" data-act-block>Step 3 of 4</div>
          <h1 className="fhj-fr-display is-small" data-act-block>What else should it keep?</h1>
          <p className="fhj-fr-sub" data-act-block>
            A day holds more than a number. Everything you pick here becomes a one-tap button on
            your home screen — nothing else does, so keep it to what you'll actually use.
          </p>

          <div className="fhj-fr-extras" data-act-block>
            {extras.map((e) => {
              const on = chosenExtras.has(e.id);
              const suggested = suggestedExtras.has(e.id);
              return (
                <button key={e.id} type="button" aria-pressed={on}
                  onClick={() => toggleExtra(e.id)}
                  className={"fhj-fr-extra" + (on ? " is-on" : "")}>
                  <span className="fhj-fr-extra-mark">
                    <Icon name={on ? "check" : e.icon} size={15} color={on ? C.onAccent : C.sub} />
                  </span>
                  <span className="fhj-fr-extra-body">
                    <span className="fhj-fr-extra-name">
                      {e.label}
                      {suggested && <span className="fhj-fr-extra-tag">for what you track</span>}
                    </span>
                    <span className="fhj-fr-extra-blurb">{e.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Photos of body areas need to know which ones. The map only
              appears once photos are on, because a body diagram on a screen
              nobody asked for it on is startling. */}
          {wantsSpots && BodyMap && (
            <div className="fhj-fr-spots" data-act-block>
              <div className="fhj-fr-eyebrow">Where do you want to photograph?</div>
              <p className="fhj-fr-sub is-tight">
                Tap the areas you want to track over time. You can add more later, and a photo is
                never required to log a day.
              </p>
              <BodyMap spots={spots} onToggle={toggleSpot} tint={chosen[0]?.color || C.accent} />
              {spots.length > 0 && (
                <div className="fhj-fr-spot-chips">
                  {spots.map((s) => (
                    <span key={`${s.part}|${s.side}`} className="fhj-fr-spot-chip">
                      {spotLabel ? spotLabel(s) : `${s.side} ${s.part}`.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* The dashboard, assembling. This is the payoff of the screen: the
              choices above are not filed away somewhere, they are the row of
              buttons the person is about to use every day. */}
          <div className="fhj-fr-preview" data-act-block>
            <div className="fhj-fr-eyebrow">Your one-tap buttons</div>
            <div className="fhj-fr-preview-row">
              {previewTiles.map((t) => (
                <span key={t.label} className="fhj-fr-preview-tile">
                  <span className="fhj-fr-preview-icon"><Icon name={t.icon} size={14} color={C.accentText} /></span>
                  {t.label}
                </span>
              ))}
            </div>
            <p className="fhj-fr-hint">
              Rearranged whenever you like, and they learn: the ones you press most move to the
              front on their own.
            </p>
          </div>

          <div className="fhj-fr-nudge" data-act-block>
            <div className="fhj-fr-eyebrow">A nudge to write it down?</div>
            <div className="fhj-fr-nudge-row" role="group" aria-label="Daily reminder">
              {REMINDERS.map(([time, label, sub]) => (
                <button key={label} type="button" aria-pressed={reminder === time}
                  onClick={() => { feedback("select"); setReminder(time); }}
                  className={"fhj-fr-nudge-btn" + (reminder === time ? " is-on" : "")}>
                  <b>{label}</b>
                  <span>{sub}</span>
                </button>
              ))}
            </div>
            <p className="fhj-fr-hint">
              A reminder from the app itself, on this device. Nothing is sent anywhere, and you can
              add it to your phone's calendar from Settings so it works with the app closed.
            </p>
          </div>
        </div>

        <div className="fhj-fr-foot">
          <button type="button" onClick={() => go("entry")} className="fhj-fr-primary">
            <span>Continue</span>
            <Icon name="right" size={17} color={C.onAccent} />
          </button>
          <button type="button" className="fhj-fr-ghost" onClick={() => go("tune", true)}>Back</button>
        </div>
      </div>
    );
  }

  /* ---------- act five: the first entry ---------- */

  if (act === "entry") {
    const ask = metric?.ask || (metric ? `${metric.label} today?` : "How is today?");
    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <StepRail index={3} labels={["Tracking", "Questions", "Extras", "First entry"]} />
          <div className="fhj-fr-step" data-act-block>Step 4 of 4</div>
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

          {metricChoices.length > 1 && (
            <div className="fhj-fr-swap" data-act-block>
              <span className="fhj-fr-swap-label">Rather track</span>
              <div className="fhj-fr-swap-chips">
                {metricChoices.map((s) => (
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
          <button type="button" className="fhj-fr-ghost" onClick={() => go("extras", true)}>
            Back
          </button>
        </div>
      </div>
    );
  }

  /* ---------- act six: the journal begins ---------- */

  /* The three beats, said back in terms of what this person actually set up.
     Generic copy here would be the one place in the flow where the app stops
     talking to them and starts talking to everybody. */
  const keptLine = (): string => {
    const bits: string[] = [];
    if (chosenExtras.has("food")) bits.push("meals");
    if (chosenExtras.has("routine")) bits.push("doses");
    if (chosenExtras.has("photos")) bits.push("photos");
    if (chosenExtras.has("bowel")) bits.push("bathroom");
    if (chosenExtras.has("weight")) bits.push("weight");
    bits.push("notes");
    return bits.slice(0, 4).join(", ");
  };

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
            {/* Where the card lands. Identical markup to the one in act five,
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
              ["spark", "How you felt",
                `${metric?.label || "One number"} — ${checkInTimeLabel(seconds)} a day`],
              ["note", "What happened", keptLine()],
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
