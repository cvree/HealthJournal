/* The Daily Pulse's logic: what counts as recorded, and which optional
   details are worth offering once it is.

   The suggestions are the part that can quietly go wrong — an app that offers
   to record something already recorded, or asks for a photograph of a good
   day, has stopped paying attention to the person using it. */
import { describe, it, expect } from "vitest";
import {
  CALM_AT, HARD_AT, answerHabits, askQueue, badness, dayKind, followUps, isOneTap,
  nextQuestion, pulseState, scoreWord, surveyProgress,
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

/* The queue behind "one tap, then the next question".

   The follow-up chips are a menu of three; this is the whole list, and the
   thing it has to get right is the *order* — because the person only ever sees
   the front of it, so a bad first question is the only question they see. */
describe("the question queue", () => {
  it("holds every question still worth asking, not just the three the chips fit", () => {
    const q = askQueue(ctx());
    expect(q.length).toBeGreaterThan(3);
    // Never the pulse itself, never a photo or a text box, never an answer already given.
    expect(q.some((f) => f.k === "severity")).toBe(false);
    expect(q.some((f) => f.type === "photo")).toBe(false);
    expect(askQueue(ctx({ answers: { severity: 5, itch: 4 } })).some((f) => f.k === "itch")).toBe(false);
  });

  it("leads with the pack's own priority, and lets the day reorder the rest", () => {
    expect(nextQuestion(ctx({ score: 9 }))!.k).toBe("itch");
    /* On a calm day the "more is better" questions come up the order, because
       they are the ones that might explain it. */
    const calm = askQueue(ctx({ score: 1 })).map((f) => f.k);
    const hard = askQueue(ctx({ score: 9 })).map((f) => f.k);
    expect(calm.indexOf("sleep_quality")).toBeLessThan(hard.indexOf("sleep_quality"));
  });

  it("lets what somebody actually records outrank what the pack thinks", () => {
    /* Weight is bottom of the pack's list and this person records it every
       day; itch is top of the list and they have never touched it. */
    const q = askQueue(ctx({ usual: { weight: 1, itch: 0 } }));
    expect(q[0].k).toBe("weight");
    // ...but a habit is a tilt, not a veto: the pack's metrics are still there.
    expect(q.some((f) => f.k === "itch")).toBe(true);
  });

  it("drops what was skipped in this sitting, and only that", () => {
    const first = nextQuestion(ctx())!;
    const after = nextQuestion(ctx(), [first.k])!;
    expect(after.k).not.toBe(first.k);
    expect(askQueue(ctx(), [first.k]).length).toBe(askQueue(ctx()).length - 1);
  });

  it("runs out rather than repeating itself", () => {
    const all = askQueue(ctx()).map((f) => f.k);
    expect(nextQuestion(ctx(), all)).toBeNull();
    expect(new Set(all).size).toBe(all.length);
  });

  it("knows which questions one tap finishes, because the rest must not be snatched away", () => {
    expect(isOneTap({ k: "a", label: "a", type: "scale" })).toBe(true);
    expect(isOneTap({ k: "a", label: "a", type: "toggle" })).toBe(true);
    expect(isOneTap({ k: "a", label: "a", type: "chips", single: true })).toBe(true);
    expect(isOneTap({ k: "a", label: "a", type: "chips" })).toBe(false);
    expect(isOneTap({ k: "a", label: "a", type: "number" })).toBe(false);
  });
});

describe("how much of today is done", () => {
  it("counts the pulse as one of the questions, because it is one", () => {
    const p = surveyProgress(ctx({ answers: { severity: 5 } }));
    expect(p.total).toBe(7); // five scales + the chips + the number; the photo is not a question
    expect(p.answered).toBe(1);
    expect(p.left).toBe(6);
  });

  it("moves as questions are answered, and treats a skip as still outstanding", () => {
    expect(surveyProgress(ctx({ answers: { severity: 5, itch: 3, weight: 180 } })).answered).toBe(3);
    expect(surveyProgress(ctx({ answers: { severity: 5, itch: null } })).answered).toBe(1);
  });

  it("says nothing is answered on a day nobody has rated", () => {
    const p = surveyProgress(ctx({ score: null, answers: {} }));
    expect(p.answered).toBe(0);
    expect(p.left).toBe(p.total);
  });
});

describe("what somebody actually records", () => {
  it("is the share of recent days each question was answered on", () => {
    const habits = answerHabits(fields, [
      { answers: { severity: 5, sleep_quality: 7 } },
      { answers: { severity: 6, sleep_quality: 8 } },
      { answers: { severity: 4 } },
      { answers: { severity: 5, itch: null } },
    ]);
    expect(habits.severity).toBe(1);
    expect(habits.sleep_quality).toBe(0.5);
    expect(habits.itch).toBe(0); // a stored null was a decision to skip, not an answer
  });

  it("is empty rather than wrong when there is no history to read", () => {
    expect(answerHabits(fields, [])).toEqual({});
  });
});
