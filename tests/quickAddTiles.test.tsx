/* Quick Add, shaped like the condition.

   Four fixed tiles were the right default for nobody. What is pinned here is
   the rule that replaced them: the row somebody starts with comes from what
   they said they were tracking, a tile only exists when their own setup has a
   question behind it, and the + sheet shows the same list rather than keeping
   a second opinion about what a day can hold.

   The condition-shaped tiles are tested through the UI rather than only as
   data, because the failure that matters is not "the catalogue is wrong" — it
   is "the button is there and pressing it does nothing to the journal". */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import App, { __internals as I } from "../src/App";

beforeAll(() => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = ((q: string) => ({
    matches: q.includes("reduce"), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  } as any)) as any;
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.confirm = () => true;
});

let kv: Map<string, string>;

/** A journal for one condition, with nothing logged yet. */
async function mountFor(modules: string[], mutate?: (db: any) => void) {
  const db: any = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  db.profile = { ...I.blankProfile(), modules };
  db.entries = [];
  db.food = []; db.bowel = []; db.routine = []; db.episodes = [];
  mutate?.(db);
  kv = new Map([["fhj_v1", JSON.stringify(db)]]);
  (window as any).storage = {
    async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
    async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
    async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
    async list() { return { keys: [...kv.keys()] }; },
  };
  render(<App />);
  await screen.findByText("Quick Add", {}, { timeout: 10000 });
}

const saved = () => JSON.parse(kv.get("fhj_v1")!);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const labels = () =>
  [...document.querySelectorAll(".fhj-tile .fhj-tile-label")].map((t) => t.textContent);
const tile = (re: RegExp) =>
  [...document.querySelectorAll(".fhj-tile")].find((t) => re.test(t.textContent || "")) as HTMLElement;

beforeEach(() => cleanup());

describe("which buttons a journal starts with", () => {
  it("gives each condition the ones it actually reaches for", () => {
    expect(I.defaultQuickAdd(["pots"])).toEqual(
      expect.arrayContaining(["checkin", "water", "hr", "flare"]));
    expect(I.defaultQuickAdd(["ibs"])).toEqual(
      expect.arrayContaining(["checkin", "bowel", "food"]));
    expect(I.defaultQuickAdd(["eczema"])).toEqual(
      expect.arrayContaining(["checkin", "photo", "flare"]));
    // Nothing a gut journal needs is on a skin journal's row, and vice versa.
    expect(I.defaultQuickAdd(["eczema"])).not.toContain("bowel");
    expect(I.defaultQuickAdd(["ibs"])).not.toContain("hr");
  });

  it("takes each condition's first choice before either one's third", () => {
    const both = I.defaultQuickAdd(["eczema", "ibs"]);
    expect(both[0]).toBe("checkin");
    // Skin's first choice, then gut's first choice, then skin's second: two
    // conditions share the row rather than one filling it.
    expect(both.slice(1, 4)).toEqual(["photo", "bowel", "routine"]);
    // Six is the cap: a wall of tiles is a menu, and a menu is read rather
    // than pressed.
    expect(both.length).toBeLessThanOrEqual(6);
  });

  it("falls back to the plain four when there is no pack to go on", () => {
    expect(I.defaultQuickAdd([])).toEqual(I.DEFAULT_QUICK_ADD);
    expect(I.defaultQuickAdd(undefined as any)).toEqual(I.DEFAULT_QUICK_ADD);
  });

  it("never offers a button whose question the setup does not have", () => {
    const caps = { photo: false, number: true, scale: true, water: false, hr: false, trigger: false, flare: true };
    for (const id of ["photo", "water", "hr", "trigger"]) {
      expect(I.tileSupported(I.quickAddTile(id), caps)).toBe(false);
    }
    for (const id of ["checkin", "food", "note", "measurement", "flare"]) {
      expect(I.tileSupported(I.quickAddTile(id), caps)).toBe(true);
    }
    // ...and a saved choice is filtered by the same rule, not just the default.
    const ids = I.resolveQuickAdd({ quickAdd: ["checkin", "water", "photo"] }, { caps, stats: {}, today: today() });
    expect(ids).toEqual(["checkin"]);
  });

  it("reads what a setup can answer off the template, not the pack list", () => {
    const potsCaps = I.quickAddContext(
      I.getProfileTemplate({ ...I.blankProfile(), modules: ["pots"] })).caps;
    expect(potsCaps).toMatchObject({ water: true, hr: true, trigger: true, flare: true });

    // The same journal with the two heart-rate questions switched off has no
    // heart-rate button — the tile follows the questions, not the pack.
    const trimmed = I.quickAddContext(I.getProfileTemplate({
      ...I.blankProfile(), modules: ["pots"], disabledFields: ["resting_hr", "standing_hr", "water_intake"],
    })).caps;
    expect(trimmed).toMatchObject({ hr: false, water: false });
  });

  it("says one cup and three cups", () => {
    expect(I.amountWithUnit(1, "cups")).toBe("1 cup");
    expect(I.amountWithUnit(3, "cups")).toBe("3 cups");
    expect(I.amountWithUnit(1, "")).toBe("1");
  });
});

