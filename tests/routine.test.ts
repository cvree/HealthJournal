/* The routine — medications, supplements, creams, products.

   The promises being pinned here are the three the whole feature rests on:

   1. A log is a *record*. Renaming or deleting the item behind it never
      rewrites what a past day says happened.
   2. An absent log is silence, not a missed dose. Only a `skipped` log says
      the person decided against it.
   3. One tap ticks, the same tap unticks, and neither needs a form. */
import { describe, it, expect } from "vitest";
import {
  ROUTINE_KINDS, ROUTINE_TIMES, kindDef, kindLabel, timeLabel, slotForTime,
  newRoutineItem, newRoutineLog, logFromItem, bumpItemUse,
  routineOn, logsForItem, scheduledItems, asNeededItems,
  routineChecklist, routineProgress, routineSummary, itemSummary, logLine,
  searchItems, itemScore, itemKey,
  ROUTINE_METRICS, sanitizeRoutineItems, sanitizeRoutineLogs,
} from "../src/lib/routine";
import { buildRoutineTable, buildRoutineItemsTable, buildWideTable } from "../src/lib/exports";
import { derivedMetric, isDerivedKey, availableDerivedMetrics } from "../src/lib/metrics";

const D = "2026-08-18";

const cream = newRoutineItem({
  id: "ri_cream", name: "CeraVe cream", kind: "topical", dose: "2 pumps",
  times: ["morning", "bed"], daily: true,
});
const vitd = newRoutineItem({
  id: "ri_vitd", name: "Vitamin D3", kind: "supplement", dose: "2000 IU",
  times: ["morning"], daily: true,
});
const anytime = newRoutineItem({ id: "ri_any", name: "Collagen", kind: "supplement", daily: true });
const asNeeded = newRoutineItem({
  id: "ri_hc", name: "Hydrocortisone", kind: "med", dose: "thin layer", daily: false, useCount: 3,
});
const ITEMS = [cream, vitd, anytime, asNeeded];

describe("catalogues", () => {
  it("gives every kind a label, an icon and a dose example in its own language", () => {
    for (const k of ROUTINE_KINDS) {
      expect(k.label).toBeTruthy();
      expect(k.icon).toBeTruthy();
      expect(k.dosePlaceholder).toBeTruthy();
    }
    // A cream asked for "e.g. 10 mg" is a form saying it wasn't built for you.
    expect(kindDef("topical").dosePlaceholder).not.toMatch(/mg/);
    expect(kindLabel("med")).toBe("Medication");
    expect(kindLabel("nonsense")).toBe("Other");
  });

  it("reads a clock into a part of the day, and never crashes on rubbish", () => {
    expect(slotForTime("07:30")).toBe("morning");
    expect(slotForTime("13:00")).toBe("midday");
    expect(slotForTime("19:45")).toBe("evening");
    expect(slotForTime("23:10")).toBe("bed");
    expect(ROUTINE_TIMES.map((t) => t.id)).toContain(slotForTime("nonsense"));
  });

  it("names an unslotted use rather than leaving a blank", () => {
    expect(timeLabel(undefined)).toBe("Anytime");
    expect(timeLabel("bed")).toBe("Bedtime");
  });
});

describe("constructors", () => {
  it("trims what came from an input field, so matching isn't broken by a stray space", () => {
    const it0 = newRoutineItem({ name: "  Magnesium  ", brand: " Now ", dose: " 400 mg " });
    expect(it0.name).toBe("Magnesium");
    expect(it0.brand).toBe("Now");
    expect(it0.dose).toBe("400 mg");
  });

  it("defaults a new item to a daily driver with no fixed time", () => {
    const it0 = newRoutineItem({ name: "Zinc" });
    expect(it0.daily).toBe(true);
    expect(it0.times).toEqual([]);
    expect(it0.useCount).toBe(0);
  });

  it("stamps a log with the item's name, kind and dose — not a reference to them", () => {
    const log = logFromItem(cream, { date: D, slot: "morning" });
    expect(log).toMatchObject({
      itemId: "ri_cream", name: "CeraVe cream", kind: "topical", dose: "2 pumps",
      slot: "morning", date: D,
    });
  });

  it("lets a single use carry a different dose without touching the item", () => {
    const log = logFromItem(cream, { date: D, slot: "morning", dose: "1 pump" });
    expect(log.dose).toBe("1 pump");
    expect(cream.dose).toBe("2 pumps");
  });

  it("keeps history readable after the item is renamed", () => {
    const log = logFromItem(cream, { date: D });
    const renamed = { ...cream, name: "CeraVe (new tub)" };
    // The log is the record. Nothing about it reads back through the item.
    expect(log.name).toBe("CeraVe cream");
    expect(renamed.name).toBe("CeraVe (new tub)");
  });

  it("counts a use against its item and leaves the others alone", () => {
    const next = bumpItemUse(ITEMS, "ri_vitd");
    expect(next.find((i) => i.id === "ri_vitd")!.useCount).toBe(1);
    expect(next.find((i) => i.id === "ri_cream")!.useCount).toBe(cream.useCount);
    expect(next.find((i) => i.id === "ri_vitd")!.lastUsedAt).toBeTruthy();
  });
});

