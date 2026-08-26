/* Experiments and the evidence ladder — the two modules that decide what this
   app is allowed to say out loud, and when. */
import { describe, it, expect } from "vitest";
import { causalLanguageAudit } from "../src/lib/validate";
import {
  buildReport, EMERGING_AT, ESTABLISHED_AT, gradeEvidence, lagLabel, monthKey,
  spread, STANDING_LIMITATIONS, STAGE_LABEL, USEFUL_AT, weekKey,
} from "../src/lib/evidence";
import {
  availableStarters, describeSide, EXPERIMENT_COPY, experimentTitle,
  highlightDates, newExperiment, pairDays, runAll, runExperiment,
  sanitizeExperiments, sortResults, STARTERS, suggestExperiments,
} from "../src/lib/experiments";
import { splitPoint } from "../src/lib/experiments";
import { journalDates, variables } from "../src/lib/series";

const pad = (n: number) => String(n).padStart(2, "0");
/** Day i of a run starting 2026-01-01, so a long journal crosses real months. */
const day = (i: number) => {
  const d = new Date(2026, 0, 1 + i);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const FIELDS = [
  { k: "sleep", label: "Sleep quality", type: "scale", dir: "pos" as const },
  { k: "itch", label: "Itch", type: "scale", dir: "sym" as const },
  { k: "water", label: "Water", type: "number", dir: "neutral" as const, unit: "glasses" },
];

/** A journal where every other day has plenty of water and better sleep. */
const journal = (n: number, gap = 2) =>
  Array.from({ length: n }, (_, i) => ({
    date: day(i * gap),
    answers: {
      water: i % 2 === 0 ? 9 : 2,
      sleep: i % 2 === 0 ? 8 : 5,
      itch: 5,
    },
  }));

const src = (n: number, gap = 2) => ({ entries: journal(n, gap), fields: FIELDS });

const exp = (over: Partial<Parameters<typeof newExperiment>[0]> = {}) =>
  newExperiment({ factor: "water", outcome: "sleep", ...over } as any);

/* ---------- the ladder ---------- */

describe("gradeEvidence", () => {
  it("climbs four rungs on the number of paired days", () => {
    expect(gradeEvidence({ pairs: 8, weeks: 2, months: 1 }).stage).toBe("collecting");
    expect(gradeEvidence({ pairs: 17, weeks: 3, months: 1 }).stage).toBe("emerging");
    expect(gradeEvidence({ pairs: 38, weeks: 6, months: 2 }).stage).toBe("useful");
    expect(gradeEvidence({ pairs: 104, weeks: 20, months: 5 }).stage).toBe("established");
  });

  it("holds a burst of days back at Emerging, however many there are", () => {
    /* Forty days from one fortnight is one fortnight of somebody's life. */
    const burst = gradeEvidence({ pairs: 40, weeks: 2, months: 1 });
    expect(burst.stage).toBe("emerging");
    expect(burst.detail).toContain("2 weeks");
  });

  it("holds a lot of days from one month back at Useful", () => {
    const oneMonth = gradeEvidence({ pairs: 120, weeks: 4, months: 1 });
    expect(oneMonth.stage).toBe("useful");
    expect(oneMonth.detail).toContain("1 month");
  });

  it("never invents a confidence percentage", () => {
    for (const pairs of [0, 5, 12, 30, 90, 400]) {
      const e = gradeEvidence({ pairs, weeks: 20, months: 6 });
      expect(JSON.stringify(e)).not.toMatch(/\d+%/);
      expect(e.count).toMatch(/^\d+ paired days?$/);
    }
  });

  it("counts down to the next rung, and stops at the top", () => {
    const a = gradeEvidence({ pairs: 8, weeks: 2, months: 1 });
    expect(a.toNext).toBe(EMERGING_AT - 8);
    expect(a.nextLabel).toBe(STAGE_LABEL.emerging);
    expect(a.progress).toBeGreaterThan(0);
    expect(a.progress).toBeLessThan(1);
    const top = gradeEvidence({ pairs: ESTABLISHED_AT + 20, weeks: 30, months: 8 });
    expect(top.toNext).toBeNull();
    expect(top.nextLabel).toBeNull();
    expect(top.progress).toBe(1);
  });

  it("tells somebody with nothing yet exactly how many days are missing", () => {
    expect(gradeEvidence({ pairs: 0, weeks: 0, months: 0 }).detail).toContain(`${EMERGING_AT} more`);
  });

  it("never speaks causally", () => {
    const all = [0, 12, USEFUL_AT, ESTABLISHED_AT].map((pairs) =>
      gradeEvidence({ pairs, weeks: 12, months: 4 })
    );
    expect(causalLanguageAudit(all)).toEqual([]);
    expect(causalLanguageAudit(STANDING_LIMITATIONS)).toEqual([]);
  });
});

describe("spread", () => {
  it("counts distinct weeks and months", () => {
    expect(spread(["2026-01-01", "2026-01-02", "2026-01-03"])).toEqual({ weeks: 1, months: 1 });
    expect(spread(["2026-01-01", "2026-02-15", "2026-03-30"]).months).toBe(3);
    expect(weekKey("2026-01-01")).toBe(weekKey("2026-01-02"));
    expect(monthKey("2026-03-30")).toBe("2026-03");
  });
});

describe("buildReport", () => {
  it("puts the standing limitations on every finding, after any specific one", () => {
    const r = buildReport({ usable: 30, missing: 4, windowLabel: "a to b", lag: 1, comparison: "x", weeks: 5, months: 2, extra: ["specific"] });
    expect(r.limitations[0]).toBe("specific");
    expect(r.limitations.slice(1)).toEqual(STANDING_LIMITATIONS);
    expect(r.lagLabel).toBe("The day before");
    expect(r.consistency).toBe("5 weeks across 2 months");
  });

  it("says the lag in words", () => {
    expect(lagLabel(0)).toBe("Same day");
    expect(lagLabel(3)).toBe("3 days before");
  });
});

/* ---------- running experiments ---------- */

describe("runExperiment", () => {
  it("says nothing at all while Collecting — not a hedged version of the result", () => {
    const r = runExperiment(exp(), src(5));
    expect(r.evidence.stage).toBe("collecting");
    expect(r.headline).toBe("");
    expect(r.subline).toBe(EXPERIMENT_COPY.collecting);
  });

  it("splits on the person's own median so both halves exist", () => {
    const r = runExperiment(exp(), src(30));
    expect(r.thresholdSource).toBe("median");
    expect(r.high.n).toBeGreaterThan(5);
    expect(r.low.n).toBeGreaterThan(5);
    expect(r.threshold).toBe(2);
  });

  it("honours a threshold somebody set by hand, and says it was theirs", () => {
    const r = runExperiment(exp({ threshold: 5 }), src(30));
    expect(r.thresholdSource).toBe("manual");
    expect(r.threshold).toBe(5);
    expect(r.report.limitations[0]).toContain("a number you chose");
  });

  it("reaches a result and states it as an average of the person's own days", () => {
    const r = runExperiment(exp(), src(60, 3));
    expect(["useful", "established"]).toContain(r.evidence.stage);
    expect(r.headline).toContain("has averaged");
    expect(r.headline).toContain("3 points higher");
    expect(r.difference).toBe(3);
    expect(causalLanguageAudit(r)).toEqual([]);
  });

  it("reports a null result rather than staying silent about it", () => {
    const flat = {
      entries: Array.from({ length: 60 }, (_, i) => ({
        date: day(i * 3),
        answers: { water: i % 2 === 0 ? 9 : 2, sleep: 6 },
      })),
      fields: FIELDS,
    };
    const r = runExperiment(exp(), flat);
    expect(r.flat).toBe(true);
    expect(r.headline).toBe(EXPERIMENT_COPY.flat);
  });

  it("grades on the smaller half, so fifty days with two above the line is two days of evidence", () => {
    const lopsided = {
      entries: Array.from({ length: 60 }, (_, i) => ({
        date: day(i * 3),
        answers: { water: i < 3 ? 9 : 2, sleep: i < 3 ? 9 : 4 },
      })),
      fields: FIELDS,
    };
    const r = runExperiment(exp(), lopsided);
    expect(r.high.n).toBe(3);
    expect(r.evidence.pairs).toBe(6);
    expect(r.evidence.stage).toBe("collecting");
    expect(r.headline).toBe("");
  });

  it("reads the factor from the day before when there is a lag", () => {
    const entries = [
      { date: "2026-01-01", answers: { water: 9 } },
      { date: "2026-01-02", answers: { sleep: 8 } },
    ];
    const vars = variables({ entries, fields: FIELDS });
    const factor = vars.find((v) => v.k === "water")!;
    const outcome = vars.find((v) => v.k === "sleep")!;
    const sameDay = pairDays(exp({ lag: 0 }), factor, outcome, journalDates({ entries }));
    const lagged = pairDays(exp({ lag: 1 }), factor, outcome, journalDates({ entries }));
    expect(sameDay.length).toBe(0);
    expect(lagged.length).toBe(1);
    expect(lagged[0].date).toBe("2026-01-02");
    expect(lagged[0].factorDate).toBe("2026-01-01");
  });

  it("caps the lag rather than offering a hypothesis the data can't support", () => {
    expect(newExperiment({ factor: "a", outcome: "b", lag: 40 }).lag).toBe(3);
    expect(newExperiment({ factor: "a", outcome: "b", lag: -5 }).lag).toBe(0);
  });

  it("waits rather than breaking when a variable disappears from the setup", () => {
    const r = runExperiment(exp({ factor: "gone" }), src(30));
    expect(r.pairs).toEqual([]);
    expect(r.headline).toBe("");
    expect(r.subline).toContain("isn't in your journal");
    expect(r.evidence.stage).toBe("collecting");
  });

  it("shows its working, including the days that were missing one side", () => {
    const holey = {
      entries: journal(40, 3).map((e, i) => (i % 5 === 0 ? { ...e, answers: { sleep: 6 } } : e)),
      fields: FIELDS,
    };
    const r = runExperiment(exp(), holey);
    expect(r.report.missing).toBeGreaterThan(0);
    expect(r.report.usable).toBeGreaterThan(0);
    expect(r.report.comparison).toContain("against");
    expect(r.report.lagLabel).toBe("Same day");
  });
});

describe("before/after experiments", () => {
  const changed = day(45);
  const beforeAfter = {
    entries: Array.from({ length: 90 }, (_, i) => ({
      date: day(i),
      answers: { itch: i < 45 ? 7 : 4, water: 5 },
    })),
    fields: FIELDS,
  };

  it("matches the two windows in length rather than comparing sizes", () => {
    const r = runExperiment(
      newExperiment({ kind: "beforeAfter", factor: "water", outcome: "itch", changedOn: changed }),
      beforeAfter
    );
    expect(r.high.n).toBe(r.low.n);
    expect(r.thresholdSource).toBe("date");
  });

  it("reports the change as a comparison of two periods, and warns what else moved", () => {
    const r = runExperiment(
      newExperiment({ kind: "beforeAfter", factor: "water", outcome: "itch", changedOn: changed }),
      beforeAfter
    );
    expect(r.headline).toContain("has averaged");
    expect(r.headline).toContain("3 points lower");
    expect(r.report.limitations[0]).toContain("everything else that changed with time");
    expect(causalLanguageAudit(r)).toEqual([]);
  });
});

describe("describeSide", () => {
  const v = { k: "sun_minutes", label: "Time outside", unit: "min", dir: "neutral" as const, sec: "Sun", kind: "sun" as const, value: () => null };

  it("says the threshold in the factor's own unit, and on the right side of it", () => {
    /* The high half is x > threshold, strictly. "15 min+" would put the
       threshold itself in the sentence's high half and in the arithmetic's
       low half — an off-by-one somebody checking by hand would find. */
    expect(describeSide(v, 15, "high")).toBe("time outside above 15 min");
    expect(describeSide(v, 15, "low")).toBe("time outside at or below 15 min");
  });

  it("reads a yes/no factor as a thing that happened", () => {
    const toggle = { ...v, k: "dairy", label: "Dairy", unit: undefined, dir: "sym" as const, kind: "answer" as const };
    expect(describeSide(toggle, 0, "high")).toBe("dairy");
    expect(describeSide(toggle, 0, "low")).toBe("no dairy");
  });
});

describe("highlightDates", () => {
  it("hands back the side the headline is about, so those days can light up", () => {
    const r = runExperiment(exp(), src(60, 3));
    expect(highlightDates(r)).toEqual(r.high.dates);
  });

  it("hands back every paired day while there is no result yet", () => {
    const r = runExperiment(exp(), src(5));
    expect(highlightDates(r)).toEqual(r.dates);
  });
});

describe("sanitizeExperiments", () => {
  it("drops rows with no factor or outcome, and de-duplicates ids", () => {
    expect(sanitizeExperiments([{ factor: "a" }])).toEqual([]);
    expect(sanitizeExperiments("no")).toEqual([]);
    const e = exp();
    expect(sanitizeExperiments([e, e]).length).toBe(1);
  });

  it("repairs a hand-edited lag and an unknown kind", () => {
    const [row] = sanitizeExperiments([{ ...exp(), lag: 99, kind: "quantum" }]);
    expect(row.lag).toBe(3);
    expect(row.kind).toBe("split");
  });
});

describe("sortResults", () => {
  it("puts pinned first, then whatever is furthest up the ladder", () => {
    const useful = runExperiment(exp(), src(60, 3));
    const collecting = runExperiment(exp({ factor: "itch", outcome: "sleep" }), src(5));
    const pinned = { ...collecting, experiment: { ...collecting.experiment, pinned: true } };
    expect(sortResults([useful, pinned])[0]).toBe(pinned);
    expect(sortResults([collecting, useful])[0]).toBe(useful);
  });
});

describe("runAll", () => {
  it("skips archived experiments and runs the rest in one pass", () => {
    const a = exp();
    const b = { ...exp({ factor: "itch", outcome: "sleep" }), archived: true };
    expect(runAll([a, b], src(30)).length).toBe(1);
  });
});

/* ---------- suggestions ---------- */

describe("suggestExperiments", () => {
  it("says nothing from a journal too short to have noticed anything", () => {
    expect(suggestExperiments(src(3))).toEqual([]);
  });

  it("offers a question only when it is already answerable", () => {
    const s = suggestExperiments(src(40, 2));
    expect(s.length).toBeGreaterThan(0);
    for (const one of s) {
      expect(one.pairs).toBeGreaterThanOrEqual(14);
      expect(one.reason).toMatch(/\d+ days with both recorded/);
    }
  });

  it("never offers one the person already has", () => {
    const existing = [exp()];
    const s = suggestExperiments(src(40, 2), { existing });
    expect(s.some((x) => x.factor === "water" && x.outcome === "sleep" && x.lag === 0)).toBe(false);
  });

  it("never offers a symptom against another symptom", () => {
    const s = suggestExperiments(src(40, 2));
    expect(s.some((x) => x.factor === "itch")).toBe(false);
  });

  it("offers one card per factor rather than the same idea three times", () => {
    const s = suggestExperiments(src(40, 2), { limit: 10 });
    expect(new Set(s.map((x) => x.factor)).size).toBe(s.length);
  });

  it("skips a factor that never varies, because it can never be split", () => {
    const flat = {
      entries: Array.from({ length: 40 }, (_, i) => ({ date: day(i), answers: { water: 5, sleep: i % 3 } })),
      fields: FIELDS,
    };
    expect(suggestExperiments(flat).some((x) => x.factor === "water")).toBe(false);
  });

  it("puts the key metric's questions first", () => {
    const s = suggestExperiments(src(40, 2), { keyMetric: "sleep" });
    expect(s[0].outcome).toBe("sleep");
  });

  it("never speaks causally", () => {
    expect(causalLanguageAudit(suggestExperiments(src(40, 2)))).toEqual([]);
  });
});

describe("starter questions", () => {
  it("is a list of real questions, not a list of variables", () => {
    for (const s of STARTERS) expect(s.question).toMatch(/\?$/);
    expect(new Set(STARTERS.map((s) => s.id)).size).toBe(STARTERS.length);
    expect(causalLanguageAudit(STARTERS)).toEqual([]);
  });

  it("offers only the ones this journal can actually answer", () => {
    expect(availableStarters(src(20))).toEqual([]); // no sun, no weather, no sleep_quality
    const withSleep = {
      entries: Array.from({ length: 20 }, (_, i) => ({ date: day(i), answers: { mood: 5 + (i % 3) } })),
      fields: [{ k: "mood", label: "Mood", type: "scale", dir: "pos" as const }],
      sun: Array.from({ length: 20 }, (_, i) => ({
        id: `s${i}`, date: day(i), start: `${day(i)}T10:00:00Z`, minutes: 20 + i,
        exposure: "arms" as const, shade: "open" as const, samples: [], uvSource: "modelled" as const, endSource: "manual" as const, estimated: false, confirmed: true,
        avgUV: 4, peakUV: 5, avgElevation: 40, sed: 0.8, medFraction: 0.3,
        iu: 600, iuLow: 400, iuHigh: 800, belowThreshold: false,
        source: "live" as const, createdAt: "", updatedAt: "",
      })),
    };
    const starters = availableStarters(withSleep);
    expect(starters.map((s) => s.id)).toContain("outside-mood");
    expect(starters.find((s) => s.id === "outside-mood")!.resolvedOutcome).toBe("mood");
  });
});

describe("experimentTitle", () => {
  it("names an experiment after its two sides", () => {
    const vars = variables(src(10));
    expect(experimentTitle(vars.find((v) => v.k === "water"), vars.find((v) => v.k === "sleep")))
      .toBe("Water × Sleep quality");
    expect(experimentTitle(undefined, undefined)).toBe("Untitled experiment");
  });
});

describe("splitPoint", () => {
  it("lands on the median for evenly spread values", () => {
    expect(splitPoint([1, 2, 3, 4, 5])).toBe(2);
    expect(splitPoint([1, 2, 3, 4])).toBe(2);
  });

  it("divides a balanced bimodal factor into its two clumps", () => {
    const water = [...Array(20).fill(2), ...Array(20).fill(9)];
    const t = splitPoint(water)!;
    expect(water.filter((v) => v > t).length).toBe(20);
    expect(water.filter((v) => v <= t).length).toBe(20);
  });

  it("divides an *unbalanced* bimodal factor rather than putting every day on one side", () => {
    /* The case that shipped broken: eighty days at nine, forty at two. The
       median is nine, and a strict "above" test then compares 120 days
       against none. */
    const water = [...Array(40).fill(2), ...Array(80).fill(9)];
    const t = splitPoint(water)!;
    expect(water.filter((v) => v > t).length).toBe(80);
    expect(water.filter((v) => v <= t).length).toBe(40);
  });

  it("never cuts inside a run of equal values, because that split does not exist", () => {
    const t = splitPoint([1, 5, 5, 5, 5, 9])!;
    expect([1, 5]).toContain(t);
  });

  it("refuses to split a factor that never varies", () => {
    expect(splitPoint([4, 4, 4, 4])).toBeNull();
    expect(splitPoint([])).toBeNull();
  });

  it("leaves an experiment on an unvarying factor collecting rather than comparing to nothing", () => {
    const flat = {
      entries: Array.from({ length: 60 }, (_, i) => ({
        date: day(i * 3), answers: { water: 5, sleep: 4 + (i % 5) },
      })),
      fields: FIELDS,
    };
    const r = runExperiment(exp(), flat);
    expect(r.threshold).toBeNull();
    expect(r.headline).toBe("");
    expect(r.evidence.stage).toBe("collecting");
  });

  it("compares two real halves on the unbalanced case, end to end", () => {
    const src2 = {
      entries: Array.from({ length: 120 }, (_, i) => ({
        date: day(i * 2),
        answers: { water: i % 3 === 0 ? 2 : 9, sleep: i % 3 === 0 ? 4 : 8 },
      })),
      fields: FIELDS,
    };
    const r = runExperiment(exp(), src2);
    expect(r.high.n).toBeGreaterThan(20);
    expect(r.low.n).toBeGreaterThan(20);
    expect(r.difference).toBe(4);
    expect(r.headline).toContain("has averaged");
  });
});
