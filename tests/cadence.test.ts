/* How often this journal asks — and what every number in the app means once
   the answer stops being "every day".

   The load-bearing claim under test is the period model: the week owes one
   check-in, not Monday. Get that wrong and a weekly journaler is told they
   missed six days out of every seven, which is the app scoring them against a
   schedule they explicitly turned off. So most of what follows is about
   *when nothing is owed* — the six quiet days, the current period that cannot
   break a streak, the fortnight somebody was in hospital. */
import { describe, it, expect } from "vitest";
import {
  CADENCE_PRESETS, DEFAULT_CADENCE, FIELD_CADENCE_PRESETS,
  adherence, asksInPeriod, cadenceHint, cadenceLabel, cadenceStreak,
  dueKeys, dueNow, fieldDue, fieldNextLine, isPaused, nextAsk,
  periodDates, periodEnd, periodKey, periodLabel, periodPaused, periodStart,
  periodStatus, presetById, presetIdOf, sameCadence, sanitizeCadence, standing,
  sanitizeFieldCadences, streakNoun, withDays,
  type Cadence,
} from "../src/lib/cadence";

const p = (id: string): Cadence => presetById(id)!.cadence;
const daily = p("daily");
const weekly = p("weekly");
const weekdays = p("weekdays");
const alternate = p("alternate");
const monthly = p("monthly");
const manual = p("manual");

/* 2026-08-24 is a Monday; 2026-08-30 the Sunday that closes the same week. */
const MON = "2026-08-24";
const WED = "2026-08-26";
const SUN = "2026-08-30";

describe("reading a cadence back", () => {
  it("defaults to daily when there is nothing to read", () => {
    expect(sanitizeCadence(undefined)).toEqual(DEFAULT_CADENCE);
    expect(sanitizeCadence("weekly")).toEqual(DEFAULT_CADENCE);
    expect(sanitizeCadence({ unit: "fortnight" }).unit).toBe("day");
  });

  it("degrades toward asking more often, never less", () => {
    /* A bad number must not quietly turn a daily journal into a monthly one. */
    expect(sanitizeCadence({ unit: "week", n: "3" }).n).toBe(1);
    expect(sanitizeCadence({ unit: "week", n: 0 }).n).toBe(1);
    expect(sanitizeCadence({ unit: "week", times: 0 }).times).toBe(1);
  });

  it("keeps named weekdays only where they mean something", () => {
    expect(sanitizeCadence({ unit: "week", n: 1, days: [5, 1, 1, 9, -2] }).days).toEqual([1, 5]);
    /* Every other week "on a Tuesday" is the same sentence with more rope. */
    expect(sanitizeCadence({ unit: "week", n: 2, days: [2] }).days).toEqual([]);
    expect(sanitizeCadence({ unit: "month", days: [2] }).days).toEqual([]);
    expect(sanitizeCadence({ unit: "day", days: [2] }).days).toEqual([]);
  });

  it("derives how many a week wants from the days when days are named", () => {
    expect(sanitizeCadence({ unit: "week", n: 1, days: [1, 3, 5], times: 1 }).times).toBe(3);
  });

  it("a period never wants more check-ins than it has days", () => {
    expect(sanitizeCadence({ unit: "day", times: 6 }).times).toBe(1);
    expect(sanitizeCadence({ unit: "week", times: 40 }).times).toBe(7);
  });

  it("carries a pause only when it is a real range", () => {
    expect(sanitizeCadence({ pause: { from: "nope" } }).pause).toBeUndefined();
    expect(sanitizeCadence({ pause: { from: "2026-08-01", to: "2026-07-01" } }).pause)
      .toEqual({ from: "2026-08-01" });
    expect(sanitizeCadence({ pause: { from: "2026-08-01", note: "  away " } }).pause)
      .toEqual({ from: "2026-08-01", note: "away" });
  });

  it("keeps manual as manual", () => {
    expect(sanitizeCadence({ manual: true }).manual).toBe(true);
  });
});

