/* Insights, driven by one time range.

   What these pin is the property the screen was rebuilt for: **every figure on
   it answers the same question about the same span of days**, and says how
   many of those days it actually has. Before, one screen carried a 7-day
   average, a 30-day average, a 30-day chart and a week-over-week grid — four
   windows, four answers, none of them adjustable.

   The rest is the honesty the range control makes easy to break: a range you
   picked is still there tomorrow, an average always arrives with its coverage,
   a month with nothing in it says so instead of showing a zero, and a day
   nobody logged leaves a gap in the chart rather than a line drawn through
   it. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { RANGE_STORAGE_KEY } from "../src/lib/insights";

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

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

/** Mount the app on the Insights tab, with the Connor demo journal. */
async function openInsights(patch: (db: any) => any = (d) => d) {
  const { __internals: I, default: App } = await import("../src/App");
  const db = patch(I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true }));
  mockStorage({ fhj_v1: JSON.stringify(db) });
  const utils = render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Insights" }, { timeout: 10000 }));
  await screen.findByRole("radiogroup", { name: "Time range" });
  return utils;
}

const rangeGroup = () => screen.getByRole("radiogroup", { name: "Time range" });
const rangePill = (name: RegExp) => within(rangeGroup()).getByRole("radio", { name });
const checkedRange = () =>
  within(rangeGroup()).getAllByRole("radio").find((r) => r.getAttribute("aria-checked") === "true");

describe("the range control", () => {
  it("offers all five windows and starts on 30 days", async () => {
    await openInsights();
    const pills = within(rangeGroup()).getAllByRole("radio");
    expect(pills.map((p) => p.textContent)).toEqual(["7D", "30D", "90D", "1Y", "All"]);
    expect(checkedRange()!.textContent).toBe("30D");
    // the pills say "7D"; assistive tech is told what that means
    expect(rangePill(/Last 7 days/).textContent).toBe("7D");
  });

  it("moves every figure on the screen to the chosen window", async () => {
    await openInsights();
    expect(document.body.textContent).toContain("Last 30 days");
    expect(document.body.textContent).toContain("of 30 days logged");
    expect(document.body.textContent).toContain("the previous 30 days");

    fireEvent.click(rangePill(/Last 7 days/));
    expect(checkedRange()!.textContent).toBe("7D");
    expect(document.body.textContent).toContain("Last 7 days");
    expect(document.body.textContent).toContain("of 7 days logged");
    expect(document.body.textContent).toContain("the previous 7 days");
    expect(document.body.textContent).not.toContain("of 30 days logged");
  });

  it("remembers the choice for next time", async () => {
    await openInsights();
    fireEvent.click(rangePill(/Last 90 days/));
    expect(localStorage.getItem(RANGE_STORAGE_KEY)).toBe("90D");

    cleanup();
    await openInsights();
    expect(checkedRange()!.textContent).toBe("90D");
    expect(document.body.textContent).toContain("Last 90 days");
  });

  it("is a radiogroup, so arrow keys move between windows", async () => {
    await openInsights();
    fireEvent.keyDown(rangePill(/Last 30 days/), { key: "ArrowRight" });
    expect(checkedRange()!.textContent).toBe("90D");
    fireEvent.keyDown(rangePill(/Last 90 days/), { key: "ArrowLeft" });
    expect(checkedRange()!.textContent).toBe("30D");
    fireEvent.keyDown(rangePill(/Last 30 days/), { key: "End" });
    expect(checkedRange()!.textContent).toBe("All");
  });
});

describe("the headline figure", () => {
  it("shows an average to two decimals, with what it is being compared against", async () => {
    await openInsights();
    // e.g. "4.37" — two decimals, so 4.35 and 4.37 are not both "4.4"
    expect(document.body.textContent).toMatch(/\d\.\d\d/);
    expect(document.body.textContent).toMatch(/(higher|lower|About the same as) .*previous 30 days/);
  });

  it("always states how many days the figure came from", async () => {
    await openInsights();
    expect(document.body.textContent).toMatch(/\d+ of 30 days logged · \d+%/);
  });

  it("says nothing was logged rather than showing a zero", async () => {
    await openInsights((db) => ({ ...db, entries: [] }));
    expect(document.body.textContent).toContain("Nothing logged in these 30 days");
    expect(document.body.textContent).toContain("0 of 30 days logged · 0%");
    expect(document.body.textContent).not.toMatch(/Average over 0 days/);
  });

  it("keeps today's own value and the streak in view", async () => {
    await openInsights();
    expect(document.body.textContent).toMatch(/Today ·|Today isn't logged yet/);
    expect(document.body.textContent).toMatch(/streak/);
  });
});

describe("the trend chart", () => {
  it("draws the 7-day average as the bold line, with the daily values behind it", async () => {
    await openInsights();
    expect(screen.getByText("7-day average")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Daily" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("offers the 30-day average without forcing it on", async () => {
    await openInsights();
    const toggle = screen.getByRole("button", { name: "30-day average" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "30-day average" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("says what a gap in the line means instead of drawing through it", async () => {
    await openInsights();
    expect(document.body.textContent).toMatch(
      /nothing logged (are left as gaps|is left as a gap)|every day in this range is logged/);
  });

  it("describes itself for anyone who can't see it", async () => {
    await openInsights();
    const chart = document.querySelector('[role="img"]');
    expect(chart).toBeTruthy();
    expect(chart!.getAttribute("aria-label")).toMatch(/days logged, average \d/);
  });

  it("falls back to a sentence, not an empty box, when the range holds nothing", async () => {
    await openInsights((db) => ({ ...db, entries: [] }));
    expect(document.body.textContent).toMatch(/No “.*” answers in this range/);
  });
});

describe("the monthly summary", () => {
  it("says the month by name, with its average and its comparison", async () => {
    await openInsights();
    expect(screen.getByText("Month by month")).toBeTruthy();
    expect(document.body.textContent).toMatch(
      /(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/);
    expect(document.body.textContent).toMatch(/average \d\.\d\d|Nothing logged in/);
  });

  it("walks back through the journal, one month at a time", async () => {
    await openInsights();
    const back = screen.getByRole("button", { name: /^Show / });
    const before = document.body.textContent || "";
    fireEvent.click(back);
    expect(document.body.textContent).not.toBe(before);
    // the arrows stop at the ends of the journal rather than walking into
    // months that never existed
    const buttons = screen.getAllByRole("button", { name: /No earlier month|No later month/ });
    expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it("shows the six figures a month gets asked about", async () => {
    await openInsights();
    for (const label of ["Median", "Lowest", "Highest", "Most common", "Logged days", "Hard days"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});

describe("the other tracked metrics", () => {
  it("compares each one over the same range, with its own coverage", async () => {
    await openInsights();
    expect(document.body.textContent).toContain("Compared with the previous 30 days");
    fireEvent.click(rangePill(/Last 7 days/));
    expect(document.body.textContent).toContain("Compared with the previous 7 days");
  });
});
