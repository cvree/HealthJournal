/* Food and bowel logs.

   The promise being pinned here is the one the UI makes on every card: the
   user can always tell their own number from an estimated one. That means the
   two must never merge on disk, must resolve in a fixed order, and must
   survive a round trip through a hand-editable backup file. */
import { describe, it, expect } from "vitest";
import {
  newFoodLog, newBowelLog, mealForTime, localDate, localTime, prettyTime,
  resolveNutrient, effectiveNutrition, hasAiValues, hasUserEdits,
  acceptEstimate, discardEstimate, dayTotals, foodOn, bowelOn,
  formatNutrient, foodSummary, bowelSummary, severityLabel, bristolLabel,
  sanitizeFoodLogs, sanitizeBowelLogs, NUTRIENT_KEYS,
  newFoodItem, rememberFood, logFromFoodItem, scaleNutrition, foodKey,
  browseFoods, searchScore, toggleFavorite, goalProgress, hasGoals,
  sanitizeFoodItems, sanitizeGoals,
  matchBowelColor, matchBowelConsistency, bowelSuggestion, applyBowelSuggestion,
  aiFilledBowelFields, BOWEL_COLORS, BOWEL_CONSISTENCY,
} from "../src/lib/tracking";
import {
  DERIVED_METRICS, derivedMetric, isDerivedKey, availableDerivedMetrics, derivedSeries,
} from "../src/lib/metrics";
import { buildFoodTable, buildBowelTable, buildWideTable, logsInRange } from "../src/lib/exports";
import type { FoodLog } from "../src/types/models";

const food = (p: Partial<FoodLog> = {}): FoodLog => newFoodLog({ date: "2026-08-09", ...p });

describe("constructors", () => {
  it("stamps a local date and time, not a UTC one", () => {
    // A meal logged at 11pm belongs to today, which toISOString() gets wrong
    // for every timezone east of UTC.
    const d = new Date(2026, 7, 9, 23, 30);
    expect(localDate(d)).toBe("2026-08-09");
    expect(localTime(d)).toBe("23:30");
  });

  it("guesses the meal from the clock but lets the caller override", () => {
    expect(mealForTime("07:15")).toBe("breakfast");
    expect(mealForTime("12:30")).toBe("lunch");
    expect(mealForTime("19:00")).toBe("dinner");
    expect(mealForTime("23:10")).toBe("snack");
    expect(newFoodLog({ time: "07:15", meal: "dinner" }).meal).toBe("dinner");
  });

  it("gives every log a distinct id", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newFoodLog().id));
    expect(ids.size).toBe(50);
  });

  it("formats times for display without changing what is stored", () => {
    expect(prettyTime("07:05")).toBe("7:05 am");
    expect(prettyTime("00:30")).toBe("12:30 am");
    expect(prettyTime("12:00")).toBe("12:00 pm");
    expect(prettyTime("19:45")).toBe("7:45 pm");
    expect(prettyTime("nonsense")).toBe("");
  });
});

describe("the user's numbers and the model's never merge", () => {
  const log = food({
    description: "Chicken and rice",
    nutrition: { protein: 40 },
    ai: {
      at: "2026-08-09T12:00:00.000Z", model: "m", source: "text",
      nutrition: { calories: 600, protein: 30, carbs: 70 },
      confidence: "medium",
    },
  });

  it("prefers the user's value and says so", () => {
    expect(resolveNutrient(log, "protein")).toEqual({ k: "protein", value: 40, source: "user" });
  });

  it("falls back to the estimate and says that too", () => {
    expect(resolveNutrient(log, "calories")).toEqual({ k: "calories", value: 600, source: "ai" });
  });

  it("reports no value rather than zero when neither side has one", () => {
    // "I didn't record fibre" and "I ate no fibre" are different statements.
    expect(resolveNutrient(log, "fiber")).toEqual({ k: "fiber", value: null, source: "none" });
  });

  it("knows when a card needs an AI Estimated badge", () => {
    expect(hasAiValues(log)).toBe(true);
    expect(hasUserEdits(log)).toBe(true);
    const mine = food({ nutrition: { calories: 500 } });
    expect(hasAiValues(mine)).toBe(false);
  });

  it("leaves the raw estimate intact when the user edits a field", () => {
    expect(log.ai!.nutrition.protein).toBe(30); // untouched by the user's 40
  });
});

