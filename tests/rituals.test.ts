/* Rituals — the routine as a process, and the scheduler behind the weekly
   tune-up.

   Four promises are pinned here, and they are the four the feature is worth
   nothing without:

   1. One tap finishes the whole thing, and the same tap takes it back.
   2. A run is a *record*. Editing the plan — dropping a step, making one
      optional — can never rewrite what last Tuesday says happened.
   3. The tune-ups never arrive together. Not on the same day, not two days
      running, and not before there is a week worth talking about.
   4. What the tune-up offers to change comes from the week's own numbers, and
      applying it can never leave a ritual asked for on no day at all. */
import { describe, it, expect } from "vitest";
import {
  FEELINGS, FRICTIONS, REVIEW_GAP_DAYS, REVIEW_MIN_AGE, REVIEW_MIN_RUNS, RITUAL_STARTERS,
  SNOOZE_DAYS, WEEKDAYS, applyTweak, bestStreak, boardProgress, celebrationFor, clearRun,
  completeRun, dayBoard, daysLabel, dueReview, dueReviews, newReview, newRitual, newRun,
  newStep, nextReviewDate, pickReviewDay, requiredSteps, ritualFromStarter, ritualReport,
  ritualStreak, runComplete, runOn, runProgress, sanitizeRitualReviews, sanitizeRitualRuns,
  sanitizeRituals, scheduledOn, skipRun, spreadReviewDays, suggestTweaks, toggleStep,
  tuneUpCards, tweakReceipt, weekDots, weekLine, weekdayOf,
  RITUAL_METRICS,
} from "../src/lib/rituals";
import type { Ritual, RitualReview, RitualRun } from "../src/lib/rituals";
import { addDays } from "../src/lib/episodes";
import { buildRitualsTable, buildRitualRunsTable } from "../src/lib/exports";
import { derivedMetric, isDerivedKey } from "../src/lib/metrics";
import { newRoutineItem } from "../src/lib/routine";

/* 2026-08-19 is a Wednesday. Every date below is derived from it, so the
   weekday arithmetic is pinned rather than assumed. */
const WED = "2026-08-19";

const shower = (over: Partial<Ritual> = {}): Ritual => newRitual({
  id: "rt_shower",
  name: "Shower & after",
  emoji: "🚿",
  slot: "evening",
  createdAt: "2026-06-01T09:00:00.000Z",
  steps: [
    newStep({ id: "s1", label: "Lukewarm" }),
    newStep({ id: "s2", label: "Pat dry" }),
    newStep({ id: "s3", label: "Moisturise within 3 minutes" }),
    newStep({ id: "s4", label: "Treatment cream", optional: true }),
  ],
  ...over,
});

/** A run with the given steps ticked, written the way the app writes them. */
const run = (ritual: Ritual, date: string, done: string[], over: Partial<RitualRun> = {}): RitualRun => ({
  ...newRun(ritual, date),
  id: `rr_${ritual.id}_${date}`,
  done,
  completedAt: done.length >= requiredSteps(ritual).length ? `${date}T21:00` : undefined,
  ...over,
});

const fullWeek = (ritual: Ritual, to: string, days = 7): RitualRun[] =>
  Array.from({ length: days }, (_, i) =>
    run(ritual, addDays(to, -i), requiredSteps(ritual).map((s) => s.id)));

describe("the day of the week", () => {
  it("reads a date as a local weekday, not a UTC one", () => {
    expect(weekdayOf(WED)).toBe(3);
    expect(WEEKDAYS[weekdayOf(WED)]).toBe("Wednesday");
    expect(weekdayOf("2026-08-23")).toBe(0);
  });

  it("says when a ritual is asked for, and an empty list means every day", () => {
    expect(scheduledOn(shower(), WED)).toBe(true);
    expect(scheduledOn(shower({ days: [1, 2] }), WED)).toBe(false);
    expect(scheduledOn(shower({ days: [3] }), WED)).toBe(true);
  });

  it("never asks for an archived ritual", () => {
    expect(scheduledOn(shower({ archived: true }), WED)).toBe(false);
  });

  it("names the common schedules in words rather than seven letters", () => {
    expect(daysLabel([])).toBe("Every day");
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(daysLabel([1, 2, 3, 4, 5])).toBe("Weekdays");
    expect(daysLabel([0, 6])).toBe("Weekends");
    expect(daysLabel([1, 3, 5])).toBe("Mon, Wed, Fri");
  });
});

