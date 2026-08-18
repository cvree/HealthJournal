/* The Diary — one day, meals and routine together.

   These pin the promises the merge was made for:

   - both systems are on one page, over one date, and the pager moves both;
   - nothing is hidden behind a tab, a toggle or a sideways scroller;
   - the shortcuts that make it fast ("All 4", a finished slot folding away)
     never cost the user the ability to undo what they did.

   The demo journal's routine deliberately stops at yesterday, so "today" here
   always starts with everything still to do. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";

beforeEach(() => cleanup());

beforeAll(() => {
  (globalThis as any).ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  };
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: q.includes("reduce"), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  } as any));
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.confirm = () => true;
});

function mockStorage(initial: Record<string, string>) {
  const kv = new Map(Object.entries(initial));
  (window as any).storage = {
    async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
    async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
    async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
    async list(prefix?: string) { return { keys: [...kv.keys()].filter((k) => !prefix || k.startsWith(prefix)) }; },
  };
  return kv;
}

const localDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Mount, then open the Diary tab. */
async function openDiary(patch: (db: any) => any = (d) => d) {
  const { __internals: I, default: App } = await import("../src/App");
  const db = patch(I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true }));
  const kv = mockStorage({ fhj_v1: JSON.stringify(db) });
  const utils = render(<App />);
  await screen.findByText(/Quick Add/);
  fireEvent.click(within(document.querySelector("nav")!).getByRole("button", { name: "Diary" }));
  await screen.findByRole("button", { name: "previous day" });
  return { ...utils, kv };
}

/** A routine with no randomness in it: two in the morning, one in the evening,
    two at bedtime, nothing logged on any day. The demo journal's own routine is
    generated with a seeded RNG that skips days, which is right for a demo and
    wrong for an assertion about a particular row. */
const stamp = new Date().toISOString();
const item = (id: string, name: string, dose: string, times: string[]) =>
  ({ id, name, dose, times, kind: "supplement", daily: true, useCount: 0, createdAt: stamp, updatedAt: stamp });

const fixedRoutine = (db: any) => ({
  ...db,
  routine: [],
  routineItems: [
    item("ri_cream", "CeraVe moisturising cream", "2 pumps", ["morning", "bed"]),
    item("ri_vitd", "Vitamin D3", "2000 IU", ["morning"]),
    item("ri_fish", "Fish oil", "2 capsules", ["evening"]),
    item("ri_mag", "Magnesium glycinate", "400 mg", ["bed"]),
  ],
});

async function saved(kv: Map<string, string>, check: (db: any) => unknown) {
  return await waitFor(() => {
    const db = JSON.parse(kv.get("fhj_v1")!);
    expect(check(db)).toBeTruthy();
    return db;
  });
}

describe("one page for the whole day", () => {
  it("puts the routine and the meals on the same screen, under one date", async () => {
    await openDiary(fixedRoutine);
    const main = within(document.getElementById("main")!);

    expect(main.getByText("Routine")).toBeTruthy();
    expect(main.getByText("Meals")).toBeTruthy();
    expect(main.getByRole("button", { name: "Mark taken: Vitamin D3, Morning" })).toBeTruthy();
    expect(main.getByRole("button", { name: "Add food to Breakfast" })).toBeTruthy();
    // One date, one pager, both systems under it.
    expect(main.getByText("Today")).toBeTruthy();
    expect(main.getAllByRole("button", { name: /day$/ })).toHaveLength(2);
  });

  it("logs a dose against whichever day the pager is on", async () => {
    const { kv } = await openDiary(fixedRoutine);
    fireEvent.click(screen.getByRole("button", { name: "previous day" }));
    await waitFor(() =>
      expect(within(document.getElementById("main")!).queryByText("Today")).toBeNull());

    fireEvent.click(await screen.findByRole("button", { name: "Mark taken: Fish oil, Evening" }));
    const db = await saved(kv, (d) =>
      d.routine.some((r: any) => r.name === "Fish oil" && r.date === localDay(-1)));
    // Yesterday's dose is filed under yesterday, not under today.
    expect(db.routine.some((r: any) => r.name === "Fish oil" && r.date === localDay(0))).toBe(false);
  });

  it("keeps every empty meal one tap away without spending a card on each", async () => {
    await openDiary();
    const main = within(document.getElementById("main")!);
    for (const meal of ["Breakfast", "Lunch", "Dinner", "Snack", "Drink"]) {
      expect(main.getByRole("button", { name: `Add food to ${meal}` }), meal).toBeTruthy();
    }
    // Chips, not five empty cards: nothing on this page is a meal card yet.
    expect(document.querySelectorAll(".fhj-card").length).toBeLessThan(3);
  });

  it("offers no sideways scroller — everything on the page is on the page", async () => {
    await openDiary();
    expect(document.getElementById("main")!.querySelector(".fhj-scroller")).toBeNull();
  });
});

