/* Reading somebody's own notes into their journal.

   Three things here are load-bearing, and none of them is visible in the happy
   path, so all three get pinned:

   1. **`normaliseImportPlan` is the boundary.** Everything past it is treated
      as the app's own data, so it is tested against a model that ignores its
      instructions — invented question keys, values of the wrong type, dates in
      the future, a caveat that reads like a diagnosis.
   2. **`applyImport` never overwrites and never doubles up.** An import that
      silently replaced an answer somebody gave themselves, or that filed the
      same meal twice because they ran it twice, would make the feature
      unusable on a journal that is already running.
   3. **The payload is what the sheet says it is.** This is the one path in the
      app that sends free text, so what goes on the wire is checked directly.
*/
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  MAX_IMPORT_IMAGES, applyImport, countKinds, describeAdded, groupByDate, imagesOf,
  normaliseImportPlan, readNotes, resolveDate, summariseImportRequest,
  type ImportTargets, type ImportVocabulary, type ImportedItem,
} from "../src/lib/import";

const TODAY = "2026-08-22";

const vocab: ImportVocabulary = {
  today: TODAY,
  fields: [
    { k: "overall", label: "Overall severity", type: "scale" },
    { k: "weight", label: "Weight", type: "number", unit: "lb" },
    { k: "slept_well", label: "Slept well", type: "toggle" },
    { k: "triggers", label: "Possible triggers", type: "chips", options: ["Dust", "Dairy", "Stress"] },
    { k: "mood", label: "Mood", type: "chips", options: ["Low", "Fine", "Good"], single: true },
  ],
  routineItems: [
    { id: "ri_1", name: "Creatine", kind: "supplement", dose: "5 g" },
  ],
  foods: ["Porridge"],
};

const item = (over: Partial<any> = {}) => ({
  kind: "note", date: "2026-08-21", source: "8.21 something", confidence: "high",
  text: "something", ...over,
});

const blank = (): ImportTargets => ({
  entries: [], food: [], foods: [], bowel: [], routine: [], routineItems: [],
});

const plan = (rows: any[]) => normaliseImportPlan({ items: rows }, vocab).items;

describe("dates a journal will accept", () => {
  it("takes a real past date as given", () => {
    expect(resolveDate("2026-08-21", TODAY)).toEqual({ date: "2026-08-21", guessed: false });
  });

  it("refuses the future — a journal is a record of what happened", () => {
    expect(resolveDate("2026-09-01", TODAY)).toEqual({ date: TODAY, guessed: true });
  });

  it("treats a date years adrift as a misreading rather than history", () => {
    expect(resolveDate("2019-08-21", TODAY)).toEqual({ date: TODAY, guessed: true });
  });

  it("falls back to today, flagged, when there is no usable date at all", () => {
    for (const bad of ["", "yesterday", "8.21", null, undefined, 20260821]) {
      expect(resolveDate(bad, TODAY)).toEqual({ date: TODAY, guessed: true });
    }
  });
});

