/* The day around the day.

   A journal that only holds what somebody typed is missing the half of their
   life that happened to them. It was 34°C. The pressure dropped 11 hPa
   overnight. The pollen was the highest it had been all spring. None of that
   is anybody's fault and none of it is worth a daily question, but all of it
   is exactly the sort of thing that shows up in a chart six months later and
   explains a fortnight nobody could account for.

   So, with permission, each day quietly gets a context record attached. Three
   rules govern it, and they are the whole design:

   1. **Ask once, plainly, and mean it.** This is the only feature in the app
      that leaves the device by default once it is on, and the only one that
      touches location. It is off until switched on, the screen that offers it
      says exactly what is sent and what comes back, and switching it off stops
      the requests immediately.

   2. **Store the weather, not the person's movements.** Coordinates are
      rounded to roughly a city district before anything is written down, and
      the *only* thing kept per day is the environmental reading. There is no
      location history here — a day says "26°C, 41% humidity, pressure falling"
      and not where you were. Rounding happens before storage, once, in
      `coarse()`, so there is one place to check.

   3. **Invisible until it is meaningful.** Context is not a weather app bolted
      onto a health app. It sits behind the day as a colour and a small glyph,
      and it only speaks up when it has something to say about the person's own
      numbers — and then it says it in the language of coincidence, never of
      cause.

   The data comes from Open-Meteo, which needs no account and no API key, and
   the requests carry a rounded latitude and longitude and nothing else. No
   identifier, no journal content, no name. */

import type { Coords } from "./solar";

/* ---------- consent ---------- */

/** What the person has agreed to. Absent means never asked, which is a
    different state from "asked and said no" and is treated as one. */
export interface ContextConsent {
  /** Master switch. Nothing here makes a request while this is false. */
  enabled: boolean;
  /** Whether to ask the browser for coordinates, or to use a place the person
      typed. "off" means context is limited to what needs no location at all,
      which is nothing — so it is really "don't". */
  location: "device" | "manual" | "off";
  /** A manually-set place, already coarse. */
  place?: { lat: number; lon: number; label?: string };
  /** When they were last asked, so the app never asks twice in a week. */
  askedAt?: string;
  /** Celsius or Fahrenheit, for display only — storage is always metric. */
  units?: "metric" | "imperial";
}

export const DEFAULT_CONSENT: ContextConsent = {
  enabled: false,
  location: "off",
  units: "metric",
};

export function sanitizeConsent(v: unknown): ContextConsent {
  if (!v || typeof v !== "object") return { ...DEFAULT_CONSENT };
  const r = v as any;
  const place =
    r.place && Number.isFinite(Number(r.place.lat)) && Number.isFinite(Number(r.place.lon))
      ? {
          ...coarse({ lat: Number(r.place.lat), lon: Number(r.place.lon) }),
          label: typeof r.place.label === "string" ? r.place.label.slice(0, 60) : undefined,
        }
      : undefined;
  return {
    enabled: r.enabled === true,
    location: r.location === "device" || r.location === "manual" ? r.location : "off",
    place,
    askedAt: typeof r.askedAt === "string" ? r.askedAt : undefined,
    units: r.units === "imperial" ? "imperial" : "metric",
  };
}

/** Round a fix to about a kilometre before it is written down or sent.

    Two decimal places is roughly 1.1 km of latitude. That is precise enough
    that the weather is the weather and the sun is where the sun is, and coarse
    enough that the stored number does not say which building you were in. */
export function coarse(c: Coords): Coords {
  return {
    lat: Math.round(c.lat * 100) / 100,
    lon: Math.round(c.lon * 100) / 100,
  };
}

/* ---------- the record ---------- */

/** One day's environment. Every field optional: a provider that is missing
    pollen for this part of the world should produce a record without pollen,
    not a record full of zeros. Zero pollen and unknown pollen are different
    facts and the charts treat them differently. */
