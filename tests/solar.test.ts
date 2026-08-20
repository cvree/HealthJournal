/* The astronomy, checked against places and dates anybody can look up, and the
   vitamin D model, checked against the thing it must never become: a
   measurement. */
import { describe, it, expect } from "vitest";
import { causalLanguageAudit } from "../src/lib/validate";
import {
  clearSkyUV, clockLabel, comfortWindow, dayLight, daylightLabel, daySamples,
  durationLabel, estimateVitaminD, EXPOSURE_LEVELS, minutesAfterWaking,
  minutesToBurn, morningLightWindow, nextVitaminDWindow, sedFrom, shadowRuleMet,
  SKIN_TYPES, skinTypeInfo, solarPosition, stopwatchLabel, uvBand, uvbFraction,
  vitaminDRangeLabel, vitaminDWindow,
} from "../src/lib/solar";

const LONDON = { lat: 51.5, lon: -0.13 };
const NYC = { lat: 40.71, lon: -74.0 };
const TROMSO = { lat: 69.65, lon: 18.95 };
const SINGAPORE = { lat: 1.35, lon: 103.82 };

/* The suite runs under TZ=UTC (see vite.config.ts), so a Date built from local
   parts is a UTC one and the times below are UTC. */
const localNoon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);
const hhmm = (d: Date | null) =>
  d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : null;

describe("dayLight", () => {
  it("puts London's midsummer sunrise and sunset where the almanac does", () => {
    const l = dayLight(localNoon(2026, 6, 21), LONDON);
    expect(hhmm(l.sunrise)).toBe("03:44"); // 04:44 BST
    expect(hhmm(l.sunset)).toBe("20:22"); // 21:22 BST
    expect(l.daylightMinutes).toBeGreaterThan(16 * 60);
    expect(l.daylightMinutes).toBeLessThan(17 * 60);
  });

  it("puts New York's shortest day where the almanac does", () => {
    const l = dayLight(localNoon(2026, 12, 21), NYC);
    expect(hhmm(l.sunrise)).toBe("12:17"); // 07:17 EST
    expect(hhmm(l.sunset)).toBe("21:32"); // 16:32 EST
    expect(l.daylightMinutes).toBeGreaterThan(9 * 60);
    expect(l.daylightMinutes).toBeLessThan(9.5 * 60);
  });

  it("survives polar night rather than printing NaN o'clock", () => {
    const dark = dayLight(localNoon(2026, 12, 21), TROMSO);
    expect(dark.polar).toBe(true);
    expect(dark.sunrise).toBeNull();
    expect(dark.sunset).toBeNull();
    expect(dark.daylightMinutes).toBe(0);
  });

  it("survives polar day too, and calls it 24 hours", () => {
    const light = dayLight(localNoon(2026, 6, 21), TROMSO);
    expect(light.polar).toBe(true);
    expect(light.daylightMinutes).toBe(1440);
    expect(light.peakElevation).toBeGreaterThan(0);
  });

  it("peaks near overhead on the equator at an equinox", () => {
    const l = dayLight(localNoon(2026, 3, 20), SINGAPORE);
    expect(l.peakElevation).toBeGreaterThan(85);
  });

  it("anchors on the local day even when asked late at night", () => {
    const lateEvening = new Date(2026, 5, 21, 23, 50, 0);
    const noon = localNoon(2026, 6, 21);
    expect(hhmm(dayLight(lateEvening, LONDON).sunrise)).toBe(hhmm(dayLight(noon, LONDON).sunrise));
  });
});

describe("solarPosition", () => {
  it("puts the midsummer London sun due south and 62° up at solar noon", () => {
    const pos = solarPosition(new Date(2026, 5, 21, 12, 3, 0), LONDON);
    expect(pos.elevation).toBeGreaterThan(61);
    expect(pos.elevation).toBeLessThan(63);
    expect(pos.azimuth).toBeGreaterThan(175);
    expect(pos.azimuth).toBeLessThan(185);
  });

  it("puts the sun below the horizon at midnight", () => {
    expect(solarPosition(new Date(2026, 5, 21, 0, 30, 0), LONDON).elevation).toBeLessThan(0);
  });
});

describe("clearSkyUV", () => {
  it("tracks the published clear-sky curve", () => {
    expect(clearSkyUV(90)).toBeGreaterThan(11);
    expect(clearSkyUV(60)).toBeCloseTo(8.7, 0);
    expect(clearSkyUV(45)).toBeCloseTo(5.6, 0);
    expect(clearSkyUV(30)).toBeCloseTo(2.6, 0);
  });

  it("is exactly zero once the sun is down — no phantom dusk UV", () => {
    expect(clearSkyUV(0)).toBe(0);
    expect(clearSkyUV(-5)).toBe(0);
  });

  it("thins under cloud but never to nothing, because overcast still burns", () => {
    const clear = clearSkyUV(60);
    const overcast = clearSkyUV(60, { cloudCover: 100 });
    expect(overcast).toBeLessThan(clear * 0.3);
    expect(overcast).toBeGreaterThan(clear * 0.15);
    expect(clearSkyUV(60, { cloudCover: 20 })).toBeGreaterThan(clear * 0.9);
  });

  it("rises with altitude and falls with ozone", () => {
    expect(clearSkyUV(60, { altitudeM: 2000 })).toBeGreaterThan(clearSkyUV(60));
    expect(clearSkyUV(60, { ozoneDU: 400 })).toBeLessThan(clearSkyUV(60, { ozoneDU: 250 }));
  });

  it("bands the way the WHO does", () => {
    expect(uvBand(1)).toBe("low");
    expect(uvBand(4)).toBe("moderate");
    expect(uvBand(7)).toBe("high");
    expect(uvBand(9)).toBe("very-high");
    expect(uvBand(12)).toBe("extreme");
  });
});

