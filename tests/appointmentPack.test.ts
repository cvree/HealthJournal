/* The Appointment Pack's arithmetic.

   This is the module whose output somebody hands to a clinician, so the tests
   that matter most are the ones about *refusing* to print: a change with a
   thin window behind it, a coverage figure that flatters, an adherence
   percentage for doses nobody was ever asked to take. Clock-free — every case
   passes its own "today". */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_PACK_SECTIONS, MIN_CHANGE_DAYS, PACK_SECTIONS,
  buildAppointmentPack, buildChanges, buildLabs, buildRoutine, buildSun,
  candidateNotes, SUN_ESTIMATE_NOTE,
  changeLabel, coverageLabel, estimateBlocks, pageEstimate,
  previousWindow, rangeCustom, rangeOfDays, rangeSinceAppointment,
  sanitizePackPrefs, verdictFor,
  type PackEntry, type PackInput, type PackMetric,
} from "../src/lib/appointmentPack";
import { datesBetween, type HealthEpisode } from "../src/lib/episodes";
import type { RoutineItem, RoutineLog } from "../src/types/models";

const TODAY = "2026-08-18";
const ITCH: PackMetric = { key: "itch", label: "Itch", dir: "sym", scale: true };

/** A journal where `key` holds `v` on every listed date. */
const journal = (rows: Record<string, number>, key = "itch"): PackEntry[] =>
  Object.entries(rows).map(([date, v]) => ({ date, answers: { [key]: v } }));

const flat = (a: string, b: string, v: number) =>
  Object.fromEntries(datesBetween(a, b).map((d) => [d, v]));

const input = (over: Partial<PackInput> = {}): PackInput => ({
  today: TODAY,
  range: rangeOfDays(30, TODAY),
  entries: [],
  primary: ITCH,
  metrics: [ITCH],
  ...over,
});

describe("the range", () => {
  it("counts the last n days inclusively, ending today", () => {
    const r = rangeOfDays(30, TODAY);
    expect(r).toMatchObject({ start: "2026-07-20", end: TODAY, days: 30, source: "days" });
  });

  it("keeps the appointment day itself — it is the visit both sides remember", () => {
    const r = rangeSinceAppointment("2026-06-01", TODAY);
    expect(r.start).toBe("2026-06-01");
    expect(r.days).toBe(79);
    expect(r.source).toBe("appointment");
  });

  it("puts custom dates the right way round however they arrive", () => {
    expect(rangeCustom("2026-08-01", "2026-07-01")).toMatchObject({ start: "2026-07-01", end: "2026-08-01" });
  });

  it("compares against the same number of days immediately before", () => {
    const prev = previousWindow(rangeOfDays(30, TODAY));
    expect(prev).toEqual({ start: "2026-06-20", end: "2026-07-19", days: 30 });
  });
});

describe("how it's been", () => {
  it("prints the average with the coverage it rests on", () => {
    const pack = buildAppointmentPack(input({
      entries: journal(flat("2026-07-20", "2026-08-08", 6)), // 20 of the 30 days
    }));
    expect(pack.headline!.average).toBe(6);
    expect(pack.headline!.loggedDays).toBe(20);
    expect(pack.headline!.rangeDays).toBe(30);
    expect(coverageLabel(20, 30)).toBe("20 of 30 days (67%)");
  });

  it("refuses a change when the previous window is too thin to compare", () => {
    const pack = buildAppointmentPack(input({
      entries: journal({ ...flat("2026-07-20", TODAY, 4), "2026-07-18": 8, "2026-07-19": 8 }),
    }));
    expect(pack.headline!.previousAverage).toBeNull();
    expect(pack.headline!.change).toBeNull();
    expect(pack.omitted.some((o) => o.key === "summary")).toBe(true);
    expect(changeLabel(null)).toBe("not enough to compare");
  });

  it("names the direction by the metric, not by the sign", () => {
    const better = buildAppointmentPack(input({
      entries: journal({ ...flat("2026-06-20", "2026-07-19", 8), ...flat("2026-07-20", TODAY, 4) }),
    }));
    expect(better.headline!.change).toBe(-4);
    expect(better.headline!.verdict).toBe("better"); // lower itch is better
    expect(verdictFor(-4, "pos")).toBe("worse");     // for "more is better", it isn't
    expect(verdictFor(-4, "neutral")).toBe("unknown");
    expect(changeLabel(-4)).toBe("−4");
  });

  it("counts days somebody showed up separately from days they rated", () => {
    const entries: PackEntry[] = [
      ...journal(flat("2026-08-01", "2026-08-10", 5)),
      { date: "2026-08-11", answers: {}, notes: "photo only" },
    ];
    const pack = buildAppointmentPack(input({ entries }));
    expect(pack.headline!.loggedDays).toBe(10);
    expect(pack.headline!.entryDays).toBe(11);
  });
});

