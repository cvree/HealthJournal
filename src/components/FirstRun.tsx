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
     4. **What it will ask you.** Their check-in, in their own words. This is
        the act that has to *teach* — most people have never been asked to
        design a survey, so the answer control is drawn beside every question
        rather than named, the questions can be sorted by how they are
        answered (a 1–10, a yes or no, a number, a few words), and the whole
        check-in can be previewed exactly as it will look tomorrow morning.
        It arrives **short** — the quick set, not the balanced one — and beside
        the list there is a guided pass that puts one group of questions on the
        screen at a time and asks about it. A check-in somebody chose question
        by question is a check-in they answer in week six; one that arrived
        pre-filled with thirty rows is one they abandon in week two.
     5. **What is worth a photograph.** Not "do you want photos" — *of what*,
        and **nothing is ticked for them**. Body areas on a map, flare-ups,
        progress shots, meals, the label on the tub: every one of them is a
        picture of somebody's own body or plate, and an app that quietly
        decided which of those it would be pointing a camera at has taken a
        decision that was never its to take. So this screen suggests, marks
        what it suggests and why, and then waits. The guided pass here holds up
        one subject at a time and asks outright. The contact sheet fills in as
        they answer, and every frame on it is a shot the camera button will
        offer them.
     6. **What else it should keep.** Meals, doses, flares, a nudge in the
        evening. Every choice here lights up a one-tap button on their
        dashboard, and the row of buttons assembles under their thumb as they
        pick — the app being built in front of them out of their own answers.
     7. **The first entry.** Real, not a demo. The number they pick is written
        to their journal.
     8. **The journal beginning.** The card they just filled in physically
        becomes the first card on their timeline, the rail draws itself
        downward into the days they have not lived yet, and the streak counts
        to one.

   Four rules hold the middle acts together, and they are the reason this can
   be five steps without feeling like five steps:

   - **Nothing is ever demanded.** Every screen after the first arrives already
     answered with a sensible default, so Continue is always live and a person
     who wants to be through in thirty seconds still can be. "Already answered"
     includes *no photographs and a four-question check-in* — both are real
     answers, and the CTA says so out loud rather than going grey.
   - **The default is the small one.** Where a screen has to guess, it guesses
     short. Nobody ever quit a journal because the first week asked too little,
     and every one of these screens can be reopened from Settings with more on
     the table than first run ever showed.
   - **Anything worth choosing can be walked through.** The two screens with
     more than a handful of options — the questions, and the photographs —
     each carry a guided pass beside the list: one group, or one subject, on
     the screen at a time, with what it costs, what it is for, and a plain way
     to say no. It is optional, it is never the only way through, and it is
     the difference between a survey somebody was handed and one they built.
   - **Every choice shows its consequence immediately.** Switching a question
     off changes the "about 25 seconds a day" line under it. Typing a name
     changes the greeting quoted underneath it. Choosing a photo subject puts
     a frame on the contact sheet and a camera button in the preview row.
     Nothing is filed away to be discovered later; the app is assembled in
     front of the person making it.

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

const RAIL = ["Tracking", "Questions", "Photos", "Extras", "First entry"];

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

type Depth = "light" | "balanced" | "full";

/* ---------- how much to ask, and why it starts small ----------

   Three presets, and the one everybody lands on is the short one.

   That is a deliberate reversal. The balanced set is the better *journal* —
   more questions, more for the patterns to chew on — and it was the default
   here for exactly that reason. What it is not is the better *first week*.
   Somebody who has just installed this has a rash or a gut or a headache and
   no idea yet what they will still be willing to answer on the morning they
   feel worst, and the honest answer to "how much should I track" is always
   "less than you think, for longer than you think".

   So the flow opens on Quick — four or five questions, half a minute — and
   says out loud that it is the starting point rather than the small option.
   Everything else is one tap away, on this screen and forever after in
   Settings, and adding a question in week three is a thing people do. Deleting
   twenty in week three is a thing nobody does; they just stop opening the app. */
const DEPTHS: [Depth, string, string][] = [
  ["light", "Quick",
    "The few you'd still answer on your worst morning. Start here — a short check-in kept for a year beats a long one kept for nine days."],
  ["balanced", "Balanced",
    "Everything the packs you picked treat as everyday. More to answer each morning, and more for the patterns to work with later."],
  ["full", "Thorough",
    "Every question your packs brought, switched on. For somebody chasing one specific thing, or with an appointment coming."],
];

