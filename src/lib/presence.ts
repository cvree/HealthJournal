/* Indoors and outdoors, inferred rather than asked.

   A sun session has an obvious beginning — somebody taps a button because they
   are walking out of a door. It has no obvious end. The end is a person coming
   back inside carrying shopping, and there is no moment in that where they
   reach for a phone to say so. Sessions therefore ran long, or were discarded,
   or were never started at all because starting a thing you have to remember to
   stop is a chore, and this app's one rule is that it may not charge a chore to
   somebody having a bad day.

   So the phone works it out. Not by asking where the person is — by noticing
   something it already knows about *itself*.

   ## The signal

   A phone's position fix carries a reported accuracy in metres, and that number
   is a very good indoor detector. Outdoors with a view of the sky, GNSS resolves
   to five or fifteen metres. Step inside and the satellites go behind a roof;
   the platform falls back to wi-fi and cell trilateration and the same API
   starts reporting sixty, ninety, two hundred. The person has not moved. The
   *sky* has moved, and the sky is exactly what a sun session is about.

   That coincidence is why this is honest here and would not be honest in a
   step counter. We are not inferring a location. We are inferring whether there
   is a roof between this phone and the sun, which is the physical quantity the
   session was measuring in the first place.

   ## What is kept

   Nothing that could rebuild a movement history. `Fix` carries a timestamp, an
   accuracy in metres, and optionally a lux reading. **There is no latitude or
   longitude in this module at all** — not in the state, not in the samples, not
   in what gets written to disk. The one coarse fix a session stores for its
   solar arithmetic is taken once, by lib/context, under its own consent. This
   module never adds to it. If that sounds like a small thing: it is the reason
   a continuously-watched position is defensible in a health journal, so it is
   enforced by the types rather than by good intentions.

   ## Why it is not just a threshold

   A single bad fix is not somebody going inside. It is a bus, a bridge, a tree,
   a phone changing pockets. Ending a session on one reading would produce a
   feature that cuts a walk in half and has to be undone, and an automation that
   has to be undone is worse than no automation.

   So a reading only moves a *run*, and a run only becomes an answer after it has
   held for a few minutes. And when it does become an answer, the time reported
   is the start of the run, not the moment the threshold was crossed — because
   the person went inside when the fixes got worse, not five minutes later when
   the app became sure of it. That backdating is the whole difference between
   "we ended your session" and "we think you came in at 3:42, is that right?".

   Nothing here reads a clock; every function is handed its `now`. */

/* ---------- what comes in ---------- */

/** One position reading, stripped to the two things this module is allowed to
    know. Built by lib/presenceWatch from a browser Position, which is where the
    coordinates are dropped — they never reach this file. */
export interface Fix {
  /** Epoch ms. */
  t: number;
  /** Reported horizontal accuracy, metres. */
  accuracy: number;
  /** Illuminance in lux, if this device has a sensor that reports it. Almost
      none do, and the code below is careful to be no worse without it. */
  lux?: number | null;
}

export type Sky = "outdoor" | "indoor" | "unknown";

/* ---------- the thresholds, and why they sit where they do ---------- */

/** At or under this many metres, the fix saw satellites. Twenty is deliberately
    generous: a good phone reports 4–8 m in the open, and the point of the band
    is to survive a cloudy day and an old handset, not to be a record. */
export const ACCURACY_OUTDOOR = 20;

/** At or over this, the fix is trilateration. Sixty is where wi-fi positioning
    lands in a normal building; below it there is enough overlap with a bad
    outdoor fix that calling it either way would be a guess. */
export const ACCURACY_INDOOR = 60;

/** Daylight outdoors is tens of thousands of lux and a bright office is under a
    thousand. Anything above this cannot be indoors, so it is allowed to *veto*
    an indoor reading — see `scoreFix`. */
export const LUX_OUTDOOR = 3000;