describe("the shortcuts", () => {
  it("logs a whole slot in one tap, with one undo behind it", async () => {
    const { kv } = await openDiary(fixedRoutine);
    // Bedtime has two items and nothing logged yet.
    fireEvent.click(await screen.findByRole("button", { name: /Mark all 2 bedtime items taken/ }));

    const db = await saved(kv, (d) => d.routine.filter((r: any) => r.date === localDay(0)).length === 2);
    expect(db.routine.filter((r: any) => r.date === localDay(0) && r.slot === "bed")).toHaveLength(2);

    // One toast, one Undo, and it takes both rows back out.
    fireEvent.click(await screen.findByRole("button", { name: /Undo/ }));
    await saved(kv, (d) => d.routine.filter((r: any) => r.date === localDay(0)).length === 0);
  });

  it("folds a finished slot into one line, and opens it again on a tap", async () => {
    await openDiary(fixedRoutine);
    fireEvent.click(await screen.findByRole("button", { name: /Mark all 2 bedtime items taken/ }));

    // The two rows become one summary line…
    const summary = await screen.findByRole("button", { name: /Bedtime done — show all 2 items/ });
    expect(screen.queryByRole("button", { name: "Undo: CeraVe moisturising cream, Bedtime" })).toBeNull();

    // …which is never a dead end: tapping it brings the rows back, untickable.
    fireEvent.click(summary);
    expect(await screen.findByRole("button", { name: "Undo: CeraVe moisturising cream, Bedtime" })).toBeTruthy();
  });

  it("never folds a slot that still has something to take", async () => {
    await openDiary(fixedRoutine);
    // Morning has two items; ticking one must leave the group open.
    fireEvent.click(screen.getByRole("button", { name: "Mark taken: Vitamin D3, Morning" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Undo: Vitamin D3, Morning" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "Mark taken: CeraVe moisturising cream, Morning" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Morning done/ })).toBeNull();
  });

  it("adds an item without leaving the day", async () => {
    const { kv } = await openDiary();
    fireEvent.click(screen.getByRole("button", { name: "Add an item to your routine" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText(/Vitamin D, CeraVe/), {
      target: { value: "Creatine" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /Add it/ }));

    await saved(kv, (d) => d.routineItems.some((i: any) => i.name === "Creatine"));
    // Still on the Diary, and the new item is already asking to be ticked.
    expect(await screen.findByRole("button", { name: /^Mark taken: Creatine$/ })).toBeTruthy();
    expect(within(document.getElementById("main")!).getByText("Meals")).toBeTruthy();
  });
});

describe("the manage screen after the merge", () => {
  it("is the plan only — the day lives on the Diary", async () => {
    await openDiary();
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    await screen.findByText("Everything you track");

    // No second copy of the day: no pager, no checklist, no progress.
    expect(screen.queryByRole("button", { name: "previous day" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Mark taken:/ })).toBeNull();
    // And a way back to the screen that does have them.
    expect(screen.getByRole("button", { name: /Tick things off/ })).toBeTruthy();
  });
});