describe("periods", () => {
  it("a daily period is the day", () => {
    expect(periodStart(daily, WED)).toBe(WED);
    expect(periodEnd(daily, WED)).toBe(WED);
    expect(periodDates(daily, WED)).toEqual([WED]);
  });

  it("a weekly period runs Monday to Sunday, whichever day you look from", () => {
    for (const d of ["2026-08-24", "2026-08-26", "2026-08-30"]) {
      expect(periodStart(weekly, d)).toBe(MON);
      expect(periodEnd(weekly, d)).toBe(SUN);
    }
    expect(periodStart(weekly, "2026-08-31")).toBe("2026-08-31");
  });

  it("a monthly period is the calendar month", () => {
    expect(periodStart(monthly, WED)).toBe("2026-08-01");
    expect(periodEnd(monthly, WED)).toBe("2026-08-31");
    expect(periodEnd(monthly, "2026-02-10")).toBe("2026-02-28");
  });

  it("every-other-day lands on a fixed grid rather than on whenever you looked", () => {
    const a = periodStart(alternate, "2026-08-24");
    const b = periodStart(alternate, "2026-08-25");
    expect(a).toBe(b);                                  // the pair shares a period
    expect(periodStart(alternate, "2026-08-26")).not.toBe(a);
    expect(periodDates(alternate, "2026-08-24")).toHaveLength(2);
  });

  it("a fortnight is fourteen days and does not drift", () => {
    const f = p("fortnightly");
    expect(periodDates(f, MON)).toHaveLength(14);
    expect(periodStart(f, MON)).toBe(periodStart(f, "2026-08-30"));
  });

  it("keys the period, not the day", () => {
    expect(periodKey(weekly, MON)).toBe(periodKey(weekly, SUN));
    expect(periodKey(daily, MON)).not.toBe(periodKey(daily, SUN));
  });
});

describe("what a period asked for", () => {
  it("a week with no named days wants its count, on any day of it", () => {
    expect(asksInPeriod(weekly, WED)).toBe(1);
    expect(asksInPeriod(p("thrice"), WED)).toBe(3);
  });

  it("named weekdays are counted where they actually fall", () => {
    expect(asksInPeriod(weekdays, WED)).toBe(5);
  });

  it("a manual cadence asks for nothing", () => {
    expect(asksInPeriod(manual, WED)).toBe(0);
  });
});

describe("the week owes one check-in, not Monday", () => {
  it("a Saturday check-in satisfies the week as fully as a Monday one", () => {
    const sat = periodStatus(weekly, ["2026-08-29"], SUN, SUN);
    expect(sat.complete).toBe(true);
    expect(sat.left).toBe(0);
  });

  it("goes quiet for the rest of the week once the week is in", () => {
    const logged = [MON];
    expect(dueNow(weekly, logged, MON)).toBe(false);
    expect(dueNow(weekly, logged, WED)).toBe(false);
    expect(dueNow(weekly, logged, SUN)).toBe(false);
    /* And asks again the moment the next one opens. */
    expect(dueNow(weekly, logged, "2026-08-31")).toBe(true);
  });

  it("does not hand out credit for logging six times in one week", () => {
    const s = periodStatus(weekly, periodDates(weekly, WED), SUN, SUN);
    expect(s.logged).toBe(7);
    expect(s.left).toBe(0);
  });

  it("only offers catch-up days that have actually happened", () => {
    const s = periodStatus(weekly, [], WED, WED);
    expect(s.open).toEqual(["2026-08-24", "2026-08-25", "2026-08-26"]);
    expect(s.current).toBe(true);
    /* Once the week is over, all of it is on the record either way. */
    expect(periodStatus(weekly, [], WED, "2026-09-02").open).toHaveLength(7);
  });

  it("a daily cadence is due every day, as it always was", () => {
    expect(dueNow(daily, [], WED)).toBe(true);
    expect(dueNow(daily, [WED], WED)).toBe(false);
  });

  it("a manual cadence is never due", () => {
    expect(dueNow(manual, [], WED)).toBe(false);
  });
});

