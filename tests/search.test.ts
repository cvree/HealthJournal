/* Searching a journal.

   The module is pure, so this suite is the specification. Four things here are
   load-bearing and none of them is visible in the happy path:

   1. **The query language never rejects anything.** A stray colon, a lone
      quote, a comparison against a question that does not exist — each has a
      defined outcome, and none of them is "your search did nothing".
   2. **Terms are ANDed.** The difference between a list somebody reads and a
      list somebody scrolls past.
   3. **A filter removes; a word only ranks.** Kinds, dates and exclusions are
      absolute; where a word landed decides the order.
   4. **Every hit can be opened.** A result with no way back is a wasted tap,
      so the targets are asserted rather than assumed.
*/
import { describe, it, expect } from "vitest";
import {
  KIND_ORDER, PLACES, SEARCH_SYNTAX, buildIndex, describeSearch, highlight,
  parseQuery, resolveField, runSearch, shiftDate, snippetFor,
  type SearchDoc, type SearchSource,
} from "../src/lib/search";
import type { SurveyQuestion } from "../src/types/models";

const TODAY = "2026-08-22";

const fields: SurveyQuestion[] = [
  { k: "overall", label: "Overall severity", type: "scale", sec: "Everyday", dir: "sym" },
  { k: "sleep_quality", label: "Sleep quality", type: "scale", sec: "Everyday" },
  { k: "weight", label: "Weight", type: "number", unit: "lb", sec: "Body" },
  { k: "slept_well", label: "Slept well", type: "toggle", sec: "Everyday" },
  { k: "triggers", label: "Possible triggers", type: "chips", options: ["Dust", "Dairy", "Stress"] },
  { k: "front_photo", label: "Front", type: "photo" },
];

const stamps = { createdAt: "", updatedAt: "" };

const source = (over: Partial<SearchSource> = {}): SearchSource => ({
  today: TODAY,
  fields,
  entries: [
    {
      id: "e1", date: "2026-08-21", ...stamps,
      answers: { overall: 8, sleep_quality: 3, weight: 182, slept_well: false, triggers: ["Dairy"] },
      notes: "Woke at 4 with the itch again. Neck is the worst spot by a mile.",
    },
    {
      id: "e2", date: "2026-08-20", ...stamps,
      answers: { overall: 4, sleep_quality: 7 },
      notes: "Quiet day. Walked to the shop.",
    },
    { id: "e3", date: "2026-05-02", ...stamps, answers: { overall: 9 }, notes: "Itch, everywhere." },
  ],
  food: [
    {
      id: "f1", date: "2026-08-21", time: "13:00", meal: "lunch",
      description: "Hamburger with havarti cheese", serving: "2.5 patties", ...stamps,
    },
    { id: "f2", date: "2026-08-20", time: "08:10", meal: "breakfast", description: "Porridge", ...stamps },
  ],
  foods: [
    {
      id: "lib1", name: "Kefir", brand: "Biotiful", serving: "250 ml",
      nutrition: {}, useCount: 12, lastUsedAt: "", ...stamps,
    },
  ],
  bowel: [
    { id: "b1", date: "2026-08-21", time: "16:00", bristol: 3, amount: "small", ...stamps },
  ],
  routineItems: [
    {
      id: "ri1", name: "Trazodone", kind: "med", dose: "50 mg", times: ["bed"], daily: true,
      useCount: 4, ...stamps,
    },
  ],
  routine: [
    {
      id: "rl1", date: "2026-08-21", time: "22:54", itemId: "ri1",
      name: "Trazodone", kind: "med", dose: "50 mg", ...stamps,
    },
  ],
  episodes: [
    { id: "ep1", title: "Bad stretch", metric: "overall", start: "2026-08-19", notes: "Started after the move.", ...stamps },
  ],
  labs: [
    {
      id: "lab1", test: "ferritin", name: "Ferritin", value: 34, unit: "ng/mL",
      date: "2026-07-02", kind: "measurement", ...stamps,
    },
  ],
  ...over,
});

const index = (over: Partial<SearchSource> = {}) => buildIndex(source(over));

const find = (docs: SearchDoc[], q: string, limit = 200) =>
  runSearch(docs, parseQuery(q, TODAY), { today: TODAY, fields, limit });

const titles = (docs: SearchDoc[], q: string) => find(docs, q).hits.map((h) => h.doc.title);