describe("best, hardest, usual", () => {
  it("reports the three scores and the counts behind them", () => {
    const pack = buildAppointmentPack(input({
      entries: journal({
        ...flat("2026-08-01", "2026-08-10", 5),
        "2026-08-11": 9, "2026-08-12": 9, "2026-08-13": 2,
      }),
    }));
    expect(pack.scores).toMatchObject({ best: 2, hardest: 9, mostCommon: 5, mostCommonDays: 10, hardDays: 2 });
  });

  it("says nothing rather than zero when no day carries a rating", () => {
    const pack = buildAppointmentPack(input({ entries: [{ date: "2026-08-01", answers: {}, notes: "hi" }] }));
    expect(pack.scores).toBeNull();
    expect(pack.omitted.some((o) => o.key === "scores")).toBe(true);
  });
});

describe("flares", () => {
  const ep = (over: Partial<HealthEpisode> = {}): HealthEpisode => ({
    id: "e1", title: "Bad stretch", metric: "itch",
    start: "2026-08-01", end: "2026-08-10",
    createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  });

  it("counts only the flare days that fall inside the range", () => {
    const pack = buildAppointmentPack(input({
      range: rangeCustom("2026-08-05", "2026-08-18"),
      entries: journal(flat("2026-08-01", "2026-08-18", 7)),
      episodes: [ep()], // Aug 1–10: six of its days are in range
    }));
    expect(pack.flares!.count).toBe(1);
    expect(pack.flares!.flareDays).toBe(6);
    expect(pack.flares!.avgDuration).toBe(10); // the flare itself still ran ten days
  });

  it("reports average and peak severity, and which flare peaked", () => {
    const pack = buildAppointmentPack(input({
      entries: journal({ ...flat("2026-08-01", "2026-08-09", 6), "2026-08-10": 10 }),
      episodes: [ep()],
    }));
    expect(pack.flares!.avgSeverity).toBeCloseTo(6.4, 5);
    expect(pack.flares!.peakSeverity).toBe(10);
    expect(pack.flares!.peakDate).toBe("2026-08-10");
    expect(pack.flares!.longestDuration).toBe(10);
  });

  it("says a flare is still going rather than closing it silently", () => {
    const pack = buildAppointmentPack(input({
      entries: journal(flat("2026-08-10", TODAY, 8)),
      episodes: [ep({ start: "2026-08-10", end: null })],
    }));
    expect(pack.flares!.ongoing).toBe(1);
    expect(pack.flares!.items[0].open).toBe(true);
    expect(pack.flares!.items[0].days).toBe(9); // through today
  });

  it("omits the section, with a reason, when nothing was marked", () => {
    const pack = buildAppointmentPack(input({ entries: journal(flat("2026-08-01", TODAY, 5)) }));
    expect(pack.flares).toBeNull();
    expect(pack.omitted.find((o) => o.key === "flares")!.reason).toMatch(/No flares/);
  });
});

describe("the three biggest changes", () => {
  const metrics: PackMetric[] = [
    ITCH,
    { key: "sleep", label: "Sleep quality", dir: "pos", scale: true },
    { key: "steps", label: "Steps", dir: "pos", unit: "steps" },
    { key: "dryness", label: "Dryness", dir: "sym", scale: true },
  ];

  /** One metric across both windows: `before` over the previous 30 days,
      `after` over the range. */
  const both = (key: string, before: number, after: number): PackEntry[] => [
    ...journal(flat("2026-06-20", "2026-07-19", before), key),
    ...journal(flat("2026-07-20", TODAY, after), key),
  ];

  /** Several metrics folded onto the same days, as a real journal has them. */
  const merge = (...sets: PackEntry[][]): PackEntry[] => {
    const byDate = new Map<string, PackEntry>();
    for (const set of sets) {
      for (const e of set) {
        const cur = byDate.get(e.date) || { date: e.date, answers: {} };
        byDate.set(e.date, { ...cur, answers: { ...cur.answers, ...e.answers } });
      }
    }
    return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  };

  it("ranks by relative movement, so a step count can't drown a 1–10 rating", () => {
    const entries = merge(
      both("itch", 8, 8),
      both("sleep", 5, 8),          // +60%
      both("steps", 8000, 8600),    // +7.5%, but +600 raw
      both("dryness", 4, 3),        // −25%
    );
    const changes = buildChanges(input({ entries, metrics }));
    expect(changes.map((c) => c.key)).toEqual(["sleep", "dryness", "steps"]);
    expect(changes[0].verdict).toBe("better");
    expect(changes[2].delta).toBe(600);
  });

  it("never includes the primary metric — the headline already is it", () => {
    expect(buildChanges(input({ entries: both("itch", 8, 3), metrics })).map((c) => c.key)).toEqual([]);
  });

  it("drops a metric without enough days on both sides", () => {
    const entries = merge(
      both("sleep", 5, 8),
      journal(flat("2026-08-14", TODAY, 9), "dryness"), // this side only
    );
    const changes = buildChanges(input({ entries, metrics }));
    expect(changes.map((c) => c.key)).toEqual(["sleep"]);
    expect(MIN_CHANGE_DAYS).toBe(5);
  });

  it("ignores a metric that did not really move", () => {
    expect(buildChanges(input({ entries: both("sleep", 5, 5.02), metrics }))).toEqual([]);
  });
});

