/* Where the sun is, how strong it is, and what your skin can do with it.

   Everything in this file is arithmetic over a latitude, a longitude and a
   moment. It reads no clock of its own, touches no network, and holds no
   state — every function takes the instant it should reason about. That is
   what lets the live session screen, the "best window tomorrow" card and the
   test suite all run the same code and agree.

   Three layers, in order of how much they can be trusted:

   1. **Astronomy.** Solar position (NOAA's low-precision algorithm), sunrise,
      sunset, solar noon, daylight length. This is not an estimate. Given a
      place and a date these numbers are correct to within a minute or so, and
      the app is allowed to state them plainly.

   2. **UV modelling.** Clear-sky UV index from solar elevation, thinned for
      cloud and ozone when a forecast supplies them. This *is* an estimate, and
      a live measurement from a weather service always wins over it — the model
      exists so a session on a phone with no network still shows something
      honest rather than a blank.

   3. **Vitamin D.** A research-model estimate of cutaneous synthesis, from UV,
      skin type, exposed body area, SPF, shade and duration. This one is
      dressed as what it is everywhere it appears: a range, with the word
      *estimate*, with the assumptions listed one tap away, and never a
      measurement. A blood test measures vitamin D. This does not, and the
      moment a product blurs that line it has started lying to somebody about
      their own body.

   The two are deliberately kept in different units and different colours all
   the way up through the UI, so a lab value of 38 ng/mL and an estimated
   2,100 IU can sit on the same screen without ever being read as the same
   kind of fact. */

/* ---------- types ---------- */

/** A place, coarsely. Latitude and longitude are all the astronomy needs, and
    the app rounds them before they are ever written down — see lib/context. */
export interface Coords {
  lat: number;
  lon: number;
}

/** Where the sun is, from somewhere, at some moment. */
export interface SolarPosition {
  /** Degrees above the horizon. Negative means the sun has set. */
  elevation: number;
  /** Compass bearing, 0 = north, 90 = east. */
  azimuth: number;
}

/** The shape of one day's daylight at one place. All times are Date objects in
    the caller's own timezone; `null` on the polar days where the sun does not
    rise or set at all — a real case at high latitude in December, and one that
    silently produced NaN o'clock in every sunlight app the author tested. */
export interface DayLight {
  sunrise: Date | null;
  sunset: Date | null;
  solarNoon: Date;
  /** Minutes between sunrise and sunset. 0 on polar night, 1440 on polar day. */
  daylightMinutes: number;
  /** Highest the sun gets today, in degrees. */
  peakElevation: number;
  /** True when the sun stays up (or stays down) for the whole day. */
  polar: boolean;
}

/** Fitzpatrick skin type — the one personalisation factor that changes a
    vitamin D estimate more than everything else combined. Asked once, in the
    user's own words rather than as a roman numeral. */
export type SkinType = 1 | 2 | 3 | 4 | 5 | 6;

export const SKIN_TYPES: {
  type: SkinType;
  label: string;
  desc: string;
  /** Minimal erythemal dose in standard erythema doses — how much UV this skin
      takes before it reddens. Higher = more protected. */
  medSED: number;
  /** How much slower this skin makes vitamin D from the same UV, relative to
      type II. Melanin competes with 7-dehydrocholesterol for the same photons. */
  synthesis: number;
}[] = [
  { type: 1, label: "Always burns, never tans", desc: "Very fair", medSED: 2.0, synthesis: 1.25 },
  { type: 2, label: "Burns easily, tans a little", desc: "Fair", medSED: 2.5, synthesis: 1.0 },
  { type: 3, label: "Sometimes burns, tans evenly", desc: "Medium", medSED: 3.0, synthesis: 0.8 },
  { type: 4, label: "Rarely burns, tans easily", desc: "Olive", medSED: 4.5, synthesis: 0.6 },
  { type: 5, label: "Very rarely burns, tans deeply", desc: "Brown", medSED: 6.0, synthesis: 0.4 },
  { type: 6, label: "Never burns", desc: "Deep brown to black", medSED: 8.0, synthesis: 0.28 },
];

export const skinTypeInfo = (t: SkinType | undefined) =>
  SKIN_TYPES.find((s) => s.type === t) || SKIN_TYPES[2];

/** What was out in the sun. The single biggest lever after skin type, and the
    one people can actually answer: nobody knows their body-surface-area
    percentage, everybody knows whether they had a shirt on. */
