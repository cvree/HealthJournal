/* Sun sessions — time outside, recorded as a thing that happened.

   The shape here follows the same rule as every other many-per-day collection
   in this journal (meals, doses, bowel movements): the *record* carries its own
   copy of everything that was true when it was made. A session logged in June
   with a skin type of III and a t-shirt keeps those figures forever, even if
   the person later corrects their skin type in Settings. Recomputing history
   from today's profile would quietly rewrite what an old day says happened,
   and this app's whole claim is that it doesn't do that.

   A session accumulates *while it runs*. The UV index is not constant across
   forty minutes at five in the afternoon — it can halve — so the dose is a sum
   over samples rather than "UV now × minutes", and the samples are kept so the
   finished session can draw its own arc.

   Two numbers come out of it, and they are different kinds of thing:

   · **Ambient UV dose**, in SED. Measured-ish. It is arithmetic over the UV
     index, which is either a real forecast value or a modelled one, and it is
     what burn risk is actually made of.
   · **Estimated vitamin D**, in IU. A research-model estimate, carried as a
     range, labelled as an estimate everywhere it is drawn, and never allowed
     to sit in the same column as a blood test.

   Nothing here reads a clock. Every function that needs "now" is handed it. */

import {
  elapse as elapsePresence,
  emptyPresence,
  indoorCall,
  isFresh,
  sanitizePresence,
  type PresenceState,
} from "./presence";
import type { Coords, ExposureLevel, ShadeLevel, SkinType, VitaminDEstimate } from "./solar";
import {
  clearSkyUV,
  durationLabel,
  estimateVitaminD,
  exposureInfo,
  minutesToBurn,
  sedFrom,
  skinTypeInfo,
  solarPosition,
  uvbFraction,
} from "./solar";

/* ---------- the record ---------- */

/** One sample taken while a session was running. Small on purpose: a two-hour
    session at one sample a minute is 120 of these, and they live in the same
    JSON blob as the rest of the journal. */
export interface SunSample {
  /** Minutes since the session started. */
  t: number;
  /** UV index at that moment. */
  uv: number;
  /** Solar elevation, degrees. */
  el: number;
}

/** Where the UV number came from. This is carried per session because it
    changes what the app is allowed to claim: a forecast value is a
    measurement of the sky, a modelled one is arithmetic over the sun's
    position, and "unknown" means the session records time outside and
    nothing else. */
export type UVSource = "forecast" | "modelled" | "none";

/* How a session stopped.

   "manual" is somebody tapping Finish, and it is the only one of these that is
   a fact. The rest are conclusions the app came to on its own, and every one of
   them is written with `estimated: true` and `confirmed: false` — which is the
   contract that makes the whole automation defensible. The record is real
   immediately, so nothing is lost if the person never comes back to it; it is
   labelled an estimate everywhere it is drawn until they say otherwise; and one
   tap either accepts the time or corrects it. */
export type EndSource = "manual" | "auto-indoor" | "auto-cap";