describe("the boundary a model's reply has to cross", () => {
  it("keeps the rows it can place, with the words they came from", () => {
    const out = plan([
      { kind: "food", date: "2026-08-21", time: "13:00", description: "2.5 hamburger patties",
        serving: "2.5 patties", source: "8.21 food, 2.5 hamburger", confidence: "medium" },
      { kind: "answer", key: "weight", number: 182, date: "2026-08-21", time: "12:00",
        source: "8.21 weight 12pm 182", confidence: "high" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].food).toEqual({ description: "2.5 hamburger patties", meal: "lunch", serving: "2.5 patties" });
    expect(out[0].source).toBe("8.21 food, 2.5 hamburger");
    expect(out[1].value).toBe(182);
    expect(out[1].detail).toBe("182 lb");
  });

  it("drops an answer to a question this journal does not ask", () => {
    expect(plan([{ ...item(), kind: "answer", key: "blood_pressure", number: 120 }])).toEqual([]);
  });

  it("drops a value the question cannot hold", () => {
    expect(plan([{ ...item(), kind: "answer", key: "overall", number: 47 }])).toEqual([]);
    expect(plan([{ ...item(), kind: "answer", key: "slept_well", number: 1 }])).toEqual([]);
    expect(plan([{ ...item(), kind: "answer", key: "triggers", choices: ["Pollen"] }])).toEqual([]);
  });

  it("stores a choice in the journal's own spelling, so it groups with every other day", () => {
    const out = plan([{ ...item(), kind: "answer", key: "triggers", choices: ["dairy", "STRESS"] }]);
    expect(out[0].value).toEqual(["Dairy", "Stress"]);
  });

  it("keeps a single-choice question single, whatever the model offered", () => {
    const out = plan([{ ...item(), kind: "answer", key: "mood", choices: ["Good", "Fine"] }]);
    expect(out[0].value).toEqual(["Good"]);
  });

  it("matches a dose against the routine the person already has", () => {
    const byId = plan([{ ...item(), kind: "routine", itemId: "ri_1", name: "creatin" }]);
    expect(byId[0].routine).toMatchObject({ itemId: "ri_1", name: "Creatine", kind: "supplement" });
    const byName = plan([{ ...item(), kind: "routine", name: "  creatine " }]);
    expect(byName[0].routine!.itemId).toBe("ri_1");
    // Something genuinely new says so, rather than being quietly attached.
    const fresh = plan([{ ...item(), kind: "routine", name: "Trazodone", dose: "50 mg", routineKind: "med" }]);
    expect(fresh[0].routine!.itemId).toBeUndefined();
    expect(fresh[0].detail).toContain("new to your routine");
  });

  it("refuses an id for a routine item that does not exist", () => {
    const out = plan([{ ...item(), kind: "routine", itemId: "ri_nope", name: "Mystery pill" }]);
    expect(out[0].routine!.itemId).toBeUndefined();
    expect(out[0].routine!.name).toBe("Mystery pill");
  });

  it("throws away a caveat that strayed into diagnosis", () => {
    const out = plan([{ ...item(), note: "This pattern suggests irritable bowel syndrome." }]);
    expect(out[0].note).toBeUndefined();
  });

  it("drops rows with no substance behind them, and reply shapes that are not replies", () => {
    expect(plan([{ ...item(), text: "   " }])).toEqual([]);
    expect(plan([{ ...item(), kind: "food", description: "" }])).toEqual([]);
    expect(plan([{ ...item(), kind: "haircut" }])).toEqual([]);
    expect(normaliseImportPlan(null, vocab).items).toEqual([]);
    expect(normaliseImportPlan({ items: "lots" }, vocab).items).toEqual([]);
  });

  it("flags a date it had to invent, so the review can offer to fix it", () => {
    const out = plan([{ ...item(), date: "next tuesday" }]);
    expect(out[0].date).toBe(TODAY);
    expect(out[0].dateGuessed).toBe(true);
  });
});

describe("writing the approved rows down", () => {
  const approved = (rows: any[]): ImportedItem[] => plan(rows);

  it("creates the day it needs and files the answer on it", () => {
    const { next, added } = applyImport(blank(), approved([
      { ...item(), kind: "answer", key: "weight", number: 182, date: "2026-08-21" },
    ]));
    expect(added.answer).toBe(1);
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0]).toMatchObject({ date: "2026-08-21", answers: { weight: 182 } });
  });

  it("never overwrites an answer somebody gave themselves", () => {
    const cur = blank();
    cur.entries.push({
      id: "e1", date: "2026-08-21", answers: { weight: 180 },
      createdAt: "", updatedAt: "",
    });
    const { next, added, duplicates } = applyImport(cur, approved([
      { ...item(), kind: "answer", key: "weight", number: 182, date: "2026-08-21" },
    ]));
    expect(next.entries[0].answers.weight).toBe(180);
    expect(added.answer).toBe(0);
    expect(duplicates).toBe(1);
  });

  it("appends a note under what is already there rather than replacing it", () => {
    const cur = blank();
    cur.entries.push({
      id: "e1", date: "2026-08-21", answers: {}, notes: "Neck is still worst spot.",
      createdAt: "", updatedAt: "",
    });
    const { next } = applyImport(cur, approved([
      { ...item(), text: "Slightly dry, like a healing leather boot.", date: "2026-08-21" },
    ]));
    expect(next.entries[0].notes).toBe("Neck is still worst spot.\nSlightly dry, like a healing leather boot.");
  });

  it("does not file the same meal, dose or movement twice when the notes are imported again", () => {
    const rows = approved([
      { kind: "food", date: "2026-08-21", time: "13:00", description: "Hamburger", source: "s", confidence: "high" },
      { kind: "routine", date: "2026-08-21", time: "13:00", itemId: "ri_1", name: "Creatine", source: "s", confidence: "high" },
      { kind: "bowel", date: "2026-08-21", time: "16:00", bristol: 3, source: "s", confidence: "high" },
    ]);
    const first = applyImport(blank(), rows);
    expect([first.added.food, first.added.routine, first.added.bowel]).toEqual([1, 1, 1]);
    const second = applyImport(first.next, rows);
    expect([second.added.food, second.added.routine, second.added.bowel]).toEqual([0, 0, 0]);
    expect(second.duplicates).toBe(3);
    expect(second.next.food).toHaveLength(1);
  });

  it("invents a routine item as-needed, never as a daily obligation", () => {
    const { next } = applyImport(blank(), approved([
      { ...item(), kind: "routine", name: "Trazodone", dose: "50 mg", routineKind: "med", time: "22:54" },
    ]));
    expect(next.routineItems).toHaveLength(1);
    expect(next.routineItems[0]).toMatchObject({ name: "Trazodone", kind: "med", daily: false, useCount: 1 });
    expect(next.routine[0]).toMatchObject({ name: "Trazodone", dose: "50 mg", slot: "bed" });
  });

  it("logs against an item that already exists rather than making a second one", () => {
    const cur = blank();
    cur.routineItems.push({
      id: "ri_1", name: "Creatine", kind: "supplement", dose: "5 g", times: [], daily: true,
      useCount: 4, createdAt: "", updatedAt: "",
    });
    const { next } = applyImport(cur, approved([
      { ...item(), kind: "routine", itemId: "ri_1", name: "Creatine", time: "09:00" },
    ]));
    expect(next.routineItems).toHaveLength(1);
    expect(next.routineItems[0].useCount).toBe(5);
    expect(next.routine[0].itemId).toBe("ri_1");
  });

  it("leaves every other row alone when one is switched off", () => {
    const rows = approved([
      { kind: "food", date: "2026-08-21", description: "Porridge", source: "s", confidence: "high" },
      { kind: "bowel", date: "2026-08-21", bristol: 4, source: "s", confidence: "high" },
    ]);
    const { added } = applyImport(blank(), rows.filter((r) => r.kind !== "bowel"));
    expect(added.food).toBe(1);
    expect(added.bowel).toBe(0);
  });

  it("says what it did in words somebody would use", () => {
    expect(describeAdded({ answer: 0, food: 3, bowel: 0, routine: 2, note: 1 }))
      .toBe("3 meals, 2 doses and 1 note");
    expect(describeAdded({ answer: 1, food: 0, bowel: 0, routine: 0, note: 0 })).toBe("1 answer");
    expect(describeAdded({ answer: 0, food: 0, bowel: 0, routine: 0, note: 0 })).toBe("Nothing added");
  });

  it("counts a plan with the same counter the receipt uses, so the two cannot disagree", () => {
    const rows = plan([
      { kind: "food", date: "2026-08-21", description: "Porridge", source: "s", confidence: "high" },
      { kind: "food", date: "2026-08-21", description: "Steak", source: "s", confidence: "high" },
      { kind: "note", date: "2026-08-21", text: "Slept badly", source: "s", confidence: "high" },
    ]);
    expect(countKinds(rows)).toEqual({ answer: 0, food: 2, bowel: 0, routine: 0, note: 1 });
    expect(describeAdded(countKinds(rows))).toBe("2 meals and 1 note");
    expect(countKinds([])).toEqual({ answer: 0, food: 0, bowel: 0, routine: 0, note: 0 });
  });
});