describe("burn risk", () => {
  it("gives fair skin about twenty minutes at UV 8", () => {
    const m = minutesToBurn(8, 2);
    expect(m).not.toBeNull();
    expect(m!).toBeGreaterThan(12);
    expect(m!).toBeLessThan(30);
  });

  it("gives deeper skin longer at the same UV", () => {
    expect(minutesToBurn(8, 6)!).toBeGreaterThan(minutesToBurn(8, 1)!);
  });

  it("is null when the UV is too low to burn at all, rather than a big number", () => {
    expect(minutesToBurn(0.4, 1)).toBeNull();
    expect(minutesToBurn(0, 2)).toBeNull();
  });

  it("credits sunscreen at a fraction of its label, because nobody applies it properly", () => {
    const bare = minutesToBurn(8, 2)!;
    const spf30 = minutesToBurn(8, 2, { spf: 30 })!;
    expect(spf30).toBeGreaterThan(bare * 5);
    expect(spf30).toBeLessThan(bare * 30); // never the full label factor
  });

  it("counts a SED the way the standard does", () => {
    // 1 hour at UVI 1 = 0.9 SED
    expect(sedFrom(1, 60)).toBeCloseTo(0.9, 5);
  });
});

describe("estimateVitaminD", () => {
  it("lands in the published band for the reference case: fair skin, most of the body, one MED", () => {
    const est = estimateVitaminD({ uv: 9, elevation: 62, minutes: 20, skin: 2, exposure: "swim" });
    expect(est.iu).toBeGreaterThan(8000);
    expect(est.iu).toBeLessThan(20000);
  });

  it("gives a realistic twenty minutes in a t-shirt a four-figure estimate", () => {
    const est = estimateVitaminD({ uv: 6, elevation: 45, minutes: 20, skin: 3, exposure: "arms" });
    expect(est.iu).toBeGreaterThan(500);
    expect(est.iu).toBeLessThan(4000);
  });

  it("says 'very little' rather than a small number when the sun is too low", () => {
    const winter = estimateVitaminD({ uv: 2, elevation: 15, minutes: 40, skin: 2, exposure: "face" });
    expect(winter.belowThreshold).toBe(true);
    expect(vitaminDRangeLabel(winter)).toBe("Very little");
  });

  it("plateaus rather than rewarding a longer burn", () => {
    const base = { uv: 9, elevation: 62, skin: 2 as const, exposure: "swim" as const };
    const twenty = estimateVitaminD({ ...base, minutes: 20 }).iu;
    const eighty = estimateVitaminD({ ...base, minutes: 80 }).iu;
    expect(eighty).toBeGreaterThan(twenty);
    // Four times the exposure must not be anywhere near four times the estimate.
    expect(eighty).toBeLessThan(twenty * 2);
  });

  it("falls with more melanin, more clothing, more shade and more sunscreen", () => {
    const base = { uv: 8, elevation: 55, minutes: 30, skin: 2 as const, exposure: "shorts" as const };
    expect(estimateVitaminD({ ...base, skin: 6 }).iu).toBeLessThan(estimateVitaminD(base).iu);
    expect(estimateVitaminD({ ...base, exposure: "face" }).iu).toBeLessThan(estimateVitaminD(base).iu);
    expect(estimateVitaminD({ ...base, shade: "shade" }).iu).toBeLessThan(estimateVitaminD(base).iu);
    expect(estimateVitaminD({ ...base, spf: 50 }).iu).toBeLessThan(estimateVitaminD(base).iu);
  });

  it("only applies an age term when an age was actually given", () => {
    const base = { uv: 8, elevation: 55, minutes: 30, skin: 2 as const, exposure: "arms" as const };
    // No age supplied behaves as the model's reference age, not as a young
    // person — the term only starts biting past 20.
    expect(estimateVitaminD({ ...base, age: 20 }).iu).toBe(estimateVitaminD(base).iu);
    expect(estimateVitaminD({ ...base, age: 45 }).iu).toBeLessThan(estimateVitaminD(base).iu);
    expect(estimateVitaminD({ ...base, age: 75 }).iu).toBeLessThan(estimateVitaminD({ ...base, age: 45 }).iu);
  });

  it("is always a range, never a point, and always carries its assumptions", () => {
    const est = estimateVitaminD({ uv: 7, elevation: 50, minutes: 25, skin: 3, exposure: "arms", spf: 30 });
    expect(est.low).toBeLessThan(est.iu);
    expect(est.high).toBeGreaterThan(est.iu);
    expect(vitaminDRangeLabel(est)).toMatch(/^~[\d,]+–[\d,]+ IU$/);
    const labels = est.assumptions.map((a) => a.label);
    expect(labels).toContain("Skin");
    expect(labels).toContain("Skin exposed");
    expect(labels).toContain("Sunscreen");
    expect(labels).toContain("Usable UVB at that height");
  });

  it("never says anything causal or diagnostic", () => {
    const est = estimateVitaminD({ uv: 9, elevation: 60, minutes: 30, skin: 2, exposure: "swim", age: 40 });
    expect(causalLanguageAudit(est)).toEqual([]);
    expect(causalLanguageAudit(SKIN_TYPES)).toEqual([]);
    expect(causalLanguageAudit(EXPOSURE_LEVELS)).toEqual([]);
  });
});

