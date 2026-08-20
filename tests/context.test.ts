/* The day around the day: what is stored, what is sent, and the floors that
   keep an observation from becoming an accusation. */
import { describe, it, expect } from "vitest";
import { causalLanguageAudit } from "../src/lib/validate";
import {
  airBand, airURL, bandObservation, coarse, contextLine, contextObservations,
  CONTEXT_METRICS, fetchContext, forecastURL, formatTemp, hardDayObservation,
  mergeAir, mergeContexts, MIN_CONTEXT_DAYS, needsRefresh, parseForecast,
  pollenBand, pollenPeak, pressureLabel, sanitizeConsent, sanitizeContexts,
  skyKind, weatherLabel, withPressureChange,
} from "../src/lib/context";

const HERE = { lat: 51.50732, lon: -0.12765 };

const day = (i: number) => `2026-07-${String(i + 1).padStart(2, "0")}`;

/* A fortnight of Open-Meteo-shaped payload. */
function forecastPayload(days = 5) {
  const time = Array.from({ length: days }, (_, i) => day(i));
  const hourly: any = { time: [], relative_humidity_2m: [], surface_pressure: [] };
  time.forEach((d, i) => {
    for (let h = 0; h < 24; h += 1) {
      hourly.time.push(`${d}T${String(h).padStart(2, "0")}:00`);
      hourly.relative_humidity_2m.push(40 + i * 5);
      hourly.surface_pressure.push(1010 - i * 4);
    }
  });
  return {
    daily: {
      time,
      weather_code: time.map((_, i) => [0, 3, 61, 95, 71][i % 5]),
      temperature_2m_max: time.map((_, i) => 20 + i),
      temperature_2m_min: time.map((_, i) => 10 + i),
      temperature_2m_mean: time.map((_, i) => 15 + i),
      uv_index_max: time.map(() => 6.2),
      precipitation_sum: time.map(() => 1.5),
      wind_speed_10m_max: time.map(() => 18),
      sunrise: time.map((d) => `${d}T04:50`),
      sunset: time.map((d) => `${d}T21:15`),
      daylight_duration: time.map(() => 58800), // 980 minutes
    },
    hourly,
  };
}

function airPayload(days = 5) {
  const time: string[] = [];
  const mk = (v: number) => time.map(() => v);
  for (let i = 0; i < days; i += 1) {
    for (let h = 0; h < 24; h += 1) time.push(`${day(i)}T${String(h).padStart(2, "0")}:00`);
  }
  return {
    hourly: {
      time,
      pm2_5: mk(12),
      pm10: mk(22),
      us_aqi: mk(48),
      european_aqi: mk(31),
      grass_pollen: mk(65),
      birch_pollen: mk(4),
      alder_pollen: mk(9),
      ragweed_pollen: mk(1),
      mugwort_pollen: mk(2),
    },
  };
}

describe("coarse", () => {
  it("rounds a fix to about a kilometre before anything is written down", () => {
    expect(coarse(HERE)).toEqual({ lat: 51.51, lon: -0.13 });
  });

  it("is applied to the URLs, so a precise fix never leaves the device", () => {
    const url = forecastURL(HERE, 7);
    expect(url).toContain("latitude=51.51");
    expect(url).toContain("longitude=-0.13");
    expect(url).not.toContain("51.50732");
    expect(airURL(HERE, 7)).not.toContain("-0.12765");
  });

  it("sends nothing but a place — no identifier, no journal content", () => {
    const q = new URL(forecastURL(HERE, 7)).searchParams;
    expect([...q.keys()].sort()).toEqual(
      ["daily", "forecast_days", "hourly", "latitude", "longitude", "past_days", "timezone"]
    );
  });

  it("clamps a silly window rather than asking for a decade", () => {
    expect(forecastURL(HERE, 9999)).toContain("past_days=92");
    expect(forecastURL(HERE, -5)).toContain("past_days=0");
  });
});

describe("sanitizeConsent", () => {
  it("defaults to off, and treats anything unrecognised as off", () => {
    expect(sanitizeConsent(undefined).enabled).toBe(false);
    expect(sanitizeConsent({ enabled: "yes" }).enabled).toBe(false);
    expect(sanitizeConsent({ enabled: true, location: "satellite" }).location).toBe("off");
  });

  it("coarsens a manually-set place on the way in", () => {
    const c = sanitizeConsent({ enabled: true, location: "manual", place: { ...HERE, label: "Home" } });
    expect(c.place).toEqual({ lat: 51.51, lon: -0.13, label: "Home" });
  });
});