describe("one tap does the whole thing", () => {
  it("completes every required step and stamps when it happened", () => {
    const r = shower();
    const done = completeRun(newRun(r, WED), r);
    expect(runComplete(done, r)).toBe(true);
    expect(runProgress(done, r)).toMatchObject({ done: 3, total: 3 });
    expect(done.completedAt?.startsWith(WED)).toBe(true);
  });

  it("leaves optional steps alone — 'did the usual' does not claim the extras", () => {
    const r = shower();
    expect(completeRun(newRun(r, WED), r).done).not.toContain("s4");
  });

  it("undoes to nothing said, which is not the same as a skip", () => {
    const r = shower();
    const back = clearRun(completeRun(newRun(r, WED), r));
    expect(back.done).toEqual([]);
    expect(back.completedAt).toBeUndefined();
    expect(back.skipped).toBeUndefined();
    expect(runComplete(back, r)).toBe(false);
  });

  it("records a deliberate miss as one", () => {
    const r = shower();
    const s = skipRun(completeRun(newRun(r, WED), r));
    expect(s.skipped).toBe(true);
    expect(runComplete(s, r)).toBe(false);
    expect(runProgress(s, r).done).toBe(0);
  });

  it("ticks and unticks one step, stamping completion only on the last one", () => {
    const r = shower();
    let cur = newRun(r, WED);
    cur = toggleStep(cur, r, "s1");
    expect(cur.completedAt).toBeUndefined();
    cur = toggleStep(cur, r, "s2");
    cur = toggleStep(cur, r, "s3");
    expect(runComplete(cur, r)).toBe(true);
    cur = toggleStep(cur, r, "s2");
    expect(runComplete(cur, r)).toBe(false);
    expect(cur.completedAt).toBeUndefined();
  });

  it("counts a run with nothing in it as nothing said", () => {
    const r = shower();
    expect(runComplete(undefined, r)).toBe(false);
    expect(runProgress(undefined, r)).toEqual({ done: 0, total: 3, ratio: 0 });
  });
});

describe("a run is a record", () => {
  it("keeps a completed day complete after a step is dropped from the plan", () => {
    const r = shower();
    const tuesday = completeRun(newRun(r, WED), r);
    const trimmed: Ritual = { ...r, steps: r.steps.filter((s) => s.id !== "s3") };
    expect(runComplete(tuesday, trimmed)).toBe(true);
    expect(runProgress(tuesday, trimmed)).toMatchObject({ done: 3, total: 3 });
  });

  it("keeps it complete after a step is made optional", () => {
    const r = shower();
    const tuesday = completeRun(newRun(r, WED), r);
    const eased: Ritual = {
      ...r, steps: r.steps.map((s) => (s.id === "s2" ? { ...s, optional: true } : s)),
    };
    expect(runComplete(tuesday, eased)).toBe(true);
  });

  it("re-reads the plan on the next write, so today catches up with an edit", () => {
    const r = shower();
    const today = completeRun(newRun(r, WED), r);
    expect(today.total).toBe(3);
    const grown: Ritual = { ...r, steps: [...r.steps, newStep({ id: "s5", label: "Water" })] };
    const after = toggleStep(today, grown, "s5");
    expect(after.total).toBe(4);
    expect(runComplete(after, grown)).toBe(true);
  });

  it("never counts more than the run asked for, however many extras were ticked", () => {
    const r = shower();
    const everything = toggleStep(completeRun(newRun(r, WED), r), r, "s4");
    expect(runProgress(everything, r)).toMatchObject({ done: 3, total: 3 });
  });
});