describe("uvbFraction and the shadow rule", () => {
  it("is nothing below 10°, and rises through the band people are told about", () => {
    expect(uvbFraction(5)).toBe(0);
    expect(uvbFraction(10)).toBe(0);
    expect(uvbFraction(30)).toBeGreaterThan(0);
    expect(uvbFraction(45)).toBeGreaterThan(uvbFraction(30));
    expect(uvbFraction(60)).toBeGreaterThan(uvbFraction(45));
  });

  it("agrees with the rule people already know", () => {
    expect(shadowRuleMet(50)).toBe(true);
    expect(shadowRuleMet(40)).toBe(false);
  });
});

describe("windows", () => {
  it("finds a summer vitamin D window in London and none in December", () => {
    const june = vitaminDWindow(localNoon(2026, 6, 21), LONDON);
    expect(june).not.toBeNull();
    expect(june!.minutes).toBeGreaterThan(120);
    expect(vitaminDWindow(localNoon(2026, 12, 21), LONDON)).toBeNull();
  });

  it("clips a window that has already started to the remaining time", () => {
    const now = new Date(2026, 5, 21, 13, 0, 0);
    const w = nextVitaminDWindow(now, LONDON);
    expect(w).not.toBeNull();
    expect(w!.start.getTime()).toBe(now.getTime());
  });

  it("looks ahead when today's window has closed", () => {
    const evening = new Date(2026, 5, 21, 21, 30, 0);
    const w = nextVitaminDWindow(evening, LONDON);
    expect(w).not.toBeNull();
    expect(w!.start.getDate()).toBe(22);
  });

  it("returns nothing at all in a British January rather than inventing one", () => {
    expect(nextVitaminDWindow(new Date(2026, 0, 10, 9, 0, 0), LONDON, 7)).toBeNull();
  });

  it("offers a morning-light window that is not a vitamin D window", () => {
    const m = morningLightWindow(localNoon(2026, 6, 21), LONDON);
    expect(m).not.toBeNull();
    expect(m!.peakElevation).toBeLessThan(45);
  });

  it("finds a gentler comfort window than the vitamin D one", () => {
    const c = comfortWindow(localNoon(2026, 6, 21), LONDON);
    expect(c).not.toBeNull();
    expect(c!.peakUV).toBeLessThan(6);
  });
});

describe("daySamples", () => {
  it("walks a whole local day and peaks at solar noon", () => {
    const rows = daySamples(localNoon(2026, 6, 21), LONDON, 30);
    expect(rows.length).toBe(49);
    const peak = rows.reduce((a, b) => (b.elevation > a.elevation ? b : a));
    expect(peak.at.getHours()).toBe(12);
  });
});

describe("formatting", () => {
  it("says durations the way people do", () => {
    expect(durationLabel(45)).toBe("45 min");
    expect(durationLabel(60)).toBe("1h");
    expect(durationLabel(95)).toBe("1h 35m");
    expect(daylightLabel(998)).toBe("16h 38m");
  });

  it("runs a stopwatch that stays legible from across a garden", () => {
    expect(stopwatchLabel(0)).toBe("00:00");
    expect(stopwatchLabel(61_000)).toBe("01:01");
    expect(stopwatchLabel(3_661_000)).toBe("1:01:01");
  });

  it("prints an em dash rather than 'Invalid Date' for a missing time", () => {
    expect(clockLabel(null)).toBe("—");
  });
});

describe("minutesAfterWaking", () => {
  it("is null without a waking time, and null for a nonsense gap", () => {
    const at = new Date(2026, 5, 21, 9, 0, 0);
    expect(minutesAfterWaking(null, at)).toBeNull();
    expect(minutesAfterWaking(new Date(2026, 5, 21, 10, 0, 0), at)).toBeNull(); // before waking
    expect(minutesAfterWaking(new Date(2026, 5, 21, 7, 30, 0), at)).toBe(90);
  });
});

describe("skinTypeInfo", () => {
  it("falls back to a middle type rather than throwing on an unset one", () => {
    expect(skinTypeInfo(undefined).type).toBe(3);
  });
});
