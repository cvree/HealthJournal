/* Food and bowel-movement logs.

   These are the two categories that don't fit the daily-survey model the rest
   of the app is built on. A day has one "overall severity" but four meals and
   two bowel movements, so they live in their own arrays (db.food, db.bowel)
   and reach the dashboard, the timeline and the trend chart through the
   *derived daily metrics* at the bottom of this file.

   Three rules this module exists to keep:

   1. **The user's numbers and the model's numbers never share a field.**
      `FoodLog.nutrition` is only ever written by a person; `FoodLog.ai` is the
      model's reply, stored whole. `effectiveNutrition` merges them for display
      and reports which side each value came from, so the UI can label an
      estimate as an estimate every single time it draws one.
   2. **Estimates are ranges wearing a number.** `formatNutrient` rounds to a
      resolution the estimate can actually support (a photo can support "about
      600 kcal", never "612 kcal") so the presentation doesn't imply a
      precision the method doesn't have.
   3. **Nothing here talks to a network.** Analysis lives in ./ai; this module
      only shapes what goes in and what comes back out. */

import type {
  BowelAiResult, BowelLog, FoodAiResult, FoodItem, FoodLog, MealCategory,
  NamedReminder, NutritionGoals, NutritionValues, RoutineItem, RoutineLog,
} from "../types/models";

export type { BowelLog, FoodItem, FoodLog, MealCategory, NutritionGoals, NutritionValues };

/* ---------- ids & clocks ---------- */

const rand = () => Math.random().toString(36).slice(2, 9);
const stamp = () => new Date().toISOString();

/** Local YYYY-MM-DD. Deliberately not toISOString().slice(0,10), which is UTC
    and silently files an 11pm meal under tomorrow. */