describe("the day's board", () => {
  const morning = newRitual({
    id: "rt_am", name: "Morning meds", slot: "morning",
    steps: [newStep({ id: "m1", label: "Water" })],
  });

  it("orders by part of the day, not by when they were created", () => {
    const rows = dayBoard([shower(), morning], [], WED);
    expect(rows.map((r) => r.ritual.id)).toEqual(["rt_am", "rt_shower"]);
  });

  it("leaves out anything not asked for today", () => {
    const rows = dayBoard([shower({ days: [1] }), morning], [], WED);
    expect(rows.map((r) => r.ritual.id)).toEqual(["rt_am"]);
  });

  it("counts a skip as answered, exactly as the routine does", () => {
    const r = shower();
    const runs = [skipRun(newRun(r, WED))];
    const p = boardProgress([r, morning], runs, WED);
    expect(p).toMatchObject({ done: 0, skipped: 1, total: 2 });
    expect(p.ratio).toBeCloseTo(0.5);
  });

  it("returns a null ratio rather than a zero when nothing is scheduled", () => {
    expect(boardProgress([], [], WED).ratio).toBeNull();
  });
});

describe("streaks", () => {
  it("counts consecutive completed days back from today", () => {
    const r = shower();
    expect(ritualStreak(r, fullWeek(r, WED, 4), WED)).toBe(4);
  });

  it("does not break on a day the ritual was never asked for", () => {
    /* Weekdays only. Monday the 24th, back over the weekend to Friday. */
    const r = shower({ days: [1, 2, 3, 4, 5], createdAt: "2026-06-01T09:00:00.000Z" });
    const mon = "2026-08-24";
    const runs = [mon, "2026-08-21", "2026-08-20"].map((d) =>
      run(r, d, requiredSteps(r).map((s) => s.id)));
    expect(ritualStreak(r, runs, mon)).toBe(3);
  });

  it("does not break on an unanswered today — the day is not over", () => {
    const r = shower();
    const runs = fullWeek(r, addDays(WED, -1), 3);
    expect(ritualStreak(r, runs, WED)).toBe(3);
  });

  it("does break on an explicit 'not today'", () => {
    const r = shower();
    const runs = [...fullWeek(r, addDays(WED, -1), 3), skipRun(newRun(r, WED))];
    expect(ritualStreak(r, runs, WED)).toBe(0);
  });

  it("remembers the best run even after it ends", () => {
    const r = shower();
    const runs = fullWeek(r, addDays(WED, -3), 5);
    expect(ritualStreak(r, runs, WED)).toBe(0);
    expect(bestStreak(r, runs, WED)).toBe(5);
  });
});

describe("the week strip", () => {
  it("is always seven days, oldest first, ending on the day asked for", () => {
    const dots = weekDots(shower(), [], WED);
    expect(dots).toHaveLength(7);
    expect(dots[0].date).toBe(addDays(WED, -6));
    expect(dots[6].date).toBe(WED);
  });

  it("tells apart done, part-way, skipped, missed and never-asked", () => {
    const r = shower({ days: [1, 2, 3, 4, 5] });
    const runs = [
      run(r, "2026-08-17", ["s1", "s2", "s3"]), // Mon, done
      run(r, "2026-08-18", ["s1"]),             // Tue, part
      skipRun(newRun(r, "2026-08-19")),         // Wed, skipped
    ];
    const dots = weekDots(r, runs, "2026-08-21");
    const by = Object.fromEntries(dots.map((d) => [d.date, d.state]));
    expect(by["2026-08-15"]).toBe("off"); // Saturday — never asked
    expect(by["2026-08-17"]).toBe("done");
    expect(by["2026-08-18"]).toBe("part");
    expect(by["2026-08-19"]).toBe("skip");
    expect(by["2026-08-20"]).toBe("miss");
  });

  it("marks days after today as future rather than missed", () => {
    const dots = weekDots(shower(), [], addDays(WED, 3), WED);
    expect(dots[6].state).toBe("future");
  });
});

