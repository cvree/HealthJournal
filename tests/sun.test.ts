/* Sun sessions: the arithmetic of being outside, and the two guarantees that
   make it safe to ship — a session is a snapshot that history cannot rewrite,
   and the app never rewards a burn. */
import { describe, it, expect } from "vitest";
import { causalLanguageAudit } from "../src/lib/validate";
import {
  addSample, burnState, finishSession, firstLightAfterWaking, manualSession,
  readout, sanitizeSunProfile, sanitizeSunSessions, sessionSummary, startSession,
  sunDay, sunDayLabel, SUN_METRICS, sunTotals, uvAt,
} from "../src/lib/sun";

const LONDON = { lat: 51.5, lon: -0.13 };
/* Solar noon in London on the longest day, under TZ=UTC. */
const NOON = new Date(2026, 5, 21, 12, 0, 0);
const at = (mins: number) => new Date(NOON.getTime() + mins * 60000);

/** A session run for `mins` minutes from solar noon, sampled every minute. */
function runFor(mins: number, opts: Parameters<typeof startSession>[1] = {}) {
  let live = startSession(NOON, { coords: LONDON, skin: 2, exposure: "arms", ...opts });
  for (let t = 0; t <= mins; t += 1) live = addSample(live, at(t));
  return live;
}

describe("uvAt", () => {
  it("models a clear-sky value from the sun's position when nothing better exists", () => {
    const r = uvAt(NOON, { coords: LONDON });
    expect(r.source).toBe("modelled");
    expect(r.uv).toBeGreaterThan(6);
    expect(r.elevation).toBeGreaterThan(60);
  });

  it("prefers a forecast value, and still moves it across the hour", () => {
    const live = { coords: LONDON, forecastUV: 7 };
    const noon = uvAt(NOON, live);
    const evening = uvAt(new Date(2026, 5, 21, 18, 30, 0), { ...live, forecastUV: 7 });
    expect(noon.source).toBe("forecast");
    // The same forecast number, read at two different sun heights, is not the
    // same UV — the sun has moved even if the hour's forecast has not.
    expect(evening.uv).toBeLessThan(noon.uv);
  });

  it("reports no UV at all rather than guessing when there is no location", () => {
    const r = uvAt(NOON, { coords: null });
    expect(r.source).toBe("none");
    expect(r.uv).toBe(0);
  });
});

describe("addSample", () => {
  it("keeps one sample per minute and never doubles a tick", () => {
    let live = startSession(NOON, { coords: LONDON });
    live = addSample(live, at(0));
    live = addSample(live, at(0));
    live = addSample(live, new Date(NOON.getTime() + 20_000)); // same minute
    expect(live.samples.length).toBe(1);
    live = addSample(live, at(1));
    expect(live.samples.length).toBe(2);
  });
});

describe("readout", () => {
  it("integrates the dose over the samples rather than multiplying the current UV", () => {
    /* A session running from noon into the evening: the last UV is much lower
       than the first, so UV-now × duration would badly understate the dose. */
    let live = startSession(new Date(2026, 5, 21, 15, 0, 0), { coords: LONDON, skin: 2, exposure: "arms" });
    for (let t = 0; t <= 240; t += 5) live = addSample(live, new Date(live.startedAt + t * 60000));
    const end = new Date(live.startedAt + 240 * 60000);
    const r = readout(live, end);
    const naive = (r.uv * 25 * 240 * 60) / 100000;
    expect(r.sed).toBeGreaterThan(naive * 1.5);
  });

  it("counts only the minutes that had usable UVB toward vitamin D", () => {
    const evening = startSession(new Date(2026, 5, 21, 19, 30, 0), { coords: LONDON, skin: 2, exposure: "arms" });
    let live = evening;
    for (let t = 0; t <= 40; t += 1) live = addSample(live, new Date(live.startedAt + t * 60000));
    const r = readout(live, new Date(live.startedAt + 40 * 60000));
    expect(r.vitaminDMinutes).toBe(0);
    expect(r.estimate.belowThreshold).toBe(true);
  });

  it("counts down to a burn and reaches zero rather than going negative", () => {
    const live = runFor(20, { skin: 1, exposure: "swim" });
    const early = readout(live, at(20));
    expect(early.burnMinutesLeft).not.toBeNull();
    const long = runFor(300, { skin: 1, exposure: "swim" });
    const late = readout(long, at(300));
    expect(late.burnMinutesLeft).toBe(0);
    expect(late.burnProgress).toBeGreaterThan(1);
  });

  it("works with no samples at all — a session that has only just started", () => {
    const live = startSession(NOON, { coords: LONDON, skin: 2, exposure: "arms" });
    const r = readout(live, NOON);
    expect(r.minutes).toBe(0);
    expect(r.sed).toBe(0);
    expect(Number.isFinite(r.estimate.iu)).toBe(true);
  });
});

