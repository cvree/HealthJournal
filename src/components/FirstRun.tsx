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
   is composed as eight screens — a doorway, five numbered acts, and a birth:

     1. **The promise.** One line, and a glimpse of a journal already alive —
        a rating, a photograph, a note, a trend, a flare that ended. The claim
        the app is making, shown rather than explained. The privacy facts are
        one tap below it, before anything has been typed.
     2. **Who this is for.** A name and an age, both refusable, neither
        numbered — this is a doorway, not step one of anything. It is here
        because everything after it is warmer for having been asked: the app
        greets them by name every morning, and the two facts a clinician asks
        for first are already at the top of anything they print. The screen
        says exactly what each one buys, out loud, and then leaves the door
        open — because a journal that guilts you on screen two is one you stop
        opening on day four.
     3. **The only question that cannot be defaulted.** What are you tracking?
     4. **What it will ask you** — one group of questions at a time.
     5. **What is worth a photograph** — one subject at a time.
     6. **What else it should keep** — one thing at a time, then how often it
        should ask, then whether it should nudge.
     7. **The first entry.** Real, not a demo. The number they pick is written
        to their journal.
     8. **The journal beginning.** The card they just filled in physically
        becomes the first card on their timeline, the rail draws itself
        downward into the days they have not lived yet, and the streak counts
        to one.

   ---------- why acts four, five and six are all walked ----------

   They used to be lists. Each list arrived pre-answered — a "Quick / Balanced
   / Thorough" preset on the questions, a set of suggestions ticked on the
   extras — with a guided pass offered *beside* it for anybody who wanted one.

   That was the wrong shape twice over.

   The first problem is the preset. Three unlabelled sizes is a slider with no
   units, and whichever one the app lands on is the app deciding what somebody
   tracks: the person most likely to tap "Thorough" is the person least likely
   to still be answering it in March, and the person who taps nothing at all
   has had a check-in chosen for them by a default. A journal is not a settings
   screen. What goes in it has to be picked, question by question, by the
   person who is going to answer it at 7am on the morning they feel worst.

   The second problem is the door beside the door. A guided pass that is
   optional is a guided pass that the people who need it never take, because
   taking it means admitting on screen four that you would like some help. So
   there is no list any more and no preset to arrive on. Every one of these
   three acts *is* its pass: one card, one decision, a plain way to say no, and
   the running cost of the whole thing under your thumb. Six short decisions
   instead of one long list — and, more to the point, six decisions somebody
   actually made.

   And nothing is confirmed at the end of one. A review card after a pass that
   asked about every single item is the app asking somebody to agree with
   themselves; it reads as doubt, and the second reading of a list you have
   just built is the reading where you stop caring. The last answer is the
   answer. The next act starts.

   Four rules hold the middle acts together:

   - **Nothing is ever demanded.** Every card can be moved past. "Not this one"
     is a real button on every screen that offers a yes, and the primary action
     is never greyed out waiting for compliance.
   - **Nothing is ever assumed.** No question, and no photograph, is switched
     on by anything other than a tap. Where the packs have an opinion it is
     drawn as a suggestion, marked as one, and left alone until somebody
     answers.
   - **The default is the small one.** Where a screen has to guess, it guesses
     short. Nobody ever quit a journal because the first week asked too little,
     and every one of these screens can be reopened from Settings with more on
     the table than first run ever showed.
   - **Every choice shows its consequence immediately.** Switching a question
     on changes the "about 25 seconds a day" line under it. Typing a name
     changes the greeting quoted underneath it. Choosing a photo subject puts a
     frame on the contact sheet. Saying yes to meals puts a button in the row
     under your thumb. Nothing is filed away to be discovered later; the app is
     assembled in front of the person making it.

   And one rule holds the personal screen on its own:

   - **Encouraged, never extracted.** Every optional thing this flow asks for
     says what it is for, in the same breath, and has a visible way past it.
     "Why we ask" is on the screen rather than behind a link, and skipping is
     a real button rather than a greyed-out apology.

   Every animation here is a no-op under `prefers-reduced-motion`, and each act
   is composed so the still frame *is* the finished layout. Nothing is animated
   into existence that is not already laid out where it belongs. */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { C, readableInk } from "../lib/theme";
import { feedback, place } from "../lib/feedback";
import { scoreWord } from "../lib/pulse";
import {
  actIn, bloom, buildTimeline, countUp, heroIn, heroOut, landCard, liftCard, railAdvance,
  readoutSwap, rungPop, type CardFlight,
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
  /** In the pack's own everyday set. Nothing is ticked by it any more — it
      is what lets a card say "most people tracking this keep it", which is a
      suggestion somebody can act on rather than a decision taken for them. */
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
}

/** Something worth photographing. The photos act is not "do you want photos"
    — it is *of what*, because "photos: on" is a setting and "the inside of my
    left elbow, every Sunday" is a journal. */
export interface FirstRunPhotoSubject {
  id: string;
  label: string;
  blurb: string;
  icon: string;
  /** `spots` opens the body map beneath it; `progress` opens the front / side
      / back chips; anything else is one plain shot. */
  kind?: "spots" | "progress" | "photo";
  /** What this subject is *for*, in one sentence — what it turns out to be
      worth having six weeks later. Shown on the guided pass, where somebody is
      being asked to say yes or no to this one thing and deserves more than a
      label to say it about. */
  why?: string;
  /** Modules this subject is suggested for. Suggested is all it is: nothing
      here arrives ticked, because every one of these is a photograph of
      somebody's own body, and choosing to take it is theirs. */
  suggest?: string[];
  /** How the frame is drawn on the contact sheet. */
  frame?: "tall" | "square";
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
  /** What they want to be called. Empty when they skipped it. */
  name: string;
  /** Age in whole years at setup, or null when they skipped it. The journal
      stores the birth year this implies, so it never goes stale. */
  age: number | null;
  modules: string[];
  keyMetric: string | null;
  score: number | null;
  note: string;
  /** Question keys left switched on. */
  enabledKeys: string[];
  /** Questions the person wrote themselves. */
  customQuestions: { label: string; type: string }[];
  extras: string[];
  /** Photo subject ids, from the catalogue passed in. */
  photoSubjects: string[];
  /** Which progress angles, when the progress subject is on. */
  progressAngles: string[];
  spots: FirstRunSpot[];
  /** "HH:MM" for a daily nudge, or null for none. */
  reminder: string | null;
  /** How often the check-in should ask, as a preset id from lib/cadence.
      "daily" unless somebody says otherwise — see the note by CADENCES. */
  cadence: string;
}

type Props = {
  packs: FirstRunPack[];
  extras: FirstRunExtra[];
  /** What the photos act is allowed to offer. */
  photoSubjects?: FirstRunPhotoSubject[];
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

type Act = "hero" | "you" | "focus" | "tune" | "photos" | "extras" | "entry" | "born";

/** The numbered part of the flow. The hero, the personal screen and the birth
    all sit outside it — none of them is a step somebody is being walked
    through, and numbering the one that asks for a name would turn a welcome
    into paperwork. */
const FLOW: Act[] = ["focus", "tune", "photos", "extras", "entry"];

/**
 * The five acts, and the one line each of them is worth.
 *
 * The note matters as much as the label, because it is what replaced a wall.
 * The first act used to carry a four-item list headed "What happens next",
 * which said, in four paragraphs, exactly what these four segments say in four
 * words — and then a fifth paragraph promising that none of it was permanent,
 * a promise the sentence above it had already made. Orientation delivered as
 * a wall on screen three is orientation nobody reads.
 *
 * So it is delivered a line at a time, from the rail, on the screen each line
 * is about. Same place every act, one sentence, and it says the thing the five
 * segments cannot draw: not *where* you are — the bars have that — but what
 * this act is going to ask of you.
 */
const RAIL: { label: string; note: string }[] = [
  { label: "Tracking", note: "Sets what you'll be offered — you pick the questions themselves next, and all of it changes later in Settings." },
  { label: "Questions", note: "Nothing is on yet. A group at a time — keep what you'll answer in March." },
  { label: "Photos", note: "Nothing is photographed unless you ask for it. One subject at a time." },
  { label: "Extras", note: "Meals, doses, flares, a nudge — each one you keep becomes a button." },
  { label: "First entry", note: "A real one, written to your journal. Not a demo." },
];

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
  ["text", "A few words", "Whatever you want to say"],
];