describe("what a week says", () => {
  it("counts the days it was asked for, not the days in the calendar", () => {
    const r = shower({ days: [1, 3, 5] });
    const rep = ritualReport(r, [], "2026-08-21");
    expect(rep.asked).toBe(3);
  });

  it("finds the step that is clearly behind the others", () => {
    const r = shower();
    const runs = Array.from({ length: 7 }, (_, i) =>
      run(r, addDays(WED, -i), i < 6 ? ["s1", "s2"] : ["s1", "s2", "s3"]));
    const rep = ritualReport(r, runs, WED);
    expect(rep.weakest?.step.id).toBe("s3");
  });

  it("names no weakest step when the week itself was the problem", () => {
    /* Three good days and four blank ones. Every step is equally behind, so
       there is nothing to single out — the app must say nothing rather than
       pick on whichever one sorted first. */
    const r = shower();
    const runs = Array.from({ length: 7 }, (_, i) =>
      run(r, addDays(WED, -i), i < 3 ? ["s1", "s2", "s3"] : []));
    expect(ritualReport(r, runs, WED).weakest).toBeUndefined();
  });

  it("works out the usual finishing time, and only from three or more", () => {
    const r = shower();
    const times = ["21:00", "21:20", "22:00"];
    const runs = times.map((t, i) =>
      run(r, addDays(WED, -i), ["s1", "s2", "s3"], { completedAt: `${addDays(WED, -i)}T${t}` }));
    expect(ritualReport(r, runs, WED).usualTime).toBe("21:20");
    expect(ritualReport(r, runs.slice(0, 2), WED).usualTime).toBeUndefined();
  });

  it("compares against the week before, and says nothing when there isn't one", () => {
    const r = shower();
    expect(ritualReport(r, [], WED).prevRate).toBe(0);
    const rep = ritualReport(r, fullWeek(r, WED, 14), WED);
    expect(rep.rate).toBe(1);
    expect(rep.prevRate).toBe(1);
  });

  it("opens with the week rather than a question", () => {
    const r = shower();
    expect(weekLine(ritualReport(r, fullWeek(r, WED), WED))).toMatch(/Every single day/);
    expect(weekLine(ritualReport(r, fullWeek(r, WED, 4), WED))).toMatch(/4 of 7 days/);
  });

  it("never congratulates somebody for a blank week", () => {
    const r = shower();
    expect(celebrationFor(ritualReport(r, [], WED)).title).toBe("A blank week");
    expect(celebrationFor(ritualReport(r, fullWeek(r, WED), WED)).title).toBe("Perfect week");
  });

  it("skips the friction question on a week nothing got in the way of", () => {
    const r = shower();
    const clean = tuneUpCards(ritualReport(r, fullWeek(r, WED), WED));
    expect(clean.map((c) => c.id)).toEqual(["felt"]);
    const messy = tuneUpCards(ritualReport(r, fullWeek(r, WED, 3), WED));
    expect(messy.map((c) => c.id)).toEqual(["felt", "friction"]);
  });
});

