/* The Daily Pulse's logic: what counts as recorded, and which optional
   details are worth offering once it is.

   The suggestions are the part that can quietly go wrong — an app that offers
   to record something already recorded, or asks for a photograph of a good
   day, has stopped paying attention to the person using it. */
import { describe, it, expect } from "vitest";
import {
  CALM_AT, HARD_AT, badness, dayKind, followUps, pulseState, scoreWord,
  type FollowUpContext, type PulseField,
} from "../src/lib/pulse";

const fields: PulseField[] = [
  { k: "severity", label: "Overall skin severity", type: "scale", dir: "sym" },
  { k: "itch", label: "Itch", type: "scale", dir: "sym" },
  { k: "dryness", label: "Dryness", type: "scale", dir: "sym" },
  { k: "sleep_quality", label: "Sleep quality", type: "scale", dir: "pos" },
  { k: "stress", label: "Stress", type: "scale", dir: "sym" },
  { k: "triggers", label: "Possible triggers", type: "chips", options: ["dust"] } as PulseField,
  { k: "weight", label: "Weight", type: "number", unit: "lb", dir: "neutral" },
  { k: "shot", label: "Neck photo", type: "photo" },
];

const ctx = (over: Partial<FollowUpContext> = {}): FollowUpContext => ({
  primaryKey: "severity",
  score: 5,
  dir: "sym",
  fields,
  priority: ["severity", "itch", "dryness", "sleep_quality", "stress"],
  answers: { severity: 5 },
  hasNote: false,
  photoFields: ["shot"],
  photoToday: false,
  daysSincePhoto: 2,
  routineDue: 0,
  ...over,
});

describe("what the day is", () => {
  it("reads the bad end of the scale by direction, not by the number", () => {
    expect(badness(9, "sym")).toBe(9);
    expect(badness(9, "pos")).toBe(2);
    expect(dayKind(9, "sym")).toBe("hard");
    expect(dayKind(9, "pos")).toBe("calm");
    expect(dayKind(5, "sym")).toBe("middling");
    expect(dayKind(null, "sym")).toBe("unrated");
    expect([HARD_AT, CALM_AT]).toEqual([7, 3]);
  });

  it("says which end a number is at, so a 7 is never ambiguous", () => {
    expect(scoreWord(8, "sym")).toBe("a hard day");
    expect(scoreWord(8, "pos")).toBe("a mild day");
    expect(scoreWord(null, "sym")).toBe("");
  });
});

describe("what counts as recorded", () => {
  it("is the number in the journal and nothing else", () => {
    expect(pulseState({ severity: 6 }, "severity")).toEqual({ value: 6, recorded: true });
    expect(pulseState({ severity: null }, "severity")).toEqual({ value: null, recorded: false });
    expect(pulseState({}, "severity")).toEqual({ value: null, recorded: false });
    expect(pulseState(undefined, "severity")).toEqual({ value: null, recorded: false });
  });
});

describe("the optional follow-ups", () => {
  it("never offers the pulse metric back again", () => {
    expect(followUps(ctx()).some((f) => f.key === "severity")).toBe(false);
  });

  it("never offers a question already answered today", () => {
    const out = followUps(ctx({ answers: { severity: 5, itch: 3 } }));
    expect(out.some((f) => f.key === "itch")).toBe(false);
    expect(out.some((f) => f.key === "dryness")).toBe(true);
  });

  it("treats a deliberate skip as unanswered — a null was a decision, not a value", () => {
    const out = followUps(ctx({ answers: { severity: 5, itch: null } }));
    expect(out.some((f) => f.key === "itch")).toBe(true);
  });

  it("asks about symptoms on a hard day and about sleep on a calm one", () => {
    const hard = followUps(ctx({ score: 9, answers: { severity: 9 } })).filter((f) => f.kind === "field");
    expect(hard[0].key).toBe("itch");
    expect(hard.map((f) => f.key)).not.toContain("sleep_quality");

    const calm = followUps(ctx({ score: 2, answers: { severity: 2 } })).filter((f) => f.kind === "field");
    expect(calm[0].key).toBe("sleep_quality");
  });

  it("offers one more question on a hard day than on a good one", () => {
    const hard = followUps(ctx({ score: 9, answers: { severity: 9 } })).filter((f) => f.kind === "field");
    const calm = followUps(ctx({ score: 2, answers: { severity: 2 } })).filter((f) => f.kind === "field");
    expect(hard.length).toBe(3);
    expect(calm.length).toBe(2);
  });

  it("asks for a photo on a hard day, and otherwise only when it has been a while", () => {
    expect(followUps(ctx({ score: 9, answers: { severity: 9 }, daysSincePhoto: 1 })).some((f) => f.kind === "photo")).toBe(true);
    expect(followUps(ctx({ score: 2, answers: { severity: 2 }, daysSincePhoto: 1 })).some((f) => f.kind === "photo")).toBe(false);
    expect(followUps(ctx({ score: 2, answers: { severity: 2 }, daysSincePhoto: 9 })).some((f) => f.kind === "photo")).toBe(true);
    expect(followUps(ctx({ daysSincePhoto: null })).find((f) => f.kind === "photo")!.hint)
      .toMatch(/first progress shot/);
  });

  it("never asks for a photo when the setup has no photo question, or one is already taken", () => {
    expect(followUps(ctx({ score: 9, photoFields: [] })).some((f) => f.kind === "photo")).toBe(false);
    expect(followUps(ctx({ score: 9, photoToday: true })).some((f) => f.kind === "photo")).toBe(false);
  });

  it("offers the routine only while something is still owed, and counts it", () => {
    expect(followUps(ctx()).some((f) => f.kind === "routine")).toBe(false);
    const due = followUps(ctx({ routineDue: 3 })).find((f) => f.kind === "routine")!;
    expect(due.hint).toBe("3 still to tick off");
  });

  it("puts the note last and drops it once there is one", () => {
    const out = followUps(ctx());
    expect(out[out.length - 1].kind).toBe("note");
    expect(followUps(ctx({ hasNote: true })).some((f) => f.kind === "note")).toBe(false);
  });

  it("never offers more than five", () => {
    const out = followUps(ctx({ score: 9, answers: { severity: 9 }, routineDue: 4, daysSincePhoto: 30 }));
    expect(out.length).toBeLessThanOrEqual(5);
    expect(out.length).toBeGreaterThanOrEqual(3);
  });

  it("degrades to fewer rather than inventing filler for a bare setup", () => {
    const out = followUps(ctx({
      fields: [fields[0]], answers: { severity: 5 }, photoFields: [], hasNote: true,
    }));
    expect(out).toEqual([]);
  });
});
