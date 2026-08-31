/* What somebody came here to find out, and when it can be answered.

   Two things are worth failing a build over in this module, and they are not
   the copy.

   The first is the arithmetic. Every date this app prints on the last screen
   of its setup is a promise made to somebody who has not used it yet, and a
   promise made in dates is checkable — which is the whole reason to make it in
   dates. If "the first pattern can show around the 12th" is out by a week on a
   three-times-a-week journal, the app has told a lie to precisely the person
   who was deciding whether to believe it.

   The second is that an aim never *does* anything on its own. It orders a
   list, it marks a row, it changes what the next screens suggest — and it must
   never be able to switch a question, a photograph or a button on. That rule
   lives in the flow, but the shape of this module is what makes it easy to
   keep: nothing here returns state, only suggestions. */
import { describe, it, expect } from "vitest";
import {
  AIMS, aimById, aimsFor, answersAim, awayLabel, daysFor, horizon, nextRung, perWeek, readyLine,
} from "../src/lib/aims";
import { EMERGING_AT, USEFUL_AT } from "../src/lib/evidence";

describe("the aims themselves", () => {
  it("offers a small number of real questions, and one honest refusal", () => {
    expect(AIMS.length).toBeGreaterThanOrEqual(4);
    expect(AIMS.length).toBeLessThanOrEqual(6);
    const record = AIMS.find((a) => a.id === "record")!;
    expect(record).toBeTruthy();
    /* The refusal is a real answer and says what it does *not* switch on. */
    expect(record.needs.extras).toHaveLength(0);
    expect(record.needs.subjects).toHaveLength(0);
  });

  it("leads with what this person's own conditions reach for", () => {
    const forGut = aimsFor(["ibs"]).map((a) => a.id);
    expect(forGut[0]).toBe("triggers");
    const forDiet = aimsFor(["carnivore"]).map((a) => a.id);
    expect(forDiet[0]).toBe("better");
  });

  it("never leads with 'nothing in particular', however little it knows", () => {
    for (const mods of [[], ["ibs"], ["eczema", "migraine"], ["nonsense"]]) {
      const ids = aimsFor(mods).map((a) => a.id);
      expect(ids[0]).not.toBe("record");
      expect(ids[ids.length - 1]).toBe("record");
      /* Every aim is offered to everybody — ordering is the only opinion. */
      expect(ids.sort()).toEqual(AIMS.map((a) => a.id).sort());
    }
  });

  it("knows which questions bear on which aim, and does not overreach", () => {
    const triggers = aimById("triggers")!;
    expect(answersAim(triggers, { label: "Dairy", sec: "Possible triggers" })).toBe(true);
    expect(answersAim(triggers, { label: "Hours slept", sec: "Lifestyle" })).toBe(true);
    expect(answersAim(triggers, { label: "Left hand severity", sec: "Body areas" })).toBe(false);
    /* "Nothing in particular" marks nothing at all — an app that highlighted
       rows for somebody who declined to name a question would be inventing
       one on their behalf. */
    expect(answersAim(aimById("record"), { label: "Dairy", sec: "Possible triggers" })).toBe(false);
    expect(answersAim(null, { label: "Dairy", sec: "Possible triggers" })).toBe(false);
  });
});

describe("how long that takes", () => {
  it("counts check-ins at the rate the journal was actually set to ask", () => {
    expect(perWeek("daily")).toBe(7);
    expect(perWeek("weekly")).toBe(1);
    /* An unrecognised cadence is treated as daily rather than crashing or
       printing nothing: no date at all is worse than a conservative one. */
    expect(perWeek("nonsense")).toBe(7);
  });

  it("counts from today's entry, not from an empty journal", () => {
    // Today is the first: six more days is a week of check-ins.
    expect(daysFor(7, "daily")).toBe(6);
    expect(daysFor(1, "daily")).toBe(0);
    expect(daysFor(0, "daily")).toBe(0);
  });

  it("never rounds a promise down", () => {
    /* Three times a week: twelve check-ins is eleven more, which is 25.67
       days. A journal that said 25 would be a day short on the morning
       somebody came to collect. */
    expect(daysFor(12, "thrice")).toBe(26);
    expect(daysFor(EMERGING_AT, "weekly")).toBe(77);
  });

  it("says the same distance the way people say it", () => {
    expect(awayLabel(1)).toBe("tomorrow");
    expect(awayLabel(6)).toBe("in 6 days");
    expect(awayLabel(21)).toBe("in about 3 weeks");
    expect(awayLabel(90)).toBe("in about 3 months");
  });
});