describe("the scheduler: one at a time, never the same day", () => {
  it("gives the first ritual today's weekday and spreads the rest away from it", () => {
    const first = pickReviewDay([], WED);
    expect(first).toBe(3);
    const a = shower({ id: "a", reviewDay: first });
    const second = pickReviewDay([a], WED);
    expect(second).toBe(0); // as far from Wednesday as the week allows
    const b = shower({ id: "b", reviewDay: second });
    const third = pickReviewDay([a, b], WED);
    expect([1, 5]).toContain(third);
  });

  it("fills all seven days before any day is used twice", () => {
    const set: Ritual[] = [];
    for (let i = 0; i < 7; i++) {
      set.push(shower({ id: `r${i}`, reviewDay: pickReviewDay(set, WED) }));
    }
    expect(new Set(set.map((r) => r.reviewDay)).size).toBe(7);
  });

  it("re-spreads a restored file where everything landed on the same day", () => {
    const clashing = [0, 1, 2].map((i) => shower({ id: `r${i}`, reviewDay: 0 }));
    const spread = spreadReviewDays(clashing, WED);
    expect(new Set(spread.map((r) => r.reviewDay)).size).toBe(3);
  });

  it("leaves a spread that already works exactly as it is", () => {
    const fine = [0, 3, 5].map((d, i) => shower({ id: `r${i}`, reviewDay: d }));
    expect(spreadReviewDays(fine, WED).map((r) => r.reviewDay)).toEqual([0, 3, 5]);
  });

  it("waits a full week past the ritual's birthday, then lands on its own day", () => {
    const born = "2026-08-01"; // a Saturday
    const r = shower({ createdAt: `${born}T10:00:00.000Z`, reviewDay: 3 }); // Wednesday
    const due = nextReviewDate(r, []);
    expect(due >= addDays(born, REVIEW_MIN_AGE)).toBe(true);
    expect(weekdayOf(due)).toBe(3);
  });

  it("comes back a week after it was answered", () => {
    const r = shower({ reviewDay: 3 });
    const reviews = [newReview({ ritualId: r.id, date: WED, felt: 4 })];
    expect(nextReviewDate(r, reviews)).toBe(addDays(WED, 7));
  });

  it("comes back in a couple of days after a snooze, not a week", () => {
    const r = shower({ reviewDay: 3 });
    const reviews = [newReview({ ritualId: r.id, date: WED, snoozed: true })];
    expect(nextReviewDate(r, reviews)).toBe(addDays(WED, SNOOZE_DAYS));
  });

  it("says nothing until there is a week of history behind it", () => {
    const r = shower({ createdAt: `${addDays(WED, -2)}T10:00`, reviewDay: 3 });
    expect(dueReview([r], fullWeek(r, WED, 2), [], WED)).toBeNull();
  });

  it("says nothing until the ritual has actually been used", () => {
    const r = shower({ createdAt: "2026-06-01T09:00:00.000Z", reviewDay: 3 });
    expect(dueReviews([r], fullWeek(r, WED, REVIEW_MIN_RUNS - 1), [], WED)).toHaveLength(0);
    expect(dueReviews([r], fullWeek(r, WED, REVIEW_MIN_RUNS), [], WED)).toHaveLength(1);
  });

  it("never returns a ritual with no steps at all", () => {
    const empty = newRitual({ id: "rt_empty", name: "Nothing", steps: [], createdAt: "2026-06-01T09:00:00.000Z" });
    expect(dueReviews([empty], [], [], WED)).toHaveLength(0);
  });

  it("shows one, and only one, when several came due at once", () => {
    const a = shower({ id: "a", reviewDay: 0, createdAt: "2026-06-01T09:00:00.000Z" });
    const b = shower({ id: "b", reviewDay: 1, createdAt: "2026-06-01T09:00:00.000Z" });
    const c = shower({ id: "c", reviewDay: 2, createdAt: "2026-06-01T09:00:00.000Z" });
    const runs = [...fullWeek(a, WED), ...fullWeek(b, WED), ...fullWeek(c, WED)]
      .map((r, i) => ({ ...r, id: `x${i}` }));
    const owed = dueReviews([a, b, c], runs, [], WED);
    expect(owed).toHaveLength(3);
    /* All three are owed; exactly one is shown, and it is the one that has
       been waiting longest. */
    expect(dueReview([a, b, c], runs, [], WED)?.id).toBe(owed[0].ritual.id);
  });

  it("shows nothing at all on a day one has already been answered", () => {
    const a = shower({ id: "a", reviewDay: 0, createdAt: "2026-06-01T09:00:00.000Z" });
    const b = shower({ id: "b", reviewDay: 1, createdAt: "2026-06-01T09:00:00.000Z" });
    const runs = [...fullWeek(a, WED), ...fullWeek(b, WED).map((r, i) => ({ ...r, id: `y${i}` }))];
    const answered = [newReview({ ritualId: "a", date: WED, felt: 5 })];
    expect(dueReview([a, b], runs, answered, WED)).toBeNull();
  });

  it("keeps a gap between two tune-ups even when their own days are adjacent", () => {
    const a = shower({ id: "a", reviewDay: 0, createdAt: "2026-06-01T09:00:00.000Z" });
    const b = shower({ id: "b", reviewDay: 1, createdAt: "2026-06-01T09:00:00.000Z" });
    const runs = [...fullWeek(a, WED), ...fullWeek(b, WED).map((r, i) => ({ ...r, id: `z${i}` }))];
    const answered: RitualReview[] = [newReview({ ritualId: "a", date: WED, felt: 4 })];
    /* The day after, and the day after that, are inside the gap. */
    for (let i = 1; i < REVIEW_GAP_DAYS; i++) {
      expect(dueReview([a, b], runs, answered, addDays(WED, i))).toBeNull();
    }
    expect(dueReview([a, b], runs, answered, addDays(WED, REVIEW_GAP_DAYS))?.id).toBe("b");
  });

  it("a snooze still costs the gap, so dismissing one does not summon the next", () => {
    const a = shower({ id: "a", reviewDay: 0, createdAt: "2026-06-01T09:00:00.000Z" });
    const b = shower({ id: "b", reviewDay: 1, createdAt: "2026-06-01T09:00:00.000Z" });
    const runs = [...fullWeek(a, WED), ...fullWeek(b, WED).map((r, i) => ({ ...r, id: `w${i}` }))];
    const snoozed = [newReview({ ritualId: "a", date: WED, snoozed: true })];
    expect(dueReview([a, b], runs, snoozed, WED)).toBeNull();
    expect(dueReview([a, b], runs, snoozed, addDays(WED, 1))).toBeNull();
  });

  it("ranks the most overdue first when the app was closed for a fortnight", () => {
    const a = shower({ id: "a", reviewDay: 3, createdAt: "2026-06-01T09:00:00.000Z" });
    const b = shower({ id: "b", reviewDay: 5, createdAt: "2026-06-01T09:00:00.000Z" });
    const reviews = [
      newReview({ ritualId: "a", date: addDays(WED, -21), felt: 3 }),
      newReview({ ritualId: "b", date: addDays(WED, -9), felt: 3 }),
    ];
    const runs = [...fullWeek(a, WED), ...fullWeek(b, WED).map((r, i) => ({ ...r, id: `v${i}` }))];
    const order = dueReviews([a, b], runs, reviews, WED);
    expect(order.map((d) => d.ritual.id)).toEqual(["a", "b"]);
    expect(order[0].overdue).toBeGreaterThan(order[1].overdue);
  });
});