describe("burnState", () => {
  it("climbs through four levels and turns the language over at one MED", () => {
    expect(burnState(0.1, 90).level).toBe("none");
    expect(burnState(0.35, 40).level).toBe("building");
    expect(burnState(0.7, 12).level).toBe("caution");
    expect(burnState(1.2, 0).level).toBe("over");
  });

  it("says the plateau out loud before the burn, not after it", () => {
    expect(burnState(0.7, 12).detail).toMatch(/plateau/i);
  });

  it("never speaks in medical or causal terms", () => {
    expect(causalLanguageAudit([0.1, 0.4, 0.7, 1.3].map((f) => burnState(f, 10)))).toEqual([]);
  });
});

describe("finishSession", () => {
  it("snapshots the conditions onto the record, so later edits cannot rewrite it", () => {
    const live = runFor(30, { skin: 2, exposure: "shorts", spf: 30 });
    const s = finishSession(live, at(30), "2026-06-21");
    expect(s.skin).toBe(2);
    expect(s.exposure).toBe("shorts");
    expect(s.spf).toBe(30);
    expect(s.source).toBe("live");
    expect(s.date).toBe("2026-06-21");
    expect(s.minutes).toBe(30);
  });

  it("lets the finish screen correct what was worn, because that is when people say", () => {
    const live = runFor(30, { exposure: "face" });
    const corrected = finishSession(live, at(30), "2026-06-21", { exposure: "swim" });
    const asStarted = finishSession(live, at(30), "2026-06-21");
    expect(corrected.exposure).toBe("swim");
    expect(corrected.iu).toBeGreaterThan(asStarted.iu);
  });

  it("stores the estimate as a range and keeps the dose separate from it", () => {
    const s = finishSession(runFor(25, { exposure: "shorts" }), at(25), "2026-06-21");
    expect(s.iuLow).toBeLessThan(s.iu);
    expect(s.iuHigh).toBeGreaterThan(s.iu);
    expect(s.sed).toBeGreaterThan(0);
    expect(s.medFraction).toBeGreaterThan(0);
  });

  it("keeps the day the caller names, even for a session that runs past midnight", () => {
    const late = startSession(new Date(2026, 5, 21, 23, 50, 0), { coords: LONDON });
    const s = finishSession(late, new Date(2026, 5, 22, 0, 20, 0), "2026-06-21");
    expect(s.date).toBe("2026-06-21");
  });
});

describe("manualSession", () => {
  it("builds an honest modelled arc for a session typed in afterwards", () => {
    const s = manualSession({
      date: "2026-06-21",
      startISO: new Date(2026, 5, 21, 11, 0, 0).toISOString(),
      minutes: 60,
      coords: LONDON,
      exposure: "arms",
      shade: "open",
      skin: 3,
    });
    expect(s.source).toBe("manual");
    expect(s.uvSource).toBe("modelled");
    expect(s.minutes).toBe(60);
    expect(s.samples.length).toBeGreaterThan(3);
    expect(s.iu).toBeGreaterThan(0);
  });

  it("records minutes outside without inventing UV when there is no location", () => {
    const s = manualSession({
      date: "2026-06-21",
      startISO: new Date(2026, 5, 21, 11, 0, 0).toISOString(),
      minutes: 45,
      coords: null,
      exposure: "arms",
      shade: "open",
    });
    expect(s.uvSource).toBe("none");
    expect(s.minutes).toBe(45);
    expect(s.iu).toBe(0);
  });

  it("clamps a nonsense duration rather than storing it", () => {
    const s = manualSession({
      date: "2026-06-21",
      startISO: NOON.toISOString(),
      minutes: 100000,
      coords: LONDON,
      exposure: "arms",
      shade: "open",
    });
    expect(s.minutes).toBeLessThanOrEqual(16 * 60);
  });
});