export interface DayContext {
  /** YYYY-MM-DD, local. */
  date: string;
  /** Coarse coordinates this reading is for. */
  coords: Coords;
  /** When it was fetched, so a stale record can be refreshed. */
  capturedAt: string;
  /** Degrees Celsius. Always metric in storage; converted at the render
      boundary by `formatTemp`. */
  tempMax?: number;
  tempMin?: number;
  tempMean?: number;
  /** Percent. */
  humidityMean?: number;
  /** hPa, mean over the day. */
  pressureMean?: number;
  /** hPa, this day's mean minus yesterday's. The number migraine and joint
      pain diaries are actually about — the level matters much less than the
      change. */
  pressureChange?: number;
  /** WMO weather code. See `weatherLabel`. */
  weatherCode?: number;
  /** Peak UV index for the day, from the forecast rather than modelled. */
  uvMax?: number;
  /** Local ISO times. */
  sunrise?: string;
  sunset?: string;
  daylightMinutes?: number;
  /** mm. */
  precipitation?: number;
  /** km/h. */
  windMax?: number;
  /** Air quality. `aqi` is the US index because it is the one most people
      recognise; the European one is carried too where it is offered. */
  aqi?: number;
  aqiEuropean?: number;
  pm25?: number;
  pm10?: number;
  /** Grains/m³, where the provider covers this part of the world at all. */
  pollenGrass?: number;
  pollenTree?: number;
  pollenWeed?: number;
  /** Where it came from, for the "why am I seeing this" panel. */
  source: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown, lo: number, hi: number, dp = 1): number | undefined => {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const f = Math.pow(10, dp);
  return Math.round(Math.max(lo, Math.min(hi, n)) * f) / f;
};