describe("what the tune-up offers to change", () => {
  const weakWeek = (r: Ritual) => Array.from({ length: 7 }, (_, i) =>
    run(r, addDays(WED, -i), ["s1", "s2"]));

  it("offers to ease the step that keeps slipping, before offering to drop it", () => {
    const r = shower();
    const tweaks = suggestTweaks(ritualReport(r, weakWeek(r), WED), weakWeek(r));
    const ids = tweaks.map((t) => t.id);
    expect(ids).toContain("ease_s3");
    expect(ids.indexOf("ease_s3")).toBeLessThan(ids.indexOf("drop_s3"));
  });

  it("does not offer to delete a step done half the time", () => {
    const r = shower();
    const runs = Array.from({ length: 8 }, (_, i) =>
      run(r, addDays(WED, -i), i % 2 ? ["s1", "s2"] : ["s1", "s2", "s3"]));
    const ids = suggestTweaks(ritualReport(r, runs, WED), runs).map((t) => t.id);
    expect(ids).not.toContain("drop_s3");
  });

  it("offers to move it to the part of the day it actually happens in", () => {
    const r = shower({ slot: "evening" });
    const runs = Array.from({ length: 5 }, (_, i) => {
      const d = addDays(WED, -i);
      return run(r, d, ["s1", "s2", "s3"], { completedAt: `${d}T07:30` });
    });
    const tweaks = suggestTweaks(ritualReport(r, runs, WED), runs);
    expect(tweaks.find((t) => t.action.type === "moveSlot")).toBeTruthy();
  });

  it("always offers to leave it alone, and puts that first on a good week", () => {
    const r = shower();
    const good = suggestTweaks(ritualReport(r, fullWeek(r, WED), WED), fullWeek(r, WED));
    expect(good[0].id).toBe("keep");
    const bad = suggestTweaks(ritualReport(r, weakWeek(r), WED), weakWeek(r));
    expect(bad[bad.length - 1].id).toBe("keep");
  });

  it("offers at most four things, because a menu of eight is a decision", () => {
    const r = shower();
    expect(suggestTweaks(ritualReport(r, weakWeek(r), WED), weakWeek(r)).length).toBeLessThanOrEqual(4);
  });
});