export type ExposureLevel = "face" | "arms" | "shorts" | "swim" | "full";

export const EXPOSURE_LEVELS: {
  id: ExposureLevel;
  label: string;
  desc: string;
  /** Fraction of total body surface area exposed. */
  bsa: number;
}[] = [
  { id: "face", label: "Face & hands", desc: "Long sleeves, trousers", bsa: 0.09 },
  { id: "arms", label: "Arms & face", desc: "T-shirt, trousers", bsa: 0.24 },
  { id: "shorts", label: "Arms & legs", desc: "T-shirt and shorts", bsa: 0.46 },
  { id: "swim", label: "Most of you", desc: "Swimwear", bsa: 0.8 },
  { id: "full", label: "All of you", desc: "No clothing", bsa: 1.0 },
];

export const exposureInfo = (id: ExposureLevel | undefined) =>
  EXPOSURE_LEVELS.find((e) => e.id === id) || EXPOSURE_LEVELS[1];

/** How much of the session was actually in the sun. */
export type ShadeLevel = "open" | "dappled" | "shade";

export const SHADE_FACTORS: Record<ShadeLevel, number> = {
  open: 1,
  dappled: 0.55,
  shade: 0.25,
};

export const SHADE_LABELS: Record<ShadeLevel, string> = {
  open: "Open sun",
  dappled: "In and out of shade",
  shade: "Mostly shade",
};

/* ---------- astronomy ---------- */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const MS_PER_DAY = 86400000;
/** Julian date of the Unix epoch. */
const J1970 = 2440588;
const J2000 = 2451545;

const toJulian = (d: Date): number => d.getTime() / MS_PER_DAY - 0.5 + J1970;
const fromJulian = (j: number): Date => new Date((j + 0.5 - J1970) * MS_PER_DAY);
/** Days since the J2000 epoch — the input every term below is written in. */
const toDays = (d: Date): number => toJulian(d) - J2000;

/* Obliquity of the ecliptic, in radians. Drifts by about a degree every 130
   centuries; the constant is fine for a journal. */
const OBLIQUITY = 23.4397 * RAD;

const solarMeanAnomaly = (d: number): number => RAD * (357.5291 + 0.98560028 * d);

const eclipticLongitude = (M: number): number => {
  /* Equation of centre — the correction for the Earth's orbit being an
     ellipse rather than a circle. Without it sunrise is wrong by up to a
     quarter of an hour in February. */
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = RAD * 102.9372; // perihelion of the Earth
  return M + C + P + Math.PI;
};

const declination = (L: number): number => Math.asin(Math.sin(OBLIQUITY) * Math.sin(L));
const rightAscension = (L: number): number =>
  Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L));
const siderealTime = (d: number, lw: number): number => RAD * (280.16 + 360.9856235 * d) - lw;

/** Where the sun is, seen from `coords`, at `when`.

    Elevation is corrected for atmospheric refraction near the horizon, which
    is why a sun that is geometrically below the horizon can still be visible
    — and why sunrise happens a couple of minutes before the geometry says. */
export function solarPosition(when: Date, coords: Coords): SolarPosition {
  const lw = RAD * -coords.lon;
  const phi = RAD * coords.lat;
  const d = toDays(when);
  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const ra = rightAscension(L);
  const H = siderealTime(d, lw) - ra;

  const sinAlt =
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * DEG;
  const az =
    Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) * DEG +
    180;

  return { elevation: refracted(alt), azimuth: (az + 360) % 360 };
}

/** Apparent elevation including refraction. Bennett's formula, clamped so it
    stops applying well below the horizon where it stops meaning anything. */
function refracted(alt: number): number {
  if (alt < -2) return alt;
  const h = Math.max(alt, -0.5);
  return alt + 0.0167 / Math.tan(RAD * (h + 10.3 / (h + 5.11)));
}

/* Sunrise/sunset are solved rather than searched: given the day's declination
   there is a closed form for the hour angle at which the sun crosses a given
   altitude, and inverting it lands within a minute. */
const julianCycle = (d: number, lw: number): number => Math.round(d - 0.0009 - lw / (2 * Math.PI));
const approxTransit = (Ht: number, lw: number, n: number): number =>
  0.0009 + (Ht + lw) / (2 * Math.PI) + n;
const solarTransitJ = (ds: number, M: number, L: number): number =>
  J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
