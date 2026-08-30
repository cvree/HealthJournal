/* What today's check-in claims about somebody's day.

   The ring on Today and the ring on History are the same arithmetic, and the
   arithmetic is a promise: the denominator is what the day actually asked for,
   never a target the app invented. These tests are the guardrail on that —
   a photo, a note and a meal have no honest daily quota, so counting them
   would be the app deciding how much somebody ought to write down. */
import { describe, it, expect } from "vitest";
import {
  PIP_LIMIT, checkinLine, checkinPips, checkinStatus, checkinVerb,
  type CheckinSource,
} from "../src/lib/checkin";
import type { PulseField } from "../src/lib/pulse";

const fields: PulseField[] = [
  { k: "severity", label: "Overall skin severity", type: "scale", dir: "sym" },
  { k: "itch", label: "Itch", type: "scale", dir: "sym" },
  { k: "sleep", label: "Sleep", type: "number", unit: "h" },
  { k: "flared", label: "Flared today", type: "toggle" },
  { k: "triggers", label: "Possible triggers", type: "chips" },
  /* Not askable inline, so not part of the count — the check-in cannot put a
     camera or a paragraph in a ring. */
  { k: "shot", label: "Neck photo", type: "photo" },
  { k: "diary", label: "Anything else", type: "text" },
];

const src = (over: Partial<CheckinSource> = {}): CheckinSource => ({
  fields,
  primaryKey: "severity",
  answers: {},
  score: null,
  ...over,
});

const part = (s: ReturnType<typeof checkinStatus>, id: string) =>
  s.parts.find((p) => p.id === id)!;

describe("what the day asked for", () => {
  it("counts every question the check-in can ask inline, and no others", () => {
    const s = checkinStatus(src());
    // scale, scale, number, toggle, chips — the photo and the text are out.
    expect(part(s, "questions").total).toBe(5);
    expect(s.total).toBe(5);
    expect(s.done).toBe(0);
    expect(s.untouched).toBe(true);
  });

  it("counts the pulse as one of the questions, however it arrives", () => {
    expect(checkinStatus(src({ score: 4 })).done).toBe(1);
    expect(checkinStatus(src({ answers: { severity: 4 } })).done).toBe(1);
    // Both at once is still one question answered, not two.
    expect(checkinStatus(src({ score: 4, answers: { severity: 4 } })).done).toBe(1);
  });

  it("counts a key metric that is not itself an inline question", () => {
    /* A hand-built setup may point the pulse at a photo. It was still asked,
       so it is still one of the things today wanted. */
    const s = checkinStatus(src({ primaryKey: "shot", score: 2 }));
    expect(part(s, "questions").total).toBe(6);
    expect(part(s, "questions").done).toBe(1);
  });

  it("treats a stored null as the deliberate skip it is", () => {
    const s = checkinStatus(src({ answers: { severity: 3, itch: null } }));
    expect(s.done).toBe(1);
    expect(s.left).toBe(4);
  });

  it("does not count an empty string or an empty multi-select", () => {
    const s = checkinStatus(src({ answers: { severity: 3, triggers: [], sleep: 0 } }));
    // Zero hours of sleep is an answer; nothing chosen is not.
    expect(s.done).toBe(2);
  });
});

describe("the routine is part of the day, and a skip answers it", () => {
  it("adds the scheduled rows to the fraction", () => {
    const s = checkinStatus(src({ routine: { done: 1, skipped: 1, total: 4 } }));
    expect(part(s, "routine")).toMatchObject({ done: 2, total: 4, counted: true });
    expect(s.total).toBe(9);
    expect(s.done).toBe(2);
  });

  it("says nothing at all when nothing is scheduled", () => {
    expect(checkinStatus(src({ routine: { done: 0, skipped: 0, total: 0 } })).parts
      .some((p) => p.id === "routine")).toBe(false);
    expect(checkinStatus(src()).parts.some((p) => p.id === "routine")).toBe(false);
  });
});