export interface SunSession {
  id: string;
  /** YYYY-MM-DD, local — the day this belongs to on the timeline. */
  date: string;
  /** ISO timestamps. `end` is absent while the session is running. */
  start: string;
  end?: string | null;
  /** Minutes outside. Written on finish; the live screen computes its own. */
  minutes: number;
  /** Coarse coordinates, as rounded by lib/context. Optional: a session logged
      with location off still records time outside, it just cannot model UV. */
  coords?: Coords | null;
  /** The conditions, snapshotted at log time. */
  skin?: SkinType;
  exposure: ExposureLevel;
  shade: ShadeLevel;
  spf?: number;
  /** The arc, as it actually happened. */
  samples: SunSample[];
  uvSource: UVSource;
  /** Averages over the session, so the card renders without replaying samples. */
  avgUV: number;
  peakUV: number;
  avgElevation: number;
  /** Ambient UV dose in standard erythema doses. */
  sed: number;
  /** Fraction of this skin's minimal erythemal dose. 1.0 = the point of
      reddening. */
  medFraction: number;
  /** The estimate, stored as the range it is. */
  iu: number;
  iuLow: number;
  iuHigh: number;
  /** True when there was no usable UVB — a winter walk, an evening one. The
      session is still worth having; it just isn't a vitamin D session. */
  belowThreshold: boolean;
  note?: string;
  /** "live" = a session that was started and finished in the app; "manual" =
      typed in afterwards. Both are real; only the first has an honest arc. */
  source: "live" | "manual";
  /** How it stopped. See EndSource. */
  endSource: EndSource;
  /** True when the app chose the end time. Permanent provenance: confirming an
      estimate does not turn it into a measurement, it only means a person has
      looked at it. Every surface that draws a session reads this. */
  estimated: boolean;
  /** True once a person has accepted or corrected the end time — or, for a
      manual finish, from birth, because they were holding the phone. */
  confirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const stamp = () => new Date().toISOString();
const rand = () => Math.random().toString(36).slice(2, 9);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number, dp = 1) => {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

export const newSunSessionId = (): string => `sun_${Date.now().toString(36)}${rand()}`;

export const EXPOSURE_IDS: ExposureLevel[] = ["face", "arms", "shorts", "swim", "full"];
export const SHADE_IDS: ShadeLevel[] = ["open", "dappled", "shade"];
export const END_SOURCES: EndSource[] = ["manual", "auto-indoor", "auto-cap"];

/* ---------- running a session ----------

   A live session never enters the journal until it is finished — a half-done
   session in the saved database would sync to another device as a session that
   is somehow still running over there, and the sync engine has no vocabulary
   for "in progress here, not there".

   It does, however, have to survive the phone. The old version of this held the
   session in React state and nothing else, which meant that going outside,
   locking the screen and coming back an hour later — the single most likely
   thing a person does during a sun session — lost the session entirely. So it
   is mirrored to device-local storage on every tick (see `saveLiveSession`),
   which is the same shelf the theme and the hand preference live on: local,
   never synced, never backed up, gone when this browser's data is cleared.

   That is what makes a session *returnable*. You can start one, put the phone
   away, open the app three times to check something else, and the session is
   still there and still counting until you end it — or until the app has good
   enough reason to think you ended it by walking through a door. */

export interface LiveSession {
  startedAt: number; // epoch ms
  coords: Coords | null;
  exposure: ExposureLevel;
  shade: ShadeLevel;
  spf?: number;
  skin?: SkinType;
  /** UV index reported by a forecast for right now, when there is one. */
  forecastUV?: number | null;
  altitudeM?: number;
  cloudCover?: number;
  samples: SunSample[];
  /** Indoor/outdoor evidence gathered so far. Carried on the session rather
      than beside it so a reload does not throw away six minutes of accumulated
      run — which would otherwise reset the auto-end clock every time somebody
      glanced at their phone. */
  presence?: PresenceState;
  /** Whether this session is allowed to end itself. Copied from the profile at
      start time and then owned by the session, so "not this one" is a decision
      that can be made mid-walk without changing a standing preference. */
  autoEnd?: boolean;
  /** The platform refused to give this app a position — permission denied, or
      a browser without geolocation at all.

      Deliberately a *separate* flag from `autoEnd`, and the distinction is not
      pedantic. Switching `autoEnd` off here would silently rewrite somebody's
      decision into its opposite, and the live screen would then have nothing
      to show and no reason to explain itself: the automation would appear to
      have been declined by the person who had just asked for it. Keeping the
      choice and recording the obstruction separately is what lets the screen
      say "you asked for this, and your phone is not letting me". */
  autoEndBlocked?: boolean;
}

export function startSession(at: Date, opts: Partial<LiveSession> = {}): LiveSession {
  return {
    startedAt: at.getTime(),
    coords: opts.coords ?? null,
    exposure: opts.exposure ?? "arms",
    shade: opts.shade ?? "open",
    spf: opts.spf,
    skin: opts.skin,
    forecastUV: opts.forecastUV ?? null,
    altitudeM: opts.altitudeM,
    cloudCover: opts.cloudCover,
    samples: [],
    presence: opts.presence ?? emptyPresence(),
    autoEnd: opts.autoEnd ?? false,
    autoEndBlocked: opts.autoEndBlocked ?? false,
  };
}

/** The UV index right now, and where the number came from.

    A forecast value wins, because it knows about the cloud that is actually
    overhead. Failing that the sun's position gives a modelled clear-sky value
    thinned by whatever cloud cover the last forecast reported. With no
    coordinates at all there is no honest number, and the session records
    minutes outside without pretending otherwise. */
export function uvAt(
  now: Date,
  live: Pick<LiveSession, "coords" | "forecastUV" | "altitudeM" | "cloudCover">
): { uv: number; elevation: number; source: UVSource } {
  if (!live.coords) {
    return { uv: 0, elevation: 0, source: "none" };
  }
  const pos = solarPosition(now, live.coords);
  const modelled = clearSkyUV(pos.elevation, {
    altitudeM: live.altitudeM,
    cloudCover: live.cloudCover,
  });
  if (typeof live.forecastUV === "number" && live.forecastUV >= 0) {
    /* The forecast is hourly; the sun is not. Scaling the hour's value by how
       the modelled curve moves inside that hour is what stops a session that
       straddles 4pm from reporting a flat UV 5 for its whole second half. */
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    const refPos = solarPosition(new Date(hourStart.getTime() + 30 * 60000), live.coords);
    const ref = clearSkyUV(refPos.elevation, { altitudeM: live.altitudeM, cloudCover: live.cloudCover });
    const scale = ref > 0.1 ? modelled / ref : 1;
    return {
      uv: round(clamp(live.forecastUV * scale, 0, 20), 1),
      elevation: round(pos.elevation, 1),
      source: "forecast",
    };
  }
  return { uv: modelled, elevation: round(pos.elevation, 1), source: "modelled" };
}

/** Add a sample. Called on a timer by the live screen; idempotent enough that
    a duplicate tick within the same minute replaces rather than doubles. */
export function addSample(live: LiveSession, now: Date): LiveSession {
  const t = Math.round((now.getTime() - live.startedAt) / 60000);
  const { uv, elevation } = uvAt(now, live);
  const samples = live.samples.filter((s) => s.t !== t);
  samples.push({ t, uv: round(uv, 1), el: round(elevation, 1) });
  samples.sort((a, b) => a.t - b.t);
  return { ...live, samples };
}

/** Everything the live screen puts on the glass, computed from the samples so
    far. Pure; takes `now` so a test can walk a session through an afternoon. */
export interface LiveReadout {
  elapsedMs: number;
  minutes: number;
  uv: number;
  elevation: number;
  azimuth: number;
  uvSource: UVSource;
  /** Ambient dose so far, SED. */
  sed: number;
  medFraction: number;
  /** Minutes of this session that were above the UVB threshold. */
  vitaminDMinutes: number;
  estimate: VitaminDEstimate;
  /** Minutes left before this skin reddens at the current UV. `null` when the
      UV is too low to burn at all. */
  burnMinutesLeft: number | null;
  /** How close to a burn, 0–1+. Drives the one piece of colour on the screen
      that is allowed to be alarming. */
  burnProgress: number;
}

export function readout(live: LiveSession, now: Date): LiveReadout {
  const elapsedMs = Math.max(0, now.getTime() - live.startedAt);
  const minutes = elapsedMs / 60000;
  const nowUV = uvAt(now, live);
  const pos = live.coords ? solarPosition(now, live.coords) : { elevation: 0, azimuth: 180 };
  const shadeF = SHADE_MULT[live.shade];
  const spfF = live.spf && live.spf > 1 ? 1 / (1 + (live.spf - 1) * 0.4) : 1;

  /* Integrate the samples. Each sample covers the span to the next one, and
     the last one covers up to now — so a session that has been running for
     forty minutes with samples every minute is a proper sum rather than the
     current UV multiplied by the whole duration. */
  let sed = 0;
  let uvbMinutes = 0;
  let weightedUV = 0;
  let weightedEl = 0;
  let weightMin = 0;
  const rows = live.samples.length
    ? live.samples
    : [{ t: 0, uv: nowUV.uv, el: nowUV.elevation }];
  for (let i = 0; i < rows.length; i += 1) {
    const s = rows[i];
    const nextT = i + 1 < rows.length ? rows[i + 1].t : minutes;
    const span = Math.max(0, nextT - s.t);
    if (!span) continue;
    sed += sedFrom(s.uv * shadeF * spfF, span);
    if (uvbFraction(s.el) > 0.02) uvbMinutes += span;
    weightedUV += s.uv * span;
    weightedEl += s.el * span;
    weightMin += span;
  }
  const avgUV = weightMin ? weightedUV / weightMin : nowUV.uv;
  const avgEl = weightMin ? weightedEl / weightMin : nowUV.elevation;
  const skin = live.skin ?? 3;
  const med = skinTypeInfo(skin).medSED;

  const estimate = estimateVitaminD({
    uv: avgUV,
    elevation: avgEl,
    minutes,
    skin,
    exposure: live.exposure,
    shade: live.shade,
    spf: live.spf,
  });

  const burnMinutesLeft = (() => {
    const total = minutesToBurn(nowUV.uv, skin, { spf: live.spf, shade: live.shade });
    if (total == null) return null;
    const used = med > 0 ? (sed / med) * total : 0;
    return Math.max(0, Math.round(total - used));
  })();

  return {
    elapsedMs,
    minutes: Math.round(minutes),
    uv: nowUV.uv,
    elevation: round(pos.elevation, 1),
    azimuth: round(pos.azimuth, 1),
    uvSource: nowUV.source,
    sed: round(sed, 2),
    medFraction: round(med > 0 ? sed / med : 0, 2),
    vitaminDMinutes: Math.round(uvbMinutes),
    estimate,
    burnMinutesLeft,
    burnProgress: round(med > 0 ? sed / med : 0, 3),
  };
}

const SHADE_MULT: Record<ShadeLevel, number> = { open: 1, dappled: 0.55, shade: 0.25 };

/* ---------- burn safety ----------

   A sunlight app that only ever counts upward is telling people that more is
   better, and for this one thing more is emphatically not better. So the
   session has a second scale running alongside the vitamin D one, it is the
   scale that turns colour, and it is the only thing on the screen allowed to
   interrupt. */

export type BurnLevel = "none" | "building" | "caution" | "over";

export interface BurnState {
  level: BurnLevel;
  /** 0–1+ of a minimal erythemal dose. */
  fraction: number;
  headline: string;
  detail: string;
}

export function burnState(medFraction: number, minutesLeft: number | null): BurnState {
  if (medFraction >= 1) {
    return {
      level: "over",
      fraction: medFraction,
      headline: "Past a burn for your skin",
      detail: "This is more UV than your skin type usually takes before it reddens. Time to cover up or head in.",
    };
  }
  if (medFraction >= 0.6) {
    return {
      level: "caution",
      fraction: medFraction,
      headline: minutesLeft != null ? `About ${minutesLeft} min before burning` : "Approaching a burn",
      detail: "Vitamin D synthesis has mostly plateaued by here. More sun now mostly adds risk.",
    };
  }
  if (medFraction >= 0.25) {
    return {
      level: "building",
      fraction: medFraction,
      headline: minutesLeft != null ? `About ${minutesLeft} min before burning` : "Dose building",
      detail: "Comfortably inside a safe dose for your skin.",
    };
  }
  return {
    level: "none",
    fraction: medFraction,
    headline: "Low UV exposure",
    detail: "Nowhere near a burn.",
  };
}

/* ---------- finishing ---------- */

export interface FinishOptions {
  note?: string;
  /** Overrides, when the person corrects what they were wearing on the finish
      screen rather than before they went out — which is what actually
      happens. */
  exposure?: ExposureLevel;
  shade?: ShadeLevel;
  spf?: number;
  skin?: SkinType;
  age?: number;
  /** How this one stopped. Defaults to a person tapping Finish, because that is
      the only caller that has no reason to say. */
  endSource?: EndSource;
}

/** Drop every sample after a given end time.

    Needed because `now` is no longer always now. An auto-ended session is
    finished at the moment the person walked through a door, which may be six
    minutes in the past, and the samples taken while the app was working that
    out are samples of a phone on a hall table. They are not part of the
    session, and leaving them in would put an indoor UV reading into the
    average and quietly inflate the dose. */
export function truncateLive(live: LiveSession, end: Date): LiveSession {
  const minutes = (end.getTime() - live.startedAt) / 60000;
  return { ...live, samples: live.samples.filter((s) => s.t <= minutes + 0.001) };
}

/** Turn a running session into a record. `date` is passed rather than derived
    so a session that starts at 23:50 lands where the caller says it does.

    `now` is the *end of the session*, not necessarily the present moment. A
    backdated end is the normal case for anything the app concluded on its own,
    and the record it produces is identical in every respect except the three
    provenance fields — which is deliberate: an estimated session is a real
    session that is honest about one of its numbers, not a second-class one. */
export function finishSession(
  live: LiveSession,
  now: Date,
  date: string,
  opts: FinishOptions = {}
): SunSession {
  const merged: LiveSession = {
    ...truncateLive(live, now),
    exposure: opts.exposure ?? live.exposure,
    shade: opts.shade ?? live.shade,
    spf: opts.spf ?? live.spf,
    skin: opts.skin ?? live.skin,
  };
  const r = readout(merged, now);
  const skin = merged.skin ?? 3;
  const estimate = estimateVitaminD({
    uv: r.sed > 0 && r.minutes > 0 ? averageUV(merged.samples, r.minutes) : r.uv,
    elevation: averageElevation(merged.samples, r.elevation),
    minutes: r.minutes,
    skin,
    exposure: merged.exposure,
    shade: merged.shade,
    spf: merged.spf,
    age: opts.age,
  });
  const at = stamp();
  return {
    id: newSunSessionId(),
    date,
    start: new Date(merged.startedAt).toISOString(),
    end: now.toISOString(),
    minutes: r.minutes,
    coords: merged.coords,
    skin,
    exposure: merged.exposure,
    shade: merged.shade,
    spf: merged.spf,
    samples: merged.samples.slice(0, 480),
    uvSource: r.uvSource,
    avgUV: round(averageUV(merged.samples, r.minutes) || r.uv, 1),
    peakUV: round(merged.samples.reduce((m, s) => Math.max(m, s.uv), r.uv), 1),
    avgElevation: round(averageElevation(merged.samples, r.elevation), 1),
    sed: r.sed,
    medFraction: r.medFraction,
    iu: estimate.iu,
    iuLow: estimate.low,
    iuHigh: estimate.high,
    belowThreshold: estimate.belowThreshold,
    note: opts.note?.slice(0, 400) || undefined,
    source: "live",
    endSource: opts.endSource ?? "manual",
    estimated: (opts.endSource ?? "manual") !== "manual",
    confirmed: (opts.endSource ?? "manual") === "manual",
    createdAt: at,
    updatedAt: at,
  };
}

function averageUV(samples: SunSample[], minutes: number): number {
  if (!samples.length) return 0;
  let sum = 0;
  let span = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const nextT = i + 1 < samples.length ? samples[i + 1].t : minutes;
    const w = Math.max(0, nextT - samples[i].t);
    sum += samples[i].uv * w;
    span += w;
  }
  return span ? sum / span : samples[samples.length - 1].uv;
}