describe("the day's checklist", () => {
  it("asks for an item once per slot it is scheduled in", () => {
    const groups = routineChecklist(ITEMS, [], D);
    const rows = groups.flatMap((g) => g.rows);
    // cream twice (morning + bed), vitd once, anytime once. As-needed never.
    expect(rows.filter((r) => r.item.id === "ri_cream")).toHaveLength(2);
    expect(rows.filter((r) => r.item.id === "ri_hc")).toHaveLength(0);
    expect(rows).toHaveLength(4);
  });

  it("groups by part of the day, in clock order, with anytime last", () => {
    const labels = routineChecklist(ITEMS, [], D).map((g) => g.label);
    expect(labels).toEqual(["Morning", "Bedtime", "Anytime"]);
  });

  it("ticks only the slot that was logged", () => {
    const logs = [logFromItem(cream, { date: D, slot: "morning" })];
    const rows = routineChecklist(ITEMS, logs, D).flatMap((g) => g.rows);
    const morning = rows.find((r) => r.item.id === "ri_cream" && r.slot === "morning")!;
    const bed = rows.find((r) => r.item.id === "ri_cream" && r.slot === "bed")!;
    expect(morning.done).toBe(true);
    expect(bed.done).toBe(false);
  });

  it("counts a slotless use against whichever row is asking", () => {
    // Logged from the as-needed row or an older build: it still happened.
    const logs = [logFromItem(vitd, { date: D })];
    const rows = routineChecklist(ITEMS, logs, D).flatMap((g) => g.rows);
    expect(rows.find((r) => r.item.id === "ri_vitd")!.done).toBe(true);
  });

  it("shows a skip as answered but not as taken", () => {
    const logs = [logFromItem(vitd, { date: D, slot: "morning", skipped: true })];
    const row = routineChecklist(ITEMS, logs, D).flatMap((g) => g.rows)
      .find((r) => r.item.id === "ri_vitd")!;
    expect(row.done).toBe(false);
    expect(row.skipped).toBe(true);
  });

  it("leaves an archived item off the checklist without touching its history", () => {
    const items = ITEMS.map((i) => (i.id === "ri_vitd" ? { ...i, archived: true } : i));
    const logs = [logFromItem(vitd, { date: D, slot: "morning" })];
    const rows = routineChecklist(items, logs, D).flatMap((g) => g.rows);
    expect(rows.some((r) => r.item.id === "ri_vitd")).toBe(false);
    expect(routineOn(logs, D)).toHaveLength(1);
  });

  it("offers as-needed items most-used first, and never as a task", () => {
    expect(scheduledItems(ITEMS).map((i) => i.id)).toEqual(["ri_cream", "ri_vitd", "ri_any"]);
    expect(asNeededItems(ITEMS).map((i) => i.id)).toEqual(["ri_hc"]);
  });

  it("reads a day's logs in clock order", () => {
    const logs = [
      logFromItem(vitd, { date: D, time: "21:00" }),
      logFromItem(cream, { date: D, time: "07:30" }),
      logFromItem(cream, { date: "2026-08-17", time: "07:30" }),
    ];
    expect(routineOn(logs, D).map((l) => l.time)).toEqual(["07:30", "21:00"]);
    expect(logsForItem(logs, D, "ri_cream")).toHaveLength(1);
  });
});

