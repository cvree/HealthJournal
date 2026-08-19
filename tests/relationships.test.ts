/* The relationships explorer's arithmetic, and — just as importantly — the
   floors that keep it quiet. */
import { describe, it, expect } from "vitest";
import { causalLanguageAudit } from "../src/lib/validate";
import {
  MIN_PAIRS, needsLine, pairUp, ranks, relationship, RELATIONSHIP_COPY,
  SOLID_PAIRS, spearman, STRENGTH_COPY, strengthOf,
} from "../src/lib/relationships";

const d = (i: number) => `2026-03-${String(i + 1).padStart(2, "0")}`;

/** A journal of n days where the factor and outcome follow the given functions. */
const journal = (n: number, f: (i: number) => number, o: (i: number) => number) =>
  Array.from({ length: n }, (_, i) => ({ date: d(i), answers: { dairy: f(i), itch: o(i) } }));

describe("ranks", () => {
  it("averages ties, because 1–10 ratings are mostly ties", () => {
    expect(ranks([10, 20, 30])).toEqual([1, 2, 3]);
    expect(ranks([5, 5, 9])).toEqual([1.5, 1.5, 3]);
    expect(ranks([7, 7, 7, 7])).toEqual([2.5, 2.5, 2.5, 2.5]);
  });
});