export function localDate(d: Date = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Local HH:MM, 24-hour. */
export function localTime(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "7:30 am" — for display only; storage always keeps 24h. */
export function prettyTime(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return "";
  const h = Number(m[1]);
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

/* ---------- catalogues ---------- */

export const MEALS: { id: MealCategory; label: string; icon: string }[] = [
  { id: "breakfast", label: "Breakfast", icon: "sunrise" },
  { id: "lunch", label: "Lunch", icon: "sun" },
  { id: "dinner", label: "Dinner", icon: "moon" },
  { id: "snack", label: "Snack", icon: "snack" },
  { id: "drink", label: "Drink", icon: "drink" },
];

export const mealLabel = (m: string): string =>
  MEALS.find((x) => x.id === m)?.label || "Meal";

/** Best guess at which meal someone is logging, from the clock. Only ever a
    pre-selection — every field stays editable. */
export function mealForTime(hhmm: string): MealCategory {
  const h = Number(String(hhmm).slice(0, 2));
  if (!isFinite(h)) return "snack";
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

export const UNITS = ["g", "oz", "ml", "cup", "tbsp", "piece", "serving"];

/** The seven Bristol types, in the scale's own order. Descriptions are the
    observable shape only — the scale is a description, not a diagnosis, and
    this app never presents it as one. */
export const BRISTOL: { type: number; label: string; desc: string }[] = [
  { type: 1, label: "Separate hard lumps", desc: "Like nuts, hard to pass" },
  { type: 2, label: "Lumpy sausage", desc: "Sausage-shaped but lumpy" },
  { type: 3, label: "Cracked sausage", desc: "Sausage with cracks on the surface" },
  { type: 4, label: "Smooth sausage", desc: "Smooth and soft, like a snake" },
  { type: 5, label: "Soft blobs", desc: "Soft blobs with clear edges" },
  { type: 6, label: "Mushy ragged", desc: "Fluffy pieces with ragged edges" },
  { type: 7, label: "Entirely liquid", desc: "Watery, no solid pieces" },
];

export const bristolLabel = (t?: number): string =>
  BRISTOL.find((b) => b.type === t)?.label || "";

export const BOWEL_COLORS = [
  "Brown", "Light brown", "Dark brown", "Yellow", "Green", "Pale / clay", "Red", "Black",
];

export const BOWEL_CONSISTENCY = ["Hard", "Formed", "Soft", "Loose", "Watery"];

export const BOWEL_AMOUNTS: { id: "small" | "medium" | "large"; label: string }[] = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];

/* ---------- turning a model's words into the form's own options ----------

   The bowel form is chips, not free text: a suggestion of "dark brown" has to
   come back as the exact string `"Dark brown"` or the chip it means never
   lights up, the value stored doesn't match any option, and every later
   grouping treats it as a category of one. That was survivable while a person
   read the suggestion and tapped the chip themselves. It is not survivable
   once the model's answer can land in the log directly, so the mapping lives
   here, next to the lists it maps onto.

   Anything that doesn't map is dropped rather than guessed at. A blank field
   the person can see and fill is always better than a wrong one they can't. */

const norm = (s: unknown): string =>
  String(s ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim();

/** The model's colour word → one of BOWEL_COLORS, or undefined. */
export function matchBowelColor(raw: unknown): string | undefined {
  const s = norm(raw);
  if (!s) return undefined;
  const exact = BOWEL_COLORS.find((c) => norm(c) === s);
  if (exact) return exact;
  // Order matters: "pale" and the qualified browns have to be tested before
  // the bare "brown" they all contain.
  if (/\b(pale|clay|grey|gray|white|chalk)\b/.test(s)) return "Pale / clay";
  if (/\bblack|tarry\b/.test(s)) return "Black";
  if (/\bred|maroon|crimson\b/.test(s)) return "Red";
  if (/\bgreen|olive\b/.test(s)) return "Green";
  if (/\byellow|amber|mustard\b/.test(s)) return "Yellow";
  if (/\bdark\b/.test(s) && /\bbrown\b/.test(s)) return "Dark brown";
  if (/\b(light|pale|tan|golden)\b/.test(s) && /\bbrown\b/.test(s)) return "Light brown";
  if (/\bbrown\b/.test(s)) return "Brown";
  return undefined;
}

/** The model's consistency word → one of BOWEL_CONSISTENCY, or undefined. */
export function matchBowelConsistency(raw: unknown): string | undefined {
  const s = norm(raw);
  if (!s) return undefined;
  const exact = BOWEL_CONSISTENCY.find((c) => norm(c) === s);
  if (exact) return exact;
  if (/\bwatery|liquid|fluid\b/.test(s)) return "Watery";
  if (/\bloose|mushy|ragged\b/.test(s)) return "Loose";
  if (/\bsoft\b/.test(s)) return "Soft";
  if (/\bformed|solid|smooth|sausage\b/.test(s)) return "Formed";
  if (/\bhard|firm|lumpy\b/.test(s)) return "Hard";
  return undefined;
}

/** Everything a photo reading can contribute to a bowel log, already expressed
    in the form's own vocabulary. Values the model didn't give — or gave in
    terms this app doesn't recognise — are simply absent. */
export function bowelSuggestion(ai: BowelAiResult | undefined): Partial<BowelLog> {
  if (!ai) return {};
  const out: Partial<BowelLog> = {};
  if (ai.bristol != null) out.bristol = ai.bristol;
  if (ai.amount) out.amount = ai.amount;
  const color = matchBowelColor(ai.color);
  if (color) out.color = color;
  const consistency = matchBowelConsistency(ai.consistency);
  if (consistency) out.consistency = consistency;
  return out;
}

/** Fold a suggestion into a log **without ever overwriting a person**. Every
    field the user has already answered wins; the model only fills blanks.
    Returns the same object when there is nothing to add, so callers can skip a
    pointless re-render. */
export function applyBowelSuggestion(log: BowelLog, ai?: BowelAiResult): BowelLog {
  const suggested = bowelSuggestion(ai ?? log.ai);
  const patch: Partial<BowelLog> = {};
  for (const [k, v] of Object.entries(suggested)) {
    if ((log as any)[k] == null) (patch as any)[k] = v;
  }
  if (!Object.keys(patch).length) return log;
  return { ...log, ...patch, updatedAt: stamp() };
}

/** Which of a log's fields the model is currently responsible for. Drives the
    "AI filled these in" summary — a value is only claimed when it matches what
    the suggestion would have written, so typing over one drops it off the
    list without any extra bookkeeping. */
export function aiFilledBowelFields(log: BowelLog): (keyof BowelLog)[] {
  const suggested = bowelSuggestion(log.ai);
  return (Object.keys(suggested) as (keyof BowelLog)[])
    .filter((k) => log[k] != null && log[k] === (suggested as any)[k]);
}

/** 0–3 scales share one vocabulary so three questions read as one control. */
export const SEVERITY_0_3 = ["None", "Mild", "Moderate", "Severe"];

export const severityLabel = (n?: number): string =>
  n == null ? "" : SEVERITY_0_3[Math.max(0, Math.min(3, Math.round(n)))] || "";

/* ---------- nutrient definitions ----------
   One list drives the estimate form, the totals row, the trend metrics and the
   export columns, so a nutrient can't exist in one of those and not another. */

export type NutrientKey = "calories" | "protein" | "carbs" | "fat" | "fiber" | "sugar" | "sodium";

export const NUTRIENTS: {
  k: NutrientKey;
  label: string;
  unit: string;
  /** Rounding step for display — see the "estimates are ranges" rule up top. */
  step: number;
  /** Shown on the compact summary line under a meal. */
  primary?: boolean;
}[] = [
  { k: "calories", label: "Calories", unit: "kcal", step: 5, primary: true },
  { k: "protein", label: "Protein", unit: "g", step: 1, primary: true },
  { k: "carbs", label: "Carbs", unit: "g", step: 1, primary: true },
  { k: "fat", label: "Fat", unit: "g", step: 1, primary: true },
  { k: "fiber", label: "Fiber", unit: "g", step: 0.5 },
  { k: "sugar", label: "Sugar", unit: "g", step: 0.5 },
  { k: "sodium", label: "Sodium", unit: "mg", step: 10 },
];

export const NUTRIENT_KEYS = NUTRIENTS.map((n) => n.k);

export const nutrientDef = (k: NutrientKey) => NUTRIENTS.find((n) => n.k === k)!;

/** Round to the nutrient's own resolution. Keeps "about 600 kcal" from being
    rendered as 612 and read as a measurement. */
export function formatNutrient(k: NutrientKey, v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "–";
  const { step } = nutrientDef(k);
  const rounded = Math.round(v / step) * step;
  return step < 1 ? String(Math.round(rounded * 2) / 2) : String(Math.round(rounded));
}

/* ---------- constructors ---------- */

/* `{ time: undefined }` is what a caller passing an optional prop through
   looks like, and spreading it over a computed default silently un-sets that
   default — a log with no time at all, which every sort and every "when was
   this" then has to cope with. Explicitly-absent and absent mean the same
   thing here, so they are made to behave the same way. */
const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

export function newFoodLog(partial: Partial<FoodLog> = {}): FoodLog {
  const now = new Date();
  const given = defined(partial);
  const time = given.time || localTime(now);
  return {
    id: `f_${Date.now().toString(36)}${rand()}`,
    date: given.date || localDate(now),
    time,
    meal: given.meal || mealForTime(time),
    description: given.description ?? "",
    createdAt: stamp(),
    updatedAt: stamp(),
    ...given,
  } as FoodLog;
}

export function newBowelLog(partial: Partial<BowelLog> = {}): BowelLog {
  const now = new Date();
  const given = defined(partial);
  return {
    id: `b_${Date.now().toString(36)}${rand()}`,
    date: given.date || localDate(now),
    time: given.time || localTime(now),
    createdAt: stamp(),
    updatedAt: stamp(),
    ...given,
  } as BowelLog;
}

/* ---------- user data vs. AI estimates ----------

   The whole point of keeping the two apart on disk is being able to answer
   "did I write this, or did a model?" at render time. This is where that gets
   answered. */

export type ValueSource = "user" | "ai" | "none";

export type ResolvedNutrient = {
  k: NutrientKey;
  value: number | null;
  source: ValueSource;
};

/** The number to show for one nutrient, and where it came from. The user's own
    figure always wins; a model's fills the gap; neither means no value, which
    is a legitimate and common answer. */
export function resolveNutrient(log: FoodLog, k: NutrientKey): ResolvedNutrient {
  const mine = log.nutrition?.[k];
  if (typeof mine === "number" && isFinite(mine)) return { k, value: mine, source: "user" };
  const theirs = log.ai?.nutrition?.[k];
  if (typeof theirs === "number" && isFinite(theirs)) return { k, value: theirs, source: "ai" };
  return { k, value: null, source: "none" };
}

/** Every nutrient resolved at once, in catalogue order. */
export const effectiveNutrition = (log: FoodLog): ResolvedNutrient[] =>
  NUTRIENT_KEYS.map((k) => resolveNutrient(log, k));

/** True when any displayed value on this log came from a model. Drives the
    "AI Estimated" badge on the card. */
export const hasAiValues = (log: FoodLog): boolean =>
  effectiveNutrition(log).some((n) => n.source === "ai");

/** True when the user has overridden anything the model said. */
export const hasUserEdits = (log: FoodLog): boolean =>
  NUTRIENT_KEYS.some((k) => typeof log.nutrition?.[k] === "number");

/** Accept a model's estimate as the user's own — used by "Looks right".
    Copies the values across so later edits to `ai` (a re-run) can't silently
    change numbers the user has already signed off on. */
export function acceptEstimate(log: FoodLog): FoodLog {
  if (!log.ai) return log;
  const nutrition: NutritionValues = { ...(log.nutrition || {}) };
  for (const k of NUTRIENT_KEYS) {
    if (typeof nutrition[k] !== "number") {
      const v = log.ai.nutrition?.[k];
      if (typeof v === "number" && isFinite(v)) nutrition[k] = v;
    }
  }
  if (log.ai.nutrition?.micros?.length && !nutrition.micros?.length) {
    nutrition.micros = log.ai.nutrition.micros.slice();
  }
  return { ...log, nutrition, updatedAt: stamp() };
}

/** Drop a model's reading entirely, keeping everything the user wrote. */
export function discardEstimate(log: FoodLog): FoodLog {
  const { ai, ...rest } = log;
  return { ...rest, updatedAt: stamp() } as FoodLog;
}

/* ---------- the food library ----------

   MyFitnessPal's speed comes from one thing above all others: you almost never
   type a food twice. That is a database of two million foods on a server, and
   this app has no server and no account, so it cannot have that.

   What it can have is the part that actually does the work. People eat the
   same thirty or forty things on repeat; a library built from the user's own
   logs covers nearly every meal after the first week, and unlike a shared
   database its serving sizes are already the ones they actually use.

   Provenance survives re-use. An item whose figures began as an unconfirmed
   model estimate is marked `estimated`, and logging it writes into the log's
   `ai` block rather than its `nutrition` — otherwise saving a food would be a
   laundering step that turns a guess into a measurement one tap later. */

/** Fold a name for matching: case, spacing and punctuation don't count. */
export const foodKey = (name: string, brand?: string): string =>
  `${String(name || "").trim().toLowerCase()}|${String(brand || "").trim().toLowerCase()}`
    .replace(/[^a-z0-9|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function newFoodItem(partial: Partial<FoodItem> & { name: string }): FoodItem {
  const { name, serving, brand, ...rest } = partial;
  return {
    id: `fi_${Date.now().toString(36)}${rand()}`,
    useCount: 0,
    lastUsedAt: stamp(),
    createdAt: stamp(),
    updatedAt: stamp(),
    nutrition: {},
    ...rest,
    // After the spread: these three come straight from input fields, and a
    // stray space in a name breaks matching for good.
    name: name.trim(),
    brand: brand?.trim() || undefined,
    serving: serving?.trim() || "1 serving",
  };
}

/** Multiply a set of figures by a serving count. Micros are dropped rather
    than scaled: "Iron: 2.1 mg" is a string, and doubling it by string surgery
    is how you end up displaying "Iron: 4.2 mg" for something that said
    "trace". */
export function scaleNutrition(n: NutritionValues, servings: number): NutritionValues {
  const mult = isFinite(servings) && servings > 0 ? servings : 1;
  const out: NutritionValues = {};
  for (const k of NUTRIENT_KEYS) {
    const v = n?.[k];
    if (typeof v === "number" && isFinite(v)) out[k] = Math.round(v * mult * 10) / 10;
  }
  if (mult === 1 && n?.micros?.length) out.micros = n.micros.slice();
  return out;
}

/** Build a log from a saved food. The figures are scaled and written down on
    the log itself, so later edits to the library item never rewrite history. */
export function logFromFoodItem(
  item: FoodItem,
  opts: { date: string; time?: string; meal?: MealCategory; servings?: number }
): FoodLog {
  const servings = isFinite(opts.servings as number) && (opts.servings as number) > 0 ? (opts.servings as number) : 1;
  const time = opts.time || localTime();
  const scaled = scaleNutrition(item.nutrition, servings);

  const base = newFoodLog({
    date: opts.date,
    time,
    meal: opts.meal || mealForTime(time),
    description: item.brand ? `${item.name} (${item.brand})` : item.name,
    serving: servings === 1 ? item.serving : `${trimNum(servings)} × ${item.serving}`,
    foodId: item.id,
    servings,
  });

  return item.estimated
    ? {
        ...base,
        ai: {
          at: stamp(),
          model: "",
          source: "library",
          nutrition: scaled,
          confidence: "low",
          note: "Carried over from a saved food whose figures were an estimate.",
        },
      }
    : { ...base, nutrition: scaled };
}

/** Drop a trailing ".0" so "2 × 1 bowl" doesn't read as "2.0 × 1 bowl". */
const trimNum = (n: number): string => String(Math.round(n * 100) / 100);

/** Turn a saved log into a library item, or update the one it came from.

    Called on save, so the library grows by using the app rather than by being
    curated. Figures are stored per *one* serving, so a "3 × 1 slice" log
    doesn't teach the library that a slice is 3 slices. */
export function rememberFood(library: FoodItem[], log: FoodLog): FoodItem[] {
  const name = (log.description || "").trim();
  if (!name) return library; // nothing to call it; a photo-only log stays a log
  const resolved = effectiveNutrition(log);
  if (!resolved.some((n) => n.value != null)) return library; // no figures worth saving

  const servings = isFinite(log.servings as number) && (log.servings as number) > 0 ? (log.servings as number) : 1;
  const perServing: NutritionValues = {};
  for (const n of resolved) {
    if (n.value != null) perServing[n.k] = Math.round((n.value / servings) * 10) / 10;
  }
  const estimated = resolved.some((n) => n.source === "ai");
  const serving = log.serving && servings === 1
    ? log.serving
    : log.quantity != null
      ? `${log.quantity}${log.unit ? ` ${log.unit}` : ""}`
      : "1 serving";

  const key = foodKey(name);
  const i = library.findIndex((f) => (log.foodId && f.id === log.foodId) || foodKey(f.name, f.brand) === key);

  if (i < 0) {
    return [
      ...library,
      newFoodItem({ name, serving, nutrition: perServing, estimated: estimated || undefined, useCount: 1, lastUsedAt: stamp() }),
    ];
  }
  const prev = library[i];
  const next: FoodItem = {
    ...prev,
    // A saved food's figures follow the most recent time it was logged, which
    // is what makes correcting an estimate once fix it everywhere after.
    nutrition: perServing,
    serving: serving || prev.serving,
    estimated: estimated || undefined,
    useCount: (prev.useCount || 0) + 1,
    lastUsedAt: stamp(),
    updatedAt: stamp(),
  };
  return library.map((f, j) => (j === i ? next : f));
}

/** Score a library item against a query. Higher is better; -1 means no match.
    A prefix match beats a word-start match beats a substring, so typing "chi"
    surfaces "Chicken" above "Zucchini". */
export function searchScore(item: FoodItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const name = item.name.toLowerCase();
  const brand = (item.brand || "").toLowerCase();
  if (name.startsWith(q)) return 100;
  if (name.split(/\s+/).some((w) => w.startsWith(q))) return 80;
  if (name.includes(q)) return 60;
  if (brand.startsWith(q)) return 50;
  if (brand.includes(q)) return 30;
  return -1;
}

export type LibraryTab = "recent" | "frequent" | "favorite" | "all";

/** The list behind each tab of the picker. Search always wins: once someone is
    typing, they are looking for one specific thing and the tab is noise. */
export function browseFoods(library: FoodItem[], tab: LibraryTab, query = ""): FoodItem[] {
  const rows = library || [];
  if (query.trim()) {
    return rows
      .map((f) => ({ f, s: searchScore(f, query) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s || (b.f.useCount || 0) - (a.f.useCount || 0) || a.f.name.localeCompare(b.f.name))
      .map((r) => r.f);
  }
  const byName = (a: FoodItem, b: FoodItem) => a.name.localeCompare(b.name);
  if (tab === "favorite") return rows.filter((f) => f.favorite).sort(byName);
  if (tab === "frequent") {
    return rows.filter((f) => (f.useCount || 0) > 0)
      .sort((a, b) => (b.useCount || 0) - (a.useCount || 0) || byName(a, b));
  }
  if (tab === "all") return rows.slice().sort(byName);
  return rows.slice().sort((a, b) => String(b.lastUsedAt).localeCompare(String(a.lastUsedAt)) || byName(a, b));
}

export const toggleFavorite = (library: FoodItem[], id: string): FoodItem[] =>
  library.map((f) => (f.id === id ? { ...f, favorite: !f.favorite, updatedAt: stamp() } : f));

/* ---------- goals ---------- */

export type GoalProgress = {
  k: NutrientKey;
  goal: number;
  eaten: number | null;
  /** 0–1, clamped. Null when nothing has been recorded. */
  ratio: number | null;
  remaining: number | null;
};

/** Progress toward whichever targets the user actually set. Returns nothing at
    all when they set none, which is the default — this app does not decide
    that someone should have a calorie goal. */
export function goalProgress(goals: NutritionGoals | undefined, totals: DayTotals): GoalProgress[] {
  if (!goals) return [];
  const out: GoalProgress[] = [];
  for (const k of NUTRIENT_KEYS) {
    const goal = goals[k];
    if (typeof goal !== "number" || !isFinite(goal) || goal <= 0) continue;
    const eaten = totals[k];
    out.push({
      k,
      goal,
      eaten,
      ratio: eaten == null ? null : Math.max(0, Math.min(1, eaten / goal)),
      remaining: eaten == null ? goal : Math.round((goal - eaten) * 10) / 10,
    });
  }
  return out;
}

export const hasGoals = (goals: NutritionGoals | undefined): boolean =>
  goalProgress(goals, {} as DayTotals).length > 0;

/* ---------- daily aggregates ---------- */

const onDate = <T extends { date: string }>(rows: T[], date: string): T[] =>
  (rows || []).filter((r) => r && r.date === date);

const byTime = <T extends { time: string }>(rows: T[]): T[] =>
  rows.slice().sort((a, b) => String(a.time).localeCompare(String(b.time)));

export const foodOn = (food: FoodLog[], date: string): FoodLog[] => byTime(onDate(food, date));
export const bowelOn = (bowel: BowelLog[], date: string): BowelLog[] => byTime(onDate(bowel, date));

export type DayTotals = Record<NutrientKey, number | null> & {
  /** How many of the day's meals contributed at least one number. */
  counted: number;
  meals: number;
  /** True when any contributing value was a model's rather than the user's. */
  partlyEstimated: boolean;
};

/** Totals across a day's meals. A nutrient with no data anywhere in the day is
    null rather than 0 — "I didn't record fibre" and "I ate no fibre" are
    different statements and the chart must not conflate them. */
export function dayTotals(food: FoodLog[], date: string): DayTotals {
  const logs = foodOn(food, date);
  const out: any = { counted: 0, meals: logs.length, partlyEstimated: false };
  for (const k of NUTRIENT_KEYS) out[k] = null;
  for (const log of logs) {
    let contributed = false;
    for (const n of effectiveNutrition(log)) {
      if (n.value == null) continue;
      out[n.k] = (out[n.k] ?? 0) + n.value;
      contributed = true;
      if (n.source === "ai") out.partlyEstimated = true;
    }
    if (contributed) out.counted += 1;
  }
  return out as DayTotals;
}

/* ---------- derived trend metrics ----------

   Food and bowel logs are many-per-day, but the trend chart is one-value-per
   day. These definitions are the bridge: each one reduces a day's logs to a
   single number, and is then indistinguishable from a survey question to the
   picker, the chart and the AI pattern payload.

   `dir` follows the app's existing convention: "sym" = higher is worse, "pos"
   = higher is better, "neutral" = neither, just a quantity. Most of these are
   neutral on purpose — there is no healthy calorie count, and colouring one
   red would be the app giving dietary advice. */

/** Everything a derived metric is allowed to look at for one day. Every
    collection is optional: a metric reads the one it is about and ignores the
    rest, and a caller that has no routine yet shouldn't have to pass an empty
    array to plot its calories. */
export interface MetricCtx {
  food?: FoodLog[];
  bowel?: BowelLog[];
  /** The routine lives in ./routine, which imports this module — so the
      metrics over it are defined there and folded into one registry by
      ./metrics. The shapes come from the model contract, which imports
      nothing, so naming them here costs no runtime dependency. */
  routine?: RoutineLog[];
  routineItems?: RoutineItem[];
  date: string;
}

export type DerivedMetric = {
  k: string;
  label: string;
  unit?: string;
  dir: "sym" | "pos" | "neutral";
  sec: string;
  /** Reduce one day to one number, or null when the day has no data. */
  value: (ctx: MetricCtx) => number | null;
};

const avg = (xs: number[]): number | null =>
  xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

export const FOOD_METRICS: DerivedMetric[] = NUTRIENTS.map((n) => ({
  k: `food_${n.k}`,
  label: n.k === "calories" ? "Calories" : `${n.label} (food)`,
  unit: n.unit,
  dir: "neutral" as const,
  sec: "Food",
  value: ({ food = [], date }) => {
    const t = dayTotals(food, date);
    const v = t[n.k];
    return v == null ? null : Math.round(v * 10) / 10;
  },
}));

export const BOWEL_METRICS: DerivedMetric[] = [
  {
    k: "bm_count",
    label: "Bowel movements",
    dir: "neutral",
    sec: "Bowel",
    value: ({ bowel = [], date }) => {
      const rows = bowelOn(bowel, date);
      return rows.length ? rows.length : null;
    },
  },
  {
    k: "bm_bristol",
    label: "Bristol type (avg)",
    dir: "neutral",
    sec: "Bowel",
    value: ({ bowel = [], date }) =>
      avg(bowelOn(bowel, date).map((b) => b.bristol).filter((n): n is number => typeof n === "number")),
  },
  {
    k: "bm_urgency",
    label: "Urgency",
    dir: "sym",
    sec: "Bowel",
    value: ({ bowel = [], date }) =>
      avg(bowelOn(bowel, date).map((b) => b.urgency).filter((n): n is number => typeof n === "number")),
  },
  {
    k: "bm_straining",
    label: "Straining",
    dir: "sym",
    sec: "Bowel",
    value: ({ bowel = [], date }) =>
      avg(bowelOn(bowel, date).map((b) => b.straining).filter((n): n is number => typeof n === "number")),
  },
  {
    k: "bm_discomfort",
    label: "Discomfort",
    dir: "sym",
    sec: "Bowel",
    value: ({ bowel = [], date }) =>
      avg(bowelOn(bowel, date).map((b) => b.discomfort).filter((n): n is number => typeof n === "number")),
  },
];

/* The combined registry — every derived metric, plus the helpers that read
   them — lives in ./metrics, because the routine's metrics are defined in
   ./routine and this module cannot import that without a cycle. */

/* ---------- summaries for the timeline ---------- */

/** "Lunch · 2 slices · about 520 kcal" — the one-line description of a meal
    used on the dashboard timeline. */
export function foodSummary(log: FoodLog): string {
  const bits: string[] = [];
  if (log.serving) bits.push(log.serving);
  else if (log.quantity != null) bits.push(`${log.quantity}${log.unit ? ` ${log.unit}` : ""}`);
  const cal = resolveNutrient(log, "calories");
  if (cal.value != null) {
    bits.push(`${cal.source === "ai" ? "about " : ""}${formatNutrient("calories", cal.value)} kcal`);
  }
  return bits.join(" · ");
}

/** "Type 4 · Medium · Brown" — same idea for a bowel log. */
export function bowelSummary(log: BowelLog): string {
  const bits: string[] = [];
  if (log.bristol != null) bits.push(`Type ${log.bristol}`);
  if (log.amount) bits.push(BOWEL_AMOUNTS.find((a) => a.id === log.amount)?.label || log.amount);
  if (log.color) bits.push(log.color);
  else if (log.consistency) bits.push(log.consistency);
  return bits.join(" · ");
}

/* ---------- sanitising restored / imported rows ----------

   Backups are user-editable files. Anything reaching the render tree from one
   goes through here first, for the same reason model output does: an array
   where an object belongs shouldn't be able to take a screen down. */

const str = (v: unknown, max = 400): string => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown): number | undefined =>
  typeof v === "number" && isFinite(v) ? v : undefined;
const clamp = (v: number | undefined, lo: number, hi: number): number | undefined =>
  v == null ? undefined : Math.max(lo, Math.min(hi, v));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/* Validates the value, not just the shape. `\d{2}:\d{2}` accepts "25:99",
   which then sorts into the middle of the timeline and renders as "25:99 pm". */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function cleanNutrition(v: any): NutritionValues | undefined {
  if (!v || typeof v !== "object") return undefined;
  const out: NutritionValues = {};
  for (const k of NUTRIENT_KEYS) {
    const n = num(v[k]);
    // Negative nutrition is not a thing; an absurd upper bound catches a
    // decimal-point slip without second-guessing a legitimately big day.
    if (n != null && n >= 0 && n < 1e6) out[k] = n;
  }
  if (Array.isArray(v.micros)) {
    out.micros = v.micros
      .filter((m: any) => m && typeof m === "object")
      .slice(0, 12)
      .map((m: any) => ({ label: str(m.label, 60), amount: str(m.amount, 40) }))
      .filter((m: any) => m.label && m.amount);
  }
  return Object.keys(out).length ? out : undefined;
}

const CONFIDENCES = ["low", "medium", "high"];
const confidence = (v: unknown) =>
  (CONFIDENCES.includes(v as string) ? v : "low") as "low" | "medium" | "high";

function cleanFoodAi(v: any): FoodAiResult | undefined {
  if (!v || typeof v !== "object") return undefined;
  const nutrition = cleanNutrition(v.nutrition);
  if (!nutrition) return undefined;
  const source = ["text", "photo", "photo+text", "library"].includes(v.source) ? v.source : "text";
  return {
    at: str(v.at, 40) || stamp(),
    model: str(v.model, 80),
    source,
    identified: str(v.identified, 200) || undefined,
    nutrition,
    confidence: confidence(v.confidence),
    note: str(v.note, 400) || undefined,
  };
}

function cleanBowelAi(v: any): BowelAiResult | undefined {
  if (!v || typeof v !== "object") return undefined;
  return {
    at: str(v.at, 40) || stamp(),
    model: str(v.model, 80),
    bristol: clamp(num(v.bristol), 1, 7),
    amount: BOWEL_AMOUNTS.some((a) => a.id === v.amount) ? v.amount : undefined,
    color: str(v.color, 40) || undefined,
    consistency: str(v.consistency, 40) || undefined,
    form: str(v.form, 60) || undefined,
    confidence: confidence(v.confidence),
    note: str(v.note, 400) || undefined,
  };
}

/** Drop anything malformed rather than throwing — one bad row in a restored
    backup must not cost the user the other three hundred. */
export function sanitizeFoodLogs(rows: unknown): FoodLog[] {
  if (!Array.isArray(rows)) return [];
  const out: FoodLog[] = [];
  for (const r of rows as any[]) {
    if (!r || typeof r !== "object") continue;
    if (!DATE_RE.test(r.date)) continue;
    const meal = MEALS.some((m) => m.id === r.meal) ? r.meal : "snack";
    out.push({
      id: str(r.id, 64) || `f_${Date.now().toString(36)}${rand()}`,
      date: r.date,
      time: TIME_RE.test(r.time) ? r.time : "12:00",
      meal,
      description: str(r.description, 400),
      serving: str(r.serving, 80) || undefined,
      foodId: str(r.foodId, 64) || undefined,
      servings: num(r.servings) != null && num(r.servings)! > 0 ? num(r.servings) : undefined,
      quantity: num(r.quantity),
      unit: str(r.unit, 20) || undefined,
      notes: str(r.notes, 2000) || undefined,
      photoId: str(r.photoId, 64) || undefined,
      nutrition: cleanNutrition(r.nutrition),
      ai: cleanFoodAi(r.ai),
      createdAt: str(r.createdAt, 40) || stamp(),
      updatedAt: str(r.updatedAt, 40) || stamp(),
    });
  }
  return out;
}

export function sanitizeFoodItems(rows: unknown): FoodItem[] {
  if (!Array.isArray(rows)) return [];
  const out: FoodItem[] = [];
  const seen = new Set<string>();
  for (const r of rows as any[]) {
    if (!r || typeof r !== "object") continue;
    const name = str(r.name, 120).trim();
    if (!name) continue;
    // A library with two entries for the same food is worse than one with none
    // — every search shows a pair and the counts split between them.
    const key = foodKey(name, r.brand);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: str(r.id, 64) || `fi_${Date.now().toString(36)}${rand()}`,
      name,
      brand: str(r.brand, 80).trim() || undefined,
      serving: str(r.serving, 80).trim() || "1 serving",
      nutrition: cleanNutrition(r.nutrition) || {},
      estimated: r.estimated === true || undefined,
      favorite: r.favorite === true || undefined,
      useCount: Math.max(0, Math.round(num(r.useCount) ?? 0)),
      lastUsedAt: str(r.lastUsedAt, 40) || stamp(),
      createdAt: str(r.createdAt, 40) || stamp(),
      updatedAt: str(r.updatedAt, 40) || stamp(),
    });
  }
  return out;
}

export function sanitizeGoals(v: unknown): NutritionGoals | undefined {
  if (!v || typeof v !== "object") return undefined;
  const out: NutritionGoals = {};
  for (const k of NUTRIENT_KEYS) {
    const n = num((v as any)[k]);
    if (n != null && n > 0 && n < 1e6) out[k] = Math.round(n);
  }
  return Object.keys(out).length ? out : undefined;
}

export function sanitizeBowelLogs(rows: unknown): BowelLog[] {
  if (!Array.isArray(rows)) return [];
  const out: BowelLog[] = [];
  for (const r of rows as any[]) {
    if (!r || typeof r !== "object") continue;
    if (!DATE_RE.test(r.date)) continue;
    out.push({
      id: str(r.id, 64) || `b_${Date.now().toString(36)}${rand()}`,
      date: r.date,
      time: TIME_RE.test(r.time) ? r.time : "12:00",
      bristol: clamp(num(r.bristol), 1, 7),
      amount: BOWEL_AMOUNTS.some((a) => a.id === r.amount) ? r.amount : undefined,
      color: str(r.color, 40) || undefined,
      consistency: str(r.consistency, 40) || undefined,
      urgency: clamp(num(r.urgency), 0, 3),
      straining: clamp(num(r.straining), 0, 3),
      discomfort: clamp(num(r.discomfort), 0, 3),
      notes: str(r.notes, 2000) || undefined,
      photoId: str(r.photoId, 64) || undefined,
      ai: cleanBowelAi(r.ai),
      createdAt: str(r.createdAt, 40) || stamp(),
      updatedAt: str(r.updatedAt, 40) || stamp(),
    });
  }
  return out;
}