const hourAngle = (h: number, phi: number, dec: number): number => {
  const cosH =
    (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  /* |cosH| > 1 means the sun never reaches that altitude — polar day or polar
     night. Returning NaN here is what every downstream `null` is made of. */
  return Math.acos(Math.max(-1, Math.min(1, cosH))) * (Math.abs(cosH) > 1 ? NaN : 1);
};

/** Sunrise, sunset, solar noon and daylight length for the local day that
    `day` falls in. `day` is used for its date only; the times come back as
    Date objects in the same timezone the Date was made in. */
export function dayLight(day: Date, coords: Coords): DayLight {
  /* Anchor on local noon so a call at 23:50 still describes today rather than
     drifting into tomorrow's astronomy. */
  const noonLocal = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0, 0);
  const lw = RAD * -coords.lon;
  const phi = RAD * coords.lat;
  const d = toDays(noonLocal);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const Jnoon = solarTransitJ(ds, M, L);
  const solarNoon = fromJulian(Jnoon);

  /* -0.833° is the standard sunrise altitude: the sun's own radius plus the
     refraction that lifts it over the horizon. */
  const h = -0.833 * RAD;
  const w = hourAngle(h, phi, dec);
  const peakElevation = refracted((Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec)) * DEG));

  if (!Number.isFinite(w)) {
    /* Polar. Which kind depends on whether the sun clears the horizon at its
       highest, and both are real days somebody may be logging from. */
    const up = peakElevation > -0.833;
    return {
      sunrise: null,
      sunset: null,
      solarNoon,
      daylightMinutes: up ? 1440 : 0,
      peakElevation,
      polar: true,
    };
  }

  const Jset = solarTransitJ(approxTransit(w, lw, n), M, L);
  const Jrise = Jnoon - (Jset - Jnoon);
  const sunrise = fromJulian(Jrise);
  const sunset = fromJulian(Jset);
  return {
    sunrise,
    sunset,
    solarNoon,
    daylightMinutes: Math.round((sunset.getTime() - sunrise.getTime()) / 60000),
    peakElevation,
    polar: false,
  };
}