describe("reading what somebody typed", () => {
  it("takes bare words, lowercased", () => {
    const q = parseQuery("Itch NECK", TODAY);
    expect(q.words).toEqual(["itch", "neck"]);
    expect(q.empty).toBe(false);
  });

  it("keeps a quoted phrase whole", () => {
    const q = parseQuery('cheese "woke at 4"', TODAY);
    expect(q.words).toEqual(["cheese"]);
    expect(q.phrases).toEqual(["woke at 4"]);
  });

  it("reads the kind, the dates and an exclusion", () => {
    const q = parseQuery("is:meals after:2026-08-01 before:2026-08-21 -cheese", TODAY);
    expect(q.kinds).toEqual(["food"]);
    expect(q.from).toBe("2026-08-01");
    expect(q.to).toBe("2026-08-21");
    expect(q.without).toEqual(["cheese"]);
    expect(q.words).toEqual([]);
  });

  it("resolves the relative dates people actually type", () => {
    expect(parseQuery("last:7d", TODAY).from).toBe(shiftDate(TODAY, -7));
    expect(parseQuery("last:2w", TODAY).from).toBe(shiftDate(TODAY, -14));
    expect(parseQuery("last:month", TODAY).from).toBe(shiftDate(TODAY, -30));
    expect(parseQuery("on:yesterday", TODAY).from).toBe("2026-08-21");
    expect(parseQuery("on:8/21", TODAY).to).toBe("2026-08-21");
  });

  it("reads a bare month and day as the most recent one, never the future", () => {
    /* 12/25 has not happened yet in August 2026, so it means last Christmas. */
    expect(parseQuery("on:12/25", TODAY).from).toBe("2025-12-25");
  });

  it("reads a comparison against a question", () => {
    expect(parseQuery("overall>=7", TODAY).numeric).toEqual([
      { field: "overall", op: ">=", value: 7, raw: "overall>=7" },
    ]);
  });

  it("never rejects a query — anything that is not a filter is a word", () => {
    const q = parseQuery("on:call is:banana http://x.y 3:15", TODAY);
    expect(q.kinds).toEqual([]);
    expect(q.from).toBeUndefined();
    expect(q.words).toContain("on:call");
    expect(q.words).toContain("is:banana");
    expect(q.empty).toBe(false);
  });

  it("knows when there is nothing to search on", () => {
    expect(parseQuery("", TODAY).empty).toBe(true);
    expect(parseQuery('   ""  ', TODAY).empty).toBe(true);
  });

  it("says every filter back, so a screen can show what is on", () => {
    const q = parseQuery('is:meals last:7d -cheese "woke at 4" overall>7', TODAY);
    expect(q.chips.map((c) => c.label)).toEqual([
      "“woke at 4”", "Meals", `since ${shiftDate(TODAY, -7)}`, "not “cheese”", "overall>7",
    ]);
  });
});

describe("the index", () => {
  it("carries a document for every kind the journal holds", () => {
    const kinds = new Set(index().map((d) => d.kind));
    for (const k of ["day", "food", "bowel", "dose", "item", "episode", "lab", "question", "place"]) {
      expect(kinds.has(k as never)).toBe(true);
    }
  });

  it("leaves out a day with nothing on it, and a photo answer", () => {
    const docs = buildIndex(source({ entries: [{ id: "x", date: "2026-08-01", answers: {}, ...stamps }] }));
    expect(docs.some((d) => d.kind === "day")).toBe(false);
    expect(docs.some((d) => d.id === "q_front_photo")).toBe(false);
  });

  it("keeps the day's numbers, so they can be compared against", () => {
    const day = index().find((d) => d.id === "day_2026-08-21")!;
    expect(day.numbers).toMatchObject({ overall: 8, sleep_quality: 3, weight: 182 });
  });

  it("hides everything that writes from a read-only viewer", () => {
    const docs = buildIndex(source({ canWrite: false }));
    expect(docs.some((d) => d.id === "p_settings")).toBe(false);
    expect(docs.some((d) => d.id === "p_import")).toBe(false);
    expect(docs.some((d) => d.id === "p_history")).toBe(true);
    /* And nothing it offers may send somebody to a screen it just hid. */
    const reachable = new Set(docs.map((d) => d.target.screen));
    for (const p of PLACES.filter((x) => !x.viewer)) expect(reachable.has(p.screen)).toBe(false);
  });

  it("gives every document a way back", () => {
    for (const d of index()) expect(d.target.screen).toBeTruthy();
  });
});