function averageElevation(samples: SunSample[], fallback: number): number {
  if (!samples.length) return fallback;
  return samples.reduce((a, s) => a + s.el, 0) / samples.length;
}

/** A session typed in after the fact — "I was out for an hour this morning".
    It gets a modelled arc from the astronomy of the window it claims, which is
    honest: the sun really was where it was. What it does not get is
    minute-by-minute cloud, so `uvSource` says "modelled" and stays that way. */
export function manualSession(input: {
  date: string;
  startISO: string;
  minutes: number;
  coords?: Coords | null;
  exposure: ExposureLevel;
  shade: ShadeLevel;
  spf?: number;
  skin?: SkinType;
  age?: number;
  note?: string;
  cloudCover?: number;
  altitudeM?: number;
}): SunSession {
  const start = new Date(input.startISO);
  const minutes = clamp(Math.round(input.minutes), 1, 16 * 60);
  const live = startSession(start, {
    coords: input.coords ?? null,
    exposure: input.exposure,
    shade: input.shade,
    spf: input.spf,
    skin: input.skin,
    cloudCover: input.cloudCover,
    altitudeM: input.altitudeM,
  });
  const step = minutes <= 30 ? 5 : 10;
  let filled = live;
  for (let t = 0; t <= minutes; t += step) {
    filled = addSample(filled, new Date(start.getTime() + t * 60000));
  }
  const session = finishSession(filled, new Date(start.getTime() + minutes * 60000), input.date, {
    note: input.note,
    age: input.age,
  });
  /* Typed in afterwards, by a person, with the times they gave. The clock is
     their memory rather than a stopwatch, but it is *their* memory — nobody
     needs to confirm it back to them. */
  return {
    ...session,
    source: "manual",
    endSource: "manual",
    estimated: false,
    confirmed: true,
    uvSource: input.coords ? "modelled" : "none",
  };
}