describe("spearman", () => {
  it("is 1 for a perfectly ordered pair and -1 for a reversed one", () => {
    const up = [1, 2, 3, 4, 5].map((x) => ({ x, y: x * 3 }));
    expect(spearman(up)).toBeCloseTo(1, 6);
    const down = [1, 2, 3, 4, 5].map((x) => ({ x, y: -x }));
    expect(spearman(down)).toBeCloseTo(-1, 6);
  });
  it("sees a monotonic but curved relationship that Pearson would understate", () => {
    const curved = [1, 2, 3, 4, 5, 6].map((x) => ({ x, y: x ** 4 }));
    expect(spearman(curved)).toBeCloseTo(1, 6);
  });
  it("is null when either side never varies", () => {
    expect(spearman([1, 2, 3].map((x) => ({ x, y: 5 })))).toBeNull();
    expect(spearman([1, 2, 3].map((y) => ({ x: 5, y })))).toBeNull();
  });
  it("is null below three pairs", () => {
    expect(spearman([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull();
  });
});

describe("pairUp", () => {
  const entries = [
    { date: "2026-03-01", answers: { dairy: 2, itch: 3 } },
    { date: "2026-03-02", answers: { dairy: 8, itch: 4 } },
    { date: "2026-03-03", answers: { itch: 9 } },            // no factor
    { date: "2026-03-04", answers: { dairy: 5 } },           // no outcome
  ];
  it("keeps only the days where both are numbers", () => {
    const pairs = pairUp(entries, "itch", "dairy");
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toMatchObject({ date: "2026-03-01", factorDate: "2026-03-01", x: 2, y: 3 });
  });
  it("reads the factor a day earlier when lagged", () => {
    const pairs = pairUp(entries, "itch", "dairy", 1);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toMatchObject({ date: "2026-03-02", factorDate: "2026-03-01", x: 2, y: 4 });
    expect(pairs[1]).toMatchObject({ date: "2026-03-03", factorDate: "2026-03-02", x: 8, y: 9 });
  });
  it("counts a yes/no answer as 1 and 0 so a trigger can be compared too", () => {
    const pairs = pairUp([
      { date: "2026-03-01", answers: { flare: true, itch: 8 } },
      { date: "2026-03-02", answers: { flare: false, itch: 3 } },
    ], "itch", "flare");
    expect(pairs.map((p) => p.x)).toEqual([1, 0]);
  });
});

describe("strength, with the sample size in the judgement", () => {
  it("will not say 'strong' on a small sample however big rho is", () => {
    expect(strengthOf(0.95, MIN_PAIRS)).toBe("moderate");
    expect(strengthOf(0.95, SOLID_PAIRS)).toBe("strong");
  });
  it("grades the middle of the range, and calls nothing nothing", () => {
    expect(strengthOf(0.05, 100)).toBe("none");
    expect(strengthOf(-0.3, 100)).toBe("slight");
    expect(strengthOf(0.5, 100)).toBe("moderate");
    expect(strengthOf(null, 100)).toBe("none");
  });
});

describe("relationship", () => {
  it("stays quiet below the paired-day floor and says how many more it needs", () => {
    const r = relationship({
      entries: journal(MIN_PAIRS - 3, (i) => i, (i) => i),
      outcomeKey: "itch", factorKey: "dairy",
    });
    expect(r.enough).toBe(false);
    expect(r.needs).toBe(3);
    expect(needsLine(r)).toBe("3 more days with both logged and this will appear.");
  });
  it("says 'one more day' in words when that is what is missing", () => {
    const r = relationship({
      entries: journal(MIN_PAIRS - 1, (i) => i, (i) => i),
      outcomeKey: "itch", factorKey: "dairy",
    });
    expect(needsLine(r)).toMatch(/^One more day/);
  });
  it("reports rho, direction and strength once there is enough", () => {
    const r = relationship({
      entries: journal(SOLID_PAIRS, (i) => (i % 10) + 1, (i) => (i % 10) + 1),
      outcomeKey: "itch", factorKey: "dairy",
    });
    expect(r.enough).toBe(true);
    expect(r.n).toBe(SOLID_PAIRS);
    expect(r.rho).toBeCloseTo(1, 6);
    expect(r.direction).toBe("up");
    expect(r.strength).toBe("strong");
  });
  it("reports coverage against the outcome's own logged days", () => {
    const entries = [
      ...journal(10, (i) => i + 1, (i) => i + 1),
      { date: "2026-03-20", answers: { itch: 5 } },
      { date: "2026-03-21", answers: { itch: 6 } },
    ];
    const r = relationship({ entries, outcomeKey: "itch", factorKey: "dairy" });
    expect(r.outcomeDays).toBe(12);
    expect(r.n).toBe(10);
    expect(r.coverage).toBeCloseTo(10 / 12, 6);
  });
  it("honours the date window", () => {
    const r = relationship({
      entries: journal(20, (i) => i + 1, (i) => i + 1),
      outcomeKey: "itch", factorKey: "dairy",
      start: "2026-03-05", end: "2026-03-14",
    });
    expect(r.n).toBe(10);
  });
  it("splits the days at the factor's own median and reports both averages", () => {
    const entries = [
      ...Array.from({ length: 8 }, (_, i) => ({ date: d(i), answers: { dairy: 1, itch: 3 } })),
      ...Array.from({ length: 8 }, (_, i) => ({ date: d(i + 8), answers: { dairy: 9, itch: 7 } })),
    ];
    const r = relationship({
      entries, outcomeKey: "itch", factorKey: "dairy",
      groupLabels: ["No dairy", "Dairy"],
    });
    expect(r.groups.map((g) => g.label)).toEqual(["No dairy", "Dairy"]);
    expect(r.groups[0]).toMatchObject({ n: 8, mean: 3 });
    expect(r.groups[1]).toMatchObject({ n: 8, mean: 7 });
    expect(r.groupDelta).toBeCloseTo(4, 6);
  });
  it("offers no split when the factor never varies", () => {
    const r = relationship({
      entries: journal(20, () => 5, (i) => i),
      outcomeKey: "itch", factorKey: "dairy",
    });
    expect(r.groups).toEqual([]);
    expect(r.groupDelta).toBeNull();
    expect(r.rho).toBeNull();
    expect(r.strength).toBe("none");
  });
  it("finds a lagged relationship the same-day comparison misses", () => {
    /* The factor spikes the day before the outcome does. */
    const entries = Array.from({ length: 24 }, (_, i) => ({
      date: d(i),
      answers: { dairy: i % 2 === 0 ? 9 : 1, itch: i % 2 === 1 ? 9 : 1 },
    }));
    const sameDay = relationship({ entries, outcomeKey: "itch", factorKey: "dairy" });
    const lagged = relationship({ entries, outcomeKey: "itch", factorKey: "dairy", lag: 1 });
    expect(sameDay.rho).toBeCloseTo(-1, 6);
    expect(lagged.rho).toBeCloseTo(1, 6);
    expect(lagged.lag).toBe(1);
  });
});

describe("what it is allowed to say", () => {
  it("never claims cause, in any phrase it can produce", () => {
    expect(causalLanguageAudit(RELATIONSHIP_COPY)).toEqual([]);
    expect(causalLanguageAudit(STRENGTH_COPY)).toEqual([]);
  });
  it("carries the not-proof line for the UI to print", () => {
    expect(RELATIONSHIP_COPY.notProof).toMatch(/not proof/i);
    expect(Object.keys(STRENGTH_COPY)).toEqual(["none", "slight", "moderate", "strong"]);
  });
});
