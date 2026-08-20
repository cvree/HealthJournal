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

/* ---------- running a session ----------

   A live session is held in React state, not in the journal, until it is
   finished — a half-finished session in the saved database would sync to
   another device as a session that is somehow still running there. The shape
   below is what the screen holds. */

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
}

/** Turn a running session into a record. `date` is passed rather than derived
    so a session that starts at 23:50 lands where the caller says it does. */
export function finishSession(
  live: LiveSession,
  now: Date,
  date: string,
  opts: FinishOptions = {}
): SunSession {
  const merged: LiveSession = {
    ...live,
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
  return { ...session, source: "manual", uvSource: input.coords ? "modelled" : "none" };
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