/** How long an indoor run has to hold before the session is ended. Six minutes
    is long enough that a supermarket aisle on the way home does not end a walk,
    and short enough that the estimate is not embarrassing. */
export const INDOOR_SETTLE_MS = 6 * 60_000;

/** Coming back out is allowed to be quicker. Nothing is written when it fires —
    it only re-opens a session that was about to end — so a false positive here
    costs nothing but a redraw. */
export const OUTDOOR_SETTLE_MS = 2 * 60_000;

/** No fix for this long and the answer becomes "unknown". A phone that has
    stopped reporting is a phone in a bag, on a dead battery, or refused
    permission mid-session. It is emphatically *not* evidence of a roof, and
    treating silence as indoors is how an automation ends a two-hour hike at
    minute eleven. */
export const STALE_MS = 12 * 60_000;

/** Readings are kept only for the current run, and a run is a few minutes of
    them. This cap exists so a session left open for hours cannot grow an array
    that gets written to disk on every tick. */
const MAX_RECENT = 60;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number, dp = 2) => {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

/* ---------- scoring one fix ---------- */

/** How much this reading looks like open sky, from −1 (a roof) to +1 (none).

    Accuracy does the work. Lux is only ever allowed to argue *for* outdoors,
    never against it: a bright reading rules out a building, but a dark one is
    just as likely to be a pocket, a coat, or nine o'clock at night, and a
    module that ended evening walks because it was dark outside would be
    measuring the wrong thing entirely. */
export function scoreFix(fix: Fix): number {
  const a = Number(fix.accuracy);
  let score: number;
  if (!Number.isFinite(a) || a <= 0) {
    score = 0; // a platform that declines to say is not evidence either way
  } else if (a <= ACCURACY_OUTDOOR) {
    score = 1;
  } else if (a >= ACCURACY_INDOOR) {
    score = -1;
  } else {
    score = 1 - (2 * (a - ACCURACY_OUTDOOR)) / (ACCURACY_INDOOR - ACCURACY_OUTDOOR);
  }
  const lux = typeof fix.lux === "number" && Number.isFinite(fix.lux) ? fix.lux : null;
  if (lux != null && lux >= LUX_OUTDOOR) return 1;
  return round(score);
}

/** Below this magnitude a reading is ambiguous. Ambiguous readings neither
    extend a run nor break one — they are simply not testimony, and the run
    they arrive in the middle of carries on waiting. */
const DECISIVE = 0.2;

export function readingOf(score: number): Sky {
  if (score >= DECISIVE) return "outdoor";
  if (score <= -DECISIVE) return "indoor";
  return "unknown";
}

/* ---------- the state ---------- */

export interface PresenceState {
  /** The settled answer — what the app is willing to act on. */
  sky: Sky;
  /** When the settled answer began. For an indoor answer this is the estimated
      moment of going inside, and it is what a backdated session end uses. */
  since: number | null;
  /** The run currently accumulating, which may not have earned `sky` yet. */
  pending: Sky;
  pendingSince: number | null;
  /** Epoch ms of the most recent fix of any quality. */
  lastFixAt: number | null;
  /** 0–1. How much the settled answer is worth. Drives whether the app acts
      silently, asks, or keeps quiet. */
  confidence: number;
  /** Scores in the current run, for the confidence average. Bounded. */
  recent: number[];
  /** How many fixes this state has ever seen — an automation that has been
      handed four readings should not be ending anything. */
  fixes: number;
}

export function emptyPresence(): PresenceState {
  return {
    sky: "unknown",
    since: null,
    pending: "unknown",
    pendingSince: null,
    lastFixAt: null,
    confidence: 0,
    recent: [],
    fixes: 0,
  };
}

export interface PresenceOptions {
  indoorSettleMs?: number;
  outdoorSettleMs?: number;
}

/** Fold one fix into the state.

    Pure, and total: a duplicate, an out-of-order or a nonsense reading all have
    a defined answer rather than an exception, because this runs on a timer in a
    pocket and there is nobody there to catch a throw. */
export function observe(
  state: PresenceState,
  fix: Fix,
  opts: PresenceOptions = {}
): PresenceState {
  const t = Number(fix.t);
  if (!Number.isFinite(t)) return state;
  /* Out-of-order fixes happen — a cached reading can arrive after a fresh one.
     Counting it would corrupt the run's start time, so it is dropped. */
  if (state.lastFixAt != null && t < state.lastFixAt) return state;

  const score = scoreFix(fix);
  const reading = readingOf(score);
  const next: PresenceState = {
    ...state,
    lastFixAt: t,
    fixes: state.fixes + 1,
    recent: [...state.recent, score].slice(-MAX_RECENT),
  };

  if (reading === "unknown") {
    /* Not testimony. The run stands, and so does whatever is settled. */
    return withConfidence(next, t, opts);
  }

  if (reading !== state.pending) {
    /* A new run starts here. Its clock begins at this fix, which is what makes
       the eventual answer backdatable. */
    next.pending = reading;
    next.pendingSince = t;
    next.recent = [score];
  }

  return withConfidence(next, t, opts);
}

function settleMs(sky: Sky, opts: PresenceOptions): number {
  if (sky === "indoor") return opts.indoorSettleMs ?? INDOOR_SETTLE_MS;
  if (sky === "outdoor") return opts.outdoorSettleMs ?? OUTDOOR_SETTLE_MS;
  return INDOOR_SETTLE_MS;
}

/** Promote a run to the settled answer once it has held long enough, and price
    the result. Split out because both `observe` and `elapse` need it. */
function withConfidence(state: PresenceState, now: number, opts: PresenceOptions): PresenceState {
  const out = { ...state };
  const held = out.pendingSince != null ? now - out.pendingSince : 0;
  const need = settleMs(out.pending, opts);

  if (out.pending !== "unknown" && out.pending !== out.sky && held >= need) {
    out.sky = out.pending;
    out.since = out.pendingSince;
  }

  /* Confidence is two things multiplied: how long the run has held against what
     it needed, and how decisive the readings in it were. A run of barely-past-
     threshold fixes that has only just matured is not the same evidence as ten
     minutes of clean twelve-metre fixes, and the difference is what decides
     between acting and asking. */
  if (out.sky === "unknown" || out.since == null) {
    out.confidence = 0;
  } else {
    const heldSettled = clamp((now - out.since) / settleMs(out.sky, opts), 0, 1);
    const decisive = out.recent.length
      ? clamp(out.recent.reduce((a, s) => a + Math.abs(s), 0) / out.recent.length, 0, 1)
      : 0;
    const enoughFixes = clamp(out.fixes / 4, 0, 1);
    /* A run building the other way is a live disagreement with the settled
       answer. It has not won yet — that is what the settle period is for — but
       the app should not be as sure as it was a minute ago, and halving the
       confidence is what stops it acting during a wobble. */
    const contested = out.pending !== "unknown" && out.pending !== out.sky ? 0.5 : 1;
    out.confidence = round(heldSettled * decisive * enoughFixes * contested);
  }
  return out;
}

/** Advance the clock without a new fix.

    Called on the same tick as the session stopwatch. Two jobs: mature a run
    that is ready but has not had a fix land on the exact minute it matured, and
    demote everything to "unknown" once the fixes have dried up. The second is
    the one that matters — see STALE_MS. */
export function elapse(
  state: PresenceState,
  now: number,
  opts: PresenceOptions & { staleMs?: number } = {}
): PresenceState {
  const stale = opts.staleMs ?? STALE_MS;
  if (state.lastFixAt == null) return state;
  if (now - state.lastFixAt > stale) {
    if (state.sky === "unknown" && state.pending === "unknown") return state;
    return { ...state, sky: "unknown", since: null, pending: "unknown", pendingSince: null, confidence: 0 };
  }
  return withConfidence(state, now, opts);
}

/** Is this state fresh enough to act on at all? */
export const isFresh = (state: PresenceState, now: number, staleMs = STALE_MS): boolean =>
  state.lastFixAt != null && now - state.lastFixAt <= staleMs;

/* ---------- what a caller actually asks ---------- */

export interface IndoorCall {
  /** Estimated epoch ms of going inside — the start of the indoor run. */
  at: number;
  /** 0–1, from `PresenceState.confidence`. */
  confidence: number;
  /** Minutes the app spent becoming sure, which is time the person was already
      indoors. Shown so the estimate can explain itself. */
  settledAfterMinutes: number;
}

/** "Have they gone in?" — the one question the sun session asks of this module.

    `null` means no: still out, not sure, or not enough evidence to be saying
    anything. The threshold on confidence is deliberately above zero; a run that
    has only just matured on marginal fixes gets to wait another minute rather
    than end somebody's afternoon. */
export function indoorCall(
  state: PresenceState,
  now: number,
  minConfidence = 0.5
): IndoorCall | null {
  if (state.sky !== "indoor" || state.since == null) return null;
  if (!isFresh(state, now)) return null;
  if (state.confidence < minConfidence) return null;
  return {
    at: state.since,
    confidence: state.confidence,
    settledAfterMinutes: Math.max(0, Math.round((now - state.since) / 60_000)),
  };
}

/** The mirror image, for offering to start a session. Same shape, same caution,
    and the caller is expected to *offer* rather than act — starting a record
    nobody asked for is a different kind of rude from ending one they did. */
export function outdoorCall(
  state: PresenceState,
  now: number,
  minConfidence = 0.5
): IndoorCall | null {
  if (state.sky !== "outdoor" || state.since == null) return null;
  if (!isFresh(state, now)) return null;
  if (state.confidence < minConfidence) return null;
  return {
    at: state.since,
    confidence: state.confidence,
    settledAfterMinutes: Math.max(0, Math.round((now - state.since) / 60_000)),
  };
}

/** One line for the live screen, so the automation is never a thing happening
    behind somebody's back. Every state it can be in has a sentence. */
export function presenceLine(state: PresenceState, now: number): string {
  if (state.lastFixAt == null) return "Watching for when you head in";
  if (!isFresh(state, now)) return "No position for a while — you'll need to finish this one yourself";
  if (state.sky === "outdoor") return "Looks like you're still out";
  if (state.sky === "indoor") {
    const mins = Math.max(1, Math.round((now - (state.since ?? now)) / 60_000));
    return `Looks like you headed in about ${mins} min ago`;
  }
  return "Watching for when you head in";
}

/* ---------- storage ---------- */

/** Repair a state read back from disk. A running session is persisted on every
    tick and read back after a reload, and the file it lands in is editable by
    anyone with the developer tools open. */
export function sanitizePresence(v: unknown): PresenceState {
  const base = emptyPresence();
  if (!v || typeof v !== "object") return base;
  const r = v as Record<string, unknown>;
  const sky = (s: unknown): Sky =>
    s === "indoor" || s === "outdoor" ? s : "unknown";
  const ms = (n: unknown): number | null =>
    typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  return {
    sky: sky(r.sky),
    since: ms(r.since),
    pending: sky(r.pending),
    pendingSince: ms(r.pendingSince),
    lastFixAt: ms(r.lastFixAt),
    confidence: clamp(round(Number(r.confidence) || 0), 0, 1),
    recent: Array.isArray(r.recent)
      ? r.recent
          .filter((s) => typeof s === "number" && Number.isFinite(s))
          .slice(-MAX_RECENT)
          .map((s) => clamp(round(Number(s)), -1, 1))
      : [],
    fixes: clamp(Math.round(Number(r.fixes) || 0), 0, 1e6),
  };
}