describe("parseForecast", () => {
  it("turns a payload into one record per day", () => {
    const rows = parseForecast(forecastPayload(5), HERE);
    expect(rows.length).toBe(5);
    expect(rows[0].date).toBe("2026-07-01");
    expect(rows[0].tempMax).toBe(20);
    expect(rows[0].daylightMinutes).toBe(980);
    expect(rows[0].coords).toEqual({ lat: 51.51, lon: -0.13 });
  });

  it("averages the hourly humidity and pressure into a daily figure", () => {
    const rows = parseForecast(forecastPayload(3), HERE);
    expect(rows[1].humidityMean).toBe(45);
    expect(rows[1].pressureMean).toBe(1006);
  });

  it("fills in the pressure change against the day before, and only that day", () => {
    const rows = parseForecast(forecastPayload(3), HERE);
    expect(rows[0].pressureChange).toBeUndefined(); // nothing before it
    expect(rows[1].pressureChange).toBe(-4);
    expect(rows[2].pressureChange).toBe(-4);
  });

  it("never computes a change across a gap in the history", () => {
    const rows = withPressureChange([
      { date: "2026-07-01", coords: HERE, capturedAt: "x", pressureMean: 1010, source: "t" },
      { date: "2026-07-09", coords: HERE, capturedAt: "x", pressureMean: 980, source: "t" },
    ]);
    expect(rows[1].pressureChange).toBeUndefined();
  });

  it("returns nothing rather than throwing on a payload it doesn't recognise", () => {
    expect(parseForecast({}, HERE)).toEqual([]);
    expect(parseForecast(null, HERE)).toEqual([]);
  });
});

describe("mergeAir", () => {
  it("folds air quality into days that already exist", () => {
    const rows = mergeAir(parseForecast(forecastPayload(3), HERE), airPayload(3));
    expect(rows[0].pm25).toBe(12);
    expect(rows[0].aqi).toBe(48);
    expect(rows[0].pollenGrass).toBe(65);
    expect(rows[0].pollenTree).toBe(9); // the higher of birch and alder
  });

  it("never invents a day of its own", () => {
    expect(mergeAir([], airPayload(3))).toEqual([]);
  });

  it("leaves the weather intact when the air payload is missing", () => {
    const weather = parseForecast(forecastPayload(2), HERE);
    expect(mergeAir(weather, {})).toEqual(weather);
  });
});