/* ---------- ending itself ----------

   The problem this solves, stated plainly: starting a sun session is a thing
   people do, and ending one is a thing people forget. The forgotten ones are
   worse than useless — a session that says four hours because the phone was on
   a kitchen counter does not merely miss a data point, it poisons every average
   and every chart built on top of it, and it does so silently.

   Two ways out, in strict order of how much the app is allowed to claim.

   1. **It saw you go in.** lib/presence watched the accuracy of the position
      fixes degrade the way it does under a roof, held that reading for several
      minutes, and can name the moment it started. This is a good estimate, and
      the session ends *at that moment*, not at the moment the app became sure.

   2. **It has no idea, and the session is absurd.** Nobody sunbathes for six
      hours by accident, and if they did, the phone stopped being a witness a
      long way back. Rather than let the session run forever or throw it away,
      it is closed at the last time it could plausibly still have been a sun
      session — the last sample with the sun above the horizon, or the cap,
      whichever came first.

   Neither of these is allowed to be silent, and neither is allowed to be final:
   both write `estimated: true, confirmed: false`, which puts the session in the
   queue of things asking one short question the next time the app is opened.
   That queue is the price of the automation, and it is deliberately the only
   price — the session is already saved, already on the timeline, already in the
   charts. Confirming it changes a label. Ignoring it forever costs nothing but
   a slightly less certain end time, which is exactly what the label says. */

/** A session past this many minutes is not being watched by anyone. Six hours
    is well beyond a long day in a garden and well short of "left it running
    overnight", which is the case the resume path handles instead. */
export const MAX_SESSION_MINUTES = 6 * 60;

/** Below this, the app does not get to end anything. A person who starts a
    session and steps back inside for their keys should find the session still
    running, because they are about to come back out. */
export const MIN_AUTO_END_MINUTES = 8;

export interface AutoEnd {
  /** The end the app is proposing, already backdated. */
  at: Date;
  reason: Exclude<EndSource, "manual">;
  /** 0–1. Only the indoor call has a meaningful one; the cap is a fallback and
      says so with a low number. */
  confidence: number;
  /** One sentence, for the toast and for the confirmation card. Non-causal and
      always hedged — the app is reporting what it thinks, not what happened. */
  detail: string;
}