describe("sanitizeSunSessions", () => {
  const good = finishSession(runFor(20), at(20), "2026-06-21");

  it("drops rows without a real date and de-duplicates ids", () => {
    expect(sanitizeSunSessions([{ ...good, date: "yesterday" }])).toEqual([]);
    expect(sanitizeSunSessions([good, good]).length).toBe(1);
    expect(sanitizeSunSessions("nonsense")).toEqual([]);
  });

  it("repairs out-of-range numbers from a hand-edited backup", () => {
    const [row] = sanitizeSunSessions([{ ...good, minutes: 99999, iu: -50, peakUV: 900, exposure: "cape" }]);
    expect(row.minutes).toBe(16 * 60);
    expect(row.iu).toBe(0);
    expect(row.peakUV).toBe(20);
    expect(row.exposure).toBe("arms"); // unknown value falls back rather than rendering blank
  });

  it("round-trips a real session unchanged", () => {
    const [row] = sanitizeSunSessions([good]);
    expect(row.minutes).toBe(good.minutes);
    expect(row.iu).toBe(good.iu);
    expect(row.exposure).toBe(good.exposure);
  });
});

describe("sunDay and totals", () => {
  const a = { ...finishSession(runFor(20), at(20), "2026-06-21"), start: at(0).toISOString() };
  const b = { ...finishSession(runFor(40), at(40), "2026-06-21"), start: at(300).toISOString() };
  const other = finishSession(runFor(10), at(10), "2026-06-22");

  it("adds a day up and knows which session came first", () => {
    const day = sunDay([b, a, other], "2026-06-21");
    expect(day.sessions).toBe(2);
    expect(day.minutes).toBe(60);
    expect(day.firstAt).toBe(a.start);
  });

  it("says nothing at all for a day with no sessions", () => {
    expect(sunDayLabel(sunDay([a], "2026-06-25"))).toBe("");
  });

  it("totals a window and averages only over the days that happened", () => {
    const t = sunTotals([a, b, other], ["2026-06-21", "2026-06-22", "2026-06-23"]);
    expect(t.days).toBe(2);
    expect(t.minutes).toBe(70);
    expect(t.avgMinutes).toBe(35);
  });

  it("summarises a session without ever calling the estimate a measurement", () => {
    const line = sessionSummary(a);
    expect(line).toContain("min");
    expect(line).toContain("~");
    expect(causalLanguageAudit(line)).toEqual([]);
  });
});

describe("firstLightAfterWaking", () => {
  const morning = {
    ...finishSession(runFor(15), at(15), "2026-06-21"),
    start: new Date(2026, 5, 21, 7, 30, 0).toISOString(),
  };

  it("measures from the person's own waking time", () => {
    expect(firstLightAfterWaking(sunDay([morning], "2026-06-21"), "06:30")).toBe(60);
  });

  it("is null without a waking time, and null when the maths would be silly", () => {
    const day = sunDay([morning], "2026-06-21");
    expect(firstLightAfterWaking(day, undefined)).toBeNull();
    expect(firstLightAfterWaking(day, "09:00")).toBeNull(); // outside before waking
    expect(firstLightAfterWaking(sunDay([], "2026-06-21"), "06:30")).toBeNull();
  });
});

describe("SUN_METRICS", () => {
  const s = finishSession(runFor(35), at(35), "2026-06-21");

  it("is null on days with no session, so a chart shows a gap not a zero", () => {
    for (const m of SUN_METRICS) expect(m.value({ sun: [s], date: "2026-06-22" })).toBeNull();
  });

  it("produces a number on days that had one", () => {
    const minutes = SUN_METRICS.find((m) => m.k === "sun_minutes")!;
    expect(minutes.value({ sun: [s], date: "2026-06-21" })).toBe(35);
  });

  it("reports first light as an hour of the day, so mornings are comparable", () => {
    const first = SUN_METRICS.find((m) => m.k === "sun_first_hour")!;
    const early = { ...s, start: new Date(2026, 5, 21, 7, 30, 0).toISOString() };
    expect(first.value({ sun: [early], date: "2026-06-21" })).toBe(7.5);
  });
});

describe("sanitizeSunProfile", () => {
  it("keeps only values it recognises, and returns nothing for an empty one", () => {
    expect(sanitizeSunProfile({ skin: 4, exposure: "shorts", wake: "07:00" })).toEqual({
      skin: 4, exposure: "shorts", wake: "07:00",
    });
    expect(sanitizeSunProfile({ skin: 99, exposure: "cape", wake: "morning" })).toBeUndefined();
    expect(sanitizeSunProfile(null)).toBeUndefined();
  });
});