describe("finding things", () => {
  const docs = index();

  it("finds a word in a note, and opens the day it was written on", () => {
    const out = find(docs, "neck");
    expect(out.total).toBe(1);
    expect(out.hits[0].doc.target).toEqual({ screen: "log", date: "2026-08-21" });
  });

  it("requires every word — a match on one is not a match", () => {
    expect(titles(docs, "havarti cheese")).toEqual(["Hamburger with havarti cheese"]);
    expect(find(docs, "havarti porridge").total).toBe(0);
  });

  it("ranks a title match above a note match", () => {
    const out = find(docs, "trazodone");
    expect(out.hits[0].doc.kind).toBe("dose");
  });

  it("honours a phrase exactly", () => {
    expect(find(docs, '"woke at 4"').total).toBe(1);
    expect(find(docs, '"woke at four"').total).toBe(0);
  });

  it("throws out anything the exclusion touches", () => {
    expect(find(docs, "is:food -cheese").hits.map((h) => h.doc.title)).not.toContain(
      "Hamburger with havarti cheese"
    );
  });

  it("narrows to a kind and to a date range, and both are absolute", () => {
    const meals = find(docs, "is:meals");
    expect(meals.hits.every((h) => h.doc.kind === "food")).toBe(true);
    const day = find(docs, "on:2026-08-20");
    expect(day.hits.every((h) => h.doc.date === "2026-08-20")).toBe(true);
    /* A date filter removes everything undated: a screen did not happen on
       Thursday, so it cannot be an answer to "what happened on Thursday". */
    expect(day.hits.some((h) => h.doc.kind === "place")).toBe(false);
  });

  it("answers a bare comparison with the days that satisfy it", () => {
    const out = find(docs, "overall>=8");
    expect(out.hits.map((h) => h.doc.date)).toEqual(["2026-08-21", "2026-05-02"]);
    expect(out.hits.every((h) => h.doc.kind === "day")).toBe(true);
  });

  it("resolves a comparison by the question's own name, not only its key", () => {
    expect(resolveField(fields, "sleep")?.k).toBe("sleep_quality");
    expect(find(docs, "sleep<5").hits.map((h) => h.doc.date)).toEqual(["2026-08-21"]);
  });

  it("combines a comparison with a word", () => {
    expect(find(docs, "overall>=8 itch").hits.map((h) => h.doc.date).sort()).toEqual([
      "2026-05-02", "2026-08-21",
    ]);
    expect(find(docs, "overall>=8 porridge").total).toBe(0);
  });

  it("refuses to guess at a comparison against a question nobody asks", () => {
    const out = find(docs, "bloodpressure>120");
    expect(out.total).toBe(0);
    expect(out.unknownFields).toEqual(["bloodpressure"]);
    expect(describeSearch(parseQuery("bloodpressure>120", TODAY), out))
      .toContain("bloodpressure");
  });

  it("answers an empty query with nothing rather than with everything", () => {
    expect(find(docs, "").total).toBe(0);
  });

  it("puts a screen last when a record said the same word", () => {
    /* "diary" names the screen and nothing else, so it is allowed to win —
       but a word that is in a record too must not be answered with a menu. */
    const out = find(docs, "ferritin");
    expect(out.hits[0].doc.kind).toBe("lab");
  });

  it("finds a screen by a name that is not on it", () => {
    expect(titles(docs, "backup")).toContain("Export");
    expect(titles(docs, "vibration")).toContain("Settings");
  });

  it("prefers the recent when nothing else separates two rows", () => {
    /* No words, so nothing scores but recency: a filter on its own is a list
       in date order, newest first. */
    expect(find(docs, "is:days").hits.map((h) => h.doc.date))
      .toEqual(["2026-08-21", "2026-08-20", "2026-05-02"]);
  });

  it("still lets a title match beat a newer note — relevance is not a clock", () => {
    /* "Itch, everywhere." leads with the word; the newer note only contains
       it. A recency weight big enough to reorder that would be the search
       lying about which row answered the question. */
    expect(find(docs, "is:days itch").hits[0].doc.date).toBe("2026-05-02");
  });

  it("counts every kind that matched, over the whole result, not the page", () => {
    const out = find(docs, "is:days itch", 1);
    expect(out.hits).toHaveLength(1);
    expect(out.total).toBe(2);
    expect(out.counts.day).toBe(2);
  });

  it("orders the kinds the way the filter row reads", () => {
    expect(KIND_ORDER[0]).toBe("day");
    expect(KIND_ORDER[KIND_ORDER.length - 1]).toBe("place");
  });
});

describe("showing the match", () => {
  it("excerpts around the hit rather than from the top of the note", () => {
    const long = `${"x ".repeat(120)}the itch again${" y".repeat(120)}`;
    const doc: SearchDoc = {
      id: "d", kind: "day", title: "note", text: long, target: { screen: "log" },
    };
    const snip = snippetFor(doc, ["itch"])!;
    expect(snip).toContain("itch");
    expect(snip.length).toBeLessThan(200);
    expect(snip.startsWith("…")).toBe(true);
  });

  it("cuts a string into matched and unmatched runs, merging overlaps", () => {
    expect(highlight("Painful, painfully", ["pain", "painful"])).toEqual([
      { text: "Painful", hit: true },
      { text: ", ", hit: false },
      { text: "painful", hit: true },
      { text: "ly", hit: false },
    ]);
  });

  it("leaves a string alone when nothing matched", () => {
    expect(highlight("Porridge", ["kefir"])).toEqual([{ text: "Porridge", hit: false }]);
    expect(highlight("Porridge", [])).toEqual([{ text: "Porridge", hit: false }]);
  });

  it("says what the search did, not only how much came back", () => {
    const docs = index();
    const q = parseQuery("is:days itch", TODAY);
    expect(describeSearch(q, runSearch(docs, q, { today: TODAY, fields }))).toBe(
      "2 results across 2 days"
    );
    const none = parseQuery("kumquat", TODAY);
    expect(describeSearch(none, runSearch(docs, none, { today: TODAY, fields })))
      .toBe("Nothing matched.");
  });

  it("documents every operator it accepts", () => {
    const tokens = SEARCH_SYNTAX.map((s) => s.token).join(" ");
    for (const op of ["is:", "on:", "after:", "last:", "-word", ">"]) {
      expect(tokens).toContain(op);
    }
  });
});