/** The last moment this could still honestly have been a session in the sun:
    the newest sample taken with the sun above the horizon. Falls back to the
    start, which produces a one-minute session rather than a fictional one. */
function lastDaylightMoment(live: LiveSession): number {
  let best = 0;
  for (const smp of live.samples) if (smp.el > 0) best = Math.max(best, smp.t);
  return live.startedAt + best * 60000;
}

/** Should this session end itself, and when?

    Pure and side-effect free — the caller decides what to do with a yes, which
    on the live screen is "finish it and say so" and on a cold start is "finish
    it and put it in the confirm queue". */
export function autoEndDecision(
  live: LiveSession,
  now: Date,
  opts: { minConfidence?: number; maxMinutes?: number } = {}
): AutoEnd | null {
  const elapsedMin = (now.getTime() - live.startedAt) / 60000;
  const cap = opts.maxMinutes ?? MAX_SESSION_MINUTES;

  if (live.autoEnd && !live.autoEndBlocked && live.presence && elapsedMin >= MIN_AUTO_END_MINUTES) {
    const call = indoorCall(live.presence, now.getTime(), opts.minConfidence ?? 0.5);
    if (call) {
      /* Never end before the session could reasonably have been outside at all.
         A session begun indoors — somebody tapping Start while still in the
         hallway — would otherwise resolve to a zero-minute record. */
      const floor = live.startedAt + MIN_AUTO_END_MINUTES * 60000;
      const at = new Date(Math.max(call.at, floor));
      return {
        at,
        reason: "auto-indoor",
        confidence: call.confidence,
        detail: `Your phone stopped seeing open sky around ${clock(at)}, so the session was closed there.`,
      };
    }
  }

  if (elapsedMin >= cap) {
    const at = new Date(Math.min(lastDaylightMoment(live), live.startedAt + cap * 60000));
    return {
      at: new Date(Math.max(at.getTime(), live.startedAt + 60000)),
      reason: "auto-cap",
      confidence: 0.15,
      detail: `This one ran past ${durationLabel(Math.round(cap))} without being finished, so it was closed at ${clock(at)}. That time is a guess.`,
    };
  }

  return null;
}

const clock = (d: Date): string =>
  d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Fold a fresh clock reading into the session's presence model. Called on the
    same tick as the stopwatch so staleness is noticed even when the platform
    has quietly stopped delivering fixes. */
export function tickPresence(live: LiveSession, now: Date): LiveSession {
  if (!live.presence) return live;
  const next = elapsePresence(live.presence, now.getTime());
  return next === live.presence ? live : { ...live, presence: next };
}

/** Is the auto-end actually working right now? The live screen needs this to
    avoid promising an automation that has gone quiet — a phone that has stopped
    reporting position is a phone that is going to need a manual Finish, and
    saying so while somebody is still outside is far better than saying nothing
    and cutting their walk in half tomorrow. */
export function autoEndArmed(live: LiveSession, now: Date): boolean {
  return !!live.autoEnd && !live.autoEndBlocked && !!live.presence
    && isFresh(live.presence, now.getTime());
}

/** Why it is not armed, for the one line the live screen shows.

    "blocked" and "quiet" look identical from the outside and are completely
    different problems: one is a permission somebody can grant in two taps, the
    other is a phone in a bag that will sort itself out. Telling them apart is
    the difference between a useful sentence and a shrug. */
export type AutoEndStatus = "off" | "blocked" | "waiting" | "quiet" | "armed";

export function autoEndStatus(live: LiveSession, now: Date): AutoEndStatus {
  if (!live.autoEnd) return "off";
  if (live.autoEndBlocked) return "blocked";
  if (!live.presence || live.presence.lastFixAt == null) return "waiting";
  return isFresh(live.presence, now.getTime()) ? "armed" : "quiet";
}

/* ---------- returning to a session ----------

   A session lives on this device only, in the same local shelf as the theme.
   Not in the journal, because it is not a fact yet; not in the sync payload,
   because a session running on a phone is not running on a laptop. */

export const LIVE_SESSION_KEY = "fhj:sun:live";

export interface StoredLive {
  live: LiveSession;
  /** The day the session was started on, so a session that runs past midnight
      still files where it began. */
  date: string;
  savedAt: string;
}

export function sanitizeStoredLive(v: unknown): StoredLive | null {
  if (!v || typeof v !== "object") return null;
  const r = v as any;
  const l = r.live;
  if (!l || typeof l !== "object") return null;
  const startedAt = Number(l.startedAt);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return null;
  if (!DATE_RE.test(r.date)) return null;
  const samples: SunSample[] = Array.isArray(l.samples)
    ? l.samples
        .filter((smp: any) => smp && Number.isFinite(Number(smp.t)))
        .slice(0, 480)
        .map((smp: any) => ({
          t: clamp(Math.round(Number(smp.t)), 0, 24 * 60),
          uv: clamp(round(Number(smp.uv) || 0, 1), 0, 20),
          el: clamp(round(Number(smp.el) || 0, 1), -90, 90),
        }))
    : [];
  const coords =
    l.coords && Number.isFinite(Number(l.coords.lat)) && Number.isFinite(Number(l.coords.lon))
      ? { lat: clamp(Number(l.coords.lat), -90, 90), lon: clamp(Number(l.coords.lon), -180, 180) }
      : null;
  return {
    date: r.date,
    savedAt: typeof r.savedAt === "string" ? r.savedAt : stamp(),
    live: {
      startedAt: Math.round(startedAt),
      coords,
      exposure: EXPOSURE_IDS.includes(l.exposure) ? l.exposure : "arms",
      shade: SHADE_IDS.includes(l.shade) ? l.shade : "open",
      spf: Number.isFinite(Number(l.spf)) && Number(l.spf) > 1 ? clamp(Math.round(Number(l.spf)), 2, 100) : undefined,
      skin: [1, 2, 3, 4, 5, 6].includes(Number(l.skin)) ? (Number(l.skin) as SkinType) : undefined,
      forecastUV: Number.isFinite(Number(l.forecastUV)) ? clamp(Number(l.forecastUV), 0, 20) : null,
      altitudeM: Number.isFinite(Number(l.altitudeM)) ? Number(l.altitudeM) : undefined,
      cloudCover: Number.isFinite(Number(l.cloudCover)) ? clamp(Number(l.cloudCover), 0, 100) : undefined,
      samples,
      presence: sanitizePresence(l.presence),
      autoEnd: !!l.autoEnd,
      autoEndBlocked: !!l.autoEndBlocked,
    },
  };
}