describe("accepting and discarding an estimate", () => {
  const base = food({
    nutrition: { protein: 40 },
    ai: {
      at: "x", model: "m", source: "photo",
      nutrition: { calories: 600, protein: 30, fiber: 8, micros: [{ label: "Iron", amount: "2 mg" }] },
      confidence: "low",
    },
  });

  it("copies estimates across without overwriting what the user already set", () => {
    const next = acceptEstimate(base);
    expect(next.nutrition!.protein).toBe(40); // the user's, kept
    expect(next.nutrition!.calories).toBe(600); // the model's, adopted
    expect(next.nutrition!.micros).toHaveLength(1);
    // Every value is now the user's, so nothing is badged as an estimate.
    expect(hasAiValues(next)).toBe(false);
  });

  it("makes accepted values immune to a later re-run", () => {
    const accepted = acceptEstimate(base);
    const rerun: FoodLog = {
      ...accepted,
      ai: { at: "y", model: "m", source: "photo", nutrition: { calories: 900 }, confidence: "high" },
    };
    expect(resolveNutrient(rerun, "calories").value).toBe(600);
    expect(resolveNutrient(rerun, "calories").source).toBe("user");
  });

  it("discarding drops the estimate and keeps everything the user wrote", () => {
    const next = discardEstimate(base);
    expect(next.ai).toBeUndefined();
    expect(next.nutrition!.protein).toBe(40);
    expect(resolveNutrient(next, "calories").value).toBe(null);
  });
});

describe("daily totals", () => {
  const rows = [
    food({ time: "08:00", nutrition: { calories: 400, protein: 20 } }),
    food({
      time: "13:00",
      ai: { at: "x", model: "m", source: "photo", nutrition: { calories: 600, protein: 30 }, confidence: "low" },
    }),
    food({ time: "19:00", date: "2026-08-08", nutrition: { calories: 999 } }), // another day
    food({ time: "21:00" }), // logged, no numbers
  ];

  it("adds the user's and the estimated values into one figure", () => {
    const t = dayTotals(rows, "2026-08-09");
    expect(t.calories).toBe(1000);
    expect(t.protein).toBe(50);
  });

  it("flags that the total leans on an estimate", () => {
    expect(dayTotals(rows, "2026-08-09").partlyEstimated).toBe(true);
    expect(dayTotals([rows[0]], "2026-08-09").partlyEstimated).toBe(false);
  });

  it("counts meals separately from meals that carried numbers", () => {
    const t = dayTotals(rows, "2026-08-09");
    expect(t.meals).toBe(3); // three logged today
    expect(t.counted).toBe(2); // two of them had any figure
  });

  it("leaves an unrecorded nutrient null rather than zero", () => {
    expect(dayTotals(rows, "2026-08-09").fiber).toBe(null);
  });

  it("ignores other days entirely", () => {
    expect(dayTotals(rows, "2026-08-08").calories).toBe(999);
  });

  it("returns logs in time order regardless of insertion order", () => {
    const shuffled = [food({ time: "19:00" }), food({ time: "08:00" }), food({ time: "13:00" })];
    expect(foodOn(shuffled, "2026-08-09").map((f) => f.time)).toEqual(["08:00", "13:00", "19:00"]);
  });
});

describe("presentation never implies more precision than the method has", () => {
  it("rounds each nutrient to its own resolution", () => {
    expect(formatNutrient("calories", 612)).toBe("610"); // 5 kcal steps
    expect(formatNutrient("protein", 30.4)).toBe("30");
    expect(formatNutrient("sodium", 1237)).toBe("1240"); // 10 mg steps
    expect(formatNutrient("fiber", 8.3)).toBe("8.5"); // half-gram steps
  });

  it("shows a dash rather than a zero for a missing value", () => {
    expect(formatNutrient("calories", null)).toBe("–");
    expect(formatNutrient("calories", undefined)).toBe("–");
    expect(formatNutrient("calories", NaN)).toBe("–");
  });

  it("hedges an estimated calorie count in the summary line, but not the user's own", () => {
    const est = food({
      serving: "1 bowl",
      ai: { at: "x", model: "m", source: "text", nutrition: { calories: 520 }, confidence: "low" },
    });
    expect(foodSummary(est)).toBe("1 bowl · about 520 kcal");
    const mine = food({ serving: "1 bowl", nutrition: { calories: 520 } });
    expect(foodSummary(mine)).toBe("1 bowl · 520 kcal");
  });

  it("summarises a bowel log from whatever fields are present", () => {
    expect(bowelSummary(newBowelLog({ bristol: 4, amount: "medium", color: "Brown" })))
      .toBe("Type 4 · Medium · Brown");
    expect(bowelSummary(newBowelLog({}))).toBe("");
  });

  it("labels the shared 0–3 scale and the Bristol scale", () => {
    expect(severityLabel(0)).toBe("None");
    expect(severityLabel(3)).toBe("Severe");
    expect(severityLabel(undefined)).toBe("");
    expect(bristolLabel(4)).toBe("Smooth sausage");
    expect(bristolLabel(99)).toBe("");
  });
});