/** One frozen empty set, so "nothing picked yet" is a stable identity rather
    than a new object on every render. */
const EMPTY: ReadonlySet<string> = new Set<string>();

/** What a group of questions is *shaped* like, in one line — because "Skin
    today" tells somebody nothing about what saying yes to it costs them, and
    "five questions, four of them a tap on a 1–10" tells them everything. */
function shapeOf(qs: { type: string }[]): string {
  const n = (t: string) => qs.filter((q) => q.type === t).length;
  const scales = n("scale");
  const yn = n("toggle");
  const rest = qs.length - scales - yn;
  const kinds: string[] = [];
  if (scales) kinds.push(`${scales} rated 1–10`);
  if (yn) kinds.push(`${yn} yes / no`);
  if (rest) kinds.push(`${rest} number${rest === 1 ? "" : "s"} or a few words`);
  if (qs.length === 1) {
    const only = kinds[0]?.replace(/^\d+ /, "") || "one to answer";
    return `One question here, ${only}.`;
  }
  const head = `${qs.length} questions here`;
  if (!kinds.length) return `${head}.`;
  /* "8 questions here — 8 rated 1–10" says the same number twice and reads
     like a receipt. When they are all one kind, say so as one kind. */
  if (kinds.length === 1) return `${head}, all ${kinds[0].replace(/^\d+ /, "")}.`;
  return `${head} — ${kinds.join(", ")}.`;
}

/* ---------- the age dial ----------

   Stored as a birth year rather than an age, which is the whole reason the
   readout says "born around 1991" underneath: a journal kept for three years
   by somebody whose age was typed once and never touched again is a journal
   that lies to a clinician about its author. The dial says out loud what is
   being written down. */
const AGE_MIN = 5;
const AGE_MAX = 100;
const AGE_DEFAULT = 32;

/* How often to ask, asked before anybody has been asked anything.

   The four that cover almost everybody, in the order they get slower. It is a
   short list on purpose: the full nine live in Settings, and a nine-way choice
   made by somebody who has not yet used the app once is a choice made on no
   information. The one that matters here is the last one — somebody who
   already knows they want a weekly journal should never have to spend a week
   finding out the app assumed otherwise. */
const CADENCES: [string, string, string][] = [
  ["daily", "Every day", "the usual"],
  ["alternate", "Every other day", "half as often"],
  ["thrice", "3× a week", "any three days"],
  ["weekly", "Once a week", "any one day"],
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

/** Where you are, how much is left, and what this one is for.

    Five segments, filled behind you and hollow ahead — the same shape as the
    timeline the last act draws, which is not an accident: this app's one
    picture is a line of days, and its progress indicator is a short one.

    It carries the whole burden of orientation now, and it is the only thing
    that does. Every act used to stack four indicators for two facts: this rail,
    a line reading "Step 2 of 5 · group 1 of 4", and a second bar under it
    drawing that inner position again. The rail says which act. The walkbar says
    which card. Neither needed a number spelling it out underneath, and a screen
    that draws its own progress twice is a screen that trusts neither drawing.

    So what is left of that line is the half no bar can draw — what the act is
    about — and it sits here, on the rail, where the position it belongs to is. */
function StepRail({ index, note }: { index: number; note?: string }) {
  const line = note ?? RAIL[index]?.note;
  /* The bars are `aria-hidden` — they are a shape, and a shape read out is
     noise. So the position that used to be spelled out underneath them is not
     gone, it has moved to where it costs a sighted person nothing: somebody on
     a screen reader still hears "Step 2 of 5, Questions", and somebody looking
     at the screen still sees it drawn once instead of written twice. */
  return (
    <div className="fhj-fr-rail-block" role="group"
      aria-label={`Step ${index + 1} of ${RAIL.length} — ${RAIL[index]?.label}`}>
      <div className="fhj-fr-rail-steps" aria-hidden="true">
        {RAIL.map((seg, i) => (
          <span key={seg.label}
            className={"fhj-fr-rail-seg" + (i < index ? " is-done" : i === index ? " is-now" : "")}>
            <span className="fhj-fr-rail-bar" data-rail-bar={i === index ? "now" : undefined} />
            <span className="fhj-fr-rail-label">{seg.label}</span>
          </span>
        ))}
      </div>
      {line && <p className="fhj-fr-rail-note" data-rail-note>{line}</p>}
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

/* ---------- drawing the answer, rather than naming it ----------

   The old list said "yes / no" in six-point grey under each question, which is
   a label about a control rather than the control. These draw the thing: ten
   rungs, or a Yes beside a No, or a box with a number in it. It costs a few
   pixels per row and it removes the entire class of "what does that mean"
   from a screen that is asking somebody to design their own survey. */
function MiniControl({ type }: { type: string }) {
  if (type === "toggle") {
    return (
      <span className="fhj-fr-mini-ctl is-toggle" aria-hidden="true">
        <span className="is-yes">Yes</span>
        <span className="is-no">No</span>
      </span>
    );
  }
  if (type === "scale") {
    return (
      <span className="fhj-fr-mini-ctl is-scale" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={i < 4 ? "is-lit" : ""} />
        ))}
      </span>
    );
  }
  if (type === "chips") {
    return (
      <span className="fhj-fr-mini-ctl is-chips" aria-hidden="true">
        <span className="is-lit" /><span /><span />
      </span>
    );
  }
  if (type === "number") {
    return <span className="fhj-fr-mini-ctl is-box" aria-hidden="true">12</span>;
  }
  if (type === "time") {
    return <span className="fhj-fr-mini-ctl is-box" aria-hidden="true">08:00</span>;
  }
  if (type === "date") {
    return <span className="fhj-fr-mini-ctl is-box" aria-hidden="true">12 Mar</span>;
  }
  return (
    <span className="fhj-fr-mini-ctl is-lines" aria-hidden="true">
      <span /><span /><span />
    </span>
  );
}

/** The same four controls at the size they are answered at, for the preview.
    Not interactive on purpose: this is tomorrow morning being shown, and a
    number tapped here would be a number that goes nowhere. */
function PreviewField({ q }: { q: FirstRunQuestion }) {
  return (
    <div className="fhj-fr-pv-field">
      <span className="fhj-fr-pv-label">{q.label}</span>
      {q.type === "scale" && (
        <>
          <span className="fhj-fr-pv-scale">
            {Array.from({ length: 10 }, (_, i) => <span key={i}>{i + 1}</span>)}
          </span>
          <span className="fhj-fr-pv-ends">
            <span>{q.dir === "pos" ? "1 · low" : "1 · none"}</span>
            <span>{q.dir === "pos" ? "10 · great" : "10 · severe"}</span>
          </span>
        </>
      )}
      {q.type === "toggle" && (
        <span className="fhj-fr-pv-yn">
          <span>Yes</span>
          <span>No</span>
        </span>
      )}
      {q.type === "chips" && (
        <span className="fhj-fr-pv-chips">
          <span>Pick any</span><span>that</span><span>apply</span>
        </span>
      )}
      {q.type === "number" && <span className="fhj-fr-pv-box">A number, on a keypad</span>}
      {q.type === "text" && <span className="fhj-fr-pv-box is-tall">A few words, in your own</span>}
      {(q.type === "time" || q.type === "date") && (
        <span className="fhj-fr-pv-box">{q.type === "time" ? "A time" : "A date"}</span>
      )}
    </div>
  );
}

/* ---------- the age dial ----------

   A number field with a keyboard over it is the fastest way to make somebody
   feel like they are filling in a government form, and this is the screen that
   can least afford it. So: a ruler with a decade marked every ten years, a
   numeral big enough to read at arm's length, and the birth year written
   underneath so what is actually being stored is never a mystery.

   It is a real range input under the paint, which is what keeps it usable
   with a keyboard, with a screen reader, and by anybody who cannot drag. */