/** How long the day is, in the words people use. */
export function daylightLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m} min`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Change in daylight against another day, in minutes. The number that makes
    a February afternoon feel different from a November one. */
export const daylightDelta = (today: DayLight, other: DayLight): number =>
  today.daylightMinutes - other.daylightMinutes;

/* ---------- UV ---------- */

/** Clear-sky UV index from solar elevation.

    A power law on the sine of the elevation. It is not a radiative transfer
    model and does not pretend to be one — it is fitted to published clear-sky
    curves (about 8.7 with the sun 60° up, 5.6 at 45°, 2.6 at 30°, 1.2 at 20°)
    and it goes to zero as the sun sets, rather than leaving behind the phantom
    dusk UV that a naive cosine produces.

    `altitudeM` adds the usual ~6% per 1000m. `ozone` and `cloud` thin it when
    a forecast supplies them; both default to "not supplied" rather than to a
    guess. */
export function clearSkyUV(
  elevationDeg: number,
  opts: { altitudeM?: number; cloudCover?: number; ozoneDU?: number } = {}
): number {
  if (elevationDeg <= 0) return 0;
  const mu = Math.sin(elevationDeg * RAD);
  let uv = 12 * Math.pow(mu, 2.2);

  if (opts.altitudeM) uv *= 1 + Math.min(0.6, (opts.altitudeM / 1000) * 0.06);
  if (typeof opts.ozoneDU === "number" && opts.ozoneDU > 0) {
    /* UV scales roughly with total ozone to the power -1.2 around the 300 DU
       reference. Bounded, because a bad reading should not be able to triple
       the number on screen. */
    uv *= Math.max(0.5, Math.min(2, Math.pow(300 / opts.ozoneDU, 1.2)));
  }
  if (typeof opts.cloudCover === "number") {
    /* Cloud is the least linear term here — thin high cloud barely touches UV,
       and broken cloud can briefly *raise* it above clear-sky. The curve below
       keeps 20% of the UV under total overcast, which is the usual measured
       floor, and never claims the enhancement. */
    const c = Math.max(0, Math.min(1, opts.cloudCover / 100));
    uv *= 1 - 0.8 * Math.pow(c, 2.2);
  }
  return Math.round(uv * 10) / 10;
}

/** The WHO's five bands, which are the only UV words most people know. */
export type UVBand = "low" | "moderate" | "high" | "very-high" | "extreme";

export function uvBand(uv: number): UVBand {
  if (uv < 3) return "low";
  if (uv < 6) return "moderate";
  if (uv < 8) return "high";
  if (uv < 11) return "very-high";
  return "extreme";
}

export const UV_BAND_LABEL: Record<UVBand, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  "very-high": "Very high",
  extreme: "Extreme",
};

/** Standard erythema dose accumulated by `minutes` at a given UV index.
    1 SED = 100 J/m² erythemally weighted; UV index 1 ≈ 25 mW/m², so one hour
    at UVI 1 is 0.9 SED. This is the unit burn risk is actually measured in. */
export const sedFrom = (uv: number, minutes: number): number =>
  (uv * 25 * minutes * 60) / 100000;

/** Minutes at this UV before this skin starts to redden, with SPF and shade
    taken into account. `null` when the UV is too low to burn at all — which
    is most of the year in most places, and worth saying out loud rather than
    printing an alarming number. */
export function minutesToBurn(
  uv: number,
  skin: SkinType,
  opts: { spf?: number; shade?: ShadeLevel } = {}
): number | null {
  const shade = SHADE_FACTORS[opts.shade || "open"];
  const effective = uv * shade;
  if (effective <= 0.5) return null;
  /* SPF is applied at a realistic fraction of its label. Almost nobody applies
     2 mg/cm², which is what the number on the bottle is measured at, and an
     app that assumes they did will tell somebody they have four hours when
     they have ninety minutes. */
  const spf = opts.spf && opts.spf > 1 ? 1 + (opts.spf - 1) * 0.4 : 1;
  const med = skinTypeInfo(skin).medSED;
  const perMinute = sedFrom(effective, 1) / spf;
  return Math.round(med / perMinute);
}

/* ---------- vitamin D ----------

   The model, stated plainly so the code and the screen can say the same thing:

   Cutaneous synthesis is driven by UVB, which is a small and strongly
   elevation-dependent slice of the UV index. Below roughly 45° of solar
   elevation, atmospheric path length removes almost all of the 290–315nm band
   — the "shadow rule" everyone repeats, that you make little vitamin D when
   your shadow is longer than you are, is exactly this. So the model weights UV
   by an elevation term rather than treating UVI 4 in March like UVI 4 in June.

   From there it is: usable UVB × exposed body area × skin factor × time, with
   an empirical constant chosen so that the canonical reference case — fair
   skin, swimwear, summer noon, one MED — lands near the 10,000–20,000 IU that
   the literature reports for a full-body erythemal dose, and a realistic
   twenty minutes in a t-shirt lands in the hundreds-to-low-thousands.

   And then it is deliberately widened into a ±35% range, because the honest
   width of this estimate is much larger than any point value implies. Age,
   season, current 25(OH)D status, previous exposure, skin thickness and where
   on the planet you are all move it, and half of those are things the app has
   no business asking. A range that admits its width is more useful than a
   precise-looking number that is wrong. */

export interface VitaminDInput {
  /** Average UV index over the exposure. */
  uv: number;
  /** Average solar elevation over the exposure, in degrees. */
  elevation: number;
  minutes: number;
  skin: SkinType;
  exposure: ExposureLevel;
  shade?: ShadeLevel;
  spf?: number;
  /** Years. Synthesis capacity falls with age; absent means "not supplied"
      and the model uses no age term rather than inventing one. */
  age?: number;
}

export interface VitaminDEstimate {
  /** Midpoint, IU. Never shown on its own. */
  iu: number;
  /** The range actually printed. */
  low: number;
  high: number;
  /** Fraction of a minimal erythemal dose this exposure represents. */
  medFraction: number;
  /** True once the UVB is too weak for meaningful synthesis — winter, early
      morning, late afternoon. The app says so instead of printing "~15 IU". */
  belowThreshold: boolean;
  /** Every factor that moved the number, in the order it was applied. This is
      what the "How is this worked out?" panel prints; it is data, not prose,
      so the panel cannot drift out of step with the arithmetic. */
  assumptions: { label: string; value: string }[];
}

/** How much of the UV at this elevation is usable UVB, 0–1.

    Zero below 10° (winter sun makes none at temperate latitudes), rising
    steeply through the 20–45° band, near-saturated above 60°. */
export function uvbFraction(elevationDeg: number): number {
  if (elevationDeg <= 10) return 0;
  const x = Math.min(1, (elevationDeg - 10) / 50);
  return Math.round(Math.pow(x, 1.6) * 1000) / 1000;
}

/** The rule of thumb, kept because it is the one people already know: below
    about 45° your shadow is longer than you are and there is little UVB. */
export const shadowRuleMet = (elevationDeg: number): boolean => elevationDeg >= 45;

const IU_CONSTANT = 12500;

export function estimateVitaminD(input: VitaminDInput): VitaminDEstimate {
  const skin = skinTypeInfo(input.skin);
  const exposure = exposureInfo(input.exposure);
  const shadeKey = input.shade || "open";
  const shade = SHADE_FACTORS[shadeKey];
  const spfFactor = input.spf && input.spf > 1 ? 1 / (1 + (input.spf - 1) * 0.4) : 1;
  const uvb = uvbFraction(input.elevation);
  /* Age term: synthesis capacity roughly halves between 20 and 70. Applied
     only when an age was actually supplied. */
  const ageFactor =
    typeof input.age === "number" && input.age > 20
      ? Math.max(0.4, 1 - (input.age - 20) * 0.01)
      : 1;

  const effectiveUV = Math.max(0, input.uv) * shade * spfFactor;
  const dose = sedFrom(effectiveUV, Math.max(0, input.minutes));
  const raw =
    IU_CONSTANT * dose * uvb * exposure.bsa * skin.synthesis * ageFactor;

  /* Synthesis plateaus: past roughly one MED of whole-body exposure the skin
     stops making more and starts breaking down what it has. An app that keeps
     the number climbing is quietly telling somebody that a longer burn is a
     bigger benefit. */
  const medFraction = dose / skin.medSED;
  const plateau = 1 - Math.exp(-1.6 * medFraction);
  const capped = medFraction > 0 ? (raw / medFraction) * plateau * 0.62 : 0;

  const iu = Math.max(0, Math.round(capped / 50) * 50);
  const belowThreshold = uvb <= 0.02 || iu < 100;

  const assumptions: { label: string; value: string }[] = [
    { label: "Sun height", value: `${Math.round(input.elevation)}° above the horizon` },
    { label: "UV index used", value: `${Math.round(input.uv * 10) / 10}` },
    { label: "Usable UVB at that height", value: `${Math.round(uvb * 100)}%` },
    { label: "Time in the sun", value: `${Math.round(input.minutes)} min` },
    { label: "Skin", value: `${skin.desc} — ${skin.label.toLowerCase()}` },
    { label: "Skin exposed", value: `${exposure.label} (~${Math.round(exposure.bsa * 100)}% of you)` },
    { label: "Shade", value: SHADE_LABELS[shadeKey] },
  ];
  if (input.spf && input.spf > 1) assumptions.push({ label: "Sunscreen", value: `SPF ${input.spf}, applied as most people do` });
  if (typeof input.age === "number") assumptions.push({ label: "Age", value: `${Math.round(input.age)}` });

  return {
    iu,
    low: Math.max(0, Math.round((iu * 0.65) / 50) * 50),
    high: Math.round((iu * 1.35) / 50) * 50,
    medFraction: Math.round(medFraction * 100) / 100,
    belowThreshold,
    assumptions,
  };
}

/** "~1,800–2,600 IU", or the honest sentence when there was no usable UVB. */
export function vitaminDRangeLabel(est: VitaminDEstimate): string {
  if (est.belowThreshold) return "Very little";
  const fmt = (n: number) => n.toLocaleString("en-US");
  return `~${fmt(est.low)}–${fmt(est.high)} IU`;
}

/* ---------- windows ----------

   "When should I go out?" is the question a sunlight app exists to answer, and
   it has two different answers that must never be merged: the window where
   synthesis is possible, and the window where it is pleasant and safe. The
   first is astronomy. The second is a judgement, and it is offered as one. */

export interface SunWindow {
  start: Date;
  end: Date;
  /** Peak UV index inside the window. */
  peakUV: number;
  /** Peak solar elevation inside the window. */
  peakElevation: number;
  minutes: number;
}

/** Sample the sun's elevation across a local day at `stepMin` intervals.
    Everything below is built on this one pass so the arc drawn on screen and
    the windows described underneath it can never disagree. */
export function daySamples(
  day: Date,
  coords: Coords,
  stepMin = 10,
  opts: { altitudeM?: number; cloudCover?: number } = {}
): { at: Date; elevation: number; azimuth: number; uv: number }[] {
  const out: { at: Date; elevation: number; azimuth: number; uv: number }[] = [];
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
  for (let m = 0; m <= 1440; m += stepMin) {
    const at = new Date(start.getTime() + m * 60000);
    const pos = solarPosition(at, coords);
    out.push({
      at,
      elevation: pos.elevation,
      azimuth: pos.azimuth,
      uv: clearSkyUV(pos.elevation, opts),
    });
  }
  return out;
}

/** The stretch of the day where vitamin D synthesis is plausible — the sun
    above the elevation where usable UVB begins. `null` when today has none,
    which is the correct answer for a British January and one the app should
    be willing to give. */
export function vitaminDWindow(
  day: Date,
  coords: Coords,
  minElevation = 30,
  opts: { altitudeM?: number; cloudCover?: number } = {}
): SunWindow | null {
  return windowAbove(daySamples(day, coords, 5, opts), minElevation);
}

/** The stretch where being outside is pleasant rather than punishing — sun up,
    but UV below the band where a fair-skinned person burns inside an hour. */
export function comfortWindow(
  day: Date,
  coords: Coords,
  opts: { altitudeM?: number; cloudCover?: number } = {}
): SunWindow | null {
  const samples = daySamples(day, coords, 5, opts);
  const usable = samples.filter((s) => s.elevation > 5 && s.uv < 6);
  return spanOf(usable);
}

function windowAbove(
  samples: { at: Date; elevation: number; uv: number }[],
  minElevation: number
): SunWindow | null {
  return spanOf(samples.filter((s) => s.elevation >= minElevation));
}

function spanOf(rows: { at: Date; elevation: number; uv: number }[]): SunWindow | null {
  if (rows.length < 2) return null;
  const start = rows[0].at;
  const end = rows[rows.length - 1].at;
  return {
    start,
    end,
    peakUV: Math.max(...rows.map((r) => r.uv)),
    peakElevation: Math.max(...rows.map((r) => r.elevation)),
    minutes: Math.round((end.getTime() - start.getTime()) / 60000),
  };
}

/** The next vitamin-D-producing window from `now`, looking up to `days` ahead.
    Returns the remainder of today's window when one is still open, so the card
    on the dashboard says "until 3:40pm" rather than pointing at tomorrow. */
export function nextVitaminDWindow(
  now: Date,
  coords: Coords,
  days = 7,
  minElevation = 30
): SunWindow | null {
  for (let i = 0; i < days; i += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const w = vitaminDWindow(day, coords, minElevation);
    if (!w) continue;
    if (w.end.getTime() <= now.getTime()) continue;
    if (w.start.getTime() < now.getTime()) {
      return { ...w, start: now, minutes: Math.round((w.end.getTime() - now.getTime()) / 60000) };
    }
    return w;
  }
  return null;
}

/** Morning light — the first stretch after sunrise, which is the one the
    circadian literature is about and the one people set out to catch. It is
    deliberately *not* described in vitamin D terms: at 10° of elevation there
    is essentially no UVB, and the benefit being claimed is a different one. */
export function morningLightWindow(day: Date, coords: Coords): SunWindow | null {
  const light = dayLight(day, coords);
  if (!light.sunrise) return null;
  const start = light.sunrise;
  const end = new Date(start.getTime() + 150 * 60000);
  const samples = daySamples(day, coords, 5).filter(
    (s) => s.at >= start && s.at <= end
  );
  return spanOf(samples);
}

/** Minutes between waking and a moment — the "first outdoor light after
    waking" number, which is only meaningful with both ends supplied. */
export function minutesAfterWaking(wake: Date | null, at: Date): number | null {
  if (!wake) return null;
  const mins = Math.round((at.getTime() - wake.getTime()) / 60000);
  return mins >= 0 && mins < 18 * 60 ? mins : null;
}

/* ---------- formatting ---------- */

export const clockLabel = (d: Date | null): string =>
  d
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "—";

export function durationLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** Elapsed time as a session clock — 00:12:41. The one number on the live
    screen that has to be legible from across a garden. */
export function stopwatchLabel(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