describe("applying a tweak", () => {
  it("keeps the ritual untouched when the answer is 'leave it'", () => {
    const r = shower();
    expect(applyTweak(r, { type: "keep" })).toBe(r);
  });

  it("drops a step, and eases one without losing it", () => {
    const r = shower();
    expect(applyTweak(r, { type: "dropStep", stepId: "s3" }).steps.map((s) => s.id))
      .toEqual(["s1", "s2", "s4"]);
    const eased = applyTweak(r, { type: "easeStep", stepId: "s3" });
    expect(eased.steps.find((s) => s.id === "s3")?.optional).toBe(true);
    expect(requiredSteps(eased)).toHaveLength(2);
  });

  it("drops weekdays, and collapses a full week back to 'every day' when adding", () => {
    const r = shower({ days: [1, 2, 3, 4, 5] });
    expect(applyTweak(r, { type: "dropDays", days: [1] }).days).toEqual([2, 3, 4, 5]);
    expect(applyTweak(r, { type: "addDays", days: [0, 6] }).days).toEqual([]);
  });

  it("refuses to leave a ritual asked for on no day at all", () => {
    const r = shower({ days: [1] });
    expect(applyTweak(r, { type: "dropDays", days: [1] }).days).toEqual([1]);
  });

  it("says what it did in the past tense, for the toast", () => {
    const r = shower();
    expect(tweakReceipt(r, { id: "k", emoji: "👌", label: "", action: { type: "keep" } }))
      .toMatch(/left as it is/);
    expect(tweakReceipt(r, { id: "m", emoji: "🕰️", label: "", action: { type: "moveSlot", slot: "morning" } }))
      .toMatch(/morning/);
  });
});

describe("the starters", () => {
  it("writes every one of them out in full, with a face and steps", () => {
    for (const s of RITUAL_STARTERS) {
      expect(s.name.length).toBeGreaterThan(2);
      expect(s.emoji).toBeTruthy();
      expect(s.steps.length).toBeGreaterThan(1);
      expect(s.blurb.length).toBeGreaterThan(10);
    }
  });

  it("fills the meds ones from the routine somebody already keeps", () => {
    const items = [
      newRoutineItem({ id: "ri_d", name: "Vitamin D3", dose: "2000 IU", times: ["morning"], daily: true }),
      newRoutineItem({ id: "ri_f", name: "Fish oil", times: ["evening"], daily: true }),
    ];
    const starter = RITUAL_STARTERS.find((s) => s.fromSlot === "morning")!;
    const built = ritualFromStarter(starter, { items, existing: [], today: WED });
    const linked = built.steps.filter((s) => s.itemId);
    expect(linked.map((s) => s.label)).toEqual(["Vitamin D3"]);
    expect(linked[0].hint).toContain("2000 IU");
    /* Water first, then the pills — the written step keeps its place. */
    expect(built.steps[0].itemId).toBeUndefined();
  });

  it("gives each new one its own tune-up day", () => {
    const a = ritualFromStarter(RITUAL_STARTERS[0], { existing: [], today: WED });
    const b = ritualFromStarter(RITUAL_STARTERS[1], { existing: [a], today: WED });
    expect(a.reviewDay).not.toBe(b.reviewDay);
  });
});

describe("the catalogues the popup is made of", () => {
  it("gives every feeling a face and every friction a word", () => {
    expect(FEELINGS).toHaveLength(5);
    for (const f of FEELINGS) expect(f.emoji && f.label).toBeTruthy();
    for (const f of FRICTIONS) expect(f.emoji && f.label && f.v).toBeTruthy();
  });
});

describe("charting rituals", () => {
  it("plots how many were finished, and refuses to when there are none", () => {
    const r = shower();
    const ctx = { rituals: [r], ritualRuns: fullWeek(r, WED, 1), date: WED };
    expect(derivedMetric("rl_done")?.value(ctx)).toBe(1);
    expect(derivedMetric("rl_pct")?.value(ctx)).toBe(100);
    expect(derivedMetric("rl_done")?.value({ rituals: [], ritualRuns: [], date: WED })).toBeNull();
  });

  it("is neutral in direction, because there is no healthy number of showers", () => {
    for (const m of RITUAL_METRICS) {
      expect(m.dir).toBe("neutral");
      expect(isDerivedKey(m.k)).toBe(true);
    }
  });
});

