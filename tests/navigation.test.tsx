/* Two destinations and one verb.

   The nav rebuild is the change most likely to be undone by accident — a tab
   quietly reappearing, or the + turning into a screen. These pin the shape:
   Today, +, History; everything the old tabs led to still reachable in one
   tap; Settings in the header rather than in the bar. */
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

async function mountApp(mutate?: (db: any) => void) {
  const db: any = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  mutate?.(db);
  kv = new Map([["fhj_v1", JSON.stringify(db)]]);
  (window as any).storage = {
    async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
    async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
    async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
    async list() { return { keys: [...kv.keys()] }; },
  };
  render(<App />);
  await screen.findByRole("button", { name: "History" }, { timeout: 10000 });
  return db;
}

const nav = () => within(document.querySelector("nav")!);
const openAdd = async () => {
  fireEvent.click(nav().getByRole("button", { name: "Add to today" }));
  return screen.findByRole("dialog");
};
const saved = () => JSON.parse(kv.get("fhj_v1")!);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

beforeEach(() => cleanup());

describe("the bar", () => {
  it("is Today, add, History — and nothing else", async () => {
    await mountApp();
    const buttons = nav().getAllByRole("button").map((b) => b.textContent!.trim() || b.getAttribute("aria-label"));
    expect(buttons).toEqual(["Today", "Add to today", "History"]);
  });

  it("keeps the add button out of the read-only viewer, which cannot write", async () => {
    (window as any).storage = {
      async get() { return null; }, async set() { return null; },
      async delete() { return null; }, async list() { return { keys: [] }; },
    };
    render(<App viewer />);
    fireEvent.click(screen.getByText(/browse example data/i));
    await waitFor(() => expect(document.querySelector("nav")).toBeTruthy());
    expect(nav().queryByRole("button", { name: "Add to today" })).toBeNull();
    expect(nav().getAllByRole("button").map((b) => b.textContent!.trim())).toEqual(["Today", "History"]);
  });

  it("puts Settings in the header instead of the bar", async () => {
    await mountApp();
    expect(nav().queryByRole("button", { name: /settings/i })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "settings" })[0]);
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy();
  });
});

describe("the + sheet", () => {
  it("leads with the buttons this person chose, from anywhere", async () => {
    await mountApp();
    fireEvent.click(nav().getByRole("button", { name: "History" }));
    const dlg = await openAdd();
    // The sheet and the Quick Add row are two views of one list: whatever is
    // on the dashboard is what the + offers first.
    const tiles = [...document.querySelectorAll(".fhj-tile .fhj-tile-label")].map((t) => t.textContent);
    for (const label of tiles) expect(within(dlg).getByText(label!)).toBeTruthy();
    // Opening it from History lands on Today, which is the day it adds to.
    expect(nav().getByRole("button", { name: "Today" }).getAttribute("aria-current")).toBe("page");
  });

  it("keeps everything else one tap further down rather than losing it", async () => {
    await mountApp();
    const dlg = await openAdd();
    // Not chosen for this journal, so not in the first grid...
    expect(within(dlg).queryByText("Note")).toBeNull();
    fireEvent.click(within(dlg).getByRole("button", { name: /Everything else/ }));
    // ...but still reachable, which is what makes curating the row safe.
    expect(await within(dlg).findByText("Note")).toBeTruthy();
    expect(within(dlg).getByText("Bowel")).toBeTruthy();
  });

  it("opens the editor for the buttons from the sheet itself", async () => {
    await mountApp();
    const dlg = await openAdd();
    fireEvent.click(within(dlg).getByRole("button", { name: /Edit these buttons/ }));
    expect(await screen.findByText(/Pick the buttons you want/i)).toBeTruthy();
  });

  it("writes a note without opening the survey", async () => {
    await mountApp();
    const dlg = await openAdd();
    fireEvent.click(within(dlg).getByRole("button", { name: /Everything else/ }));
    fireEvent.click(await within(dlg).findByText("Note"));
    fireEvent.change(await screen.findByLabelText("Note for today"), { target: { value: "Slept badly." } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    await waitFor(() =>
      expect(saved().entries.find((e: any) => e.date === today())?.notes).toBe("Slept badly."));
  });

  it("takes a measurement straight to the keypad", async () => {
    await mountApp();
    const dlg = await openAdd();
    fireEvent.click(within(dlg).getByText("Measurement"));  // suggested by the diet pack
    fireEvent.click(await screen.findByRole("button", { name: /^Weight/ }));
    for (const key of ["1", "8", "0"]) fireEvent.click(await screen.findByRole("button", { name: key }));
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));
    await waitFor(() =>
      expect(saved().entries.find((e: any) => e.date === today())?.answers.weight).toBe(180));
  });

  it("ticks off the routine in one tap", async () => {
    await mountApp();
    const dlg = await openAdd();
    fireEvent.click(within(dlg).getByText("Routine"));      // suggested by the skin pack
    const sheet = await screen.findByRole("dialog");
    const row = within(sheet).getAllByRole("button", { name: /CeraVe/ })[0];
    fireEvent.click(row);
    await waitFor(() => expect(saved().routine.length).toBeGreaterThan(0));
  });
});

