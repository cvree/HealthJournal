/* Searching, through the actual screen.

   The module suite pins what a search *is*. This one pins the three promises
   the screen makes on top of it:

   1. **It is reachable.** From Today, from History, and from the header of
      every screen that draws one. A search box nobody can find is a search box
      nobody has.
   2. **It answers as you type**, with no button to press and nothing to wait
      for — the index is already in memory.
   3. **Every row opens something.** A result that goes nowhere is worse than
      no result, because it teaches somebody the list is decorative. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";

beforeEach(() => cleanup());
afterEach(() => vi.unstubAllGlobals());

beforeAll(() => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: q.includes("reduce"), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  } as any));
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

let kv: Map<string, string>;

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function mountApp() {
  const { __internals: I, default: App } = await import("../src/App");
  const db = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  kv = new Map(Object.entries({ fhj_v1: JSON.stringify(db) }));
  (window as any).storage = {
    async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
    async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
    async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
    async list(prefix?: string) { return { keys: [...kv.keys()].filter((k) => !prefix || k.startsWith(prefix)) }; },
  };
  render(<App />);
  await screen.findByText(/Quick Add/);
  return db;
}

const openSearch = async () => {
  fireEvent.click(screen.getAllByLabelText(/search your journal/i)[0]);
  return (await screen.findByLabelText("Search your journal")) as HTMLInputElement;
};

const type = (box: HTMLInputElement, value: string) =>
  fireEvent.change(box, { target: { value } });

describe("getting to the search", () => {
  it("is one tap from Today", async () => {
    await mountApp();
    const box = await openSearch();
    expect(box).toBeTruthy();
    expect(screen.getAllByRole("heading", { name: "Search" }).length).toBeGreaterThan(0);
  });

  it("is one tap from History too — the screen people go to to find a day", async () => {
    await mountApp();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    await screen.findByRole("heading", { name: "History" });
    expect(screen.getAllByLabelText(/search your journal/i).length).toBeGreaterThan(0);
  });
});

describe("the empty screen teaches the query language", () => {
  it("offers searches somebody would actually run, and runs one when tapped", async () => {
    await mountApp();
    const box = await openSearch();
    const example = screen.getByText("is:food dairy");
    fireEvent.click(example.closest("button")!);
    await waitFor(() => expect(box.value).toBe("is:food dairy"));
  });

  it("keeps the operator reference behind a disclosure rather than on the screen", async () => {
    await mountApp();
    await openSearch();
    expect(screen.queryByText(/That exact phrase/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /How to narrow it down/i }));
    expect(await screen.findByText(/That exact phrase/)).toBeTruthy();
  });
});

describe("searching", () => {
  it("answers as you type, with no button to press", async () => {
    await mountApp();
    const box = await openSearch();
    type(box, "cerave");
    /* The cream in the demo journal's routine, and every day it was used. */
    expect((await screen.findAllByText(/CeraVe/)).length).toBeGreaterThan(0);
  });

  it("says what it did, including the filters that are on", async () => {
    await mountApp();
    const box = await openSearch();
    type(box, "is:doses last:30d");
    expect(await screen.findByText("Doses")).toBeTruthy();
    expect(screen.getByText(/results/)).toBeTruthy();
  });

  it("marks the words it matched inside the row", async () => {
    await mountApp();
    const box = await openSearch();
    type(box, "fish oil");
    const marks = await waitFor(() => {
      const found = document.querySelectorAll("mark.fhj-sr-hit");
      expect(found.length).toBeGreaterThan(0);
      return found;
    });
    expect([...marks].some((m) => m.textContent?.toLowerCase() === "fish")).toBe(true);
  });

  it("narrows to one kind, and the chip's count is the search's count", async () => {
    await mountApp();
    const box = await openSearch();
    type(box, "sleep");
    const chip = await screen.findByRole("tab", { name: /^Questions/ });
    const count = Number(within(chip).getByText(/^\d+$/).textContent);
    fireEvent.click(chip);
    await waitFor(() =>
      expect(document.querySelectorAll("[data-search-row]").length).toBe(count));
  });

  it("finds a screen by a word that is not written on it", async () => {
    await mountApp();
    const box = await openSearch();
    type(box, "backup");
    expect(await screen.findByText("Export")).toBeTruthy();
  });

  it("explains a comparison against a question the journal does not ask", async () => {
    await mountApp();
    const box = await openSearch();
    type(box, "bloodpressure>120");
    expect(await screen.findByText(/No question here is called/)).toBeTruthy();
  });

  it("offers the way out of a search that only its filters emptied", async () => {
    await mountApp();
    const box = await openSearch();
    type(box, "is:labs cerave");
    const escape = await screen.findByRole("button", { name: /Search without the filters/i });
    fireEvent.click(escape);
    await waitFor(() => expect(box.value).toBe("cerave"));
  });
});

describe("a result goes somewhere", () => {
  it("opens the day a logged day belongs to", async () => {
    await mountApp();
    const box = await openSearch();
    type(box, "is:days");
    const row = await waitFor(() => document.querySelector("[data-search-row]") as HTMLElement);
    fireEvent.click(row);
    /* The Daily Log, on a past day — which is what the header's jump-to-today
       button only ever appears on. */
    expect(await screen.findByRole("button", { name: /Jump to today/i })).toBeTruthy();
  });

  it("opens the Diary on the day a dose was taken, not on today", async () => {
    const db = await mountApp();
    const dose = [...(db.routine || [])].sort((a: any, b: any) => (a.date < b.date ? -1 : 1))[0];
    expect(dose).toBeTruthy();
    expect(dose.date).not.toBe(todayStr());
    const box = await openSearch();
    type(box, `is:doses on:${dose.date}`);
    const row = await waitFor(() => document.querySelector("[data-search-row]") as HTMLElement);
    fireEvent.click(row);
    /* The Diary's own day pager, sitting on the searched day rather than on
       today — the whole point of carrying the date through. */
    const nice = (iso: string) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric",
      });
    };
    expect(await screen.findByText(nice(dose.date))).toBeTruthy();
    expect(screen.queryByText(nice(todayStr()))).toBeNull();
  });

  it("takes a screen result to that screen", async () => {
    await mountApp();
    const box = await openSearch();
    type(box, "vibration");
    const row = await waitFor(() => document.querySelector("[data-search-row]") as HTMLElement);
    expect(row.textContent).toContain("Settings");
    fireEvent.click(row);
    expect(await screen.findByRole("heading", { name: /Settings/i })).toBeTruthy();
  });

  it("walks the list with the arrow keys and opens with Enter", async () => {
    await mountApp();
    const box = await openSearch();
    type(box, "is:days");
    await waitFor(() => expect(document.querySelectorAll("[data-search-row]").length)
      .toBeGreaterThan(2));
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    const active = document.querySelector("[data-search-row].is-active") as HTMLElement;
    const wanted = active.textContent;
    fireEvent.keyDown(box, { key: "Enter" });
    await screen.findByRole("button", { name: /Jump to today/i });
    expect(wanted).toBeTruthy();
  });
});