describe("the spreadsheet", () => {
  it("names the steps actually done rather than counting them", () => {
    const r = shower();
    const runs = [run(r, WED, ["s1", "s2"])];
    const tbl = buildRitualRunsTable(runs, [r]);
    const row = tbl.rows[0];
    expect(row[tbl.header.indexOf("status")]).toBe("part");
    expect(row[tbl.header.indexOf("step_list")]).toBe("Lukewarm; Pat dry");
  });

  it("writes the plan as its own sheet, tune-up day and all", () => {
    const tbl = buildRitualsTable([shower({ reviewDay: 3, days: [1, 3, 5] })]);
    const row = tbl.rows[0];
    expect(row[tbl.header.indexOf("tune_up_day")]).toBe("Wed");
    expect(row[tbl.header.indexOf("days")]).toBe("Mon; Wed; Fri");
    expect(String(row[tbl.header.indexOf("step_list")])).toContain("(optional)");
  });
});

describe("sanitising a hand-edited file", () => {
  it("drops what it cannot read and keeps everything it can", () => {
    const out = sanitizeRituals([
      null,
      { name: "" },
      { id: "a", name: "Shower", steps: [{ label: "Wash" }, { label: "" }, null], days: [1, 9, "x"], reviewDay: 12 },
      { id: "a", name: "Duplicate id" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].steps.map((s) => s.label)).toEqual(["Wash"]);
    expect(out[0].days).toEqual([1]);
    expect(out[0].reviewDay).toBe(0);
  });

  it("refuses two steps sharing an id, which would tick as one", () => {
    const out = sanitizeRituals([{ id: "a", name: "X", steps: [{ id: "s", label: "One" }, { id: "s", label: "Two" }] }]);
    expect(out[0].steps).toHaveLength(1);
  });

  it("treats all seven days listed as 'every day'", () => {
    expect(sanitizeRituals([{ id: "a", name: "X", days: [0, 1, 2, 3, 4, 5, 6] }])[0].days).toEqual([]);
  });

  it("keeps one run per ritual per day", () => {
    const rows = sanitizeRitualRuns([
      { id: "1", date: WED, ritualId: "a", done: ["s1"], total: 2 },
      { id: "2", date: WED, ritualId: "a", done: ["s2"], total: 2 },
      { id: "3", date: WED, ritualId: "b", done: [], total: 1 },
      { id: "4", date: "nope", ritualId: "a" },
      { id: "5", date: WED },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["1", "3"]);
  });

  it("repairs a broken clock rather than dropping the day", () => {
    expect(sanitizeRitualRuns([{ id: "1", date: WED, ritualId: "a", time: "99:99" }])[0].time).toBe("12:00");
  });

  it("keeps only answers it recognises on a review", () => {
    const rows = sanitizeRitualReviews([
      { id: "r1", ritualId: "a", date: WED, felt: 4, friction: "tired" },
      { id: "r2", ritualId: "a", date: WED, felt: 99, friction: "banana" },
      { id: "r3", ritualId: "", date: WED },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ felt: 4, friction: "tired" });
    expect(rows[1].felt).toBeUndefined();
    expect(rows[1].friction).toBeUndefined();
  });

  it("survives being handed something that isn't a list at all", () => {
    expect(sanitizeRituals("nope" as unknown)).toEqual([]);
    expect(sanitizeRitualRuns(undefined)).toEqual([]);
    expect(sanitizeRitualReviews({} as unknown)).toEqual([]);
  });
});

describe("finding a run", () => {
  it("looks one up by ritual and day", () => {
    const r = shower();
    const runs = fullWeek(r, WED, 3);
    expect(runOn(runs, r.id, WED)?.date).toBe(WED);
    expect(runOn(runs, r.id, addDays(WED, 1))).toBeUndefined();
    expect(runOn(runs, "other", WED)).toBeUndefined();
  });
});