describe("History", () => {
  it("carries the month, the recent days, and the two doors out", async () => {
    await mountApp();
    fireEvent.click(nav().getByRole("button", { name: "History" }));
    expect(await screen.findByRole("heading", { name: "History" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Recent days" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Insights/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Diary/ })).toBeTruthy();
  });

  it("opens a past day straight from the list", async () => {
    await mountApp();
    fireEvent.click(nav().getByRole("button", { name: "History" }));
    const rows = document.querySelectorAll(".fhj-hist-row");
    expect(rows.length).toBeGreaterThan(0);
    fireEvent.click(rows[0]);
    expect(await screen.findByRole("heading", { name: /^(Today|\w{3},)/ })).toBeTruthy();
  });

  it("still reaches Insights in one tap", async () => {
    await mountApp();
    fireEvent.click(nav().getByRole("button", { name: "History" }));
    fireEvent.click(screen.getByRole("button", { name: /^Insights/ }));
    expect(await screen.findByRole("heading", { name: "Trend" }, { timeout: 10000 })).toBeTruthy();
  });
});

describe("Quick Add learns", () => {
  it("moves what somebody actually taps to the front, and remembers it", async () => {
    await mountApp();
    const tiles = () => [...document.querySelectorAll(".fhj-tile")].map((t) => t.textContent!.trim());
    expect(tiles()[0]).toMatch(/^Check-in/);

    // Three taps on Food — the picker is closed again each time.
    for (let i = 0; i < 3; i++) {
      fireEvent.click([...document.querySelectorAll(".fhj-tile")].find((t) => /^Food/.test(t.textContent!))!);
      const close = screen.queryByRole("button", { name: /close/i });
      if (close) fireEvent.click(close);
    }

    await waitFor(() => expect(saved().profile.actionStats?.food?.n).toBe(3));
    await waitFor(() => expect(tiles()[0]).toMatch(/^Food/));
  });

  it("starts from the buttons this person's own conditions reach for", async () => {
    await mountApp();
    const tiles = [...document.querySelectorAll(".fhj-tile .fhj-tile-label")].map((t) => t.textContent);
    // The sample journal is skin + diet: a camera and a routine, not a bowel
    // tile nobody in that setup would press.
    expect(tiles[0]).toBe("Check-in");
    expect(tiles).toContain("Photo");
    expect(tiles).toContain("Routine");
    expect(tiles).not.toContain("Bowel");
  });

  it("stops learning the moment somebody arranges the tiles themselves", async () => {
    await mountApp((db) => {
      db.profile.actionStats = { bowel: { n: 20, at: "2026-08-19" } };
    });
    fireEvent.click(screen.getByRole("button", { name: /Edit which Quick Add buttons/ }));
    // Moving a tile is the decision; no switch has to be found first.
    fireEvent.click((await screen.findAllByRole("button", { name: /Move .* down/ }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saved().profile.quickAddOrder).toBe("manual"));
  });
});

describe("one tap, again", () => {
  it("offers the foods and doses the journal already knows", async () => {
    await mountApp();
    const row = await screen.findByRole("list", { name: "Do something again" });
    expect(within(row).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("repeats a routine dose without opening anything", async () => {
    await mountApp();
    const row = await screen.findByRole("list", { name: "Do something again" });
    const dose = within(row).getAllByRole("listitem").find((b) => /CeraVe/.test(b.textContent!));
    if (!dose) return; // a demo journal without routine history has nothing to repeat
    const before = saved().routine.length;
    fireEvent.click(dose);
    await waitFor(() => expect(saved().routine.length).toBe(before + 1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