function AgeDial({ value, onChange, onClear }: {
  value: number | null;
  onChange: (n: number) => void;
  onClear: () => void;
}) {
  const readRef = useRef<HTMLDivElement>(null);
  const shown = value ?? AGE_DEFAULT;
  const born = new Date().getFullYear() - shown;

  useEffect(() => {
    if (value != null) readoutSwap(readRef.current);
  }, [value]);

  return (
    <div className={"fhj-fr-age" + (value == null ? " is-unset" : "")}>
      <div className="fhj-fr-age-read" ref={readRef}>
        <span className="fhj-fr-age-num">{value == null ? "—" : value}</span>
        <span className="fhj-fr-age-word">
          {value == null ? <>years old<br /><b>not set</b></> : <>years old<br /><b>born around {born}</b></>}
        </span>
      </div>

      <div className="fhj-fr-age-track">
        <span className="fhj-fr-age-ticks" aria-hidden="true">
          {Array.from({ length: (AGE_MAX - AGE_MIN) / 5 + 1 }, (_, i) => (
            <span key={i} className={(AGE_MIN + i * 5) % 10 === 0 ? "is-decade" : ""} />
          ))}
        </span>
        <input
          type="range" min={AGE_MIN} max={AGE_MAX} step={1} value={shown}
          className="fhj-fr-age-input"
          aria-label="Your age"
          aria-valuetext={value == null ? "not set" : `${value} years old`}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (n !== value) feedback("select");
            onChange(n);
          }}
        />
      </div>

      <div className="fhj-fr-age-ends">
        <span>{AGE_MIN}</span>
        {value == null
          ? <span className="fhj-fr-age-note">drag to set</span>
          : <button type="button" className="fhj-fr-age-clear"
              onClick={() => { feedback("erase"); onClear(); }}>
              Rather not say
            </button>}
        <span>{AGE_MAX}+</span>
      </div>
    </div>
  );
}

/* ---------- the component ---------- */