describe("fetchContext", () => {
  const ok = (json: any) => ({ ok: true, json: async () => json });

  it("makes exactly two requests and merges them", async () => {
    const urls: string[] = [];
    const res = await fetchContext(HERE, 3, async (url) => {
      urls.push(url);
      return ok(url.includes("air-quality") ? airPayload(3) : forecastPayload(3));
    });
    expect(urls.length).toBe(2);
    expect(res.rows.length).toBe(3);
    expect(res.rows[0].pm25).toBe(12);
    expect(res.error).toBeUndefined();
  });

  it("keeps the weather when air quality isn't covered where you are", async () => {
    const res = await fetchContext(HERE, 3, async (url) =>
      url.includes("air-quality") ? { ok: false, json: async () => ({}) } : ok(forecastPayload(3))
    );
    expect(res.rows.length).toBe(3);
    expect(res.rows[0].tempMax).toBe(20);
    expect(res.rows[0].pm25).toBeUndefined();
  });

  it("reports a failure in plain words rather than throwing", async () => {
    const res = await fetchContext(HERE, 3, async () => {
      throw new Error("offline");
    });
    expect(res.rows).toEqual([]);
    expect(res.error).toMatch(/couldn't reach/i);
  });
});

describe("mergeContexts", () => {
  const base = parseForecast(forecastPayload(3), HERE);

  it("keeps days that have scrolled out of the fetch window", () => {
    const old = [{ ...base[0], date: "2026-01-01" }];
    const merged = mergeContexts(old, base);
    expect(merged.find((c) => c.date === "2026-01-01")).toBeTruthy();
    expect(merged.length).toBe(4);
  });

  it("never lets a thinner retry erase a fuller record", () => {
    const full = mergeAir(base, airPayload(3));
    const merged = mergeContexts(full, base); // second fetch had no air data
    expect(merged[0].pm25).toBe(12);
  });
});

describe("needsRefresh", () => {
  const fresh = { ...parseForecast(forecastPayload(1), HERE)[0], capturedAt: new Date().toISOString() };

  it("always fetches a day it has never seen", () => {
    expect(needsRefresh(undefined, "2026-07-01", "2026-07-01")).toBe(true);
  });

  it("leaves a settled past day alone", () => {
    expect(needsRefresh(fresh, "2026-06-01", "2026-07-05")).toBe(false);
  });

  it("refreshes today once the forecast has had time to become a measurement", () => {
    const stale = { ...fresh, capturedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString() };
    expect(needsRefresh(fresh, "2026-07-01", "2026-07-01")).toBe(false);
    expect(needsRefresh(stale, "2026-07-01", "2026-07-01")).toBe(true);
  });
});

describe("sanitizeContexts", () => {
  it("drops rows without a date or coordinates, and repairs out-of-range values", () => {
    expect(sanitizeContexts([{ date: "nope", coords: HERE }])).toEqual([]);
    expect(sanitizeContexts([{ date: "2026-07-01" }])).toEqual([]);
    const [row] = sanitizeContexts([
      { date: "2026-07-01", coords: HERE, tempMax: 900, humidityMean: -20, aqi: 99999, source: "t" },
    ]);
    expect(row.tempMax).toBe(60);
    expect(row.humidityMean).toBe(0);
    expect(row.aqi).toBe(600);
  });

  it("keeps one record per date", () => {
    const rows = sanitizeContexts([
      { date: "2026-07-01", coords: HERE, tempMax: 20 },
      { date: "2026-07-01", coords: HERE, tempMax: 25 },
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0].tempMax).toBe(25);
  });
});

describe("display", () => {
  it("converts for display only, and stores metric", () => {
    expect(formatTemp(20)).toBe("20°C");
    expect(formatTemp(20, "imperial")).toBe("68°F");
    expect(formatTemp(undefined)).toBe("—");
  });

  it("says pressure as a direction, not a level, and stays quiet when it barely moved", () => {
    expect(pressureLabel(-9)).toBe("Pressure fell 9 hPa");
    expect(pressureLabel(6)).toBe("Pressure rose 6 hPa");
    expect(pressureLabel(1)).toBe("Pressure steady");
    expect(pressureLabel(undefined)).toBe("");
  });

  it("has one small vocabulary of skies", () => {
    expect(skyKind(0)).toBe("clear");
    expect(skyKind(3)).toBe("cloudy");
    expect(skyKind(63)).toBe("rain");
    expect(skyKind(85)).toBe("snow");
    expect(skyKind(96)).toBe("storm");
    expect(skyKind(undefined)).toBeUndefined();
    expect(weatherLabel(undefined)).toBe("");
  });

  it("bands air and pollen, and returns nothing when there is nothing to band", () => {
    expect(airBand(30)).toBe("good");
    expect(airBand(160)).toBe("poor");
    expect(airBand(undefined)).toBeUndefined();
    expect(pollenBand(0)).toBe("none");
    expect(pollenBand(65)).toBe("high");
    expect(pollenBand(undefined)).toBeUndefined();
  });

  it("takes the highest of the three pollen counts, and undefined when none is known", () => {
    expect(pollenPeak({ date: "x", coords: HERE, capturedAt: "x", source: "t", pollenGrass: 5, pollenTree: 40 })).toBe(40);
    expect(pollenPeak({ date: "x", coords: HERE, capturedAt: "x", source: "t" })).toBeUndefined();
  });

  it("writes a timeline line that stays quiet about a steady day", () => {
    const rows = mergeAir(parseForecast(forecastPayload(3), HERE), airPayload(3));
    expect(contextLine(rows[1])).toBe("21°C · Overcast · Pressure fell 4 hPa");
    expect(contextLine(undefined)).toBe("");
  });
});

describe("CONTEXT_METRICS", () => {
  const rows = mergeAir(parseForecast(forecastPayload(3), HERE), airPayload(3));

  it("is null on days with no record, so a chart draws a gap not a zero", () => {
    const temp = CONTEXT_METRICS.find((m) => m.k === "env_temp_max")!;
    expect(temp.value({ context: rows, date: "2026-07-01" })).toBe(20);
    expect(temp.value({ context: rows, date: "2026-08-01" })).toBeNull();
  });

  it("offers pollen as the peak of the three", () => {
    const pollen = CONTEXT_METRICS.find((m) => m.k === "env_pollen")!;
    expect(pollen.value({ context: rows, date: "2026-07-01" })).toBe(65);
  });
});

/* ---------- observations ---------- */

/** n days where the outcome tracks temperature, so an observation should fire. */
const hotJournal = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    date: `2026-0${Math.floor(i / 28) + 6}-${String((i % 28) + 1).padStart(2, "0")}`,
    answers: { itch: i % 2 === 0 ? 8 : 3 },
  }));