describe("what a ring is not allowed to claim", () => {
  it("shows the photo, the note and the meals without counting any of them", () => {
    const s = checkinStatus(src({
      hasPhotoFields: true,
      photos: { shot: { photoId: "p1" } },
      notes: "  a line about today  ",
      meals: 3,
      answers: { severity: 5 },
    }));
    expect(part(s, "photo")).toMatchObject({ done: 1, total: 0, counted: false });
    expect(part(s, "note")).toMatchObject({ done: 1, total: 0, counted: false });
    expect(part(s, "meals")).toMatchObject({ done: 3, total: 0, counted: false });
    // Five questions, one answered. Three meals did not move the fraction.
    expect(s.total).toBe(5);
    expect(s.done).toBe(1);
    expect(s.extras.map((p) => p.id)).toEqual(["photo", "note", "meals"]);
  });

  it("leaves the photo row out entirely when the setup has no camera in it", () => {
    expect(checkinStatus(src()).parts.some((p) => p.id === "photo")).toBe(false);
  });

  it("counts whitespace as no note", () => {
    expect(part(checkinStatus(src({ notes: "   \n " })), "note").done).toBe(0);
  });

  it("is not untouched once something optional has happened", () => {
    const s = checkinStatus(src({ notes: "went swimming" }));
    expect(s.done).toBe(0);
    expect(s.untouched).toBe(false);
  });
});

describe("finished means finished", () => {
  const all = { severity: 5, itch: 2, sleep: 7, flared: false, triggers: ["dust"] };

  it("is complete only when everything the day asked for is in", () => {
    const s = checkinStatus(src({ answers: all, routine: { done: 2, skipped: 0, total: 2 } }));
    expect(s.complete).toBe(true);
    expect(s.left).toBe(0);
    expect(s.pct).toBe(100);
  });

  it("is not complete with a dose still outstanding, however many questions are in", () => {
    const s = checkinStatus(src({ answers: all, routine: { done: 0, skipped: 0, total: 2 } }));
    expect(s.complete).toBe(false);
    expect(s.left).toBe(2);
  });

  it("never calls an empty setup finished", () => {
    const s = checkinStatus({ fields: [], primaryKey: "severity", answers: {}, score: null });
    expect(s.total).toBe(0);
    expect(s.complete).toBe(false);
    expect(s.ratio).toBe(0);
    expect(checkinPips(s)).toEqual([]);
  });

  it("says false is an answer, because it is", () => {
    expect(checkinStatus(src({ answers: { flared: false } })).done).toBe(1);
  });
});

/* Rituals were absent from this arithmetic for a release, and the symptom was
   the one a check-in cannot survive: a person whose morning is a five-step
   ritual could leave the whole of it untouched and be told the day was fully
   on the record. A ritual is exactly what this module says a counted part is —
   something today asked for, with a denominator its owner set. */
describe("the rituals today asked for", () => {
  const withRituals = (over = {}) => checkinStatus(src({
    answers: { severity: 5, itch: 1, sleep: 7, flared: true, triggers: ["dust"] },
    rituals: { done: 0, skipped: 0, total: 2, ...over },
  }));

  it("puts them in the fraction, not beside it", () => {
    const s = withRituals();
    expect(part(s, "rituals").counted).toBe(true);
    expect(s.total).toBe(7);
    expect(s.done).toBe(5);
  });

  it("will not call a day complete while one is still untouched", () => {
    expect(withRituals().complete).toBe(false);
    expect(withRituals({ done: 2 }).complete).toBe(true);
  });

  it("counts a deliberate skip as answered, exactly as the routine does", () => {
    /* The question a scheduled thing asks is "did you deal with this", and
       "not today" is a way of dealing with it. */
    expect(withRituals({ done: 1, skipped: 1 }).complete).toBe(true);
    expect(part(withRituals({ done: 1, skipped: 1 }), "rituals").done).toBe(2);
  });

  it("counts a part-finished ritual as unanswered — that is the state worth showing", () => {
    expect(withRituals({ done: 1 }).left).toBe(1);
  });

  it("shows no ritual row on a journal that has none", () => {
    expect(checkinStatus(src()).parts.some((p) => p.id === "rituals")).toBe(false);
    expect(checkinStatus(src({ rituals: { done: 0, skipped: 0, total: 0 } }))
      .parts.some((p) => p.id === "rituals")).toBe(false);
  });

  it("gives them their own run of marks, after the routine's", () => {
    const pips = checkinPips(checkinStatus(src({
      answers: { severity: 5 },
      routine: { done: 1, skipped: 0, total: 2 },
      rituals: { done: 1, skipped: 0, total: 2 },
    })));
    expect(pips.map((p) => p.part)).toEqual([
      "questions", "questions", "questions", "questions", "questions",
      "routine", "routine", "rituals", "rituals",
    ]);
    expect(pips.filter((p) => p.on)).toHaveLength(3);
  });
});