export default function FirstRun({
  packs, extras, photoSubjects = [], onComplete, onLoadSample, Icon, BodyMap, spotLabel,
  appName, disclaimer, promises = [],
}: Props) {
  const [act, setAct] = useState<Act>("hero");

  /* The doorway. Both refusable, and both are the difference between an app
     that says "Good morning" and one that says "Good morning, Sam". */
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | null>(null);
  const [mods, setMods] = useState<string[]>([]);
  const [metricKey, setMetricKey] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [showAllPacks, setShowAllPacks] = useState(false);
  const [openPromises, setOpenPromises] = useState(false);

  /* Act three: the questions somebody has actually said yes to. `null` is
     "nobody has touched this yet", which means *nothing but the daily number*
     — there is no preset to arrive on and no set of questions the app picked
     out on somebody's behalf. Changing a pack on the screen before this one
     clears it back to null rather than stranding answers about questions that
     no longer exist. */
  const [hand, setHand] = useState<Set<string> | null>(null);
  const [customs, setCustoms] = useState<FirstRunCustom[]>([]);
  const [writing, setWriting] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftType, setDraftType] = useState("scale");

  /* Where each of the three guided acts has got to. They are plain indices
     rather than "null means not walking", because there is no other way
     through any of these acts now. */
  const [walk, setWalk] = useState(0);

  /* Act four: what is worth photographing. Nothing is pre-picked here — see
     the note above the act — so untouched (`null`) falls back to *nothing*
     rather than to the app's suggestions. `photoAnswered` is what has actually
     been decided, so stepping back through the pass shows a "no" as a no
     rather than as a card nobody reached. */
  const [photoPicked, setPhotoPicked] = useState<Set<string> | null>(null);
  const [photoWalk, setPhotoWalk] = useState(0);
  const [photoAnswered, setPhotoAnswered] = useState<Set<string>>(() => new Set());
  const [spots, setSpots] = useState<FirstRunSpot[]>([]);
  const [angles, setAngles] = useState<string[]>(["Front"]);

  /* Act five. */
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [extraWalk, setExtraWalk] = useState(0);
  const [extraAnswered, setExtraAnswered] = useState<Set<string>>(() => new Set());
  const [reminder, setReminder] = useState<string | null>("20:00");
  const [cadence, setCadence] = useState("daily");

  const heroRef = useRef<HTMLDivElement>(null);
  const actRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const landingRef = useRef<HTMLDivElement>(null);
  const bornRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef<HTMLSpanElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const tallyRef = useRef<HTMLDivElement>(null);
  const flight = useRef<CardFlight | null>(null);
  const dir = useRef<1 | -1>(1);
  /* The hero's exit outlives its own click handler by a third of a second, and
     the person could have left in that time — reloaded, or tapped through to
     the sample journal. Setting state on a torn-down flow is a warning nobody
     can act on. */
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

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

  /* What the check-in is, right now. Everything in it got there because
     somebody tapped it — the one exception being the daily number, which is
     the question this app *is* and cannot be switched off. */
  const enabled = useMemo(() => {
    const base = hand ?? EMPTY;
    const out = new Set<string>();
    for (const q of catalogue) if (base.has(q.k)) out.add(q.k);
    if (activeMetric) out.add(activeMetric); // never switchable off
    return out;
  }, [catalogue, hand, activeMetric]);

  const enabledQs = useMemo(() => catalogue.filter((q) => enabled.has(q.k)), [catalogue, enabled]);
  const seconds = useMemo(() => checkInSeconds(enabledQs), [enabledQs]);

  /* Sections, in the order the packs put them in — and *only* the packs'.

     A question somebody writes on the last card of the pass must not become a
     group card in the same pass. It did: adding one grew the deck by a card,
     the index they were standing on was suddenly a group rather than the end,
     and they were thrown back into the middle of a walk they had finished. The
     questions they write are listed on the card that takes them, which is the
     only place they belong. */
  const sections = useMemo(() => {
    const own = new Set(customs.map((c) => c.id));
    const map = new Map<string, FirstRunQuestion[]>();
    for (const q of catalogue) {
      if (own.has(q.k)) continue;
      const sec = q.sec || "Other";
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(q);
    }
    return [...map.entries()];
  }, [catalogue, customs]);

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

  /* ---------- act four: what is worth a photograph ----------

     What the packs *suggest*, which is as far as this goes. The extras act
     pre-ticks its suggestions and is right to: a bowel log is a switch, and a
     switch somebody leaves on costs them nothing. A photograph is not a
     switch. Every subject here ends with a camera pointed at somebody's own
     skin, plate or bathroom shelf, and an app that arrives having already
     decided which of those it will be asking for has helped itself to a
     decision that was never on offer.

     So the suggestion is drawn — marked, and named as a suggestion — and then
     nothing happens until somebody says yes. It is the one place in this flow
     where the screen genuinely arrives blank, and the CTA underneath it treats
     an empty answer as a finished one rather than as an unfilled form. */
  const suggestedSubjects = useMemo(() => {
    const out = new Set<string>();
    for (const sub of photoSubjects) {
      if ((sub.suggest || []).some((m) => mods.includes(m))) out.add(sub.id);
    }
    /* A body map is no use to somebody tracking migraines. Where the packs
       don't photograph body areas, the map subject is dropped from the
       suggestion even if a pack asked for it. */
    if (!BodyMap || !chosen.some((p) => p.photoKind === "skin")) out.delete("areas");
    return out;
  }, [photoSubjects, mods, chosen, BodyMap]);
  /* Not `?? suggestedSubjects`. Nothing is chosen until it is chosen. */
  const chosenSubjects = photoPicked ?? EMPTY;

  /* The order the guided pass holds them up in: what this person's own
     conditions reach for first, everything else after, and the body map
     dropped entirely where there is no map to drop a pin on. */
  const walkSubjects = useMemo(() => {
    const offered = photoSubjects.filter((sub) => !(sub.kind === "spots" && !BodyMap));
    return [
      ...offered.filter((sub) => suggestedSubjects.has(sub.id)),
      ...offered.filter((sub) => !suggestedSubjects.has(sub.id)),
    ];
  }, [photoSubjects, suggestedSubjects, BodyMap]);

  const wantsSpots = useMemo(
    () => chosenSubjects.has("areas") && !!BodyMap,
    [chosenSubjects, BodyMap]
  );
  const wantsProgress = chosenSubjects.has("progress");

  /* The contact sheet: one frame per shot the camera button will offer. This
     is the payoff of the photos act — "photos: on" is a setting, and a row of
     labelled frames is a journal. */
  const shots = useMemo(() => {
    const out: { key: string; label: string; frame: string }[] = [];
    for (const sub of photoSubjects) {
      if (!chosenSubjects.has(sub.id)) continue;
      if (sub.kind === "spots") {
        if (!BodyMap) continue;
        for (const sp of spots) {
          const l = spotLabel ? spotLabel(sp) : `${sp.side} ${sp.part}`.trim();
          out.push({ key: `spot|${sp.part}|${sp.side}`, label: l.charAt(0).toUpperCase() + l.slice(1), frame: "square" });
        }
        continue;
      }
      if (sub.kind === "progress") {
        for (const a of angles) out.push({ key: `angle|${a}`, label: `Progress · ${a.toLowerCase()}`, frame: "tall" });
        continue;
      }
      out.push({ key: sub.id, label: sub.label, frame: sub.frame || "square" });
    }
    return out;
  }, [photoSubjects, chosenSubjects, spots, angles, spotLabel, BodyMap]);

  const photosOn = shots.length > 0;

  /* The row of one-tap buttons this setup is building, drawn as it is chosen.
     Check-in always leads it — it is the one thing worth doing every day, and
     the camera comes second whenever there is anything to point it at. */
  const previewTiles = useMemo(() => {
    const out = [{ label: "Check-in", icon: "log" }];
    if (photosOn) out.push({ label: "Photo", icon: "camera" });
    for (const e of extras) {
      if (e.tile && chosenExtras.has(e.id)) out.push(e.tile);
    }
    return out;
  }, [extras, chosenExtras, photosOn]);

  const metric = useMemo(
    () => scales.find((s) => s.k === activeMetric) || scales.find((s) => enabled.has(s.k)) || scales[0] || null,
    [scales, activeMetric, enabled]
  );

  /* Any 1–10 the packs brought can be the main number. It does not have to
     have survived act three, because `enabled` adds whatever the main number
     is: choosing one here is the same act as switching it on. */
  const metricChoices = useMemo(() => scales.slice(0, 6), [scales]);

  /* ---------- choreography ---------- */

  useLayoutEffect(() => {
    if (act !== "hero") return;
    return heroIn(heroRef.current);
  }, [act]);

  useLayoutEffect(() => {
    if (act === "hero" || act === "born") return;
    const stop = actIn(actRef.current, dir.current);
    /* The rail is the one thing on screen that outlives the act, so it is the
       one thing whose change is worth showing rather than cutting to. */
    railAdvance(actRef.current, dir.current);
    return stop;
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

  /* The tally answers back whenever the cost changes, so switching a question
     on is felt rather than merely recorded. */
  useEffect(() => {
    if (act === "tune") readoutSwap(tallyRef.current);
  }, [seconds, act, walk]);

  /* The hero is a full-bleed screen; nothing behind it should scroll. */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = act === "hero" ? "hidden" : prev;
    return () => { document.body.style.overflow = prev; };
  }, [act]);

  /* Each numbered act starts at its own top, and so does each card of a
     guided pass — a card that arrives scrolled to its own middle is a card
     whose question nobody read. Without this, arriving at a long question
     list halfway down it reads as a broken screen. */
  useEffect(() => {
    if (act !== "hero") window.scrollTo?.(0, 0);
  }, [act, walk, photoWalk, extraWalk]);

  /* ---------- moving between acts ---------- */

  const go = (next: Act, back = false) => {
    dir.current = back ? -1 : 1;
    feedback(back ? "tap" : "nav");
    setAct(next);
  };

  const stepIndex = FLOW.indexOf(act);

  /* ---------- actions ---------- */

  /* The hero recedes rather than being cut away — see `heroOut`. The state
     change is inside the callback, which is the whole point: the promise the
     first screen made has to still be on the screen while it is being kept.
     Under reduced motion the callback runs on this same tick, so nobody who
     asked for stillness waits for one. */
  const start = () => {
    feedback("complete");
    dir.current = 1;
    heroOut(heroRef.current, () => { if (alive.current) setAct("you"); });
  };

  /* The name, as it will be said out loud. A journal that greets somebody by
     their full legal name is not greeting them. */
  const first = name.trim().split(/\s+/)[0] || "";

  /* Refusing is a button, not a greyed-out apology — and it clears rather than
     merely walks past, so nothing half-typed is kept by accident. */
  const skipYou = () => {
    feedback("skip");
    setName("");
    setAge(null);
    go("focus");
  };

  const togglePack = (key: string) => {
    feedback("select");
    setMods((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    /* A different set of packs is a different set of questions, so anything
       already chosen is about a screen that no longer exists — and the pass
       over them starts again from its first card. */
    setHand(null);
    setWalk(0);
  };

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

  /* ---------- act three: one group of questions at a time ----------

     One section on the screen at a time, its shape said out loud, its rows
     big enough to read on a phone held one-handed, and a running total of
     what the whole check-in now costs. Six short decisions instead of one
     long list — and, more to the point, six decisions somebody actually made.

     The last card is not a review. It is the one thing the packs cannot
     supply: a question in somebody's own words. */
  const walkCards = useMemo(() => sections.filter(([, qs]) => qs.length > 0), [sections]);
  /** Every group, and then the card that takes a question of your own. */
  const walkLast = walkCards.length;
  const walkAt = Math.min(walk, walkLast);

  const walkTo = (i: number, back = false) => {
    feedback(back ? "tap" : "nav");
    setWalk(Math.max(0, Math.min(i, walkLast)));
  };

  /** Every question in one section, on or off together. A group somebody has
      already decided about should cost one tap, not five. */
  const setSection = (qs: FirstRunQuestion[], on: boolean) => {
    feedback(on ? "select" : "erase");
    setHand(() => {
      const next = new Set(enabled);
      for (const q of qs) {
        if (q.k === activeMetric) continue;   // the daily number stays
        if (on) next.add(q.k);
        else next.delete(q.k);
      }
      return next;
    });
  };

  const addCustom = () => {
    const label = draftLabel.trim();
    if (!label) return;
    feedback("save");
    const id = `own_${customs.length}_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 16)}`;
    setCustoms((prev) => [...prev, { id, label, type: draftType }]);
    /* A question somebody just wrote is on. Obviously — but only obvious if
       the hand-made list is told about it. */
    setHand((prev) => new Set([...(prev ?? EMPTY), id]));
    setDraftLabel("");
    setWriting(false);
  };

  /* ---------- act four: one subject at a time ----------

     Not a list of tickboxes with an opinion baked into it: one subject held
     up at a time, what it is, what it turns out to be worth, and a Yes beside
     a No. Both answers move on, both are recorded, and "no" is recorded as an
     answer rather than as an absence — so somebody stepping back through the
     deck sees the decision they made rather than a card that looks untouched.

     Two subjects need one more fact before they mean anything: which body
     areas, and which angles. Those used to wait on a screen this pass handed
     back to, which is the one place a guided pass can strand somebody — you
     say yes to the body map and then it is over and you never see a body map.
     They are cards in the pass now, appended the moment the yes that needs
     them lands. */
  const photoDetails = useMemo(() => {
    const out: ("areas" | "progress")[] = [];
    if (chosenSubjects.has("areas") && BodyMap) out.push("areas");
    if (chosenSubjects.has("progress")) out.push("progress");
    return out;
  }, [chosenSubjects, BodyMap]);

  const photoLast = walkSubjects.length + photoDetails.length - 1;
  const photoAt = Math.max(0, Math.min(photoWalk, photoLast));

  const photoWalkTo = (i: number, back = false) => {
    feedback(back ? "tap" : "nav");
    setPhotoWalk(Math.max(0, Math.min(i, photoLast)));
  };

  const answerSubject = (id: string, yes: boolean, at: number) => {
    feedback(yes ? "select" : "tap");
    setPhotoAnswered((prev) => new Set([...prev, id]));
    setPhotoPicked((prev) => {
      const next = new Set(prev ?? EMPTY);
      if (yes) next.add(id);
      else next.delete(id);
      return next;
    });
    /* Not clamped to `photoLast`: a yes on the body map grows the deck by a
       card, and that card does not exist until this state lands. */
    setPhotoWalk(at + 1);
  };

  const toggleAngle = (a: string) => {
    feedback("select");
    setAngles((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const toggleExtra = (id: string) => {
    feedback("select");
    setExtraAnswered((prev) => new Set([...prev, id]));
    setPicked((prev) => {
      const next = new Set(prev ?? suggestedExtras);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ---------- act five: one thing a day holds at a time ----------

     The extras used to be five rows with the app's suggestions already ticked,
     which is defensible — a bowel log is a switch, and a switch somebody
     leaves on costs them nothing — right up until you notice that the row of
     buttons under their thumb for the next year was assembled by a default.

     So each one gets a card, a yes beside a no, and the dashboard it is
     building drawn underneath as it fills in. Then the two questions that are
     not about *what* a day holds but about *when* it is asked for: how often,
     and whether to nudge. */
  const extraLast = extras.length + 1;   // …the cadence card, then the nudge
  const extraAt = Math.max(0, Math.min(extraWalk, extraLast));

  const extraWalkTo = (i: number, back = false) => {
    feedback(back ? "tap" : "nav");
    setExtraWalk(Math.max(0, Math.min(i, extraLast)));
  };

  const answerExtra = (id: string, yes: boolean, at: number) => {
    feedback(yes ? "select" : "tap");
    setExtraAnswered((prev) => new Set([...prev, id]));
    setPicked((prev) => {
      const next = new Set(prev ?? suggestedExtras);
      if (yes) next.add(id);
      else next.delete(id);
      return next;
    });
    setExtraWalk(Math.min(at + 1, extraLast));
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
      name: name.trim(),
      age,
      modules: mods,
      keyMetric: metric?.k ?? null,
      score,
      note: note.trim(),
      enabledKeys: enabledQs.filter((q) => !q.k.startsWith("own_")).map((q) => q.k),
      customQuestions: customs
        .filter((c) => enabled.has(c.id))
        .map((c) => ({ label: c.label, type: c.type })),
      extras: [...chosenExtras],
      photoSubjects: [...chosenSubjects].filter((id) => photoSubjects.some((s) => s.id === id)),
      progressAngles: wantsProgress ? angles : [],
      spots: wantsSpots ? spots : [],
      reminder,
      cadence,
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
            <span style={{ color: C.subtle }}> kept, in your own words, on your own device.</span>
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
              No account · nothing leaves unless you say so · not medical advice
              <Icon name={openPromises ? "up" : "down"} size={12} color={C.subtle} />
            </button>
            {openPromises && (
              <div className="fhj-fr-fine-body">
                {/* A short list of checkable facts about this build, before
                    anything has been typed. A privacy paragraph is read by
                    nobody; a list somebody could go and verify is the only kind
                    of trust claim worth making to a stranger — which is also
                    why the list names the things that *can* leave rather than
                    claiming nothing ever does. */}
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

  /* ---------- the doorway: who this is for ----------

     Deliberately unnumbered. The moment this screen says "Step 1 of 6" it
     becomes a registration form, and a registration form is the thing this
     whole app exists to not be. It is a welcome that happens to ask two
     things, says what each one is for in the same breath, and holds the door
     open for anybody who would rather not.

     The encouragement is entirely made of *consequence*: the greeting is
     quoted back with their own name in it as they type, and the printed
     header is drawn with their name and age in place. Nothing here nags, and
     nothing here is greyed out until they comply. */

  if (act === "you") {
    const hasName = first.length > 0;
    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <div className="fhj-fr-eyebrow" data-act-block>Before the questions</div>
          <h1 className="fhj-fr-display is-small" data-act-block>
            {hasName ? `Hello, ${first}.` : "Who is this journal for?"}
          </h1>
          <p className="fhj-fr-sub" data-act-block>
            Both of these are optional, and neither is ever part of anything this app sends —
            but a journal that knows who it belongs to is a different object to one that
            doesn't. Here's exactly what each one changes.
          </p>

          <div className="fhj-fr-you" data-act-block>
            <label className="fhj-fr-you-label" htmlFor="fhj-fr-name">What should it call you?</label>
            <input id="fhj-fr-name" className="fhj-fr-you-input" value={name} maxLength={40}
              autoComplete="given-name" autoCapitalize="words" spellCheck={false}
              placeholder="Your name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
            <div className="fhj-fr-you-echo" aria-live="polite">
              <span className="fhj-fr-you-echo-mark"><Icon name="sun" size={12} color={C.accentText} /></span>
              <span>
                {hasName
                  ? <>Every morning, this app will open with <b>“Good morning, {first}.”</b></>
                  : <>Every morning, this app will open with <b>“Good morning.”</b> — add a name and it says yours.</>}
              </span>
            </div>
          </div>

          <div className="fhj-fr-you" data-act-block>
            <div className="fhj-fr-you-label" id="fhj-fr-age-label">How old are you?</div>
            <AgeDial value={age} onChange={setAge} onClear={() => setAge(null)} />
            <p className="fhj-fr-hint">
              Stored as the year you were born, so it is still right in three years' time. It is
              the second thing every clinician asks, and it is on the pack before they ask it.
            </p>
          </div>

          {/* What the two answers are actually for, drawn rather than
              promised: the header of the page they will one day hand to a
              doctor, with their own name and age already set into it. */}
          <div className="fhj-fr-letter" data-act-block>
            <div className="fhj-fr-eyebrow">On everything you print or export</div>
            <div className="fhj-fr-letter-paper">
              <div className="fhj-fr-letter-title">Appointment pack</div>
              <div className="fhj-fr-letter-meta">
                <span className={hasName ? "is-set" : ""}>{hasName ? name.trim() : "Name not given"}</span>
                <span className={age != null ? "is-set" : ""}>{age != null ? `${age} years old` : "Age not given"}</span>
                <span>Last 30 days · printed today</span>
              </div>
              <div className="fhj-fr-letter-rules" aria-hidden="true">
                <span /><span /><span />
              </div>
            </div>
          </div>

          <ul className="fhj-fr-why" data-act-block>
            {[
              ["spark", "It stops sounding like software",
                "Your name in the greeting, in your milestones, on your streak — not “the user”."],
              ["note", "A clinician knows whose logs these are",
                "Name and age head every export, every summary and every appointment pack. Without them the page is anonymous, and an anonymous page is one more thing to explain in a ten-minute visit."],
              ["device", "Nothing sends it anywhere",
                "There is no account to attach it to. Your name and age are not part of any request this app can make — not the AI, not the weather — and the only places they appear are on this device and on the pages you print yourself."],
            ].map(([icon, title, body]) => (
              <li key={title}>
                <span className="fhj-fr-why-mark"><Icon name={icon} size={13} color={C.accentText} /></span>
                <span>
                  <b>{title}</b>
                  <span>{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="fhj-fr-foot">
          <button type="button" onClick={() => go("focus")} className="fhj-fr-primary">
            <span>{hasName ? `Continue, ${first}` : "Continue"}</span>
            <Icon name="right" size={17} color={C.onAccent} />
          </button>
          <button type="button" className="fhj-fr-ghost" onClick={skipYou}>
            Skip this — I'd rather not say
          </button>
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
          <StepRail index={0} />
          <h1 className="fhj-fr-display is-small" data-act-block>
            {first ? `${first} — what are you tracking?` : "What are you tracking?"}
          </h1>
          {/* No sub. The rail's line above already says what picking a pack
              does and that none of it is permanent, and saying it twice under
              one headline is the habit this whole pass exists to break. */}

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

          {/* Nothing here restates the rail. This screen used to end with a
              four-item list headed "What happens next", whose four items were
              the rail's four remaining segments written out as paragraphs, over
              a fifth paragraph promising nothing was permanent — which the
              sentence under the headline had already promised. Four indicators
              and two reassurances for one screen's worth of orientation. The
              rail carries it now, a line at a time, on the screen each line is
              actually about. */}
        </div>

        <div className="fhj-fr-foot">
          <button type="button" onClick={() => go("tune")} disabled={!mods.length}
            className="fhj-fr-primary">
            <span>{mods.length ? "Continue" : "Pick what you're tracking"}</span>
            {mods.length ? <Icon name="right" size={17} color={C.onAccent} /> : null}
          </button>
          <button type="button" className="fhj-fr-ghost" onClick={() => go("you", true)}>Back</button>
        </div>
      </div>
    );
  }

  /* ---------- act three: what it will ask you ----------

     A catalogue of forty questions in six folds, on a phone, arriving
     pre-answered, is not a choice — it is a scroll, and a check-in nobody
     chose is a check-in nobody defends at 7am on a bad morning. So this act
     deals the same catalogue out one group at a time.

     Each card says how big the group is and what answering it feels like,
     draws the control beside every row so nobody has to be told what a yes/no
     question is, marks the ones people tracking this usually keep, offers
     all-of-them and none-of-them as single taps for the people who already
     know, and keeps the running cost of the whole check-in under their thumb.

     Nothing arrives switched on but the daily number. */

  if (act === "tune") {
    const done = walkAt >= walkCards.length;             // the card that takes your own
    const [sec, qs] = done ? ["", [] as FirstRunQuestion[]] : walkCards[walkAt];
    const onCount = qs.filter((q) => enabled.has(q.k)).length;
    const suggestCount = qs.filter((q) => q.quick && q.k !== activeMetric).length;

    const lead = onCount === 0
      ? (suggestCount
        ? "None of these are on yet. Tap the ones you want asked — or leave the lot, which is a real answer: a question you resent being asked is one you end up answering badly."
        : "None of these are on. Leaving it that way is a real answer — a question you resent being asked is one you end up answering badly.")
      : onCount === qs.length
        ? "All of them are on. Each one is a few more seconds every morning, so drop anything you would only be guessing at."
        : `${onCount} of the ${qs.length} are on. Tap any row to change your mind.`;

    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <StepRail index={1} note={done ? "Anything of your own, in your own words." : undefined} />

          {/* Which card of this act, drawn once. The words it used to be
              written out as live on the element rather than under it — see
              StepRail. */}
          <div className="fhj-fr-walkbar" data-act-block role="group"
            aria-label={done
              ? `Last card of ${walkCards.length + 1} — anything of your own`
              : `Group ${walkAt + 1} of ${walkCards.length}`}>
            {walkCards.map(([name], i) => (
              <span key={name} aria-hidden="true"
                className={"fhj-fr-walkbar-seg" + (i < walkAt ? " is-done" : i === walkAt ? " is-now" : "")} />
            ))}
            <span aria-hidden="true" className={"fhj-fr-walkbar-seg" + (done ? " is-now" : "")} />
          </div>

          {done ? (
            /* The one thing a pack cannot bring: a question in somebody's own
               words. It is the last card because by now they have seen forty
               examples of what a question looks like, which is the only useful
               preparation for writing one. */
            <>
              <h1 className="fhj-fr-display is-small" data-act-block>
                Anything it should ask that isn't here?
              </h1>
              <p className="fhj-fr-sub" data-act-block>
                {first ? `${first}, the` : "The"} packs are a starting point, not a limit. If there
                is something you already know you want to watch — a joint, a mood, a number your
                doctor asks for — write it and it joins the rest.
              </p>

              {customs.length > 0 && (
                <div className="fhj-fr-ownlist" data-act-block>
                  <div className="fhj-fr-eyebrow">Your own questions</div>
                  {customs.map((c) => (
                    <div key={c.id} className="fhj-fr-ownrow">
                      <span className="fhj-fr-ownrow-mark">
                        <Icon name="check" size={12} color={C.onAccent} />
                      </span>
                      <span className="fhj-fr-ownrow-label">{c.label}</span>
                      <MiniControl type={c.type} />
                    </div>
                  ))}
                </div>
              )}

              {writing ? (
                <div className="fhj-fr-own" data-act-block>
                  <label className="fhj-fr-own-label" htmlFor="fhj-own-q">Your question</label>
                  <input id="fhj-own-q" autoFocus value={draftLabel} maxLength={60}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
                    placeholder="e.g. Hands · how bad today?" />
                  <div className="fhj-fr-own-hint">How do you want to answer it?</div>
                  <div className="fhj-fr-own-types" role="group" aria-label="Answer type">
                    {CUSTOM_TYPES.map(([t, l, hint]) => (
                      <button key={t} type="button" aria-pressed={draftType === t}
                        onClick={() => { feedback("select"); setDraftType(t); }}
                        className={"fhj-fr-own-type" + (draftType === t ? " is-on" : "")}>
                        <MiniControl type={t} />
                        <b>{l}</b>
                        <span>{hint}</span>
                      </button>
                    ))}
                  </div>

                  {/* The question they are writing, drawn as it will be asked.
                      A yes/no question is an abstraction until the Yes and the
                      No are on the screen with their own words above them. */}
                  <div className="fhj-fr-own-pv">
                    <span className="fhj-fr-eyebrow">In your check-in</span>
                    <PreviewField q={{
                      k: "draft",
                      label: draftLabel.trim() || "Your question",
                      type: draftType,
                    }} />
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
                  {customs.length ? "+ Write another one" : "+ Ask me something of my own"}
                </button>
              )}

              <div className="fhj-fr-walk-tally" data-act-block aria-live="polite" ref={tallyRef}>
                <span className="fhj-fr-walk-tally-num">{enabledQs.length}</span>
                <span>
                  question{enabledQs.length === 1 ? "" : "s"} in your check-in<br />
                  <b>{checkInTimeLabel(seconds)} a day</b>
                </span>
              </div>

              <p className="fhj-fr-hint" data-act-block>
                Nothing about this is permanent: questions can be added, dropped or written from
                scratch whenever you like, and the days you have already logged keep their answers
                either way.
              </p>
            </>
          ) : (
            <>
              <h1 className="fhj-fr-display is-small" data-act-block>{sec}</h1>
              <p className="fhj-fr-sub" data-act-block>
                {shapeOf(qs)} {lead}
              </p>

              <div className="fhj-fr-walkqs" data-act-block>
                {qs.map((q) => {
                  const on = enabled.has(q.k);
                  const isMetric = q.k === activeMetric;
                  const usual = !!q.quick && !isMetric;
                  return (
                    <button key={q.k} type="button" role="switch" aria-checked={on}
                      disabled={isMetric} onClick={() => toggleQuestion(q)}
                      className={"fhj-fr-wq" + (on ? " is-on" : "") + (isMetric ? " is-locked" : "")}>
                      <span className="fhj-fr-wq-top">
                        <span className="fhj-fr-wq-mark">
                          {on ? <Icon name="check" size={12} color={C.onAccent} /> : null}
                        </span>
                        <span className="fhj-fr-wq-label">
                          {q.label}
                          {usual && !on && <span className="fhj-fr-extra-tag">most people keep this</span>}
                        </span>
                        <MiniControl type={q.type} />
                      </span>
                      <span className="fhj-fr-wq-foot">
                        <span className="fhj-fr-wq-state">
                          {isMetric ? "Your daily number · always asked"
                            : on ? "Asked every check-in" : "Not asked"}
                        </span>
                        <span className="fhj-fr-wq-type">{TYPE_HINT[q.type] || q.type}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="fhj-fr-walk-bulk" data-act-block>
                <button type="button" className="fhj-fr-mini is-quiet"
                  onClick={() => setSection(qs, true)}>
                  Ask me all {qs.length === 2 ? "both" : qs.length}
                </button>
                <button type="button" className="fhj-fr-mini is-quiet"
                  onClick={() => setSection(qs, false)}>
                  None of these
                </button>
              </div>

              <div className="fhj-fr-walk-tally" data-act-block aria-live="polite" ref={tallyRef}>
                <span className="fhj-fr-walk-tally-num">{enabledQs.length}</span>
                <span>
                  question{enabledQs.length === 1 ? "" : "s"} in your check-in so far<br />
                  <b>{checkInTimeLabel(seconds)} a day</b>
                </span>
              </div>
            </>
          )}
        </div>

        {/* No review card, and so no confirmation: the last answer *is* the
            answer. Asking somebody to agree with a list they have just built
            question by question reads as doubt, and it is the reading where
            they stop caring. */}
        <div className="fhj-fr-foot">
          <button type="button" className="fhj-fr-primary"
            onClick={() => (done ? go("photos") : walkTo(walkAt + 1))}>
            <span>
              {done ? "Continue" : walkAt === walkCards.length - 1 ? "Last one" : "Next group"}
            </span>
            <Icon name="right" size={17} color={C.onAccent} />
          </button>
          <div className="fhj-fr-foot-row">
            <button type="button" className="fhj-fr-ghost"
              onClick={() => (walkAt > 0 ? walkTo(walkAt - 1, true) : go("focus", true))}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- act four: what is worth a photograph ----------

     The old flow asked "photos?" as one tick among six, and then guessed: a
     body map if the pack looked like skin, one front-on progress shot if it
     didn't. Both guesses are wrong for most people. Somebody with IBS wants a
     picture of the plate; somebody on a new cream wants the tub's ingredient
     list; somebody whose ankle swells wants the ankle, and nobody was ever
     going to find that behind a setting called "Photos".

     So the question is not whether but *of what* — and it is asked one subject
     at a time, because eight things a camera can be pointed at is more than
     anybody weighs in a glance, and the cost of getting it wrong is
     asymmetric: a subject nobody picks is a photograph never taken, and there
     is no going back in six weeks to take it.

     Each card is one subject: what it is, what it is worth having later,
     whether people tracking what this person tracks tend to keep it, and a Yes
     beside a No. Both answers move on. Nothing is assumed and nothing arrives
     ticked — every one of these ends with a camera pointed at somebody's own
     skin, plate or bathroom shelf, and an app that arrives having already
     decided which of those it will be asking for has helped itself to a
     decision that was never on offer.

     The contact sheet fills in underneath as the answers land, so "photos: on"
     — which is a setting — never has to stand in for a row of labelled frames,
     which is a journal. */

  if (act === "photos") {
    const total = walkSubjects.length + photoDetails.length;
    const at = photoAt;
    const detail = at >= walkSubjects.length ? photoDetails[at - walkSubjects.length] : null;
    const sub = detail ? null : walkSubjects[at];
    const suggested = sub ? suggestedSubjects.has(sub.id) : false;
    const on = sub ? chosenSubjects.has(sub.id) : false;
    const answered = sub ? photoAnswered.has(sub.id) : false;
    const last = at >= total - 1;
    const tracking = chosen.map((p) => p.label.toLowerCase());
    const trackingWords = tracking.length > 1
      ? `${tracking.slice(0, -1).join(", ")} and ${tracking[tracking.length - 1]}`
      : tracking[0] || "what you track";

    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <StepRail index={2} note={detail ? "One more detail about this one." : undefined} />

          <div className="fhj-fr-walkbar" data-act-block role="group"
            aria-label={`Subject ${at + 1} of ${total}`}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} aria-hidden="true"
                className={"fhj-fr-walkbar-seg" + (i < at ? " is-done" : i === at ? " is-now" : "")} />
            ))}
          </div>

          {detail === "areas" && BodyMap ? (
            /* Said yes to the body map, so here is the body map. It used to
               wait on a screen this pass handed back to, which meant the one
               way to say yes to it and never see it was to be walked through
               the deck — the exact person who most needed the help. */
            <>
              <h1 className="fhj-fr-display is-small" data-act-block>Which areas?</h1>
              <p className="fhj-fr-sub" data-act-block>
                Tap the ones you want to watch over time. Each keeps its own run of photos, lined
                up against the last time you took it. Add more later, and a photo is never required
                to log a day.
              </p>
              <div className="fhj-fr-spots" data-act-block>
                <BodyMap spots={spots} onToggle={toggleSpot} tint={chosen[0]?.color || C.accent} />
                {spots.length > 0 && (
                  <div className="fhj-fr-spot-chips">
                    {spots.map((sp) => (
                      <span key={`${sp.part}|${sp.side}`} className="fhj-fr-spot-chip">
                        {spotLabel ? spotLabel(sp) : `${sp.side} ${sp.part}`.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {spots.length === 0 && (
                <p className="fhj-fr-hint" data-act-block>
                  Nothing pinned yet. One is plenty to start with — the worst patch, or the one you
                  argue with your doctor about.
                </p>
              )}
            </>
          ) : detail === "progress" ? (
            <>
              <h1 className="fhj-fr-display is-small" data-act-block>Which angles?</h1>
              <p className="fhj-fr-sub" data-act-block>
                Same pose, same spot, weeks apart. Front on its own is plenty to start with.
              </p>
              <div className="fhj-fr-spots" data-act-block>
                <div className="fhj-fr-angles" role="group" aria-label="Progress photo angles">
                  {["Front", "Side", "Back"].map((a) => (
                    <button key={a} type="button" aria-pressed={angles.includes(a)}
                      onClick={() => toggleAngle(a)}
                      className={"fhj-fr-angle" + (angles.includes(a) ? " is-on" : "")}>
                      <Icon name="camera" size={14} color={angles.includes(a) ? C.onAccent : C.sub} />
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : sub ? (
            <>
              <h1 className="fhj-fr-display is-small" data-act-block>{sub.label}</h1>
              <p className="fhj-fr-sub" data-act-block>{sub.blurb}.</p>

              <div className="fhj-fr-pw-shot" data-act-block>
                <span className={"fhj-fr-frame is-" + (sub.frame || "square")}>
                  <span className="fhj-fr-frame-win" aria-hidden="true">
                    <Icon name={sub.icon} size={18} color={C.subtle} />
                  </span>
                  <span className="fhj-fr-frame-label">Today</span>
                </span>
                <span className="fhj-fr-pw-then" aria-hidden="true">
                  <Icon name="right" size={13} color={C.subtle} />
                </span>
                <span className={"fhj-fr-frame is-" + (sub.frame || "square")}>
                  <span className="fhj-fr-frame-win" aria-hidden="true">
                    <Icon name={sub.icon} size={18} color={C.subtle} />
                  </span>
                  <span className="fhj-fr-frame-label">Six weeks on</span>
                </span>
              </div>

              {sub.why && (
                <div className="fhj-fr-pw-why" data-act-block>
                  <span className="fhj-fr-why-mark"><Icon name="spark" size={13} color={C.accentText} /></span>
                  <span>{sub.why}</span>
                </div>
              )}

              <p className="fhj-fr-hint" data-act-block>
                {suggested
                  ? `People tracking ${trackingWords} usually keep this one — which is a suggestion, not a decision. `
                  : ""}
                {sub.kind === "spots"
                  ? "Say yes and the next screen is a body map to pin the exact areas on. "
                  : sub.kind === "progress"
                    ? "Say yes and the next screen picks the angles — front on its own is plenty. "
                    : ""}
                Photos stay on this device.
              </p>

              <div className="fhj-fr-pw-actions" data-act-block>
                <button type="button" className="fhj-fr-pw-yes"
                  aria-pressed={answered && on}
                  onClick={() => answerSubject(sub.id, true, at)}>
                  <Icon name="camera" size={15} color={C.onAccent} />
                  <span>Yes — I'll photograph this</span>
                </button>
                <button type="button" className="fhj-fr-pw-no"
                  aria-pressed={answered && !on}
                  onClick={() => answerSubject(sub.id, false, at)}>
                  Not this one
                </button>
              </div>
            </>
          ) : null}

          {/* The contact sheet, filling in. One frame per shot the camera
              button will offer — the payoff of the act, drawn under every card
              of it rather than saved for a summary nobody needs. */}
          <div className="fhj-fr-sheet" data-act-block>
            <div className="fhj-fr-eyebrow">
              {photosOn ? `Your camera · ${shots.length} shot${shots.length === 1 ? "" : "s"}` : "Your camera"}
            </div>
            {photosOn ? (
              <div className="fhj-fr-sheet-row">
                {shots.slice(0, 8).map((sh) => (
                  <span key={sh.key} className={"fhj-fr-frame is-" + sh.frame}>
                    <span className="fhj-fr-frame-win" aria-hidden="true">
                      <Icon name="camera" size={13} color={C.subtle} />
                    </span>
                    <span className="fhj-fr-frame-label">{sh.label}</span>
                  </span>
                ))}
                {shots.length > 8 && <span className="fhj-fr-frame is-more">+{shots.length - 8}</span>}
              </div>
            ) : (
              <p className="fhj-fr-hint">
                Nothing yet — and nothing is missing. Plenty of journals are numbers and notes, and
                the camera can be switched on any time from Settings.
              </p>
            )}
          </div>
        </div>

        <div className="fhj-fr-foot">
          {/* A yes or a no moves the deck on by itself, so the primary is only
              ever the way *out* of the act — on the last card, and on the two
              detail cards, which have no yes/no of their own. */}
          {(last || detail) && (
            <button type="button" className="fhj-fr-primary"
              onClick={() => (last ? go("extras") : photoWalkTo(at + 1))}>
              <span>
                {!last ? "Continue" : photosOn ? "These are my shots" : "Continue without photos"}
              </span>
              <Icon name="right" size={17} color={C.onAccent} />
            </button>
          )}
          <div className="fhj-fr-foot-row">
            <button type="button" className="fhj-fr-ghost"
              onClick={() => (at > 0 ? photoWalkTo(at - 1, true) : go("tune", true))}>
              Back
            </button>
            {!last && !detail && (
              <button type="button" className="fhj-fr-ghost" onClick={() => photoWalkTo(at + 1)}>
                Decide later
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- act five: what else it should keep ----------

     A day holds more than a number and a photograph, and every one of the
     things it can hold turns into a one-tap button on somebody's home screen.
     That is the whole reason this is walked rather than listed: the row of
     buttons under their thumb for the next year should not be an arrangement
     the app suggested and they never looked at.

     So one card each, a yes beside a no, and the dashboard drawn underneath as
     it assembles. Then the two questions that are not about *what* a day holds
     but about *when* it is asked for — how often, and whether to nudge — in
     that order, because the reminder is about when in the day and the cadence
     is about whether the day is even one of the days, and getting them the
     other way round is how somebody ends up choosing an evening nudge for a
     journal they only meant to keep on Sundays. */

  if (act === "extras") {
    const total = extras.length + 2;
    const at = extraAt;
    const stage = at < extras.length ? "extra" : at === extras.length ? "cadence" : "nudge";
    const e = stage === "extra" ? extras[at] : null;
    const on = e ? chosenExtras.has(e.id) : false;
    const answered = e ? extraAnswered.has(e.id) : false;
    const suggested = e ? suggestedExtras.has(e.id) : false;
    const last = stage === "nudge";

    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <StepRail index={3} />

          <div className="fhj-fr-walkbar" data-act-block role="group"
            aria-label={`Extra ${at + 1} of ${total}`}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} aria-hidden="true"
                className={"fhj-fr-walkbar-seg" + (i < at ? " is-done" : i === at ? " is-now" : "")} />
            ))}
          </div>

          {stage === "extra" && e ? (
            <>
              <h1 className="fhj-fr-display is-small" data-act-block>{e.label}</h1>
              <p className="fhj-fr-sub" data-act-block>{e.blurb}.</p>

              {/* No mock-up of the tile here any more. It drew one button with
                  an arrow and a caption reading "One tap on your home screen,
                  every day you need it" — directly above the row that shows the
                  real ones assembling as they are answered. Two demonstrations
                  of one mechanism, and the illustration was the weaker of them:
                  it showed a button, and the row below shows *theirs*. */}

              {suggested && (
                <p className="fhj-fr-hint" data-act-block>
                  Suggested for what you track — which is a suggestion, not a decision.
                </p>
              )}

              <div className="fhj-fr-pw-actions" data-act-block>
                <button type="button" className="fhj-fr-pw-yes"
                  aria-pressed={answered && on}
                  onClick={() => answerExtra(e.id, true, at)}>
                  <Icon name={e.icon} size={15} color={C.onAccent} />
                  <span>Yes — keep this</span>
                </button>
                <button type="button" className="fhj-fr-pw-no"
                  aria-pressed={answered && !on}
                  onClick={() => answerExtra(e.id, false, at)}>
                  Not this one
                </button>
              </div>
            </>
          ) : stage === "cadence" ? (
            <>
              <h1 className="fhj-fr-display is-small" data-act-block>How often should it ask?</h1>
              <p className="fhj-fr-sub" data-act-block>
                A slower journal is not a worse one — a year of one number a week beats a fortnight
                of forty a day. On anything but every day, the app goes quiet once the week has what
                it asked for, and nothing counts as missed.
              </p>
              <div className="fhj-fr-nudge" data-act-block>
                <div className="fhj-fr-nudge-row" role="group" aria-label="How often to check in">
                  {CADENCES.map(([id, label, sub]) => (
                    <button key={id} type="button" aria-pressed={cadence === id}
                      onClick={() => { feedback("select"); setCadence(id); }}
                      className={"fhj-fr-nudge-btn" + (cadence === id ? " is-on" : "")}>
                      <b>{label}</b>
                      <span>{sub}</span>
                    </button>
                  ))}
                </div>
                {/* The fact, not the reassurance: "changeable any time" is the
                    promise the rail already made on the first act, and made
                    again two cards ago. What it does not say is that this list
                    is the short one. */}
                <p className="fhj-fr-hint">More choices in Settings.</p>
              </div>
            </>
          ) : (
            <>
              <h1 className="fhj-fr-display is-small" data-act-block>A nudge to write it down?</h1>
              <p className="fhj-fr-sub" data-act-block>
                A reminder from the app itself, on this device. Nothing is sent anywhere, and you
                can add it to your phone's calendar from Settings so it works with the app closed.
              </p>
              <div className="fhj-fr-nudge" data-act-block>
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
              </div>
            </>
          )}

          {/* The dashboard, assembling. This is the payoff of the act: the
              answers above are not filed away somewhere, they are the row of
              buttons this person is about to use every day. */}
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
              Rearranged whenever you like by holding one and dragging it, and they learn: switch it
              on and the ones you press most move to the front on their own.
            </p>
          </div>
        </div>

        <div className="fhj-fr-foot">
          {(stage !== "extra" || last) && (
            <button type="button" className="fhj-fr-primary"
              onClick={() => (last ? go("entry") : extraWalkTo(at + 1))}>
              <span>Continue</span>
              <Icon name="right" size={17} color={C.onAccent} />
            </button>
          )}
          <div className="fhj-fr-foot-row">
            <button type="button" className="fhj-fr-ghost"
              onClick={() => (at > 0 ? extraWalkTo(at - 1, true) : go("photos", true))}>
              Back
            </button>
            {stage === "extra" && (
              <button type="button" className="fhj-fr-ghost" onClick={() => extraWalkTo(at + 1)}>
                Decide later
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- act six: the first entry ---------- */

  if (act === "entry") {
    const ask = metric?.ask || (metric ? `${metric.label} today?` : "How is today?");
    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <StepRail index={4} />
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

  /* ---------- act seven: the journal begins ---------- */

  /* The three beats, said back in terms of what this person actually set up.
     Generic copy here would be the one place in the flow where the app stops
     talking to them and starts talking to everybody. */
  const keptLine = (): string => {
    const bits: string[] = [];
    if (chosenExtras.has("food")) bits.push("meals");
    if (chosenExtras.has("routine")) bits.push("doses");
    if (photosOn) bits.push(shots.length === 1 ? "one photo" : `${shots.length} photos`);
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
          <h1 className="fhj-fr-display is-small" data-tl-line>
            {first ? `Your journal has begun, ${first}.` : "Your journal has begun."}
          </h1>
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