describe("derived trend metrics", () => {
  const F = [
    food({ date: "2026-08-08", nutrition: { calories: 1800, protein: 90 } }),
    food({ date: "2026-08-09", nutrition: { calories: 2100, protein: 110 } }),
  ];
  const B = [
    newBowelLog({ date: "2026-08-08", time: "08:00", bristol: 4, urgency: 1 }),
    newBowelLog({ date: "2026-08-09", time: "09:00", bristol: 3, urgency: 2 }),
    newBowelLog({ date: "2026-08-09", time: "17:00", bristol: 5, urgency: 0 }),
  ];
  const dates = ["2026-08-08", "2026-08-09"];

  it("exposes one metric per nutrient plus the bowel set", () => {
    expect(isDerivedKey("food_calories")).toBe(true);
    expect(isDerivedKey("bm_bristol")).toBe(true);
    expect(isDerivedKey("itch")).toBe(false);
    for (const k of NUTRIENT_KEYS) expect(derivedMetric(`food_${k}`)).toBeTruthy();
  });

  it("reduces a day of meals to one number", () => {
    const m = derivedMetric("food_calories")!;
    expect(m.value({ food: F, bowel: B, date: "2026-08-09" })).toBe(2100);
    expect(m.value({ food: F, bowel: B, date: "2026-08-07" })).toBe(null);
  });

  it("counts bowel movements and averages their attributes", () => {
    expect(derivedMetric("bm_count")!.value({ food: F, bowel: B, date: "2026-08-09" })).toBe(2);
    expect(derivedMetric("bm_bristol")!.value({ food: F, bowel: B, date: "2026-08-09" })).toBe(4);
    expect(derivedMetric("bm_urgency")!.value({ food: F, bowel: B, date: "2026-08-09" })).toBe(1);
  });

  it("leaves calorie and macro metrics directionless", () => {
    // Marking calories "higher is worse" would be the app giving dietary
    // advice through a colour choice.
    for (const k of NUTRIENT_KEYS) expect(derivedMetric(`food_${k}`)!.dir).toBe("neutral");
    expect(derivedMetric("bm_urgency")!.dir).toBe("sym");
  });

  it("only offers metrics that actually have data behind them", () => {
    const available = availableDerivedMetrics({ food: F, bowel: B }, dates).map((m) => m.k);
    expect(available).toContain("food_calories");
    expect(available).toContain("bm_count");
    expect(available).not.toContain("food_sodium"); // never recorded
  });

  it("builds a series the chart can read directly", () => {
    const s = derivedSeries(derivedMetric("food_protein")!, { food: F, bowel: B }, [...dates, "2026-08-10"]);
    expect(s).toEqual([
      { date: "2026-08-08", value: 90 },
      { date: "2026-08-09", value: 110 },
      { date: "2026-08-10", value: null },
    ]);
  });

  it("has no duplicate keys, which would make the picker ambiguous", () => {
    const keys = DERIVED_METRICS.map((m) => m.k);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("restoring from a hand-editable backup", () => {
  it("drops malformed rows instead of throwing", () => {
    const rows = sanitizeFoodLogs([
      { date: "2026-08-09", time: "08:00", meal: "breakfast", description: "Toast" },
      null,
      "not an object",
      { date: "nope", description: "bad date" },
      { time: "08:00" }, // no date at all
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("Toast");
  });

  it("does not let one bad row cost the user the good ones", () => {
    const rows = sanitizeFoodLogs([
      { date: "2026-08-09", description: "first" },
      { date: 12345 },
      { date: "2026-08-09", description: "second" },
    ]);
    expect(rows.map((r) => r.description)).toEqual(["first", "second"]);
  });

  it("repairs missing or invalid times and meals rather than dropping the row", () => {
    const [r] = sanitizeFoodLogs([{ date: "2026-08-09", time: "25:99", meal: "brunch" }]);
    expect(r.time).toBe("12:00");
    expect(r.meal).toBe("snack");
  });

  it("rejects impossible nutrition values", () => {
    const [r] = sanitizeFoodLogs([
      { date: "2026-08-09", nutrition: { calories: -5, protein: "40", fat: 1e9, carbs: 30 } },
    ]);
    expect(r.nutrition).toEqual({ carbs: 30 });
  });

  it("keeps a valid AI block whole and drops an empty one", () => {
    const [withAi] = sanitizeFoodLogs([
      { date: "2026-08-09", ai: { model: "m", source: "photo", nutrition: { calories: 500 }, confidence: "high" } },
    ]);
    expect(withAi.ai!.nutrition.calories).toBe(500);
    expect(withAi.ai!.source).toBe("photo");
    const [noAi] = sanitizeFoodLogs([{ date: "2026-08-09", ai: { model: "m" } }]);
    expect(noAi.ai).toBeUndefined();
  });

  it("clamps bowel scales to their real ranges", () => {
    const [r] = sanitizeBowelLogs([
      { date: "2026-08-09", bristol: 99, urgency: -4, straining: 2, amount: "enormous" },
    ]);
    expect(r.bristol).toBe(7);
    expect(r.urgency).toBe(0);
    expect(r.straining).toBe(2);
    expect(r.amount).toBeUndefined();
  });

  it("survives a full round trip through JSON", () => {
    const original = [
      food({ description: "Eggs", nutrition: { calories: 220, protein: 14 } }),
      food({ description: "Salad", ai: { at: "x", model: "m", source: "text", nutrition: { calories: 150 }, confidence: "low" } }),
    ];
    const back = sanitizeFoodLogs(JSON.parse(JSON.stringify(original)));
    expect(back).toHaveLength(2);
    expect(resolveNutrient(back[0], "calories")).toEqual({ k: "calories", value: 220, source: "user" });
    expect(resolveNutrient(back[1], "calories")).toEqual({ k: "calories", value: 150, source: "ai" });
  });

  it("accepts a journal that predates these categories", () => {
    expect(sanitizeFoodLogs(undefined)).toEqual([]);
    expect(sanitizeBowelLogs(null)).toEqual([]);
    expect(sanitizeFoodLogs({ not: "an array" } as any)).toEqual([]);
  });
});

/* ---------- export ---------- */

describe("export keeps the two sources apart", () => {
  const rows = [
    food({
      time: "08:00", meal: "breakfast", description: "Oats", serving: "1 bowl",
      nutrition: { calories: 300, protein: 12 },
    }),
    food({
      time: "13:00", meal: "lunch", description: "Salad",
      ai: {
        at: "2026-08-09T13:00:00.000Z", model: "m", source: "photo+text",
        nutrition: { calories: 450, protein: 20, micros: [{ label: "Iron", amount: "2 mg" }] },
        confidence: "medium", note: "Assumed a light dressing.",
      },
    }),
  ];

  it("labels every nutrient with where the number came from", () => {
    const { header, rows: out } = buildFoodTable(rows);
    const cal = header.indexOf("calories");
    const calSrc = header.indexOf("calories_source");
    expect(out[0][cal]).toBe(300);
    expect(out[0][calSrc]).toBe("user");
    expect(out[1][cal]).toBe(450);
    expect(out[1][calSrc]).toBe("ai");
  });

  it("leaves the source blank where there is no value to attribute", () => {
    const { header, rows: out } = buildFoodTable(rows);
    const i = header.indexOf("sodium_source");
    expect(out[0][i]).toBe("");
  });

  it("carries the model's own caveats rather than dropping them", () => {
    const { header, rows: out } = buildFoodTable(rows);
    expect(out[1][header.indexOf("ai_confidence")]).toBe("medium");
    expect(out[1][header.indexOf("ai_note")]).toBe("Assumed a light dressing.");
    expect(out[1][header.indexOf("micronutrients")]).toBe("Iron: 2 mg");
  });

  it("sorts chronologically across days, not by insertion", () => {
    const mixed = [
      food({ date: "2026-08-10", time: "09:00", description: "later day" }),
      food({ date: "2026-08-09", time: "20:00", description: "earlier day" }),
      food({ date: "2026-08-09", time: "07:00", description: "earliest" }),
    ];
    const { header, rows: out } = buildFoodTable(mixed);
    const d = header.indexOf("description");
    expect(out.map((r) => r[d])).toEqual(["earliest", "earlier day", "later day"]);
  });

  it("keeps a bowel log's own answers separate from the photo suggestion", () => {
    const { header, rows: out } = buildBowelTable([
      newBowelLog({
        date: "2026-08-09", time: "07:30", bristol: 4, color: "Brown",
        ai: { at: "x", model: "m", bristol: 5, color: "light brown", confidence: "low" },
      }),
    ]);
    expect(out[0][header.indexOf("bristol_type")]).toBe(4);
    expect(out[0][header.indexOf("ai_bristol")]).toBe(5);
    expect(out[0][header.indexOf("color")]).toBe("Brown");
    expect(out[0][header.indexOf("ai_color")]).toBe("light brown");
  });

  it("filters to the requested range", () => {
    const all = [
      food({ date: "2026-08-01" }), food({ date: "2026-08-09" }), food({ date: "2026-08-20" }),
    ];
    expect(logsInRange(all, "2026-08-05", "2026-08-15")).toHaveLength(1);
    expect(logsInRange([], "2026-08-05", "2026-08-15")).toEqual([]);
    expect(logsInRange(undefined as any, "a", "b")).toEqual([]);
  });
});

describe("the daily table gains food columns only when there is food", () => {
  const tpl = { label: "T", fields: [{ k: "itch", label: "Itch", type: "scale" as const }] };
  const profile = { id: "p", name: "N" } as any;
  const entries = [
    { id: "e1", date: "2026-08-09", answers: { itch: 5 }, createdAt: "", updatedAt: "" },
  ] as any;

  it("stays exactly as it was for a journal with no food logs", () => {
    const { header } = buildWideTable(tpl, profile, entries);
    expect(header.some((h) => h.startsWith("food_"))).toBe(false);
  });

  it("adds daily totals when food exists", () => {
    const rows = [food({ date: "2026-08-09", nutrition: { calories: 500 } })];
    const { header, rows: out } = buildWideTable(tpl, profile, entries, rows);
    expect(out[0][header.indexOf("food_calories")]).toBe(500);
    expect(out[0][header.indexOf("food_meals")]).toBe(1);
  });

  it("flags a day whose totals lean on an estimate", () => {
    const rows = [food({
      date: "2026-08-09",
      ai: { at: "x", model: "m", source: "text", nutrition: { calories: 500 }, confidence: "low" },
    })];
    const { header, rows: out } = buildWideTable(tpl, profile, entries, rows);
    expect(out[0][header.indexOf("food_partly_estimated")]).toBe("y");
  });

  it("leaves an unrecorded nutrient blank rather than zero", () => {
    const rows = [food({ date: "2026-08-09", nutrition: { calories: 500 } })];
    const { header, rows: out } = buildWideTable(tpl, profile, entries, rows);
    expect(out[0][header.indexOf("food_fiber")]).toBe("");
  });
});

/* ---------- the food library ---------- */

describe("the food library grows by using the app", () => {
  it("remembers a meal the first time it is saved", () => {
    const lib = rememberFood([], food({ description: "Oats", serving: "1 bowl", nutrition: { calories: 300 } }));
    expect(lib).toHaveLength(1);
    expect(lib[0].name).toBe("Oats");
    expect(lib[0].serving).toBe("1 bowl");
    expect(lib[0].nutrition.calories).toBe(300);
    expect(lib[0].useCount).toBe(1);
  });

  it("counts a second use instead of creating a duplicate", () => {
    let lib = rememberFood([], food({ description: "Oats", nutrition: { calories: 300 } }));
    lib = rememberFood(lib, food({ description: "  oats  ", nutrition: { calories: 300 } }));
    expect(lib).toHaveLength(1);
    expect(lib[0].useCount).toBe(2);
  });

  it("stores figures per single serving, not per logged portion", () => {
    // Logging "3 × 1 slice" must not teach the library that a slice is 3 slices.
    const lib = rememberFood([], food({
      description: "Toast", servings: 3, serving: "3 × 1 slice", nutrition: { calories: 300 },
    }));
    expect(lib[0].nutrition.calories).toBe(100);
  });

  it("refuses to save a log with nothing to call it", () => {
    expect(rememberFood([], food({ description: "", nutrition: { calories: 300 } }))).toHaveLength(0);
  });

  it("refuses to save a log with no figures worth reusing", () => {
    expect(rememberFood([], food({ description: "Water" }))).toHaveLength(0);
  });

  it("marks a food whose figures were never confirmed by the user", () => {
    const lib = rememberFood([], food({
      description: "Salad",
      ai: { at: "x", model: "m", source: "photo", nutrition: { calories: 200 }, confidence: "low" },
    }));
    expect(lib[0].estimated).toBe(true);
  });

  it("clears the estimated flag once the user corrects it", () => {
    let lib = rememberFood([], food({
      description: "Salad",
      ai: { at: "x", model: "m", source: "photo", nutrition: { calories: 200 }, confidence: "low" },
    }));
    expect(lib[0].estimated).toBe(true);
    lib = rememberFood(lib, food({ description: "Salad", nutrition: { calories: 240 } }));
    expect(lib[0].estimated).toBeUndefined();
    expect(lib[0].nutrition.calories).toBe(240); // correcting once fixes it everywhere after
  });
});

describe("logging from the library", () => {
  const item = newFoodItem({ name: "Oats", serving: "1 bowl", nutrition: { calories: 300, protein: 10 } });

  it("scales the figures by the serving count", () => {
    const log = logFromFoodItem(item, { date: "2026-08-09", time: "08:00", servings: 2 });
    expect(resolveNutrient(log, "calories")).toEqual({ k: "calories", value: 600, source: "user" });
    expect(resolveNutrient(log, "protein").value).toBe(20);
    expect(log.serving).toBe("2 × 1 bowl");
  });

  it("keeps the single-serving wording at one serving", () => {
    expect(logFromFoodItem(item, { date: "2026-08-09", servings: 1 }).serving).toBe("1 bowl");
  });

  it("handles a half serving without a fractional mess", () => {
    const log = logFromFoodItem(item, { date: "2026-08-09", servings: 0.5 });
    expect(resolveNutrient(log, "calories").value).toBe(150);
    expect(log.serving).toBe("0.5 × 1 bowl");
  });

  it("picks the meal from the time when one isn't given", () => {
    expect(logFromFoodItem(item, { date: "2026-08-09", time: "08:00" }).meal).toBe("breakfast");
    expect(logFromFoodItem(item, { date: "2026-08-09", time: "19:00" }).meal).toBe("dinner");
  });

  it("carries the estimate flag through, so a guess never becomes a measurement", () => {
    const guessed = newFoodItem({ name: "Curry", nutrition: { calories: 700 }, estimated: true });
    const log = logFromFoodItem(guessed, { date: "2026-08-09" });
    // The figure lands in the AI block, not the user's, so it still badges.
    expect(log.nutrition).toBeUndefined();
    expect(resolveNutrient(log, "calories")).toEqual({ k: "calories", value: 700, source: "ai" });
    expect(hasAiValues(log)).toBe(true);
    expect(log.ai!.source).toBe("library");
  });

  it("writes its own figures down, so editing the saved food can't rewrite history", () => {
    const log = logFromFoodItem(item, { date: "2026-08-09", servings: 1 });
    const edited = { ...item, nutrition: { calories: 999 } };
    expect(edited.nutrition.calories).toBe(999);
    expect(resolveNutrient(log, "calories").value).toBe(300); // unchanged
  });

  it("does not scale micronutrient strings", () => {
    const withMicros = newFoodItem({
      name: "Spinach", nutrition: { calories: 20, micros: [{ label: "Iron", amount: "2.7 mg" }] },
    });
    const log = logFromFoodItem(withMicros, { date: "2026-08-09", servings: 3 });
    expect(log.nutrition!.micros).toBeUndefined(); // dropped rather than mangled
    expect(log.nutrition!.calories).toBe(60);
  });
});

describe("finding a food fast", () => {
  const lib = [
    newFoodItem({ name: "Chicken breast", nutrition: { calories: 165 }, useCount: 9, lastUsedAt: "2026-08-01" }),
    newFoodItem({ name: "Zucchini", nutrition: { calories: 17 }, useCount: 2, lastUsedAt: "2026-08-09" }),
    newFoodItem({ name: "Chocolate", nutrition: { calories: 546 }, useCount: 5, lastUsedAt: "2026-08-05", favorite: true }),
    newFoodItem({ name: "Greek yoghurt", brand: "Chobani", nutrition: { calories: 120 }, useCount: 0, lastUsedAt: "2026-07-01" }),
  ];

  it("ranks a prefix match above a match buried mid-word", () => {
    const names = browseFoods(lib, "all", "chi").map((f) => f.name);
    expect(names[0]).toBe("Chicken breast");
    expect(names).toContain("Zucchini"); // still found, just lower
    expect(names.indexOf("Chicken breast")).toBeLessThan(names.indexOf("Zucchini"));
  });

  it("matches on brand as well as name", () => {
    expect(browseFoods(lib, "all", "chobani").map((f) => f.name)).toEqual(["Greek yoghurt"]);
  });

  it("ignores case and punctuation in matching keys", () => {
    expect(foodKey("Chicken Breast")).toBe(foodKey("  chicken breast  "));
    expect(foodKey("Ben & Jerry's")).toBe(foodKey("ben and jerry s".replace(" and ", " & ")));
  });

  it("lets search override the tab, because typing means you want one thing", () => {
    // "favorite" tab, but a query that only matches a non-favourite.
    expect(browseFoods(lib, "favorite", "zucc").map((f) => f.name)).toEqual(["Zucchini"]);
  });

  it("orders recents by when they were last eaten", () => {
    expect(browseFoods(lib, "recent")[0].name).toBe("Zucchini");
  });

  it("orders frequents by use count and omits the never-used", () => {
    const names = browseFoods(lib, "frequent").map((f) => f.name);
    expect(names).toEqual(["Chicken breast", "Chocolate", "Zucchini"]);
    expect(names).not.toContain("Greek yoghurt");
  });

  it("shows only favourites on the favourites tab", () => {
    expect(browseFoods(lib, "favorite").map((f) => f.name)).toEqual(["Chocolate"]);
  });

  it("toggles a favourite without touching anything else", () => {
    const next = toggleFavorite(lib, lib[0].id);
    expect(next[0].favorite).toBe(true);
    expect(next[0].nutrition).toEqual(lib[0].nutrition);
    expect(toggleFavorite(next, lib[0].id)[0].favorite).toBe(false);
  });

  it("returns everything for an empty query", () => {
    expect(browseFoods(lib, "all", "   ")).toHaveLength(4);
  });
});

describe("daily goals", () => {
  const totals = { calories: 1500, protein: 60, fiber: null } as any;

  it("reports nothing at all when no goals are set", () => {
    expect(goalProgress(undefined, totals)).toEqual([]);
    expect(goalProgress({}, totals)).toEqual([]);
    expect(hasGoals(undefined)).toBe(false);
  });

  it("only reports the targets that were actually set", () => {
    const p = goalProgress({ calories: 2000 }, totals);
    expect(p.map((g) => g.k)).toEqual(["calories"]);
    expect(p[0].remaining).toBe(500);
    expect(p[0].ratio).toBeCloseTo(0.75);
  });

  it("clamps the ratio so a bar can't overflow its track", () => {
    expect(goalProgress({ calories: 1000 }, totals)[0].ratio).toBe(1);
    expect(goalProgress({ calories: 1000 }, totals)[0].remaining).toBe(-500);
  });

  it("treats an unrecorded nutrient as untouched, not as zero eaten", () => {
    const p = goalProgress({ fiber: 30 }, totals)[0];
    expect(p.eaten).toBe(null);
    expect(p.ratio).toBe(null);
    expect(p.remaining).toBe(30);
  });

  it("ignores nonsense targets", () => {
    expect(goalProgress({ calories: 0, protein: -5 } as any, totals)).toEqual([]);
    expect(sanitizeGoals({ calories: "2000", protein: 120 })).toEqual({ protein: 120 });
    expect(sanitizeGoals({})).toBeUndefined();
    expect(sanitizeGoals(null)).toBeUndefined();
  });
});

describe("restoring a library", () => {
  it("drops entries with no name", () => {
    expect(sanitizeFoodItems([{ name: "" }, { name: "   " }, {}, null])).toHaveLength(0);
  });

  it("collapses duplicates, which would split the use counts", () => {
    const rows = sanitizeFoodItems([
      { name: "Oats", nutrition: { calories: 300 }, useCount: 5 },
      { name: "  OATS ", nutrition: { calories: 310 }, useCount: 2 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].useCount).toBe(5);
  });

  it("repairs a missing serving rather than dropping the food", () => {
    expect(sanitizeFoodItems([{ name: "Oats" }])[0].serving).toBe("1 serving");
  });

  it("survives a round trip through JSON", () => {
    const lib = rememberFood([], food({ description: "Oats", serving: "1 bowl", nutrition: { calories: 300 } }));
    const back = sanitizeFoodItems(JSON.parse(JSON.stringify(lib)));
    expect(back[0].name).toBe("Oats");
    expect(back[0].nutrition.calories).toBe(300);
  });

  it("accepts a journal that predates the library", () => {
    expect(sanitizeFoodItems(undefined)).toEqual([]);
  });
});

/* ---------- a photo reading landing in the log ----------

   Once the model's answer can be written into the log without a person
   tapping it through, two things start to matter that didn't before: it has
   to arrive in the form's own vocabulary, and it must never sit on top of an
   answer the person already gave. */

describe("mapping a model's words onto the form's options", () => {
  it("returns a value the chips actually offer, or nothing at all", () => {
    for (const raw of ["dark brown", "Dark Brown", "dark-brown stool", "brown", "pale", "tarry black"]) {
      const c = matchBowelColor(raw);
      expect(BOWEL_COLORS, raw).toContain(c);
    }
    for (const raw of ["soft", "LOOSE", "watery/liquid", "formed"]) {
      const c = matchBowelConsistency(raw);
      expect(BOWEL_CONSISTENCY, raw).toContain(c);
    }
  });

  it("tests the qualified browns before the bare one they contain", () => {
    expect(matchBowelColor("dark brown")).toBe("Dark brown");
    expect(matchBowelColor("light brown")).toBe("Light brown");
    expect(matchBowelColor("brown")).toBe("Brown");
    // "pale" wins over the "brown" sitting next to it — clay is the distinct
    // observation, and collapsing it into Brown would lose it.
    expect(matchBowelColor("pale brown, almost clay")).toBe("Pale / clay");
  });

  it("drops a word it can't place rather than guessing", () => {
    expect(matchBowelColor("iridescent")).toBeUndefined();
    expect(matchBowelConsistency("moderate")).toBeUndefined();
    expect(matchBowelColor("")).toBeUndefined();
    expect(matchBowelColor(undefined)).toBeUndefined();
  });

  it("carries amount through only in the three buckets the form has", () => {
    expect(bowelSuggestion({ at: "", model: "", amount: "large", confidence: "low" }).amount).toBe("large");
    expect(bowelSuggestion({ at: "", model: "", confidence: "low" }).amount).toBeUndefined();
  });
});

describe("applying a suggestion to a log", () => {
  const ai = {
    at: "2026-08-10T09:00:00Z", model: "m", bristol: 4, amount: "medium" as const,
    color: "dark brown", consistency: "formed", confidence: "high" as const,
  };

  it("fills every blank field it can", () => {
    const out = applyBowelSuggestion(newBowelLog({ date: "2026-08-10" }), ai);
    expect(out.bristol).toBe(4);
    expect(out.amount).toBe("medium");
    expect(out.color).toBe("Dark brown");
    expect(out.consistency).toBe("Formed");
  });

  it("never overwrites an answer the person already gave", () => {
    const mine = newBowelLog({ date: "2026-08-10", bristol: 6, color: "Green" });
    const out = applyBowelSuggestion(mine, ai);
    expect(out.bristol).toBe(6);
    expect(out.color).toBe("Green");
    // The blanks still get filled — one disagreement doesn't discard the rest.
    expect(out.amount).toBe("medium");
    expect(out.consistency).toBe("Formed");
  });

  it("leaves the log untouched when there is nothing to add", () => {
    const log = newBowelLog({ date: "2026-08-10", bristol: 4, amount: "medium", color: "Dark brown", consistency: "Formed" });
    expect(applyBowelSuggestion(log, ai)).toBe(log);
  });

  it("reports which fields the model is answering for, and stops once one is overtyped", () => {
    const filled = applyBowelSuggestion(newBowelLog({ date: "2026-08-10" }), ai);
    const withAi = { ...filled, ai };
    expect(aiFilledBowelFields(withAi).sort()).toEqual(["amount", "bristol", "color", "consistency"]);

    const corrected = { ...withAi, color: "Green" };
    expect(aiFilledBowelFields(corrected)).not.toContain("color");
    expect(aiFilledBowelFields(corrected)).toContain("bristol");
  });

  it("survives a round trip through a backup, amount included", () => {
    const filled = { ...applyBowelSuggestion(newBowelLog({ date: "2026-08-10" }), ai), ai };
    const back = sanitizeBowelLogs(JSON.parse(JSON.stringify([filled])));
    expect(back[0].ai?.amount).toBe("medium");
    expect(aiFilledBowelFields(back[0])).toContain("amount");
  });
});

describe("an explicitly-undefined field means 'not given'", () => {
  /* Passing an optional prop straight through is the normal way to call these,
     and it used to un-set the default it was meant to fall back to. */
  it("still stamps a time when one is passed as undefined", () => {
    expect(newFoodLog({ date: "2026-08-10", time: undefined }).time).toMatch(/^\d{2}:\d{2}$/);
    expect(newBowelLog({ date: "2026-08-10", time: undefined }).time).toMatch(/^\d{2}:\d{2}$/);
    expect(newFoodLog({ date: "2026-08-10", meal: undefined }).meal).toBeTruthy();
  });

  it("keeps honouring a time that was actually given", () => {
    expect(newFoodLog({ date: "2026-08-10", time: "07:15" }).time).toBe("07:15");
    expect(newFoodLog({ date: "2026-08-10", time: "07:15" }).meal).toBe("breakfast");
  });
});