describe("the words", () => {
  it("changes with the state and says nothing about the person", () => {
    expect(checkinLine(checkinStatus(src()))).toBe("5 to answer, about a minute.");
    expect(checkinLine(checkinStatus(src({ answers: { severity: 5, itch: 1 } }))))
      .toBe("3 to go.");
    expect(checkinLine(checkinStatus(src({ answers: { severity: 5, itch: 1, sleep: 7, flared: true } }))))
      .toBe("One left.");
    expect(checkinLine(checkinStatus(src({
      answers: { severity: 5, itch: 1, sleep: 7, flared: true, triggers: ["dust"] },
    })))).toBe("Today is fully on the record.");
  });

  /* The line is never drawn on its own: every caller puts a ring showing the
     fraction and a row of pips showing which pieces right beside it. So the
     line saying the fraction too would be the same number three times in one
     card, and the two that are shapes are the two worth keeping. */
  it("does not repeat the fraction the ring beside it is already drawing", () => {
    const part = checkinLine(checkinStatus(src({ answers: { severity: 5, itch: 1 } })));
    expect(part).not.toMatch(/\bof\b/);
    expect(part).not.toMatch(/\b2\b/);
    expect(checkinLine(checkinStatus(src({
      answers: { severity: 5, itch: 1, sleep: 7, flared: true, triggers: ["dust"] },
    })))).not.toMatch(/\d/);
  });

  it("never says 'questions' on a setup where some of them are doses", () => {
    const line = checkinLine(checkinStatus(src({ routine: { done: 0, skipped: 0, total: 3 } })));
    expect(line).toBe("8 to answer, about a minute.");
    expect(line).not.toMatch(/question/i);
  });

  it("names the action after the state", () => {
    expect(checkinVerb(checkinStatus(src()))).toBe("Start today's check-in");
    expect(checkinVerb(checkinStatus(src({ answers: { severity: 5 } })))).toBe("Finish today's check-in");
    expect(checkinVerb(checkinStatus(src({
      answers: { severity: 5, itch: 1, sleep: 7, flared: true, triggers: ["dust"] },
    })))).toBe("Review today's check-in");
  });
});

describe("the marks", () => {
  it("draws one per thing asked for, in part order, filled as far as it got", () => {
    const pips = checkinPips(checkinStatus(src({
      answers: { severity: 5, itch: 2 },
      routine: { done: 1, skipped: 0, total: 2 },
    })));
    expect(pips).toHaveLength(7);
    expect(pips.filter((p) => p.on)).toHaveLength(3);
    expect(pips.map((p) => p.part)).toEqual([
      "questions", "questions", "questions", "questions", "questions", "routine", "routine",
    ]);
    // The filled ones lead each part, so the row reads as two progress runs.
    expect(pips.map((p) => p.on)).toEqual([true, true, false, false, false, true, false]);
  });

  it("gives up and lets a bar say it once the row would be a texture", () => {
    const many = Array.from({ length: PIP_LIMIT + 1 }, (_, i) => ({
      k: `q${i}`, label: `Q${i}`, type: "scale",
    })) as PulseField[];
    const s = checkinStatus({ fields: many, primaryKey: "q0", answers: {}, score: null });
    expect(s.total).toBe(PIP_LIMIT + 1);
    expect(checkinPips(s)).toEqual([]);
  });
});

describe("what the day asked for, once a question can ask less often", () => {
  /* The failure this guards against arrives through the front door: a weekly
     weight already answered on Monday, counted as missing on Tuesday, putting
     a permanent "10 of 11" on a journal that is completely up to date. */
  const some = new Set(["itch", "sleep"]);

  it("counts only the questions today is asking for", () => {
    const s = checkinStatus(src({ due: some }));
    /* itch, sleep, and the pulse itself — never the two that went quiet. */
    expect(part(s, "questions").total).toBe(3);
  });

  it("always asks the pulse, whatever the schedule says", () => {
    const s = checkinStatus(src({ due: new Set<string>() }));
    expect(part(s, "questions").total).toBe(1);
    expect(s.total).toBe(1);
  });

  it("can be finished by answering only what was asked", () => {
    const s = checkinStatus(src({
      due: some,
      score: 4,
      answers: { itch: 3, sleep: 7 },
    }));
    expect(s.complete).toBe(true);
    expect(s.left).toBe(0);
  });

  it("is the whole template when nothing narrows it — every journal, before", () => {
    expect(checkinStatus(src({ due: null })).total)
      .toBe(checkinStatus(src()).total);
  });
});