export function loadLiveSession(read?: (k: string) => string | null): StoredLive | null {
  const get = read ?? ((k: string) =>
    typeof localStorage === "undefined" ? null : localStorage.getItem(k));
  try {
    const raw = get(LIVE_SESSION_KEY);
    return raw ? sanitizeStoredLive(JSON.parse(raw)) : null;
  } catch {
    /* A half-written value from a phone that died mid-save is not worth a
       recovery screen. It is one session, and the alternative to dropping it is
       a crash on launch. */
    return null;
  }
}

export function saveLiveSession(
  live: LiveSession,
  date: string,
  write?: (k: string, v: string) => void
): void {
  const set = write ?? ((k: string, v: string) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(k, v);
  });
  try {
    set(LIVE_SESSION_KEY, JSON.stringify({ live, date, savedAt: stamp() } satisfies StoredLive));
  } catch {
    /* Out of quota, or a browser in private mode that pretends localStorage
       exists and then refuses to write. The session carries on in memory; only
       the ability to return to it after a reload is lost, and nothing about
       that is worth interrupting somebody standing in a garden. */
  }
}

export function clearLiveSession(remove?: (k: string) => void): void {
  const del = remove ?? ((k: string) => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(k);
  });
  try { del(LIVE_SESSION_KEY); } catch { /* see above */ }
}

/** What to do with a session found on disk at launch.

    · `resume` — pick it up where it was. The common case, and the whole point.
    · `close`  — too old to still be running; end it at the app's best guess and
                 ask. The decision that comes with it says where and why.
    · `drop`   — old enough that even the guess would be fiction. A session
                 started yesterday and found today has no honest end time, and
                 inventing one puts a made-up number in a health record. */
export type ResumeVerdict = "resume" | "close" | "drop";

export interface ResumeDecision {
  verdict: ResumeVerdict;
  minutes: number;
  autoEnd: AutoEnd | null;
}

export function resumeDecision(
  stored: StoredLive,
  now: Date,
  opts: { maxMinutes?: number } = {}
): ResumeDecision {
  const minutes = Math.round((now.getTime() - stored.live.startedAt) / 60000);
  if (minutes < 0) return { verdict: "drop", minutes: 0, autoEnd: null };
  /* A different calendar day is the line. Not a duration — a duration would
     close a legitimate session that began at 11pm, and a day boundary is what
     "I left this running overnight" actually means. */
  if (stored.date !== localDay(now) && minutes > MAX_SESSION_MINUTES) {
    return { verdict: "drop", minutes, autoEnd: null };
  }
  const decision = autoEndDecision(stored.live, now, opts);
  if (decision) return { verdict: "close", minutes, autoEnd: decision };
  return { verdict: "resume", minutes, autoEnd: null };
}

const localDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ---------- confirming an estimate ----------

   The other half of the bargain. The app got to write a session without being
   asked; in exchange it asks one question, once, in a form where the answer is
   a tap and the correction is a slider. */

/** Sessions still waiting on a person. Newest first, because the one somebody
    remembers is the one that just happened. */
export const unconfirmed = (sessions: SunSession[]): SunSession[] =>
  sessions.filter((s) => s.estimated && !s.confirmed).sort((a, b) => (a.start < b.start ? 1 : -1));

/** Accept the app's estimate as it stands. The session keeps `estimated: true`
    forever — that is provenance, not a to-do — and stops asking. */
export function confirmSession(s: SunSession): SunSession {
  if (s.confirmed) return s;
  return { ...s, confirmed: true, updatedAt: stamp() };
}

/** Correct the end time, and recompute everything that depended on it.

    Everything means everything: minutes, the dose, the estimate range, the
    burn fraction, the averages. Editing only the displayed duration and leaving
    a dose computed over a longer window is the exact class of quiet
    inconsistency this app spends most of its code avoiding.

    What is *not* recomputed is anything the record snapshotted about the person
    — skin type, exposure, the UV source. Those were true when the session
    happened and revising a clock does not make them less true. */
export function reviseSession(
  s: SunSession,
  end: Date,
  opts: { age?: number; confirmed?: boolean } = {}
): SunSession {
  const startedAt = new Date(s.start).getTime();
  const minutes = clamp(Math.round((end.getTime() - startedAt) / 60000), 1, 16 * 60);
  const endAt = new Date(startedAt + minutes * 60000);
  const live: LiveSession = {
    startedAt,
    coords: s.coords ?? null,
    exposure: s.exposure,
    shade: s.shade,
    spf: s.spf,
    skin: s.skin,
    forecastUV: null,
    samples: s.samples,
    presence: undefined,
    autoEnd: false,
    autoEndBlocked: false,
  };
  const rebuilt = finishSession(live, endAt, s.date, { note: s.note, age: opts.age });
  return {
    ...rebuilt,
    /* Identity, provenance and everything a person typed survive the rewrite. */
    id: s.id,
    date: s.date,
    start: s.start,
    uvSource: s.uvSource,
    source: s.source,
    endSource: s.endSource,
    estimated: s.estimated,
    confirmed: opts.confirmed ?? true,
    note: s.note,
    createdAt: s.createdAt,
    updatedAt: stamp(),
  };
}