describe("progress", () => {
  it("counts skips as answered, because the question is 'did you deal with it'", () => {
    const logs = [
      logFromItem(cream, { date: D, slot: "morning" }),
      logFromItem(vitd, { date: D, slot: "morning", skipped: true }),
    ];
    expect(routineProgress(ITEMS, logs, D)).toEqual({
      done: 1, skipped: 1, total: 4, ratio: 0.5,
    });
  });

  it("says nothing rather than 0% when there is no plan", () => {
    expect(routineProgress([], [], D)).toEqual({ done: 0, skipped: 0, total: 0, ratio: null });
  });
});

describe("summaries", () => {
  it("says what happened, in the order somebody reads it", () => {
    const log = logFromItem(cream, { date: D, slot: "morning" });
    expect(routineSummary(log)).toBe("2 pumps · Morning");
    expect(routineSummary({ ...log, skipped: true })).toBe("Skipped · 2 pumps · Morning");
    expect(logLine({ ...log, time: "07:05" })).toBe("7:05 am · 2 pumps");
  });

  it("describes an item by what it is and when it is asked for", () => {
    expect(itemSummary(cream)).toBe("2 pumps · Morning, Bedtime");
    expect(itemSummary(anytime)).toBe("Anytime");
    expect(itemSummary(asNeeded)).toBe("thin layer · As needed");
  });
});

describe("search", () => {
  it("puts a prefix match above a word match above a substring", () => {
    expect(itemScore(cream, "cera")).toBeGreaterThan(itemScore(cream, "cream"));
    expect(itemScore(cream, "zzz")).toBe(-1);
    expect(searchItems(ITEMS, "vit").map((i) => i.id)).toEqual(["ri_vitd"]);
    expect(searchItems(ITEMS, "")).toHaveLength(ITEMS.length);
  });

  it("folds case and punctuation when deciding two names are the same thing", () => {
    expect(itemKey(" Vitamin D3 ")).toBe(itemKey("vitamin-d3"));
  });
});

describe("derived metrics", () => {
  const logs = [
    logFromItem(cream, { date: D, slot: "morning" }),
    logFromItem(vitd, { date: D, slot: "morning" }),
    logFromItem(anytime, { date: D, skipped: true }),
  ];

  it("is registered alongside the food and bowel metrics", () => {
    expect(isDerivedKey("rt_taken")).toBe(true);
    expect(isDerivedKey("rt_done")).toBe(true);
    expect(derivedMetric("rt_taken")).toBeTruthy();
    expect(ROUTINE_METRICS.map((m) => m.k)).toEqual(["rt_taken", "rt_done"]);
  });

  it("counts doses actually taken, and says nothing on a day with none", () => {
    const m = derivedMetric("rt_taken")!;
    expect(m.value({ routine: logs, routineItems: ITEMS, date: D })).toBe(2);
    expect(m.value({ routine: logs, routineItems: ITEMS, date: "2026-08-17" })).toBe(null);
  });

  it("reports completion against the plan, not against the doses logged", () => {
    // 2 of 4 scheduled rows ticked; the skip is answered but not done.
    expect(derivedMetric("rt_done")!.value({ routine: logs, routineItems: ITEMS, date: D })).toBe(50);
  });

  it("stays directionless — an adherence number the app colours red is advice", () => {
    for (const m of ROUTINE_METRICS) expect(m.dir).toBe("neutral");
  });

  it("is only offered once there is data behind it", () => {
    const dates = [D, "2026-08-17"];
    expect(availableDerivedMetrics({ routine: logs, routineItems: ITEMS }, dates, 1).map((m) => m.k))
      .toContain("rt_taken");
    expect(availableDerivedMetrics({ food: [], bowel: [] }, dates).map((m) => m.k))
      .not.toContain("rt_taken");
  });
});

