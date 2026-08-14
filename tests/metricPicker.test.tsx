/* 30-day trend metric selector.

   The bug this replaces: the selector was a bare overflow-x scroller with the
   app's global stylesheet hiding every scrollbar, so on a desktop the metrics
   past the first few were reachable only by a horizontal trackpad gesture with
   nothing on screen to suggest it existed. These tests pin the parts of the
   fix that are testable without a layout engine — every option rendered and
   reachable, one tab stop, full keyboard traversal — plus the dashboard
   actually offering every chartable metric rather than a truncated slice. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";
import MetricPicker from "../src/components/MetricPicker";
import App, { __internals as I } from "../src/App";

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
});

const OPTIONS = Array.from({ length: 12 }, (_, i) => ({ k: `m${i}`, label: `Metric ${i}` }));

function setup(selected = ["m0"]) {
  const onToggle = vi.fn();
  const utils = render(
    <MetricPicker options={OPTIONS} selected={selected} onToggle={onToggle} max={4} />
  );
  const group = screen.getByRole("group", { name: "Metrics to chart" });
  return { ...utils, group, onToggle };
}

describe("MetricPicker", () => {
  it("renders every option — none are dropped or clipped out of the tree", () => {
    const { group } = setup();
    const chips = within(group).getAllByRole("button");
    expect(chips).toHaveLength(12);
    expect(chips[11].textContent).toContain("Metric 11");
  });

  it("says how many metrics exist and how many are selected", () => {
    setup(["m0", "m3"]);
    expect(document.body.textContent).toContain("2 of 12 selected");
    expect(document.body.textContent).toContain("Tap to compare up to 4");
  });

  it("exposes selection state to assistive tech", () => {
    const { group } = setup(["m5"]);
    const chips = within(group).getAllByRole("button");
    expect(chips[5].getAttribute("aria-pressed")).toBe("true");
    expect(chips[0].getAttribute("aria-pressed")).toBe("false");
  });

  it("toggles the last option, not just the ones that fit on screen", () => {
    const { group, onToggle } = setup();
    fireEvent.click(within(group).getAllByRole("button")[11]);
    expect(onToggle).toHaveBeenCalledWith("m11");
  });

  it("is a single tab stop, so the strip doesn't swallow 12 tabs", () => {
    const { group } = setup(["m4"]);
    const chips = within(group).getAllByRole("button");
    expect(chips.filter((c) => c.tabIndex === 0)).toHaveLength(1);
    // and the one stop is the current selection, not an arbitrary end
    expect(chips.find((c) => c.tabIndex === 0)!.textContent).toContain("Metric 4");
  });

  it("walks the whole strip with arrow keys", () => {
    const { group } = setup();
    const chips = within(group).getAllByRole("button");
    chips[0].focus();
    for (let i = 0; i < 11; i++) {
      fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    }
    expect(document.activeElement).toBe(chips[11]);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(chips[10]);
  });

  it("supports Home and End", () => {
    const { group } = setup();
    const chips = within(group).getAllByRole("button");
    chips[3].focus();
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(chips[11]);
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(document.activeElement).toBe(chips[0]);
  });

  it("stops at the ends instead of wrapping past them", () => {
    const { group } = setup();
    const chips = within(group).getAllByRole("button");
    chips[0].focus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(chips[0]);
  });

  it("ignores keys it doesn't own, so typing still reaches the page", () => {
    const { group } = setup();
    const chips = within(group).getAllByRole("button");
    chips[2].focus();
    fireEvent.keyDown(document.activeElement!, { key: "a" });
    expect(document.activeElement).toBe(chips[2]);
  });

  it("renders a series dot only while comparing, matching the chart legend", () => {
    const withDots = [
      { k: "a", label: "A", dot: "#5b63e8" },
      { k: "b", label: "B", dot: null },
    ];
    const { container } = render(
      <MetricPicker options={withDots} selected={["a"]} onToggle={() => {}} />
    );
    expect(container.querySelectorAll(".fhj-chip-dot")).toHaveLength(1);
  });

  it("survives an empty option list", () => {
    expect(() =>
      render(<MetricPicker options={[]} selected={[]} onToggle={() => {}} />)
    ).not.toThrow();
  });
});

describe("the Insights screen offers every chartable metric", () => {
  it("puts one chip in the picker for each of the template's chart metrics", async () => {
    const kv = new Map<string, string>([
      ["fhj_v1", JSON.stringify(I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true }))],
    ]);
    (window as any).storage = {
      async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
      async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
      async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
      async list() { return { keys: [...kv.keys()] }; },
    };

    render(<App />);
    // Trends — and so the picker — live on the Insights tab now; the first
    // screen is for logging.
    fireEvent.click(await screen.findByRole("button", { name: "Insights" }, { timeout: 10000 }));
    const group = await screen.findByRole("group", { name: "Metrics to chart" }, { timeout: 10000 });

    const db = JSON.parse(kv.get("fhj_v1")!);
    const tpl = I.getProfileTemplate(db.profile);
    const expected = tpl.chartMetrics.filter((k: string) => tpl.fields.some((f: any) => f.k === k));

    // The old markup rendered these too — what it didn't do was make anything
    // past the visible few reachable. This asserts the count so a future
    // "just show the first N" shortcut fails loudly.
    expect(expected.length).toBeGreaterThan(4);
    expect(within(group).getAllByRole("button")).toHaveLength(expected.length);
    await waitFor(() =>
      expect(document.body.textContent).toContain(`of ${expected.length} selected`)
    );
  });
});