/** The sentence on the confirmation card. One line, a time, and a question. */
export function confirmPrompt(s: SunSession): string {
  const at = s.end ? clock(new Date(s.end)) : "";
  const how =
    s.endSource === "auto-indoor"
      ? "It looked like you headed in"
      : "This one was still running";
  return `${how}, so it was closed at ${at} — ${durationLabel(s.minutes)} outside. Is that about right?`;
}

/** How an estimated session labels itself wherever it is drawn. Empty for a
    session somebody finished themselves, which is most of them. */
export function endNote(s: SunSession): string {
  if (!s.estimated) return "";
  if (s.confirmed) return s.endSource === "auto-indoor" ? "Ended automatically" : "End time estimated";
  return "Estimated end · not confirmed yet";
}

/* ---------- reading them back ---------- */

export function sanitizeSunSessions(rows: unknown): SunSession[] {
  if (!Array.isArray(rows)) return [];
  const out: SunSession[] = [];
  const seen = new Set<string>();
  for (const r of rows as any[]) {
    if (!r || typeof r !== "object") continue;
    if (!DATE_RE.test(r.date)) continue;
    const id = typeof r.id === "string" && r.id ? r.id : newSunSessionId();
    if (seen.has(id)) continue;
    seen.add(id);
    const minutes = clamp(Math.round(Number(r.minutes) || 0), 0, 16 * 60);
    const exposure: ExposureLevel = EXPOSURE_IDS.includes(r.exposure) ? r.exposure : "arms";
    const shade: ShadeLevel = SHADE_IDS.includes(r.shade) ? r.shade : "open";
    const samples: SunSample[] = Array.isArray(r.samples)
      ? r.samples
          .filter((s: any) => s && Number.isFinite(Number(s.t)))
          .slice(0, 480)
          .map((s: any) => ({
            t: clamp(Math.round(Number(s.t)), 0, 16 * 60),
            uv: clamp(round(Number(s.uv) || 0, 1), 0, 20),
            el: clamp(round(Number(s.el) || 0, 1), -90, 90),
          }))
      : [];
    const coords =
      r.coords && Number.isFinite(Number(r.coords.lat)) && Number.isFinite(Number(r.coords.lon))
        ? { lat: clamp(Number(r.coords.lat), -90, 90), lon: clamp(Number(r.coords.lon), -180, 180) }
        : null;
    out.push({
      id,
      date: r.date,
      start: typeof r.start === "string" ? r.start : new Date().toISOString(),
      end: typeof r.end === "string" ? r.end : null,
      minutes,
      coords,
      skin: [1, 2, 3, 4, 5, 6].includes(Number(r.skin)) ? (Number(r.skin) as SkinType) : undefined,
      exposure,
      shade,
      spf: Number.isFinite(Number(r.spf)) && Number(r.spf) > 1 ? clamp(Math.round(Number(r.spf)), 2, 100) : undefined,
      samples,
      uvSource: r.uvSource === "forecast" || r.uvSource === "modelled" ? r.uvSource : "none",
      avgUV: clamp(round(Number(r.avgUV) || 0, 1), 0, 20),
      peakUV: clamp(round(Number(r.peakUV) || 0, 1), 0, 20),
      avgElevation: clamp(round(Number(r.avgElevation) || 0, 1), -90, 90),
      sed: clamp(round(Number(r.sed) || 0, 2), 0, 100),
      medFraction: clamp(round(Number(r.medFraction) || 0, 2), 0, 20),
      iu: clamp(Math.round(Number(r.iu) || 0), 0, 60000),
      iuLow: clamp(Math.round(Number(r.iuLow) || 0), 0, 60000),
      iuHigh: clamp(Math.round(Number(r.iuHigh) || 0), 0, 60000),
      belowThreshold: !!r.belowThreshold,
      note: typeof r.note === "string" ? r.note.slice(0, 400) : undefined,
      source: r.source === "manual" ? "manual" : "live",
      /* Sessions written before the app could end them all ended the one way
         there was: somebody tapped Finish. Defaulting them to a confirmed
         manual end is not a guess, it is what happened. */
      endSource: END_SOURCES.includes(r.endSource) ? r.endSource : "manual",
      estimated: typeof r.estimated === "boolean" ? r.estimated : false,
      confirmed: typeof r.confirmed === "boolean" ? r.confirmed : true,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : stamp(),
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : stamp(),
    });
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : 1));
}

export const sunOn = (sessions: SunSession[], date: string): SunSession[] =>
  sessions.filter((s) => s.date === date).sort((a, b) => (a.start < b.start ? -1 : 1));

/** One day, added up. */
export interface SunDay {
  date: string;
  sessions: number;
  minutes: number;
  sed: number;
  iu: number;
  iuLow: number;
  iuHigh: number;
  peakUV: number;
  /** The first session of the day, which is the one the morning-light question
      is about. */
  firstAt: string | null;
}

export function sunDay(sessions: SunSession[], date: string): SunDay {
  const rows = sunOn(sessions, date);
  return {
    date,
    sessions: rows.length,
    minutes: rows.reduce((a, s) => a + s.minutes, 0),
    sed: round(rows.reduce((a, s) => a + s.sed, 0), 2),
    iu: rows.reduce((a, s) => a + s.iu, 0),
    iuLow: rows.reduce((a, s) => a + s.iuLow, 0),
    iuHigh: rows.reduce((a, s) => a + s.iuHigh, 0),
    peakUV: rows.reduce((m, s) => Math.max(m, s.peakUV), 0),
    firstAt: rows.length ? rows[0].start : null,
  };
}

/** "42 min outside · ~900–1,700 IU" — the timeline line for a day. */
export function sunDayLabel(day: SunDay): string {
  if (!day.minutes) return "";
  const bits = [durationLabel(day.minutes)];
  if (day.iuHigh >= 100) bits.push(`~${day.iuLow.toLocaleString("en-US")}–${day.iuHigh.toLocaleString("en-US")} IU`);
  return bits.join(" · ");
}