describe("nudges", () => {
  it("fires on the named days, and never on a day nothing is owed", () => {
    expect(dueNow(weekdays, [], WED)).toBe(true);           // a Wednesday
    expect(dueNow(weekdays, [], "2026-08-29")).toBe(false); // a Saturday off
    expect(dueNow(weekdays, [WED], WED)).toBe(false);       // already in
  });

  it("does not nag a chosen day off because the week ran short", () => {
    /* Three of five weekdays done, and the Sunday that closes the week says
       nothing. A day off that gets chased is not a day off. */
    expect(dueNow(weekdays, [MON, "2026-08-25", WED], SUN)).toBe(false);
  });

  it("catches a named-day journal before its period closes blank", () => {
    const friday = withDays({ ...weekly }, [5]);
    expect(dueNow(friday, [], "2026-08-27")).toBe(false);  // Thursday
    expect(dueNow(friday, [], "2026-08-28")).toBe(true);   // Friday
    expect(dueNow(friday, [], SUN)).toBe(true);            // last chance
    expect(dueNow(friday, ["2026-08-28"], SUN)).toBe(false);
  });

  it("says when the next ask is, and never says it for a manual journal", () => {
    expect(nextAsk(daily, WED)).toBe("2026-08-27");
    expect(nextAsk(weekly, WED)).toBe("2026-08-31");
    expect(nextAsk(weekdays, "2026-08-28")).toBe("2026-08-31"); // Friday → Monday
    expect(nextAsk(manual, WED)).toBeNull();
  });
});

describe("pausing", () => {
  const away: Cadence = { ...weekly, pause: { from: "2026-08-24", to: "2026-09-06", note: "away" } };

  it("owes nothing while it runs", () => {
    expect(isPaused(away, WED)).toBe(true);
    expect(dueNow(away, [], WED)).toBe(false);
    expect(nextAsk(away, WED)).toBe("2026-09-07");
  });

  it("only excuses a period it covers end to end", () => {
    expect(periodPaused(away, WED)).toBe(true);
    /* A week with two days of holiday in it still owed a check-in on the
       other five. */
    const partial: Cadence = { ...weekly, pause: { from: "2026-08-29", to: "2026-08-31" } };
    expect(periodPaused(partial, WED)).toBe(false);
  });

  it("an open-ended pause runs until it is cleared", () => {
    const open: Cadence = { ...weekly, pause: { from: "2026-08-24" } };
    expect(isPaused(open, "2027-01-01")).toBe(true);
    expect(isPaused(open, "2026-08-23")).toBe(false);
  });
});

describe("a streak is a run of periods", () => {
  it("counts weeks for a weekly journal, not days", () => {
    /* One check-in a week for four weeks: four, not one. */
    const logged = ["2026-08-04", "2026-08-12", "2026-08-17", "2026-08-26"];
    expect(cadenceStreak(weekly, logged, WED)).toBe(4);
  });

  it("does not break because the current period is not finished yet", () => {
    const logged = ["2026-08-11", "2026-08-19"];   // last two weeks, nothing yet this one
    expect(cadenceStreak(weekly, logged, WED)).toBe(2);
  });

  it("counts the current period as soon as it is satisfied", () => {
    const logged = ["2026-08-19", MON];
    expect(cadenceStreak(weekly, logged, WED)).toBe(2);
  });

  it("steps over a paused stretch instead of resetting", () => {
    const away: Cadence = { ...weekly, pause: { from: "2026-08-10", to: "2026-08-23" } };
    /* Two weeks logged, two weeks away, then this week in. */
    const logged = ["2026-07-29", "2026-08-05", MON];
    expect(cadenceStreak(away, logged, WED)).toBe(3);
  });

  it("still counts plain days when there is no schedule to count", () => {
    const logged = ["2026-08-24", "2026-08-25", "2026-08-26"];
    expect(cadenceStreak(manual, logged, WED)).toBe(3);
    /* And keeps the old grace: a run that stopped yesterday is still a run. */
    expect(cadenceStreak(manual, ["2026-08-24", "2026-08-25"], WED)).toBe(2);
  });

  it("names what it is a streak of", () => {
    expect(streakNoun(weekly, 1)).toBe("week");
    expect(streakNoun(weekly, 4)).toBe("weeks");
    expect(streakNoun(p("fortnightly"), 3)).toBe("fortnights");
    expect(streakNoun(monthly, 2)).toBe("months");
    expect(streakNoun(daily, 9)).toBe("days");
  });
});