describe("the review's own shape", () => {
  it("groups by day, newest first, and orders each day by the clock", () => {
    const groups = groupByDate(plan([
      { kind: "food", date: "2026-08-20", time: "18:00", description: "Dinner", source: "s", confidence: "high" },
      { kind: "food", date: "2026-08-21", time: "19:00", description: "Chuck steak", source: "s", confidence: "high" },
      { kind: "food", date: "2026-08-21", time: "08:00", description: "Porridge", source: "s", confidence: "high" },
    ]));
    expect(groups.map((g) => g.date)).toEqual(["2026-08-21", "2026-08-20"]);
    expect(groups[0].items.map((i) => i.label)).toEqual(["Porridge", "Chuck steak"]);
  });
});

/* ---------- the wire ---------- */

function mockGemini(reply: unknown) {
  const bodies: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
    if (String(url).endsWith("/models")) {
      return { ok: true, json: async () => ({ models: [{ name: "models/gemini-9-flash" }] }) } as any;
    }
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }),
    } as any;
  }));
  return bodies;
}

const CONN = { provider: "gemini" as const, key: "AQ.Ab8RN6JexampleEXAMPLEexample1234wxyz", model: "gemini-9-flash" };

afterEach(() => vi.unstubAllGlobals());

describe("what actually leaves the device", () => {
  it("says so before it goes, in countable terms", () => {
    const said = summariseImportRequest({ text: "8.21 weight 182" }, vocab);
    expect(said.sendsImage).toBe(false);
    expect(said.characters).toBe(15);
    expect(said.lines.join(" ")).toContain("15 characters");
    expect(said.lines.join(" ")).toContain("5 questions");
    expect(summariseImportRequest({ text: "x", image: { mime: "image/png", data: "AA==" } }, vocab).sendsImage).toBe(true);
  });

  it("sends the notes and the journal's structure — and none of the journal's answers", () => {
    const bodies = mockGemini({ items: [] });
    return readNotes(CONN, { text: "8.21 weight 12pm 182" }, vocab).then(() => {
      const wire = JSON.stringify(bodies[0]);
      expect(wire).toContain("8.21 weight 12pm 182");
      expect(wire).toContain("Overall severity");
      expect(wire).toContain("Creatine");
      expect(wire).not.toContain("inlineData");
    });
  });

  it("refuses to send anything when there is nothing to read", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(readNotes(CONN, { text: "   " }, vocab)).rejects.toThrow(/Paste some notes/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses to send anything without a key", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(readNotes({ ...CONN, key: "" }, { text: "notes" }, vocab)).rejects.toThrow(/No API key/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the image only when the person chose one", async () => {
    const bodies = mockGemini({ items: [] });
    await readNotes(CONN, { text: "", image: { mime: "image/jpeg", data: "QUJD" } }, vocab);
    expect(bodies[0].contents[0].parts[0].inlineData.data).toBe("QUJD");
  });

  /* A chat with yourself is four screenshots, not one. They go in one request
     and in the order given, and the prompt has to say they are one document —
     otherwise a date at the top of the second governs nothing in the third. */
  it("sends several screenshots as one document, in the order they were added", async () => {
    const bodies = mockGemini({ items: [] });
    await readNotes(CONN, {
      images: [
        { mime: "image/png", data: "AAA" },
        { mime: "image/png", data: "BBB" },
        { mime: "image/png", data: "CCC" },
      ],
    }, vocab);
    const parts = bodies[0].contents[0].parts;
    expect(parts.slice(0, 3).map((p: any) => p.inlineData.data)).toEqual(["AAA", "BBB", "CCC"]);
    expect(parts[3].text).toMatch(/one continuous set of notes, in order/i);
  });

  it("caps how many screenshots one reading carries", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ mime: "image/png", data: `X${i}` }));
    expect(imagesOf({ images: many })).toHaveLength(MAX_IMPORT_IMAGES);
    // and the confirmation counts what will actually go, not what was offered
    expect(summariseImportRequest({ images: many }, vocab).lines.join(" "))
      .toContain(`${MAX_IMPORT_IMAGES} screenshots`);
  });

  it("counts a single screenshot in the singular, and none at all as none", () => {
    expect(summariseImportRequest({ text: "x", image: { mime: "image/png", data: "A" } }, vocab).lines.join(" "))
      .toMatch(/The screenshot you chose/);
    const bare = summariseImportRequest({ text: "x" }, vocab);
    expect(bare.sendsImage).toBe(false);
    expect(bare.lines.join(" ")).not.toMatch(/screenshot/i);
  });

  it("turns a reply that is not JSON into something the screen can say", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/models")) {
        return { ok: true, json: async () => ({ models: [{ name: "models/gemini-9-flash" }] }) } as any;
      }
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "Sure! Here you go:" }] } }] }),
      } as any;
    }));
    await expect(readNotes(CONN, { text: "notes" }, vocab)).rejects.toThrow(/unexpected shape/);
  });
});