describe("the plan", () => {
  const from = new Date(2026, 0, 1);   // a Thursday, so the maths is readable

  it("is three rungs, dated, in the order a journal reaches them", () => {
    const plan = horizon({ cadence: "daily", from, aim: aimById("triggers") });
    expect(plan.map((m) => m.id)).toEqual(["first", "emerging", "useful"]);
    expect(plan.map((m) => m.entries)).toEqual([7, EMERGING_AT, USEFUL_AT]);
    expect(plan[0].date).toBe("2026-01-07");     // today plus six
    expect(plan[1].date).toBe("2026-01-12");
    expect(plan[2].date).toBe("2026-01-30");
    // Every rung says how many check-ins are still owed for it.
    expect(plan.map((m) => m.left)).toEqual([6, EMERGING_AT - 1, USEFUL_AT - 1]);
  });

  it("uses the rungs the rest of the app is graded on, not rounder ones", () => {
    const plan = horizon({ cadence: "daily", from });
    expect(plan[1].entries).toBe(EMERGING_AT);
    expect(plan[2].entries).toBe(USEFUL_AT);
  });

  it("moves the dates when the journal asks less often", () => {
    const daily = horizon({ cadence: "daily", from });
    const weekly = horizon({ cadence: "weekly", from });
    expect(weekly[2].date > daily[2].date).toBe(true);
    // ...and asks for less of a first week, because four weekly check-ins is
    // a month and "your first week" would be a month late.
    expect(weekly[0].entries).toBe(4);
    expect(weekly[0].title).toMatch(/four weeks/i);
  });

  it("says what the person came for, on the rung that first answers it", () => {
    const triggers = horizon({ cadence: "daily", from, aim: aimById("triggers") });
    expect(triggers[1].body).toMatch(/comparison/i);
    const better = horizon({ cadence: "daily", from, aim: aimById("better") });
    expect(better[1].body).toMatch(/trend/i);
    // …and still says something honest to somebody who named no aim at all.
    const none = horizon({ cadence: "daily", from });
    expect(none[1].body).toMatch(/point anything out/i);
  });

  it("counts from what the journal already holds", () => {
    const day1 = horizon({ cadence: "daily", from, have: 1 });
    const day8 = horizon({ cadence: "daily", from, have: 8 });
    expect(day1[1].left).toBe(EMERGING_AT - 1);
    expect(day8[1].left).toBe(EMERGING_AT - 8);
    expect(day8[1].date < day1[1].date).toBe(true);
  });
});

describe("the next rung, on a journal already running", () => {
  const from = new Date(2026, 0, 1);

  it("is the first one still owed something", () => {
    expect(nextRung({ have: 1, cadence: "daily", from })!.id).toBe("first");
    expect(nextRung({ have: 7, cadence: "daily", from })!.id).toBe("emerging");
    expect(nextRung({ have: EMERGING_AT, cadence: "daily", from })!.id).toBe("useful");
  });

  it("goes quiet once the top rung is behind them", () => {
    /* At that point the app has real findings to show, and a countdown
       underneath them would be furniture. */
    expect(nextRung({ have: USEFUL_AT, cadence: "daily", from })).toBe(null);
    expect(nextRung({ have: 400, cadence: "weekly", from })).toBe(null);
  });

  it("shortens as the journal is kept", () => {
    const early = nextRung({ have: 2, cadence: "daily", from })!;
    const later = nextRung({ have: 5, cadence: "daily", from })!;
    expect(later.left).toBeLessThan(early.left);
    expect(later.days).toBeLessThan(early.days);
  });
});

describe("the line on the screen where the aim is chosen", () => {
  it("names the rung and a date, whichever aim it is about", () => {
    for (const aim of AIMS) {
      const line = readyLine(aim, "daily");
      expect(line.length).toBeGreaterThan(20);
      expect(line).toMatch(new RegExp(String(EMERGING_AT)));
    }
    expect(readyLine(null, "daily")).toMatch(new RegExp(String(EMERGING_AT)));
  });
});