describe("the record, for a document that has to explain itself", () => {
  it("reads a weekly journal as weeks kept, not days missed", () => {
    const logged = ["2026-08-03", "2026-08-11", "2026-08-19", "2026-08-25"];
    const a = adherence(weekly, logged, "2026-08-03", "2026-08-30");
    expect(a.periods).toBe(4);
    expect(a.kept).toBe(4);
    expect(a.pct).toBe(100);
  });

  it("never counts a paused period against anybody, and says how many", () => {
    const away: Cadence = { ...weekly, pause: { from: "2026-08-10", to: "2026-08-23" } };
    const a = adherence(away, ["2026-08-03", "2026-08-25"], "2026-08-03", "2026-08-30");
    expect(a.paused).toBe(2);
    expect(a.periods).toBe(2);
    expect(a.kept).toBe(2);
  });

  it("cannot be gamed by logging the same period into the ground", () => {
    const a = adherence(weekly, periodDates(weekly, WED), MON, SUN);
    expect(a.logged).toBe(1);
    expect(a.pct).toBe(100);
  });

  it("has nothing to measure a manual journal against", () => {
    const a = adherence(manual, [MON, WED], MON, SUN);
    expect(a.periods).toBe(0);
    expect(a.logged).toBe(2);
  });
});

describe("a question can ask less often than the journal", () => {
  const days = [
    { date: MON, answers: { severity: 4, weight: 78 } },
    { date: WED, answers: { severity: 6 } },
  ];

  it("is asked every check-in with no cadence of its own", () => {
    expect(fieldDue(undefined, "severity", days, WED)).toBe(true);
  });

  it("goes quiet for the rest of the period once it is answered", () => {
    expect(fieldDue(weekly, "weight", days, WED)).toBe(false);
    /* And comes back when the next period opens. */
    expect(fieldDue(weekly, "weight", days, "2026-08-31")).toBe(true);
  });

  it("is still asked in a period nobody answered it in", () => {
    expect(fieldDue(weekly, "waist", days, WED)).toBe(true);
  });

  it("never lets an imported day satisfy a question", () => {
    const imported = [{ date: MON, answers: { weight: 78 }, auto: true }];
    expect(fieldDue(weekly, "weight", imported, WED)).toBe(true);
  });

  it("asks twice-a-week twice, then stops", () => {
    const twice = presetById("twiceWeek", FIELD_CADENCE_PRESETS)!.cadence;
    const one = [{ date: MON, answers: { mood: 3 } }];
    expect(fieldDue(twice, "mood", one, WED)).toBe(true);
    expect(fieldDue(twice, "mood", [...one, { date: WED, answers: { mood: 5 } }], WED)).toBe(false);
  });

  it("resolves a whole template in one pass", () => {
    const fields = [{ k: "severity" }, { k: "weight" }, { k: "waist" }];
    const due = dueKeys(fields, { weight: weekly, waist: monthly }, days, WED);
    expect([...due].sort()).toEqual(["severity", "waist"]);
  });

  it("says when a quiet question comes back", () => {
    expect(fieldNextLine(undefined, WED)).toBeNull();
    expect(fieldNextLine(weekly, WED)).toBe("Asked again next week.");
    expect(fieldNextLine(monthly, WED)).toBe("Asked again next month.");
  });

  it("drops overrides that only say 'daily' the long way round", () => {
    const clean = sanitizeFieldCadences({ weight: weekly, itch: { unit: "day", n: 1 }, "": weekly });
    expect(Object.keys(clean)).toEqual(["weight"]);
  });
});