describe("routine adherence", () => {
  const item = (over: Partial<RoutineItem> = {}): RoutineItem => ({
    id: "i1", name: "Ointment", kind: "topical", times: ["morning", "evening"],
    daily: true, useCount: 0,
    createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  });
  const log = (date: string, over: Partial<RoutineLog> = {}): RoutineLog => ({
    id: `l_${date}_${over.slot || "x"}`, date, time: "08:00",
    itemId: "i1", name: "Ointment", kind: "topical", slot: "morning",
    createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z`,
    ...over,
  });

  it("counts a dose against the plan, and only from the day the item existed", () => {
    const routine = buildRoutine(input({
      range: rangeCustom("2026-07-28", "2026-08-03"), // three days before the item was added
      routineItems: [item()],
      routineLogs: [log("2026-08-01"), log("2026-08-02"), log("2026-08-02", { slot: "evening" })],
    }))!;
    expect(routine.planned).toBe(6); // Aug 1–3, two slots a day
    expect(routine.taken).toBe(3);
    expect(routine.adherence).toBeCloseTo(0.5, 5);
  });

  it("keeps a deliberate skip distinct from a day nobody said anything", () => {
    const routine = buildRoutine(input({
      range: rangeCustom("2026-08-01", "2026-08-01"),
      routineItems: [item()],
      routineLogs: [log("2026-08-01", { slot: "morning", skipped: true })],
    }))!;
    expect(routine.taken).toBe(0);
    expect(routine.skipped).toBe(1);
    expect(routine.planned).toBe(2);
  });

  it("counts an as-needed item without inventing an adherence for it", () => {
    const routine = buildRoutine(input({
      range: rangeCustom("2026-08-01", "2026-08-05"),
      routineItems: [item({ id: "i2", name: "Antihistamine", kind: "med", daily: false, times: [] })],
      routineLogs: [
        log("2026-08-01", { itemId: "i2", name: "Antihistamine", kind: "med", slot: undefined }),
        log("2026-08-04", { itemId: "i2", name: "Antihistamine", kind: "med", slot: undefined }),
      ],
    }))!;
    expect(routine.items[0]).toMatchObject({ name: "Antihistamine", asNeeded: true, taken: 2, adherence: null });
    expect(routine.planned).toBe(0);
  });

  it("says nothing at all when there is no routine", () => {
    expect(buildRoutine(input())).toBeNull();
  });
});

describe("notes and questions", () => {
  const entries: PackEntry[] = [
    { date: "2026-08-02", answers: { itch: 5 }, notes: "Worse after mowing." },
    { date: "2026-08-04", answers: { itch: 4 }, notes: "  " },
    { date: "2026-08-06", answers: { itch: 7 }, notes: "New cream stung." },
  ];

  it("offers every note in the range, newest first, and picks none of them itself", () => {
    const notes = candidateNotes(entries, rangeCustom("2026-08-01", "2026-08-10"));
    expect(notes.map((n) => n.date)).toEqual(["2026-08-06", "2026-08-02"]);
    const pack = buildAppointmentPack(input({ range: rangeCustom("2026-08-01", "2026-08-10"), entries }));
    expect(pack.notes).toEqual([]);
    expect(pack.omitted.some((o) => o.key === "notes")).toBe(true);
  });

  it("prints exactly the notes that were ticked", () => {
    const pack = buildAppointmentPack(input({
      range: rangeCustom("2026-08-01", "2026-08-10"), entries, noteDates: ["2026-08-02"],
    }));
    expect(pack.notes).toEqual([{ date: "2026-08-02", text: "Worse after mowing." }]);
  });

  it("carries the questions through, trimmed, and drops the empty ones", () => {
    const pack = buildAppointmentPack(input({ questions: ["  Is this the right cream? ", "", "   "] }));
    expect(pack.questions).toEqual(["Is this the right cream?"]);
  });
});

describe("choosing what appears", () => {
  it("leaves a switched-off section out without recording it as missing", () => {
    const entries = journal(flat("2026-07-20", TODAY, 5));
    const pack = buildAppointmentPack(input({ entries, sections: { scores: false, flares: false } }));
    expect(pack.scores).toBeNull();
    expect(pack.omitted.some((o) => o.key === "scores")).toBe(false);
    expect(pack.headline).not.toBeNull();
  });

  it("defaults every section on, and every section has a definition", () => {
    expect(Object.values(DEFAULT_PACK_SECTIONS).every(Boolean)).toBe(true);
    expect(PACK_SECTIONS.map((s) => s.key).sort())
      .toEqual(Object.keys(DEFAULT_PACK_SECTIONS).sort());
  });

  it("keeps the promise of one or two pages", () => {
    const small = buildAppointmentPack(input({ entries: journal(flat("2026-08-01", TODAY, 5)) }));
    expect(pageEstimate(small)).toBe(1);
    const big = buildAppointmentPack(input({
      entries: journal(flat("2026-07-20", TODAY, 5)),
      questions: ["a", "b", "c", "d", "e", "f", "g", "h"],
      episodes: [{
        id: "e1", title: "Flare", metric: "itch", start: "2026-08-01", end: "2026-08-10",
        createdAt: "x", updatedAt: "x",
      }],
    }));
    expect(estimateBlocks(big)).toBeGreaterThan(estimateBlocks(small));
    expect(pageEstimate(big)).toBe(2);
  });
});

describe("the saved settings", () => {
  it("repairs anything a hand-edited backup can throw at it", () => {
    const prefs = sanitizePackPrefs({
      lastAppointment: "not-a-date",
      sections: { flares: false, nonsense: true, notes: "yes" },
      questions: [null, "  ok  ", "x".repeat(400), ...Array(20).fill("more")],
      noteDates: ["2026-08-01", "nope", 7],
      photoField: 12,
    });
    expect(prefs.lastAppointment).toBeNull();
    expect(prefs.sections.flares).toBe(false);
    expect(prefs.sections.notes).toBe(true); // a non-boolean is not a choice
    expect((prefs.sections as Record<string, unknown>).nonsense).toBeUndefined();
    expect(prefs.questions.length).toBe(10);
    expect(prefs.questions[0]).toBe("ok");
    expect(prefs.questions[1].length).toBe(200);
    expect(prefs.noteDates).toEqual(["2026-08-01"]);
    expect(prefs.photoField).toBeNull();
  });

  it("gives a journal that has never made a pack every section, on", () => {
    expect(sanitizePackPrefs(undefined)).toEqual({
      lastAppointment: null, sections: DEFAULT_PACK_SECTIONS, questions: [], noteDates: [], photoField: null,
    });
  });
});

/* ---------- measurements and time outside ----------

   The two sections added in 1.21, and the two places on this page where the
   distinction between "somebody measured this" and "this app modelled it" has
   to survive being printed on paper and read months later. */

const lab = (over: Record<string, unknown> = {}) => ({
  id: "l1", test: "vitamin_d", name: "Vitamin D (25-OH)", value: 38, unit: "ng/mL",
  date: "2026-08-01", ...over,
} as any);

const sunSession = (date: string, over: Record<string, unknown> = {}) => ({
  date, minutes: 40, iuLow: 700, iuHigh: 1300, ...over,
} as any);

describe("buildLabs", () => {
  it("prints every test with a result in the range", () => {
    const labs = buildLabs(input({ labs: [lab(), lab({ id: "l2", test: "ferritin", name: "Ferritin", value: 42, unit: "ng/mL", date: "2026-08-05" })] }));
    expect(labs.map((l) => l.test).sort()).toEqual(["ferritin", "vitamin_d"]);
  });

  it("pulls in one earlier reading so a new result is a comparison, not a lone number", () => {
    const labs = buildLabs(input({
      labs: [lab({ id: "old", value: 24, date: "2026-02-01" }), lab({ value: 38 })],
    }));
    expect(labs[0].points.length).toBe(2);
    expect(labs[0].series).toBe("24 → 38 ng/mL");
  });

  it("says nothing about a test with no result inside the range", () => {
    expect(buildLabs(input({ labs: [lab({ date: "2026-01-01" })] }))).toEqual([]);
  });

  it("prints the laboratory's own range, described as theirs", () => {
    const [l] = buildLabs(input({ labs: [lab({ refLow: 30, refHigh: 100 })] }));
    expect(l.range).toBe("Your lab's range: 30–100 ng/mL");
    expect(l.points[0].status).toBe("in range");
  });

  it("prints no range and no verdict when the report never carried one", () => {
    const [l] = buildLabs(input({ labs: [lab()] }));
    expect(l.range).toBeUndefined();
    expect(l.points[0].status).toBe("");
  });

  it("keeps a paired value readable", () => {
    const [l] = buildLabs(input({
      labs: [lab({ test: "blood_pressure", name: "Blood pressure", value: 128, value2: 82, unit: "mmHg" })],
    }));
    expect(l.points[0].value).toBe("128/82");
  });

  it("puts a mixed-unit history onto the unit of the report somebody is holding", () => {
    const [l] = buildLabs(input({
      labs: [lab({ id: "old", value: 60, unit: "nmol/L", date: "2026-07-25" }), lab({ value: 38 })],
    }));
    expect(l.unit).toBe("ng/mL");
    expect(l.points.length).toBe(2);
    expect(l.series).toBe("24.04 → 38 ng/mL");
  });

  it("converts the lab's own range along with the value, never one against the other", () => {
    const [l] = buildLabs(input({
      labs: [
        lab({ id: "old", value: 60, unit: "nmol/L", refLow: 75, refHigh: 250, date: "2026-07-25" }),
        lab({ value: 38, refLow: 30, refHigh: 100 }),
      ],
    }));
    expect(l.points[0].status).toBe("below range");
    expect(l.points[1].status).toBe("in range");
  });

  it("drops a reading it cannot line up at all rather than printing it at the wrong scale", () => {
    const [l] = buildLabs(input({
      labs: [lab({ id: "old", value: 60, unit: "furlongs", date: "2026-07-25" }), lab({ value: 38 })],
    }));
    expect(l.points.length).toBe(1);
    expect(l.unit).toBe("ng/mL");
  });
});

describe("buildSun", () => {
  it("counts days, sessions and minutes across the range", () => {
    const sun = buildSun(input({
      sun: [sunSession("2026-08-01"), sunSession("2026-08-01", { minutes: 20 }), sunSession("2026-08-05")],
    }));
    expect(sun).toMatchObject({ days: 2, sessions: 3, minutes: 100, averageMinutes: 50 });
  });

  it("ignores sessions outside the range", () => {
    expect(buildSun(input({ sun: [sunSession("2026-01-01")] }))).toBeNull();
  });

  it("carries the estimate as a range, with the note that keeps it apart from a blood level", () => {
    const sun = buildSun(input({ sun: [sunSession("2026-08-01")] }))!;
    expect(sun.estimatedLow).toBe(700);
    expect(sun.estimatedHigh).toBe(1300);
    expect(sun.estimateNote).toBe(SUN_ESTIMATE_NOTE);
    expect(SUN_ESTIMATE_NOTE).toContain("not a measurement");
    expect(SUN_ESTIMATE_NOTE).toContain("blood level is the measurement");
  });
});

describe("the pack carries both, and says why when it can't", () => {
  it("includes them when they are switched on and have something to say", () => {
    const pack = buildAppointmentPack(input({
      labs: [lab()], sun: [sunSession("2026-08-01")],
    }));
    expect(pack.labs.length).toBe(1);
    expect(pack.sun).toBeTruthy();
    expect(pack.omitted.some((o) => o.key === "labs")).toBe(false);
  });

  it("explains an empty section instead of leaving somebody to guess", () => {
    const pack = buildAppointmentPack(input());
    expect(pack.omitted.find((o) => o.key === "labs")?.reason).toContain("No measurements");
    expect(pack.omitted.find((o) => o.key === "sun")?.reason).toContain("No time outside");
  });

  it("leaves them out entirely when the section is switched off", () => {
    const pack = buildAppointmentPack(input({
      labs: [lab()], sun: [sunSession("2026-08-01")],
      sections: { labs: false, sun: false },
    }));
    expect(pack.labs).toEqual([]);
    expect(pack.sun).toBeNull();
    expect(pack.omitted.some((o) => o.key === "labs")).toBe(false);
  });

  it("offers both as sections somebody can turn off", () => {
    expect(PACK_SECTIONS.map((s) => s.key)).toContain("labs");
    expect(PACK_SECTIONS.map((s) => s.key)).toContain("sun");
    expect(DEFAULT_PACK_SECTIONS.labs).toBe(true);
    expect(DEFAULT_PACK_SECTIONS.sun).toBe(true);
  });
});