const hotContexts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    date: `2026-0${Math.floor(i / 28) + 6}-${String((i % 28) + 1).padStart(2, "0")}`,
    coords: { lat: 51.51, lon: -0.13 },
    capturedAt: "2026-07-01T00:00:00Z",
    tempMax: i % 2 === 0 ? 30 : 18,
    source: "test",
  }));

const TEMP = {
  key: "env_temp_max",
  label: "high temperature",
  unit: "°C",
  get: (c: any) => c.tempMax,
};

describe("observations", () => {
  it("says nothing at all below the floor, however clean the pattern is", () => {
    const n = MIN_CONTEXT_DAYS - 1;
    expect(hardDayObservation(hotJournal(n), hotContexts(n), "itch", "sym", TEMP)).toBeNull();
    expect(bandObservation(hotJournal(n), hotContexts(n), "itch", "Itch", TEMP)).toBeNull();
  });

  it("counts hard days rather than reporting a coefficient", () => {
    const obs = hardDayObservation(hotJournal(40), hotContexts(40), "itch", "sym", TEMP);
    expect(obs).not.toBeNull();
    expect(obs!.headline).toMatch(/^\d+ of your \d+ hardest days /);
    expect(obs!.dates.length).toBeGreaterThan(0);
    expect(obs!.observed).toBe(40);
  });

  it("hands back the exact days it is about, so they can be lit up elsewhere", () => {
    const obs = hardDayObservation(hotJournal(40), hotContexts(40), "itch", "sym", TEMP)!;
    const hot = new Set(hotContexts(40).filter((c) => c.tempMax === 30).map((c) => c.date));
    expect(obs.dates.every((d) => hot.has(d))).toBe(true);
  });

  it("stays quiet when the hardest days fall on both sides of the line", () => {
    const entries = Array.from({ length: 40 }, (_, i) => ({
      date: `2026-06-${String((i % 28) + 1).padStart(2, "0")}`,
      answers: { itch: (i * 7) % 10 },
    }));
    const ctx = hotContexts(40).map((c, i) => ({ ...c, tempMax: (i * 13) % 30 }));
    const obs = hardDayObservation(entries, ctx, "itch", "sym", TEMP);
    if (obs) expect(obs.dates.length / 12).toBeGreaterThanOrEqual(0.67);
  });

  it("knows which end is the hard end for a positive metric", () => {
    const entries = hotJournal(40).map((e) => ({ ...e, answers: { energy: e.answers.itch } }));
    const obs = hardDayObservation(entries, hotContexts(40), "energy", "pos", TEMP)!;
    /* Higher energy is better, so the hardest days are the low-energy ones —
       which here are the cool days. */
    const cool = new Set(hotContexts(40).filter((c) => c.tempMax === 18).map((c) => c.date));
    expect(obs.dates.every((d) => cool.has(d))).toBe(true);
  });

  it("will not report a difference too small to feel", () => {
    const entries = Array.from({ length: 40 }, (_, i) => ({
      date: `2026-06-${String((i % 28) + 1).padStart(2, "0")}`,
      answers: { itch: 5 + (i % 2) * 0.2 },
    }));
    expect(bandObservation(entries, hotContexts(40), "itch", "Itch", TEMP)).toBeNull();
  });

  it("prints in the person's own units", () => {
    const obs = hardDayObservation(hotJournal(40), hotContexts(40), "itch", "sym", { ...TEMP, units: "imperial" })!;
    expect(obs.headline).toContain("°F");
  });

  it("never speaks causally, and always prints the count it is based on", () => {
    const all = contextObservations(hotJournal(40), hotContexts(40), { key: "itch", label: "Itch", dir: "sym" });
    expect(all.length).toBeGreaterThan(0);
    expect(causalLanguageAudit(all)).toEqual([]);
    for (const o of all) {
      expect(o.detail).toMatch(/\d+ days/);
      expect(o.detail.toLowerCase()).toMatch(/coincidence|not an effect/);
    }
  });

  it("caps how many coincidences it will show at once", () => {
    const all = contextObservations(hotJournal(60), hotContexts(60), { key: "itch", label: "Itch", dir: "sym" }, "metric", 2);
    expect(all.length).toBeLessThanOrEqual(2);
  });

  it("returns nothing with no context at all", () => {
    expect(contextObservations(hotJournal(40), [], { key: "itch", label: "Itch", dir: "sym" })).toEqual([]);
  });
});