/** One session as a timeline line. */
export function sessionSummary(s: SunSession): string {
  const bits = [durationLabel(s.minutes)];
  if (s.uvSource !== "none" && s.peakUV > 0) bits.push(`UV ${s.peakUV}`);
  if (!s.belowThreshold && s.iuHigh >= 100) {
    bits.push(`~${s.iuLow.toLocaleString("en-US")}–${s.iuHigh.toLocaleString("en-US")} IU`);
  }
  bits.push(exposureInfo(s.exposure).label.toLowerCase());
  return bits.join(" · ");
}

/* ---------- what it becomes downstream ----------

   These are the same shape as the food and routine metrics, so a sun session
   is chartable, comparable and testable in an experiment without anything
   downstream needing to know it came from the sun. */

export interface SunMetricCtx {
  sun?: SunSession[];
  date: string;
}

export const SUN_METRIC_KEYS = [
  "sun_minutes",
  "sun_sed",
  "sun_iu",
  "sun_peak_uv",
  "sun_first_hour",
] as const;

export type SunMetricKey = (typeof SUN_METRIC_KEYS)[number];

export const SUN_METRICS: {
  k: SunMetricKey;
  label: string;
  unit?: string;
  dir: "sym" | "pos" | "neutral";
  sec: string;
  value: (ctx: SunMetricCtx) => number | null;
}[] = [
  {
    k: "sun_minutes",
    label: "Time outside",
    unit: "min",
    dir: "neutral",
    sec: "Sun",
    value: ({ sun = [], date }) => {
      const d = sunDay(sun, date);
      return d.sessions ? d.minutes : null;
    },
  },
  {
    k: "sun_sed",
    label: "Ambient UV dose",
    unit: "SED",
    dir: "neutral",
    sec: "Sun",
    value: ({ sun = [], date }) => {
      const d = sunDay(sun, date);
      return d.sessions ? d.sed : null;
    },
  },
  {
    k: "sun_iu",
    label: "Vitamin D (estimated)",
    unit: "IU",
    dir: "neutral",
    sec: "Sun",
    value: ({ sun = [], date }) => {
      const d = sunDay(sun, date);
      return d.sessions ? d.iu : null;
    },
  },
  {
    k: "sun_peak_uv",
    label: "Peak UV outside",
    dir: "neutral",
    sec: "Sun",
    value: ({ sun = [], date }) => {
      const d = sunDay(sun, date);
      return d.sessions ? d.peakUV : null;
    },
  },
  {
    k: "sun_first_hour",
    label: "First light (hour of day)",
    dir: "neutral",
    sec: "Sun",
    value: ({ sun = [], date }) => {
      const d = sunDay(sun, date);
      if (!d.firstAt) return null;
      const at = new Date(d.firstAt);
      return round(at.getHours() + at.getMinutes() / 60, 2);
    },
  },
];

/* ---------- the profile side ----------

   Skin type, usual exposure and age live on the tracking setup rather than on
   each session, because they are answered once. A session copies them at log
   time; this is just where the defaults are read from and repaired. */

export interface SunProfile {
  skin?: SkinType;
  /** What they usually wear outside — the default the session starts with. */
  exposure?: ExposureLevel;
  /** Whether they want the sun surface on Today at all. */
  enabled?: boolean;
  /** Their usual waking time, "HH:MM", for the first-light-after-waking
      number. Optional, and absent is a normal answer. */
  wake?: string;
}

export function sanitizeSunProfile(v: unknown): SunProfile | undefined {
  if (!v || typeof v !== "object") return undefined;
  const r = v as any;
  const out: SunProfile = {};
  if ([1, 2, 3, 4, 5, 6].includes(Number(r.skin))) out.skin = Number(r.skin) as SkinType;
  if (EXPOSURE_IDS.includes(r.exposure)) out.exposure = r.exposure;
  if (typeof r.enabled === "boolean") out.enabled = r.enabled;
  if (typeof r.wake === "string" && /^\d{2}:\d{2}$/.test(r.wake)) out.wake = r.wake;
  return Object.keys(out).length ? out : undefined;
}

/** Minutes between the person's usual waking time and their first session of
    the day. The circadian number, and deliberately separate from anything to
    do with vitamin D — at 8am there is essentially no UVB, and a screen that
    ran the two together would be claiming a benefit the sun wasn't offering
    yet. `null` when either end is missing, which is most days at first. */
export function firstLightAfterWaking(day: SunDay, wake: string | undefined): number | null {
  if (!day.firstAt || !wake) return null;
  const first = new Date(day.firstAt);
  const [h, m] = wake.split(":").map(Number);
  const wakeAt = new Date(first.getFullYear(), first.getMonth(), first.getDate(), h, m, 0, 0);
  const mins = Math.round((first.getTime() - wakeAt.getTime()) / 60000);
  return mins >= 0 && mins <= 16 * 60 ? mins : null;
}

/** A run of days, for the sunlight history chart. */
export function sunSeries(sessions: SunSession[], dates: string[]): SunDay[] {
  return dates.map((d) => sunDay(sessions, d));
}

/** Rolling total across a window — "4h 20m outside in the last 7 days", which
    is the figure that actually moves week to week. */
export function sunTotals(sessions: SunSession[], dates: string[]) {
  const days = sunSeries(sessions, dates);
  const active = days.filter((d) => d.sessions > 0);
  return {
    days: active.length,
    minutes: days.reduce((a, d) => a + d.minutes, 0),
    iuLow: days.reduce((a, d) => a + d.iuLow, 0),
    iuHigh: days.reduce((a, d) => a + d.iuHigh, 0),
    sed: round(days.reduce((a, d) => a + d.sed, 0), 2),
    avgMinutes: active.length
      ? Math.round(days.reduce((a, d) => a + d.minutes, 0) / active.length)
      : 0,
  };
}