describe("the words on the picker", () => {
  it("names every preset in the fewest words that are still true", () => {
    const labels = CADENCE_PRESETS.map((x) => cadenceLabel(x.cadence));
    expect(labels).toEqual([
      "Every day", "Weekdays", "Every other day", "Three times a week",
      "Twice a week", "Once a week", "Every two weeks", "Once a month",
      "Only when you open it",
    ]);
  });

  it("recognises its own presets, and admits when a cadence is bespoke", () => {
    for (const x of CADENCE_PRESETS) expect(presetIdOf(x.cadence)).toBe(x.id);
    expect(presetIdOf(withDays({ ...weekly }, [2, 4]))).toBeNull();
  });

  it("names a hand-picked pair of days", () => {
    expect(cadenceLabel(withDays({ ...weekly }, [2, 4]))).toBe("Tue & Thu");
    expect(cadenceLabel(withDays({ ...weekly }, [0, 6]))).toBe("Weekends");
    expect(cadenceLabel(withDays({ ...weekly }, [3]))).toBe("Wednesdays");
  });

  it("keeps the count in step when days are picked", () => {
    const c = withDays({ ...weekly }, [1, 3, 5]);
    expect(c.times).toBe(3);
    expect(asksInPeriod(c, WED)).toBe(3);
  });

  it("refuses to put days on a cadence that has no use for them", () => {
    expect(withDays(monthly, [1]).days).toEqual([]);
    expect(withDays(manual, [1]).days).toEqual([]);
  });

  it("says what each choice costs, without encouragement", () => {
    expect(cadenceHint(weekly)).toBe("One check-in a week. Any day of it counts.");
    expect(cadenceHint(manual)).toBe("Nothing is ever due, and nothing is ever missed.");
    expect(cadenceHint(weekdays)).toBe("Nudged on Mon, Tue, Wed, Thu & Fri. Any day still counts.");
  });

  it("labels a period the way somebody would say it out loud", () => {
    expect(periodLabel(weekly, WED, WED)).toBe("This week");
    expect(periodLabel(weekly, "2026-08-19", WED)).toBe("Last week");
    expect(periodLabel(daily, WED, WED)).toBe("Today");
    expect(periodLabel(daily, "2026-08-25", WED)).toBe("Yesterday");
    expect(periodLabel(monthly, WED, WED)).toBe("This month");
  });

  it("compares cadences by what they mean, not by their spelling", () => {
    expect(sameCadence(weekly, { ...weekly, anchor: "2026-01-01" })).toBe(true);
    expect(sameCadence(weekly, monthly)).toBe(false);
  });
});

describe("what the app says when it wants nothing from you", () => {
  it("says nothing extra on a daily journal — the ring already says it", () => {
    expect(standing(daily, [], WED).line).toBeNull();
    expect(standing(daily, [WED], WED).settled).toBe(true);
    /* And never claims a daily day is *quiet*: "the day is on the record" is
       not the same claim as "today's check-in is finished", and only the ring
       is allowed to make the second one. */
    expect(standing(daily, [WED], WED).quiet).toBe(false);
  });

  it("tells a weekly journaler the week is in, and when the next one opens", () => {
    const s = standing(weekly, [MON], WED);
    expect(s.settled).toBe(true);
    /* The date is formatted by the platform's own locale, so the assertion is
       about the sentence rather than about which side the month falls on. */
    expect(s.line).toMatch(/^This week is in\. Next from .+\.$/);
    expect(s.next).toBe("2026-08-31");
  });

  it("counts a multi-ask period rather than pretending it is finished", () => {
    const s = standing(p("thrice"), [MON], WED);
    expect(s.settled).toBe(false);
    expect(s.line).toBe("1 of 3 this week. 2 to go.");
  });

  it("says a paused journal is paused rather than behind", () => {
    const away: Cadence = { ...weekly, pause: { from: "2026-08-24", to: "2026-09-06" } };
    const s = standing(away, [], WED);
    expect(s.paused).toBe(true);
    expect(s.settled).toBe(true);
    expect(s.line).toMatch(/^Paused until .+\. Nothing is due\.$/);
  });

  it("never tells a manual journal it is behind on anything", () => {
    const s = standing(manual, [], WED);
    expect(s.settled).toBe(true);
    expect(s.line).toBe("No schedule — nothing is ever due.");
  });

  it("says a blank week is blank without dressing it up", () => {
    expect(standing(weekly, [], WED).line).toBe("Nothing in for this week yet.");
  });
});