describe("sanitising a hand-edited backup", () => {
  it("drops what cannot be understood and keeps everything that can", () => {
    const items = sanitizeRoutineItems([
      { id: "a", name: "Real", kind: "med", times: ["morning", "nope"], daily: true },
      { name: "" },                       // nothing to call it
      null,
      "not an object",
      { id: "b", name: "Odd kind", kind: "wizardry", daily: false },
    ]);
    expect(items.map((i) => i.name)).toEqual(["Real", "Odd kind"]);
    expect(items[0].times).toEqual(["morning"]);
    expect(items[1].kind).toBe("other");
    expect(items[1].daily).toBe(false);
  });

  it("refuses two rows with one id, which would show twice and split its history", () => {
    const items = sanitizeRoutineItems([
      { id: "dup", name: "First" }, { id: "dup", name: "Second" },
    ]);
    expect(items).toHaveLength(1);
  });

  it("keeps a log's own snapshot and repairs only what it must", () => {
    const logs = sanitizeRoutineLogs([
      { date: D, time: "25:99", itemId: "x", name: "Thing", kind: "med", dose: " 5 mg ", slot: "bogus" },
      { date: "not a date", name: "Dropped" },
      { date: D, time: "08:00" },        // neither a name nor an item
      { date: D, time: "08:00", itemId: "y", name: "Skipped one", skipped: true },
    ]);
    expect(logs).toHaveLength(2);
    expect(logs[0].time).toBe("12:00");   // "25:99" sorts and renders as nonsense
    expect(logs[0].dose).toBe("5 mg");
    expect(logs[0].slot).toBeUndefined();
    expect(logs[1].skipped).toBe(true);
  });

  it("survives anything that isn't an array at all", () => {
    expect(sanitizeRoutineItems(undefined)).toEqual([]);
    expect(sanitizeRoutineLogs({ nope: true })).toEqual([]);
  });
});

describe("export", () => {
  const logs = [
    logFromItem(vitd, { date: D, time: "07:40", slot: "morning" }),
    logFromItem(cream, { date: D, time: "22:30", slot: "bed", skipped: true }),
    logFromItem(cream, { date: "2026-08-17", time: "07:30", slot: "morning" }),
  ];

  it("writes one row per dose, oldest first, with taken and skipped told apart", () => {
    const { header, rows } = buildRoutineTable(logs, ITEMS);
    expect(rows).toHaveLength(3);
    expect(rows[0][0]).toBe("2026-08-17");
    const status = header.indexOf("status");
    expect(rows.map((r) => r[status])).toEqual(["taken", "taken", "skipped"]);
  });

  it("exports the name and dose as written at the time, not as they are now", () => {
    const renamed = ITEMS.map((i) => (i.id === "ri_vitd" ? { ...i, name: "Vit D (new)", dose: "4000 IU" } : i));
    const { header, rows } = buildRoutineTable(logs, renamed);
    const item = header.indexOf("item");
    const dose = header.indexOf("dose");
    const usual = header.indexOf("usual_dose");
    const row = rows.find((r) => String(r[item]).startsWith("Vitamin D"))!;
    expect(row[dose]).toBe("2000 IU");    // what happened
    expect(row[usual]).toBe("4000 IU");   // what the plan says now
  });

  it("exports the plan itself as its own small sheet", () => {
    const { header, rows } = buildRoutineItemsTable(ITEMS);
    expect(header).toContain("schedule");
    expect(rows).toHaveLength(4);
    const schedule = header.indexOf("schedule");
    expect(rows.map((r) => r[schedule])).toContain("as needed");
  });

  it("summarises the day beside the survey answers, and only when there is a routine", () => {
    const tpl = { label: "Test", fields: [{ k: "itch", label: "Itch", type: "scale" as const }] };
    const profile = { id: "p", name: "Me" } as any;
    const entries = [{
      id: "e1", date: D, answers: { itch: 4 }, createdAt: "", updatedAt: "",
    }] as any;

    const without = buildWideTable(tpl, profile, entries);
    expect(without.header).not.toContain("routine_taken");

    const withRoutine = buildWideTable(tpl, profile, entries, [], logs);
    const i = withRoutine.header.indexOf("routine_taken");
    expect(i).toBeGreaterThan(-1);
    expect(withRoutine.rows[0][i]).toBe(1);
    expect(withRoutine.rows[0][withRoutine.header.indexOf("routine_skipped")]).toBe(1);
    expect(String(withRoutine.rows[0][withRoutine.header.indexOf("routine_items")]))
      .toContain("Vitamin D3 (2000 IU)");
  });
});