const CUSTOM_TYPES: [string, string, string][] = [
  ["scale", "1–10", "A severity or a rating"],
  ["toggle", "Yes / no", "Did it happen or not"],
  ["number", "A number", "Counts, minutes, anything measured"],
  ["text", "A few words", "Whatever you want to say"],
];

/* ---------- the four ways a question can be answered ----------

   Almost nobody has designed a survey before, and the words for the parts of
   one ("field type", "boolean") are worse than useless to somebody who is
   trying to describe their own body. So the lens row names them the way an
   answer feels — a 1–10, a yes or no, a number, a few words — and every
   question in the list is drawn *with the control it will actually use*.
   Nobody has to be taught what a yes/no question is once they can see the Yes
   and the No sitting there. */
type Lens = "all" | "scale" | "toggle" | "other";

const LENSES: [Lens, string][] = [
  ["all", "Everything"],
  ["scale", "1–10"],
  ["toggle", "Yes / no"],
  ["other", "Numbers & words"],
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

const inLens = (type: string, lens: Lens): boolean =>
  lens === "all" ? true : lens === "other" ? type !== "scale" && type !== "toggle" : type === lens;

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

  /* Act three. `depth` is the preset somebody is on; `hand` is what they did
     to it afterwards. Null means "still following the preset", which is what
     lets changing a pack on the screen before this one re-derive the whole
     list instead of stranding a set of answers about questions that no longer
     exist. */
  const [depth, setDepth] = useState<Depth>("light");
  const [hand, setHand] = useState<Set<string> | null>(null);
  const [customs, setCustoms] = useState<FirstRunCustom[]>([]);
  const [writing, setWriting] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftType, setDraftType] = useState("scale");
  const [openSecs, setOpenSecs] = useState<Set<string> | null>(null);

  /* Act three's teaching aids: which slice of the survey is on screen, and
     whether the whole thing is being previewed as it will look tomorrow. */
  const [lens, setLens] = useState<Lens>("all");
  const [previewOpen, setPreviewOpen] = useState(false);

  /* The guided pass over the questions. `walk` is which card is on screen —
     one per section, then a review card at the end — and null is "not walking",
     which is where somebody who would rather work the list starts and stays.
     `walked` only changes what the screen says afterwards. */
  const [walk, setWalk] = useState<number | null>(null);
  const [walked, setWalked] = useState(false);

  /* Act four: what is worth photographing. Nothing is pre-picked here — see
     the note above the act — so untouched (`null`) falls back to *nothing*
     rather than to the app's suggestions. The guided pass has its own cursor
     and its own record of which subjects have actually been *answered*, so
     stepping back through it shows a "no" as a no rather than as a question
     nobody reached. */
  const [photoPicked, setPhotoPicked] = useState<Set<string> | null>(null);
  const [photoWalk, setPhotoWalk] = useState<number | null>(null);
  const [photoWalked, setPhotoWalked] = useState(false);
  const [photoAnswered, setPhotoAnswered] = useState<Set<string>>(() => new Set());
  const [spots, setSpots] = useState<FirstRunSpot[]>([]);
  const [angles, setAngles] = useState<string[]>(["Front"]);

  /* Act five. */
  const [picked, setPicked] = useState<Set<string> | null>(null);
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
      a journal with no number is not a journal.

      Quick is now where everybody starts, which raises the bar on what it is
      allowed to contain. Four severity ratings is a check-in that can only
      ever chart itself — every line on it moves together, and the first
      question this app exists to answer ("what was different about the bad
      weeks?") has nothing to answer it with. So when the pack's own everyday
      order would hand somebody nothing but 1–10s, the last slot goes to the
      first question that is answered another way: something they *did*, next
      to something they *felt*. It costs a couple of seconds and it is the
      difference between a journal and a graph of one line. */
  const presetKeys = (mode: Depth): Set<string> => {
    if (mode === "full") return new Set(catalogue.map((q) => q.k));
    const out = new Set<string>();
    if (activeMetric) out.add(activeMetric);
    const quick = catalogue.filter((q) => q.quick && q.k !== activeMetric);
    if (mode === "light") {
      const few = quick.slice(0, 3);
      if (few.length && few.every((q) => q.type === "scale")) {
        const context = quick.find((q) => q.type !== "scale");
        if (context) few[few.length - 1] = context;
      }
      for (const q of few) out.add(q.k);
    } else {
      for (const q of quick) out.add(q.k);
    }
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

  /* Each numbered act starts at its own top, and so does each card of a
     guided pass — a card that arrives scrolled to its own middle is a card
     whose question nobody read. Without this, arriving at a long question
     list halfway down it reads as a broken screen. */
  useEffect(() => {
    if (act !== "hero") window.scrollTo?.(0, 0);
  }, [act, walk, photoWalk]);

  /* ---------- moving between acts ---------- */

  const go = (next: Act, back = false) => {
    dir.current = back ? -1 : 1;
    feedback(back ? "tap" : "nav");
    setAct(next);
  };

  const stepIndex = FLOW.indexOf(act);

  /* ---------- actions ---------- */

  const start = () => { feedback("complete"); dir.current = 1; setAct("you"); };

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

  const setPreset = (mode: Depth) => {
    feedback("select");
    setDepth(mode);
    setHand(null);
  };

  /* ---------- the guided pass over the questions ----------

     One section on the screen at a time, its shape said out loud, its rows
     big enough to read on a phone held one-handed, and a running total of
     what the whole check-in now costs. Six short decisions instead of one
     long list — and, more to the point, six decisions somebody actually
     made. The list upstairs is still there and still does everything this
     does; what this adds is that nothing scrolls past unlooked-at. */
  const walkCards = useMemo(() => sections.filter(([, qs]) => qs.length > 0), [sections]);
  const walkAt = walk == null ? null : Math.min(walk, walkCards.length);

  const startWalk = () => { feedback("nav"); setWalk(0); };

  const leaveWalk = (finished: boolean) => {
    feedback(finished ? "complete" : "tap");
    if (finished) setWalked(true);
    setWalk(null);
  };

  const walkTo = (i: number, back = false) => {
    feedback(back ? "tap" : "nav");
    setWalk(Math.max(0, Math.min(i, walkCards.length)));
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
    setHand((prev) => (prev ? new Set([...prev, id]) : prev));
    setOpenSecs((prev) => (prev ? new Set([...prev, "Your own questions"]) : prev));
    setDraftLabel("");
    setWriting(false);
  };

  const toggleSubject = (id: string) => {
    feedback("select");
    setPhotoAnswered((prev) => new Set([...prev, id]));
    setPhotoPicked((prev) => {
      const next = new Set(prev ?? EMPTY);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ---------- the guided pass over the photographs ----------

     Not a list of tickboxes with an opinion baked into it: one subject held
     up at a time, what it is, what it turns out to be worth, and a Yes beside
     a No. Both answers move on, both are recorded, and "no" is recorded as an
     answer rather than as an absence — so somebody stepping back through the
     deck sees the decision they made rather than a card that looks untouched. */
  const startPhotoWalk = () => { feedback("nav"); setPhotoWalk(0); };

  const leavePhotoWalk = (finished: boolean) => {
    feedback(finished ? "complete" : "tap");
    if (finished) setPhotoWalked(true);
    setPhotoWalk(null);
  };

  const photoWalkTo = (i: number, back = false) => {
    feedback(back ? "tap" : "nav");
    setPhotoWalk(Math.max(0, Math.min(i, walkSubjects.length)));
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
    setPhotoWalk(Math.min(at + 1, walkSubjects.length));
  };

  const toggleAngle = (a: string) => {
    feedback("select");
    setAngles((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
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
    const questionCount = catalogue.length;
    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <StepRail index={0} labels={RAIL} />
          <div className="fhj-fr-step" data-act-block>Step 1 of 5</div>
          <h1 className="fhj-fr-display is-small" data-act-block>
            {first ? `${first} — what are you tracking?` : "What are you tracking?"}
          </h1>
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
              abstraction once it says what it brings with it — and neither is
              "four more screens" until somebody has been told what is on them.

              This is the orientation the flow never gave. A step rail names
              four words; it does not say that the questions arrive short, that
              nothing gets photographed unless it is asked for, or that every
              one of these screens exists again in Settings tomorrow. Somebody
              who knows all three arrives at the next screen deciding. Somebody
              who does not arrives at it bracing. */}
          {mods.length > 0 && (
            <div className="fhj-fr-next" aria-live="polite">
              <div className="fhj-fr-eyebrow">What happens next</div>
              <ol className="fhj-fr-next-list">
                <li>
                  <b>Your questions.</b>{" "}
                  {questionCount} came with what you just picked, and it starts with a short set
                  switched on. You decide which of the rest get asked — the whole list at once, or
                  one group at a time.
                </li>
                <li>
                  <b>Your photographs.</b>{" "}
                  What is worth a picture, and of what. Nothing here is chosen for you.
                </li>
                <li>
                  <b>Everything else a day holds.</b>{" "}
                  Meals, doses, flares, a nudge in the evening — and how often it should ask at all.
                </li>
                <li>
                  <b>Your first entry.</b>{" "}
                  A real one, written to your journal rather than a demo.
                </li>
              </ol>
              <p className="fhj-fr-hint">
                Two minutes, and nothing is permanent: every one of these screens exists again in
                Settings, with more on the table than first run ever shows you.
              </p>
            </div>
          )}
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

  /* ---------- act three, walked: one group of questions at a time ----------

     The list on the screen behind this one is complete, honest and, for a lot
     of people, unreadable: forty rows in six folds, arriving pre-answered, on
     a phone. Scrolling it is not choosing, and a check-in nobody chose is a
     check-in nobody defends at 7am on a bad morning.

     So this is the same catalogue, dealt out one group at a time. Each card
     says how big the group is and what answering it feels like, draws the
     control beside every row, offers all-of-them and none-of-them as single
     taps for the people who already know, and keeps the running cost of the
     whole check-in under their thumb. It ends on the finished thing, drawn as
     tomorrow morning will draw it.

     Nothing here can be reached only from here. Leaving mid-way keeps every
     answer already given — this is a way through the same screen, never a
     mode with its own state to lose. */

  if (act === "tune" && walkAt !== null) {
    const total = walkCards.length;
    const done = walkAt >= total;
    const [sec, qs] = done ? ["", [] as FirstRunQuestion[]] : walkCards[walkAt];
    const onCount = qs.filter((q) => enabled.has(q.k)).length;

    const lead = onCount === 0
      ? "None of these are on. Leaving it that way is a real answer — a question you resent being asked is one you end up answering badly."
      : onCount === qs.length
        ? "All of them are on. Each one is a few more seconds every morning, so drop anything you would only be guessing at."
        : `${onCount} of the ${qs.length} are on. Tap any row to change your mind.`;

    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <StepRail index={1} labels={RAIL} />
          <div className="fhj-fr-step" data-act-block>
            {done ? "Step 2 of 5 · your check-in" : `Step 2 of 5 · group ${walkAt + 1} of ${total}`}
          </div>

          <div className="fhj-fr-walkbar" aria-hidden="true" data-act-block>
            {walkCards.map(([name], i) => (
              <span key={name}
                className={"fhj-fr-walkbar-seg" + (i < walkAt ? " is-done" : i === walkAt ? " is-now" : "")} />
            ))}
            <span className={"fhj-fr-walkbar-seg" + (done ? " is-now" : "")} />
          </div>

          {done ? (
            <>
              <h1 className="fhj-fr-display is-small" data-act-block>This is your check-in.</h1>
              <p className="fhj-fr-sub" data-act-block>
                {first ? `${first}, every one of these is here because you said so. ` : "Every one of these is here because you said so. "}
                Tomorrow morning, and every morning after it, this is the whole of what it asks —
                and it is yours to change any time, from Settings or from here.
              </p>

              <div className="fhj-fr-pv" data-act-block>
                <div className="fhj-fr-pv-head">
                  <span className="fhj-fr-pv-date">{todayLabel()}</span>
                  <span className="fhj-fr-pv-tag">Your check-in</span>
                </div>
                <div className="fhj-fr-pv-body">
                  {enabledQs.map((q) => <PreviewField key={q.k} q={q} />)}
                </div>
                <div className="fhj-fr-pv-foot">
                  <span>Then one button, and the day is on the record.</span>
                  <b>{checkInTimeLabel(seconds)}</b>
                </div>
              </div>

              <p className="fhj-fr-hint" data-act-block>
                {enabledQs.length} question{enabledQs.length === 1 ? "" : "s"}, {checkInTimeLabel(seconds)} a day.
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
                  return (
                    <button key={q.k} type="button" role="switch" aria-checked={on}
                      disabled={isMetric} onClick={() => toggleQuestion(q)}
                      className={"fhj-fr-wq" + (on ? " is-on" : "") + (isMetric ? " is-locked" : "")}>
                      <span className="fhj-fr-wq-top">
                        <span className="fhj-fr-wq-mark">
                          {on ? <Icon name="check" size={12} color={C.onAccent} /> : null}
                        </span>
                        <span className="fhj-fr-wq-label">{q.label}</span>
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

              <div className="fhj-fr-walk-tally" data-act-block aria-live="polite">
                <span className="fhj-fr-walk-tally-num">{enabledQs.length}</span>
                <span>
                  question{enabledQs.length === 1 ? "" : "s"} in your check-in so far<br />
                  <b>{checkInTimeLabel(seconds)} a day</b>
                </span>
              </div>
            </>
          )}
        </div>

        {/* A way out of every card, not just the first one. Somebody who
            changes their mind three groups in should not have to walk back
            out the way they came, and nothing here is lost by leaving. */}
        <div className="fhj-fr-foot">
          <button type="button" className="fhj-fr-primary"
            onClick={() => (done ? leaveWalk(true) : walkTo(walkAt + 1))}>
            <span>{done ? "That's my check-in" : walkAt === total - 1 ? "See my check-in" : "Next group"}</span>
            <Icon name="right" size={17} color={C.onAccent} />
          </button>
          <div className="fhj-fr-foot-row">
            {walkAt > 0 && (
              <button type="button" className="fhj-fr-ghost" onClick={() => walkTo(walkAt - 1, true)}>
                Back
              </button>
            )}
            <button type="button" className="fhj-fr-ghost" onClick={() => leaveWalk(false)}>
              Show me the whole list
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- act three: what it will ask you ---------- */

  if (act === "tune") {
    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <StepRail index={1} labels={RAIL} />
          <div className="fhj-fr-step" data-act-block>Step 2 of 5</div>
          <h1 className="fhj-fr-display is-small" data-act-block>What should it ask you?</h1>
          <p className="fhj-fr-sub" data-act-block>
            {first ? `${first}, this is your check-in — the same few questions, every day.` :
              "This is your check-in — the same few questions, every day."}{" "}
            It starts <b>short</b> on purpose: {catalogue.length} questions came with what you
            picked, and {enabledQs.length} of them are switched on. Add whatever is missing —
            here, or one group at a time.
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
              {DEPTHS.map(([m, l, why]) => (
                <button key={m} type="button" aria-pressed={depth === m && !hand}
                  aria-label={`${l} — ${why}`}
                  onClick={() => setPreset(m)}
                  className={"fhj-fr-depth-btn" + (depth === m && !hand ? " is-on" : "")}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* What the pill you are standing on actually means, in a sentence.
              Three unlabelled sizes is a slider with no units: "Balanced"
              tells nobody what they are agreeing to, and the person most
              likely to pick the biggest one is the person least likely to
              still be answering it in March. */}
          <p className="fhj-fr-depth-note" data-act-block aria-live="polite">
            {hand
              ? <><b>Your own set.</b> You have picked these yourself — the presets above are one tap away if you would rather start over from one.</>
              : <><b>{DEPTHS.find(([m]) => m === depth)![1]}.</b> {DEPTHS.find(([m]) => m === depth)![2]}</>}
          </p>

          {/* The guided pass. Offered before the list rather than after it,
              because the person who needs it is the one about to be scrolled
              past forty rows, and the person who does not need it has already
              stopped reading this paragraph and gone to the list. */}
          <div className="fhj-fr-invite" data-act-block>
            <div className="fhj-fr-invite-body">
              <span className="fhj-fr-eyebrow">
                {walked ? "You have been through these" : `${catalogue.length} questions on the table`}
              </span>
              <b>{walked ? "Go through them again?" : "Choose them with me, one group at a time"}</b>
              <span>
                {walkCards.length} short screens — {walkCards.length === 1 ? "one group" : "one group each"},
                what it costs you every morning, and a plain way to say no. About a minute, and you
                can leave it at any point without losing an answer.
              </span>
            </div>
            <button type="button" className="fhj-fr-invite-btn" onClick={startWalk}>
              <span>{walked ? "Walk them again" : "Walk me through them"}</span>
              <Icon name="right" size={15} color={C.onAccent} />
            </button>
          </div>

          {/* The four ways a question can be answered, named the way an answer
              feels and counted so the shape of the check-in is legible at a
              glance: "six 1–10s and four yes/nos" is a survey somebody
              understands; a list of forty rows is not. Tapping one narrows the
              list to that kind, which is how somebody who came here to add
              three yes/no questions finds the eleven that already exist. */}
          <div className="fhj-fr-lenses" data-act-block>
            <div className="fhj-fr-lens-head">
              <span className="fhj-fr-eyebrow">How you'll answer</span>
              <button type="button" className="fhj-fr-lens-preview"
                aria-expanded={previewOpen}
                onClick={() => { feedback("expand"); setPreviewOpen((v) => !v); }}>
                {previewOpen ? "Hide the preview" : "See it as it'll look"}
                <Icon name={previewOpen ? "up" : "down"} size={12} color={C.accentText} />
              </button>
            </div>
            <div className="fhj-fr-lens-row" role="group" aria-label="Show questions by answer type">
              {LENSES.map(([id, label]) => {
                const n = id === "all"
                  ? enabledQs.length
                  : enabledQs.filter((q) => inLens(q.type, id)).length;
                return (
                  <button key={id} type="button" aria-pressed={lens === id}
                    onClick={() => { feedback("select"); setLens(id); }}
                    className={"fhj-fr-lens" + (lens === id ? " is-on" : "")}>
                    {id !== "all" && <MiniControl type={id === "other" ? "number" : id} />}
                    <b>{label}</b>
                    <span>{n} on</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tomorrow morning, drawn. Every question that survived, with the
              control it will actually use, in the order it will be asked. This
              is the answer to "what am I signing up for", and it is worth more
              than any amount of explaining. */}
          {previewOpen && (
            <div className="fhj-fr-pv" data-act-block>
              <div className="fhj-fr-pv-head">
                <span className="fhj-fr-pv-date">{todayLabel()}</span>
                <span className="fhj-fr-pv-tag">Preview</span>
              </div>
              <div className="fhj-fr-pv-body">
                {enabledQs.map((q) => <PreviewField key={q.k} q={q} />)}
              </div>
              <div className="fhj-fr-pv-foot">
                <span>Then one button, and the day is on the record.</span>
                <b>{checkInTimeLabel(seconds)}</b>
              </div>
            </div>
          )}

          <div className="fhj-fr-qs" data-act-block>
            {sections.map(([sec, all]) => {
              /* A lens narrows what is listed, never what is kept: switching
                 to "Yes / no" and back has to leave the check-in exactly as it
                 was, so the filter lives here and touches nothing else. */
              const qs = lens === "all" ? all : all.filter((q) => inLens(q.type, lens));
              if (!qs.length) return null;
              const onCount = qs.filter((q) => enabled.has(q.k)).length;
              const open = lens === "all" ? openNow.has(sec) : true;
              return (
                <div key={sec} className="fhj-fr-qsec">
                  <button type="button" className="fhj-fr-qsec-head"
                    aria-expanded={open} disabled={lens !== "all"}
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
                    {lens === "all" && <Icon name={open ? "up" : "down"} size={13} color={C.subtle} />}
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
                            {/* The control itself, at the end of the row.
                                Nobody has to be told what a yes/no question is
                                once the Yes and the No are sitting there. */}
                            <MiniControl type={q.type} />
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
                  A yes/no question is an abstraction until the Yes and the No
                  are on the screen with their own words above them. */}
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
              + Ask me something of my own
            </button>
          )}
        </div>

        <div className="fhj-fr-foot">
          <button type="button" onClick={() => go("photos")} className="fhj-fr-primary">
            <span>Continue</span>
            <Icon name="right" size={17} color={C.onAccent} />
          </button>
          <button type="button" className="fhj-fr-ghost" onClick={() => go("focus", true)}>Back</button>
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

     So the question is not whether but *of what*, and the answer draws itself
     into a contact sheet as it is given. Choosing nothing is a first-class
     outcome — the CTA says so rather than going grey.

     And the guess is gone entirely. Nothing on this screen arrives ticked:
     the suggestions are drawn as suggestions and every frame on the contact
     sheet got there because somebody put it there. Two screens follow — the
     guided pass, one subject at a time, and then the list itself. */

  /* ---------- act four, walked: one subject at a time ----------

     Eight things a camera can be pointed at is more than anybody can weigh in
     one glance, and the cost of getting it wrong is asymmetric: a subject
     nobody picks is a photograph never taken, and there is no way to go back
     in six weeks and take it.

     So each one gets its own screen — what it is, what it is worth having
     later, whether people tracking what this person tracks tend to keep it —
     and a Yes beside a No, both of which move on. No card can be reached
     without being answered, and no answer is assumed. */

  if (act === "photos" && photoWalk !== null) {
    const total = walkSubjects.length;
    const at = Math.min(photoWalk, total);
    const done = at >= total;
    const sub = done ? null : walkSubjects[at];
    const suggested = sub ? suggestedSubjects.has(sub.id) : false;
    const on = sub ? chosenSubjects.has(sub.id) : false;
    const answered = sub ? photoAnswered.has(sub.id) : false;
    const tracking = chosen.map((p) => p.label.toLowerCase());
    const trackingWords = tracking.length > 1
      ? `${tracking.slice(0, -1).join(", ")} and ${tracking[tracking.length - 1]}`
      : tracking[0] || "what you track";

    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <StepRail index={2} labels={RAIL} />
          <div className="fhj-fr-step" data-act-block>
            {done ? "Step 3 of 5 · your camera" : `Step 3 of 5 · ${at + 1} of ${total}`}
          </div>

          <div className="fhj-fr-walkbar" aria-hidden="true" data-act-block>
            {walkSubjects.map((w, i) => (
              <span key={w.id}
                className={"fhj-fr-walkbar-seg" + (i < at ? " is-done" : i === at ? " is-now" : "")} />
            ))}
            <span className={"fhj-fr-walkbar-seg" + (done ? " is-now" : "")} />
          </div>

          {done || !sub ? (
            <>
              <h1 className="fhj-fr-display is-small" data-act-block>
                {photosOn ? "This is your camera." : "No photographs, then."}
              </h1>
              <p className="fhj-fr-sub" data-act-block>
                {photosOn
                  ? "Every frame here is a shot the camera button will offer you, lined up against the last time you took it. Nothing is ever required to log a day."
                  : "You went through all of them and kept none, which is a real answer — plenty of journals are numbers and notes. The camera can be switched on any time from Settings."}
              </p>

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
                  <p className="fhj-fr-hint">Nothing picked — and nothing is missing.</p>
                )}
              </div>

              {(chosenSubjects.has("areas") || wantsProgress) && (
                <p className="fhj-fr-hint" data-act-block>
                  Two of these want one more detail —
                  {chosenSubjects.has("areas") ? " which body areas" : ""}
                  {chosenSubjects.has("areas") && wantsProgress ? ", and" : ""}
                  {wantsProgress ? " which angles" : ""} — waiting for you on the screen this
                  hands back to.
                </p>
              )}
            </>
          ) : (
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
                  ? "Say yes and you pick the exact areas off a body map, each keeping its own run of photos. "
                  : sub.kind === "progress"
                    ? "Say yes and you pick the angles — front on its own is plenty to start with. "
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
          )}
        </div>

        <div className="fhj-fr-foot">
          {done && (
            <button type="button" className="fhj-fr-primary" onClick={() => leavePhotoWalk(true)}>
              <span>{photosOn ? "These are my shots" : "Continue without photos"}</span>
              <Icon name="right" size={17} color={C.onAccent} />
            </button>
          )}
          <div className="fhj-fr-foot-row">
            {at > 0 && (
              <button type="button" className="fhj-fr-ghost" onClick={() => photoWalkTo(at - 1, true)}>
                Back
              </button>
            )}
            <button type="button" className="fhj-fr-ghost" onClick={() => leavePhotoWalk(false)}>
              Show me the whole list
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (act === "photos") {
    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <StepRail index={2} labels={RAIL} />
          <div className="fhj-fr-step" data-act-block>Step 3 of 5</div>
          <h1 className="fhj-fr-display is-small" data-act-block>What's worth a photo?</h1>
          <p className="fhj-fr-sub" data-act-block>
            You will not remember what week three looked like. The camera will. Nothing here is
            picked for you — these are photographs of your own skin, plate and bathroom shelf, and
            which of them get taken is yours to say. Every one you choose becomes a shot the camera
            button offers, lined up against the last time you took it.
          </p>

          {/* The same offer the questions act makes, for the same reason: this
              is eight decisions, they are not interchangeable, and the list
              below is the fast path rather than the only one. */}
          <div className="fhj-fr-invite" data-act-block>
            <div className="fhj-fr-invite-body">
              <span className="fhj-fr-eyebrow">
                {photoWalked
                  ? `You went through all ${walkSubjects.length}`
                  : `${walkSubjects.length} things people photograph`}
              </span>
              <b>{photoWalked ? "Go through them again?" : "Go through them one at a time"}</b>
              <span>
                What each one is, what it is worth six weeks later, and a yes beside a no. Under a
                minute, and every answer lands here.
              </span>
            </div>
            <button type="button" className="fhj-fr-invite-btn" onClick={startPhotoWalk}>
              <span>{photoWalked ? "Walk them again" : "Walk me through them"}</span>
              <Icon name="right" size={15} color={C.onAccent} />
            </button>
          </div>

          <div className="fhj-fr-subjects" data-act-block>
            {photoSubjects.map((sub) => {
              const on = chosenSubjects.has(sub.id);
              const suggested = suggestedSubjects.has(sub.id);
              if (sub.kind === "spots" && !BodyMap) return null;
              return (
                <button key={sub.id} type="button" aria-pressed={on}
                  onClick={() => toggleSubject(sub.id)}
                  className={"fhj-fr-subject" + (on ? " is-on" : "")}>
                  <span className="fhj-fr-subject-mark">
                    <Icon name={on ? "check" : sub.icon} size={15} color={on ? C.onAccent : C.sub} />
                  </span>
                  <span className="fhj-fr-subject-body">
                    <span className="fhj-fr-subject-name">
                      {sub.label}
                      {suggested && !on && <span className="fhj-fr-extra-tag">suggested for what you track</span>}
                    </span>
                    <span className="fhj-fr-subject-blurb">{sub.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Body areas, on a map, because "left elbow" typed into a box is a
              different thing from a spot somebody pointed at. Only ever shown
              once they've asked for it — a body diagram on a screen nobody
              opened is startling. */}
          {wantsSpots && BodyMap && (
            <div className="fhj-fr-spots" data-act-block>
              <div className="fhj-fr-eyebrow">Which areas?</div>
              <p className="fhj-fr-sub is-tight">
                Tap the ones you want to watch over time. Add more later, and a photo is never
                required to log a day.
              </p>
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
          )}

          {wantsProgress && (
            <div className="fhj-fr-spots" data-act-block>
              <div className="fhj-fr-eyebrow">Which angles?</div>
              <p className="fhj-fr-sub is-tight">
                Same pose, same spot, weeks apart. Front on its own is plenty to start with.
              </p>
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
          )}

          {/* The contact sheet. Empty frames with real labels under them, one
              per shot — the same trick the last act plays with the timeline:
              show the shape of the thing before there is anything in it. */}
          <div className="fhj-fr-sheet" data-act-block>
            <div className="fhj-fr-eyebrow">
              {photosOn
                ? `Your camera · ${shots.length} shot${shots.length === 1 ? "" : "s"}`
                : "Your camera"}
            </div>
            {photosOn ? (
              <>
                <div className="fhj-fr-sheet-row">
                  {shots.slice(0, 8).map((sh) => (
                    <span key={sh.key} className={"fhj-fr-frame is-" + sh.frame}>
                      <span className="fhj-fr-frame-win" aria-hidden="true">
                        <Icon name="camera" size={13} color={C.subtle} />
                      </span>
                      <span className="fhj-fr-frame-label">{sh.label}</span>
                    </span>
                  ))}
                  {shots.length > 8 && (
                    <span className="fhj-fr-frame is-more">+{shots.length - 8}</span>
                  )}
                </div>
                <p className="fhj-fr-hint">
                  Each one remembers its last shot and lines the next one up against it, so a
                  slow change over two months is something you can see rather than something you
                  have to remember. Photos stay on this device — nothing uploads them, and the
                  only way one ever leaves is you handing it to the optional AI yourself.
                </p>
              </>
            ) : (
              <p className="fhj-fr-hint">
                Nothing picked yet. Continuing with an empty sheet is a real answer — plenty of
                journals are numbers and notes, and the camera can be switched on any time from
                Settings — but it is worth thirty seconds first: tap anything above, or let it
                walk you through them one at a time.
              </p>
            )}
          </div>
        </div>

        <div className="fhj-fr-foot">
          <button type="button" onClick={() => go("extras")} className="fhj-fr-primary">
            <span>{photosOn ? "Continue" : "Continue without photos"}</span>
            <Icon name="right" size={17} color={C.onAccent} />
          </button>
          <button type="button" className="fhj-fr-ghost" onClick={() => go("tune", true)}>Back</button>
        </div>
      </div>
    );
  }

  /* ---------- act five: what else it should keep ---------- */

  if (act === "extras") {
    return (
      <div className="fhj-fr" ref={actRef}>
        <div className="fhj-fr-act">
          <StepRail index={3} labels={RAIL} />
          <div className="fhj-fr-step" data-act-block>Step 4 of 5</div>
          <h1 className="fhj-fr-display is-small" data-act-block>What else should it keep?</h1>
          <p className="fhj-fr-sub" data-act-block>
            A day holds more than a number and a photo. Everything you pick here becomes a one-tap
            button on your home screen — nothing else does, so keep it to what you'll actually use.
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

          {/* How often it should ask, before it has asked anything.

              This sits above the reminder deliberately: the reminder is about
              *when in the day*, and this is about whether the day is even one
              of the days. Getting them the other way round is how somebody
              ends up choosing an evening nudge for a journal they only meant
              to keep on Sundays. */}
          <div className="fhj-fr-nudge" data-act-block>
            <div className="fhj-fr-eyebrow">How often should it ask?</div>
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
            <p className="fhj-fr-hint">
              A slower journal is not a worse one — a year of one number a week beats a fortnight
              of forty a day. On anything but every day, the app goes quiet once the week has what
              it asked for, and nothing counts as missed. Changeable any time, and there are more
              choices in Settings.
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
          <button type="button" className="fhj-fr-ghost" onClick={() => go("photos", true)}>Back</button>
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
          <StepRail index={4} labels={RAIL} />
          <div className="fhj-fr-step" data-act-block>Step 5 of 5</div>
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