describe("a POTS journal", () => {
  it("opens with water, a heart rate and a flare", async () => {
    await mountFor(["pots"]);
    expect(labels()[0]).toBe("Check-in");
    expect(labels()).toContain("Water");
    expect(labels()).toContain("Heart rate");
    expect(labels()).toContain("Flare");
  });

  it("adds a cup of water in one tap, with an undo rather than a form", async () => {
    await mountFor(["pots"]);
    fireEvent.click(tile(/^Water/));
    await waitFor(() =>
      expect(saved().entries.find((e: any) => e.date === today())?.answers.water_intake).toBe(1));
    // No sheet opened — the tap was the log — and the receipt carries the undo.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(/Water: 1 cup today/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    await waitFor(() =>
      expect(saved().entries.find((e: any) => e.date === today())?.answers.water_intake).toBeFalsy());
  });

  it("takes both heart rates and shows the jump between them", async () => {
    await mountFor(["pots"]);
    fireEvent.click(tile(/^Heart rate/));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /Lying/ }));
    for (const k of ["6", "8"]) fireEvent.click(await screen.findByRole("button", { name: k }));
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    fireEvent.click(await screen.findByRole("button", { name: /Standing/ }));
    for (const k of ["1", "1", "2"]) fireEvent.click(await screen.findByRole("button", { name: k }));
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    // The arithmetic that defines the condition, done by the app rather than
    // by the person with the condition.
    expect(await screen.findByText("+44")).toBeTruthy();
    expect(screen.getByText(/threshold clinicians ask about/i)).toBeTruthy();
    // ...and it is a record, never a verdict.
    expect(screen.getByText(/not a diagnosis/i)).toBeTruthy();
    await waitFor(() => {
      const a = saved().entries.find((e: any) => e.date === today())?.answers;
      expect(a.resting_hr).toBe(68);
      expect(a.standing_hr).toBe(112);
    });
  });

  it("rates one symptom without opening the whole check-in", async () => {
    await mountFor(["pots"]);
    fireEvent.click(tile(/^Symptom/));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /^Brain fog/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Brain fog 7" }));
    await waitFor(() =>
      expect(saved().entries.find((e: any) => e.date === today())?.answers.brain_fog).toBe(7));
    // It closes itself: one question was the whole point.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("starts a flare, says so on the tile, and ends it on the next tap", async () => {
    await mountFor(["pots"]);
    fireEvent.click(tile(/^Flare/));
    await waitFor(() => expect(saved().episodes.length).toBe(1));
    expect(saved().episodes[0].metric).toBe("overall_symptom_severity");
    expect(saved().episodes[0].end).toBeFalsy();

    // The tile now describes today rather than naming a feature.
    const running = await waitFor(() => {
      const t = tile(/End flare/);
      expect(t).toBeTruthy();
      return t;
    });
    expect(running.textContent).toMatch(/started today/i);

    fireEvent.click(running);
    await waitFor(() => expect(saved().episodes[0].end).toBe(today()));
  });
});

describe("a gut journal", () => {
  it("opens with the bathroom and the day's meals, and no camera", async () => {
    await mountFor(["ibs"]);
    expect(labels()).toContain("Bowel");
    expect(labels()).toContain("Food");
    // No photo question in the IBS pack, so no photo button that opens an
    // apology.
    expect(labels()).not.toContain("Photo");
  });

  it("tags a trigger while it is still remembered", async () => {
    await mountFor(["ibs"]);
    fireEvent.click(tile(/^Trigger/));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: "Dairy" }));
    await waitFor(() => {
      const a = saved().entries.find((e: any) => e.date === today())?.answers;
      expect(a.possible_triggers).toEqual(["Dairy"]);
    });
  });
});