export function sanitizeContexts(rows: unknown): DayContext[] {
  if (!Array.isArray(rows)) return [];
  const byDate = new Map<string, DayContext>();
  for (const r of rows as any[]) {
    if (!r || typeof r !== "object" || !DATE_RE.test(r.date)) continue;
    const lat = num(r.coords?.lat, -90, 90, 2);
    const lon = num(r.coords?.lon, -180, 180, 2);
    if (lat === undefined || lon === undefined) continue;
    byDate.set(r.date, {
      date: r.date,
      coords: { lat, lon },
      capturedAt: typeof r.capturedAt === "string" ? r.capturedAt : new Date().toISOString(),
      tempMax: num(r.tempMax, -90, 60),
      tempMin: num(r.tempMin, -90, 60),
      tempMean: num(r.tempMean, -90, 60),
      humidityMean: num(r.humidityMean, 0, 100),
      pressureMean: num(r.pressureMean, 800, 1100),
      pressureChange: num(r.pressureChange, -60, 60),
      weatherCode: num(r.weatherCode, 0, 99, 0),
      uvMax: num(r.uvMax, 0, 20),
      sunrise: typeof r.sunrise === "string" ? r.sunrise.slice(0, 19) : undefined,
      sunset: typeof r.sunset === "string" ? r.sunset.slice(0, 19) : undefined,
      daylightMinutes: num(r.daylightMinutes, 0, 1440, 0),
      precipitation: num(r.precipitation, 0, 500),
      windMax: num(r.windMax, 0, 300),
      aqi: num(r.aqi, 0, 600, 0),
      aqiEuropean: num(r.aqiEuropean, 0, 600, 0),
      pm25: num(r.pm25, 0, 1000),
      pm10: num(r.pm10, 0, 2000),
      pollenGrass: num(r.pollenGrass, 0, 1000),
      pollenTree: num(r.pollenTree, 0, 1000),
      pollenWeed: num(r.pollenWeed, 0, 1000),
      source: typeof r.source === "string" ? r.source.slice(0, 40) : "open-meteo",
    });
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export const contextOn = (rows: DayContext[], date: string): DayContext | undefined =>
  rows.find((c) => c.date === date);

/* ---------- WMO weather codes ----------

   The glyph behind a day. Deliberately a small vocabulary — eight shapes, not
   twenty-eight — because this sits *behind* a health entry and a detailed
   meteorological icon set competing with the day's rating would be exactly the
   decoration this app doesn't do. */

export type SkyKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export function skyKind(code: number | undefined): SkyKind | undefined {
  if (code === undefined) return undefined;
  if (code === 0) return "clear";
  if (code <= 2) return "partly";
  if (code === 3) return "cloudy";
  if (code >= 45 && code <= 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

export const SKY_LABEL: Record<SkyKind, string> = {
  clear: "Clear",
  partly: "Partly cloudy",
  cloudy: "Overcast",
  fog: "Fog",
  drizzle: "Drizzle",
  rain: "Rain",
  snow: "Snow",
  storm: "Thunderstorms",
};

export const weatherLabel = (code: number | undefined): string => {
  const k = skyKind(code);
  return k ? SKY_LABEL[k] : "";
};

/* ---------- display ---------- */

export const toF = (c: number): number => Math.round((c * 9) / 5 + 32);

export function formatTemp(c: number | undefined, units: "metric" | "imperial" = "metric"): string {
  if (c === undefined) return "—";
  return units === "imperial" ? `${toF(c)}°F` : `${Math.round(c)}°C`;
}

/** The pressure sentence. The *direction and size* of the change is the whole
    point; the absolute reading is background. */
export function pressureLabel(change: number | undefined): string {
  if (change === undefined) return "";
  const v = Math.round(change);
  if (Math.abs(v) < 2) return "Pressure steady";
  return v < 0 ? `Pressure fell ${Math.abs(v)} hPa` : `Pressure rose ${v} hPa`;
}

export type AirBand = "good" | "fair" | "moderate" | "poor" | "very-poor";

export function airBand(aqi: number | undefined): AirBand | undefined {
  if (aqi === undefined) return undefined;
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "fair";
  if (aqi <= 150) return "moderate";
  if (aqi <= 200) return "poor";
  return "very-poor";
}

export const AIR_LABEL: Record<AirBand, string> = {
  good: "Good",
  fair: "Fair",
  moderate: "Moderate",
  poor: "Poor",
  "very-poor": "Very poor",
};

export type PollenBand = "none" | "low" | "moderate" | "high" | "very-high";

/** Bands over grains/m³, on the grass-pollen scale most services publish. */
export function pollenBand(v: number | undefined): PollenBand | undefined {
  if (v === undefined) return undefined;
  if (v < 1) return "none";
  if (v < 20) return "low";
  if (v < 50) return "moderate";
  if (v < 200) return "high";
  return "very-high";
}

export const POLLEN_LABEL: Record<PollenBand, string> = {
  none: "None",
  low: "Low",
  moderate: "Moderate",
  high: "High",
  "very-high": "Very high",
};

/** The highest of the three pollen counts, which is the one somebody with hay
    fever actually feels. */
export const pollenPeak = (c: DayContext): number | undefined => {
  const vals = [c.pollenGrass, c.pollenTree, c.pollenWeed].filter(
    (v): v is number => typeof v === "number"
  );
  return vals.length ? Math.max(...vals) : undefined;
};

/** One line for the timeline: "24°C · Partly cloudy · Pressure fell 8 hPa". */
export function contextLine(c: DayContext | undefined, units: "metric" | "imperial" = "metric"): string {
  if (!c) return "";
  const bits: string[] = [];
  if (c.tempMax !== undefined) bits.push(formatTemp(c.tempMax, units));
  const sky = weatherLabel(c.weatherCode);
  if (sky) bits.push(sky);
  const p = pressureLabel(c.pressureChange);
  if (p && !p.endsWith("steady")) bits.push(p);
  return bits.join(" · ");
}

/* ---------- fetching ----------

   One request to each of two Open-Meteo endpoints, covering a window of days
   at a time rather than one day per call. `fetchImpl` is a parameter so the
   test suite runs the parsing without a network, and so a caller that has
   already decided not to make requests cannot accidentally make one. */

export const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
export const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "temperature_2m_mean",
  "uv_index_max",
  "precipitation_sum",
  "wind_speed_10m_max",
  "sunrise",
  "sunset",
  "daylight_duration",
].join(",");

/* Humidity and pressure have no daily aggregate in this API, so they come back
   hourly and are averaged here. That is the right average anyway — a "daily
   pressure" that is really the reading at midnight would miss the whole point
   of the number. */
const HOURLY_FIELDS = ["relative_humidity_2m", "surface_pressure"].join(",");

const AIR_FIELDS = [
  "pm10",
  "pm2_5",
  "us_aqi",
  "european_aqi",
  "grass_pollen",
  "birch_pollen",
  "alder_pollen",
  "ragweed_pollen",
  "mugwort_pollen",
].join(",");

export type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<any> }>;

export function forecastURL(coords: Coords, pastDays: number): string {
  const c = coarse(coords);
  const q = new URLSearchParams({
    latitude: String(c.lat),
    longitude: String(c.lon),
    daily: DAILY_FIELDS,
    hourly: HOURLY_FIELDS,
    timezone: "auto",
    past_days: String(Math.max(0, Math.min(92, pastDays))),
    forecast_days: "2",
  });
  return `${FORECAST_URL}?${q}`;
}

export function airURL(coords: Coords, pastDays: number): string {
  const c = coarse(coords);
  const q = new URLSearchParams({
    latitude: String(c.lat),
    longitude: String(c.lon),
    hourly: AIR_FIELDS,
    timezone: "auto",
    past_days: String(Math.max(0, Math.min(92, pastDays))),
    forecast_days: "1",
  });
  return `${AIR_URL}?${q}`;
}

/** Group hourly values by their local date and average them. */
function dailyMean(times: string[] | undefined, values: (number | null)[] | undefined) {
  const out = new Map<string, number>();
  if (!Array.isArray(times) || !Array.isArray(values)) return out;
  const sums = new Map<string, { sum: number; n: number }>();
  for (let i = 0; i < times.length; i += 1) {
    const v = values[i];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const day = String(times[i]).slice(0, 10);
    const acc = sums.get(day) || { sum: 0, n: 0 };
    acc.sum += v;
    acc.n += 1;
    sums.set(day, acc);
  }
  for (const [day, acc] of sums) out.set(day, acc.sum / acc.n);
  return out;
}

function dailyMax(times: string[] | undefined, values: (number | null)[] | undefined) {
  const out = new Map<string, number>();
  if (!Array.isArray(times) || !Array.isArray(values)) return out;
  for (let i = 0; i < times.length; i += 1) {
    const v = values[i];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const day = String(times[i]).slice(0, 10);
    const prev = out.get(day);
    if (prev === undefined || v > prev) out.set(day, v);
  }
  return out;
}

/** Turn one forecast payload into day records. Pure — this is the half that
    is worth testing, and it is separated from the request for that reason. */
export function parseForecast(json: any, coords: Coords): DayContext[] {
  const daily = json?.daily;
  if (!daily || !Array.isArray(daily.time)) return [];
  const humidity = dailyMean(json?.hourly?.time, json?.hourly?.relative_humidity_2m);
  const pressure = dailyMean(json?.hourly?.time, json?.hourly?.surface_pressure);
  const at = new Date().toISOString();
  const c = coarse(coords);
  const rows: DayContext[] = daily.time.map((date: string, i: number) => ({
    date: String(date).slice(0, 10),
    coords: c,
    capturedAt: at,
    tempMax: num(daily.temperature_2m_max?.[i], -90, 60),
    tempMin: num(daily.temperature_2m_min?.[i], -90, 60),
    tempMean: num(daily.temperature_2m_mean?.[i], -90, 60),
    humidityMean: num(humidity.get(String(date).slice(0, 10)), 0, 100),
    pressureMean: num(pressure.get(String(date).slice(0, 10)), 800, 1100),
    weatherCode: num(daily.weather_code?.[i], 0, 99, 0),
    uvMax: num(daily.uv_index_max?.[i], 0, 20),
    sunrise: typeof daily.sunrise?.[i] === "string" ? daily.sunrise[i] : undefined,
    sunset: typeof daily.sunset?.[i] === "string" ? daily.sunset[i] : undefined,
    daylightMinutes: num(
      typeof daily.daylight_duration?.[i] === "number" ? daily.daylight_duration[i] / 60 : undefined,
      0,
      1440,
      0
    ),
    precipitation: num(daily.precipitation_sum?.[i], 0, 500),
    windMax: num(daily.wind_speed_10m_max?.[i], 0, 300),
    source: "open-meteo",
  }));
  return withPressureChange(rows);
}

/** Fill in each day's change against the day before it. Done here rather than
    at render time so a record carries its own answer and a gap in the middle
    of the history cannot silently produce a change against a week ago. */
export function withPressureChange(rows: DayContext[]): DayContext[] {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((row, i) => {
    const prev = i > 0 ? sorted[i - 1] : undefined;
    const consecutive = prev && dayBefore(row.date) === prev.date;
    if (!consecutive || prev?.pressureMean === undefined || row.pressureMean === undefined) return row;
    return { ...row, pressureChange: Math.round((row.pressureMean - prev.pressureMean) * 10) / 10 };
  });
}

function dayBefore(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Fold air quality into day records that already exist. Air quality never
    creates a day on its own — a day with pollen and no weather would render as
    a mostly-empty strip. */
export function mergeAir(rows: DayContext[], json: any): DayContext[] {
  const hourly = json?.hourly;
  if (!hourly || !Array.isArray(hourly.time)) return rows;
  const pm25 = dailyMean(hourly.time, hourly.pm2_5);
  const pm10 = dailyMean(hourly.time, hourly.pm10);
  const aqi = dailyMax(hourly.time, hourly.us_aqi);
  const aqiEu = dailyMax(hourly.time, hourly.european_aqi);
  const grass = dailyMax(hourly.time, hourly.grass_pollen);
  const tree = dailyMax(
    hourly.time,
    (hourly.birch_pollen || []).map((v: number | null, i: number) =>
      Math.max(v ?? 0, hourly.alder_pollen?.[i] ?? 0)
    )
  );
  const weed = dailyMax(
    hourly.time,
    (hourly.ragweed_pollen || []).map((v: number | null, i: number) =>
      Math.max(v ?? 0, hourly.mugwort_pollen?.[i] ?? 0)
    )
  );
  return rows.map((row) => ({
    ...row,
    pm25: num(pm25.get(row.date), 0, 1000),
    pm10: num(pm10.get(row.date), 0, 2000),
    aqi: num(aqi.get(row.date), 0, 600, 0),
    aqiEuropean: num(aqiEu.get(row.date), 0, 600, 0),
    pollenGrass: num(grass.get(row.date), 0, 1000),
    pollenTree: num(tree.get(row.date), 0, 1000),
    pollenWeed: num(weed.get(row.date), 0, 1000),
  }));
}

export interface FetchResult {
  rows: DayContext[];
  error?: string;
}

/** Fetch a window of days. Air quality is best-effort: its provider covers
    fewer places than the weather one, and a missing pollen forecast should
    never cost somebody their temperature record. */
export async function fetchContext(
  coords: Coords,
  pastDays = 7,
  fetchImpl?: FetchLike
): Promise<FetchResult> {
  const f: FetchLike | undefined =
    fetchImpl || (typeof fetch === "function" ? ((url: string) => fetch(url)) as FetchLike : undefined);
  if (!f) return { rows: [], error: "No network available on this device." };
  let rows: DayContext[] = [];
  try {
    const res = await f(forecastURL(coords, pastDays));
    if (!res.ok) return { rows: [], error: "The weather service didn't answer." };
    rows = parseForecast(await res.json(), coords);
  } catch {
    return { rows: [], error: "Couldn't reach the weather service." };
  }
  try {
    const air = await f(airURL(coords, pastDays));
    if (air.ok) rows = mergeAir(rows, await air.json());
  } catch {
    /* Weather without air quality is still a useful day. */
  }
  return { rows };
}

/** Merge freshly fetched days into what is already stored. Newer readings win
    for the same date, and a day that has scrolled out of the fetch window is
    kept rather than dropped — this is a journal, and last March is the point. */
export function mergeContexts(existing: DayContext[], incoming: DayContext[]): DayContext[] {
  const byDate = new Map(existing.map((c) => [c.date, c] as const));
  for (const row of incoming) {
    const prev = byDate.get(row.date);
    /* A record whose fields are already filled in should not be replaced by a
       thinner one — the air-quality half can be missing on a retry. */
    byDate.set(row.date, prev ? { ...prev, ...stripEmpty(row) } : row);
  }
  return withPressureChange([...byDate.values()]).slice(-800);
}

function stripEmpty(row: DayContext): Partial<DayContext> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (v !== undefined && v !== null) out[k] = v;
  return out as Partial<DayContext>;
}

/** Whether a day is worth (re)fetching. Today and yesterday are refreshed
    because a forecast becomes a measurement over the following hours; older
    days are left alone once they have a temperature. */
export function needsRefresh(row: DayContext | undefined, date: string, today: string): boolean {
  if (!row) return true;
  if (row.tempMax === undefined) return true;
  if (date === today || date === dayBefore(today)) {
    return Date.now() - Date.parse(row.capturedAt) > 3 * 3600 * 1000;
  }
  return false;
}

/* ---------- what it becomes downstream ---------- */

export interface ContextMetricCtx {
  context?: DayContext[];
  date: string;
}

export const CONTEXT_METRICS: {
  k: string;
  label: string;
  unit?: string;
  dir: "sym" | "pos" | "neutral";
  sec: string;
  value: (ctx: ContextMetricCtx) => number | null;
}[] = [
  { k: "env_temp_max", label: "High temperature", unit: "°C", dir: "neutral", sec: "Environment", value: pick("tempMax") },
  { k: "env_temp_min", label: "Low temperature", unit: "°C", dir: "neutral", sec: "Environment", value: pick("tempMin") },
  { k: "env_humidity", label: "Humidity", unit: "%", dir: "neutral", sec: "Environment", value: pick("humidityMean") },
  { k: "env_pressure", label: "Pressure", unit: "hPa", dir: "neutral", sec: "Environment", value: pick("pressureMean") },
  { k: "env_pressure_change", label: "Pressure change", unit: "hPa", dir: "neutral", sec: "Environment", value: pick("pressureChange") },
  { k: "env_uv", label: "UV index (peak)", dir: "neutral", sec: "Environment", value: pick("uvMax") },
  { k: "env_daylight", label: "Daylight", unit: "min", dir: "neutral", sec: "Environment", value: pick("daylightMinutes") },
  { k: "env_aqi", label: "Air quality index", dir: "sym", sec: "Environment", value: pick("aqi") },
  { k: "env_pm25", label: "PM2.5", unit: "µg/m³", dir: "sym", sec: "Environment", value: pick("pm25") },
  { k: "env_pm10", label: "PM10", unit: "µg/m³", dir: "sym", sec: "Environment", value: pick("pm10") },
  {
    k: "env_pollen",
    label: "Pollen (peak)",
    unit: "grains/m³",
    dir: "sym",
    sec: "Environment",
    value: ({ context = [], date }) => {
      const c = contextOn(context, date);
      const v = c ? pollenPeak(c) : undefined;
      return v === undefined ? null : v;
    },
  },
  { k: "env_rain", label: "Precipitation", unit: "mm", dir: "neutral", sec: "Environment", value: pick("precipitation") },
];

function pick(field: keyof DayContext) {
  return ({ context = [], date }: ContextMetricCtx): number | null => {
    const c = contextOn(context, date);
    const v = c?.[field];
    return typeof v === "number" ? v : null;
  };
}

export const CONTEXT_METRIC_KEYS = CONTEXT_METRICS.map((m) => m.k);
export const isContextKey = (k: string): boolean => CONTEXT_METRIC_KEYS.includes(k);

/* ---------- observations ----------

   The sentences. This is where the honesty has to be structural rather than
   editorial, because "8 of your 10 hardest days were above 29°C" is *true*
   and still reads as an accusation against the weather if it is not framed
   carefully.

   Three defences:

   · The sentence is always a count, never a rate or a coefficient. "8 of your
     10" is checkable by a person. "r = 0.42" is not.
   · Nothing is produced under MIN_DAYS days of overlap, and the count is
     always printed alongside.
   · The vocabulary is fixed here, in one place, so the causal-language audit
     in lib/validate can read every phrase this module can emit. */

export const MIN_CONTEXT_DAYS = 20;

export interface ContextObservation {
  id: string;
  /** The environmental factor's metric key. */
  factor: string;
  /** The outcome's answer key. */
  outcome: string;
  headline: string;
  detail: string;
  /** The days this is about, so tapping it can light them up everywhere. */
  dates: string[];
  /** How many days went into it at all. */
  observed: number;
}

interface Entryish {
  date: string;
  answers?: Record<string, unknown>;
}

const answerNum = (e: Entryish | undefined, k: string): number | null => {
  const v = e?.answers?.[k];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  return null;
};

/** "8 of your 10 hardest days were above 29°C."

    The hardest days are the top decile of the outcome; the observation fires
    only when most of them land on one side of the factor's own median, which
    is a deliberately blunt test. Blunt is the point: a subtle effect found in
    forty days of self-rated data is almost always noise wearing a lab coat. */
export function hardDayObservation(
  entries: Entryish[],
  contexts: DayContext[],
  outcomeKey: string,
  dir: "sym" | "pos" | "neutral" | undefined,
  factor: { key: string; label: string; get: (c: DayContext) => number | undefined; unit?: string; units?: "metric" | "imperial" }
): ContextObservation | null {
  const byDate = new Map(contexts.map((c) => [c.date, c] as const));
  const rows: { date: string; y: number; x: number }[] = [];
  for (const e of entries) {
    const y = answerNum(e, outcomeKey);
    const c = byDate.get(e.date);
    const x = c ? factor.get(c) : undefined;
    if (y == null || x === undefined) continue;
    rows.push({ date: e.date, y, x });
  }
  if (rows.length < MIN_CONTEXT_DAYS) return null;

  const worse = (v: number) => (dir === "pos" ? -v : v);
  const ranked = [...rows].sort((a, b) => worse(b.y) - worse(a.y));
  const n = Math.max(5, Math.min(12, Math.round(rows.length * 0.2)));
  const hardest = ranked.slice(0, n);
  const xs = [...rows].map((r) => r.x).sort((a, b) => a - b);
  const median = xs[Math.floor(xs.length / 2)];
  const above = hardest.filter((r) => r.x > median);
  const below = hardest.filter((r) => r.x <= median);
  const side = above.length >= below.length ? above : below;
  /* Two thirds is the floor. At exactly half, this is a coin. */
  if (side.length / n < 0.67) return null;

  const isAbove = side === above;
  const value =
    factor.units === "imperial" && factor.unit === "°C"
      ? `${toF(median)}°F`
      : `${Math.round(median)}${factor.unit || ""}`;
  return {
    id: `ctx_${outcomeKey}_${factor.key}`,
    factor: factor.key,
    outcome: outcomeKey,
    headline: `${side.length} of your ${n} hardest days ${isAbove ? "were above" : "were at or below"} ${value} ${factor.label.toLowerCase()}.`,
    detail: `Across ${rows.length} days where both were recorded. Days can be alike for many reasons — this is a coincidence worth noticing, not an explanation.`,
    dates: side.map((r) => r.date).sort(),
    observed: rows.length,
  };
}

/** The general form: how the outcome's average differs between the days above
    and below the factor's median. Phrased as a comparison of *your own*
    averages, never as an effect. */
export function bandObservation(
  entries: Entryish[],
  contexts: DayContext[],
  outcomeKey: string,
  outcomeLabel: string,
  factor: { key: string; label: string; get: (c: DayContext) => number | undefined; unit?: string; units?: "metric" | "imperial" }
): ContextObservation | null {
  const byDate = new Map(contexts.map((c) => [c.date, c] as const));
  const rows: { date: string; y: number; x: number }[] = [];
  for (const e of entries) {
    const y = answerNum(e, outcomeKey);
    const c = byDate.get(e.date);
    const x = c ? factor.get(c) : undefined;
    if (y == null || x === undefined) continue;
    rows.push({ date: e.date, y, x });
  }
  if (rows.length < MIN_CONTEXT_DAYS) return null;
  const xs = rows.map((r) => r.x).sort((a, b) => a - b);
  const median = xs[Math.floor(xs.length / 2)];
  const hi = rows.filter((r) => r.x > median);
  const lo = rows.filter((r) => r.x <= median);
  if (hi.length < 8 || lo.length < 8) return null;
  const mean = (arr: typeof rows) => arr.reduce((a, r) => a + r.y, 0) / arr.length;
  const diff = mean(hi) - mean(lo);
  /* Under half a point on a ten-point scale is not something a person can
     feel, and saying it out loud invites them to act on nothing. */
  if (Math.abs(diff) < 0.5) return null;
  const higher = diff > 0 ? "higher" : "lower";
  const value =
    factor.units === "imperial" && factor.unit === "°C"
      ? `${toF(median)}°F`
      : `${Math.round(median)}${factor.unit || ""}`;
  return {
    id: `ctxb_${outcomeKey}_${factor.key}`,
    factor: factor.key,
    outcome: outcomeKey,
    headline: `Your ${outcomeLabel.toLowerCase()} has usually been ${Math.abs(Math.round(diff * 10) / 10)} points ${higher} on days above ${value} ${factor.label.toLowerCase()}.`,
    detail: `${hi.length} days above and ${lo.length} at or below, out of ${rows.length} with both recorded. Averages of your own ratings, side by side — not an effect, and not a cause.`,
    dates: (diff > 0 ? hi : lo).map((r) => r.date).sort(),
    observed: rows.length,
  };
}

/** The factors worth checking against an outcome, in the order they are worth
    checking. Temperature and pressure first because they are the two people
    already suspect, which makes a true finding land and a null one reassuring. */
export function contextFactors(units: "metric" | "imperial" = "metric") {
  return [
    { key: "env_temp_max", label: "high temperature", unit: "°C", units, get: (c: DayContext) => c.tempMax },
    { key: "env_pressure_change", label: "pressure change", unit: " hPa", units, get: (c: DayContext) => c.pressureChange },
    { key: "env_humidity", label: "humidity", unit: "%", units, get: (c: DayContext) => c.humidityMean },
    { key: "env_pollen", label: "pollen", unit: "", units, get: (c: DayContext) => pollenPeak(c) },
    { key: "env_aqi", label: "air quality index", unit: "", units, get: (c: DayContext) => c.aqi },
    { key: "env_uv", label: "UV index", unit: "", units, get: (c: DayContext) => c.uvMax },
    { key: "env_daylight", label: "daylight", unit: " min", units, get: (c: DayContext) => c.daylightMinutes },
  ];
}

/** Everything worth saying about one outcome, best first. Capped, because a
    list of nine coincidences is a horoscope. */
export function contextObservations(
  entries: Entryish[],
  contexts: DayContext[],
  outcome: { key: string; label: string; dir?: "sym" | "pos" | "neutral" },
  units: "metric" | "imperial" = "metric",
  limit = 3
): ContextObservation[] {
  if (!contexts.length || !entries.length) return [];
  const out: ContextObservation[] = [];
  for (const f of contextFactors(units)) {
    const hard = hardDayObservation(entries, contexts, outcome.key, outcome.dir, f);
    if (hard) out.push(hard);
    else {
      const band = bandObservation(entries, contexts, outcome.key, outcome.label, f);
      if (band) out.push(band);
    }
  }
  return out.slice(0, limit);
}
