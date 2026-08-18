/* The year heatmap in a DOM: what a square says out loud, what one tap does
   versus two, and the month-by-month list that stands in for the colour. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import YearHeatmap from "../src/components/YearHeatmap";
import { buildHeatmap } from "../src/lib/heatmap";

beforeAll(() => {
  window.matchMedia = ((q: string) =>
    ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {},
       addListener() {}, removeListener() {}, dispatchEvent: () => false } as any)) as any;
});
beforeEach(() => cleanup());

const TODAY = "2026-08-18";
const VALUES: Record<string, number> = {
  "2026-08-03": 7, "2026-08-04": 2, "2026-07-10": 9,
};
const LOGGED = [...Object.keys(VALUES), "2026-08-05"];

const months = () =>
  buildHeatmap({
    today: TODAY,
    valueOn: (d) => (d in VALUES ? VALUES[d] : null),
    loggedOn: (d) => LOGGED.includes(d),
  });

function mount(props: Partial<React.ComponentProps<typeof YearHeatmap>> = {}) {
  const onOpenDay = vi.fn();
  render(
    <YearHeatmap months={months()} dir="sym" metricLabel="Itch" today={TODAY}
      onOpenDay={onOpenDay} {...props} />
  );
  return { onOpenDay };
}

const square = (date: string) =>
  document.querySelector(`[data-heat-date="${date}"]`) as HTMLButtonElement;

describe("the grid", () => {
  it("draws twelve month rows, oldest first", () => {
    mount();
    const labels = [...document.querySelectorAll(".fhj-heat-month")].map((n) => n.textContent);
    expect(labels).toHaveLength(12);
    expect(labels[0]).toBe("Sep 25");
    expect(labels[11]).toBe("Aug");
    expect(labels).toContain("Jan 26");   // the year is printed when it turns over
  });

  it("says each day's date and score out loud, and distinguishes the empty kinds", () => {
    mount();
    expect(square("2026-08-03").getAttribute("aria-label"))
      .toBe("Monday, August 3, 2026 — Itch 7 out of 10");
    expect(square("2026-08-05").getAttribute("aria-label")).toMatch(/logged, no rating$/);
    expect(square("2026-08-06").getAttribute("aria-label")).toMatch(/nothing logged$/);
  });

  it("draws nothing for days after today", () => {
    mount();
    expect(square("2026-08-18")).toBeTruthy();
    expect(square("2026-08-19")).toBeNull();
  });

  it("is one tab stop, landing on today", () => {
    mount();
    const stops = [...document.querySelectorAll<HTMLElement>(".fhj-heat-day")]
      .filter((n) => n.tabIndex === 0);
    expect(stops).toHaveLength(1);
    expect(stops[0].getAttribute("data-heat-date")).toBe(TODAY);
  });
});

describe("touching a day", () => {
  it("names the day before it opens it", () => {
    const { onOpenDay } = mount();
    fireEvent.click(square("2026-08-03"));
    expect(onOpenDay).not.toHaveBeenCalled();
    const readout = document.querySelector(".fhj-heat-readout")!;
    expect(readout.textContent).toContain("Aug 3");
    expect(readout.textContent).toContain("7/10");
    expect(readout.textContent).toContain("Itch");
  });

  it("opens on the second tap of the same square", () => {
    const { onOpenDay } = mount();
    fireEvent.click(square("2026-08-03"));
    fireEvent.click(square("2026-08-03"));
    expect(onOpenDay).toHaveBeenCalledWith("2026-08-03");
  });

  it("moves the readout rather than opening when a different square is hit", () => {
    const { onOpenDay } = mount();
    fireEvent.click(square("2026-08-03"));
    fireEvent.click(square("2026-08-04"));
    expect(onOpenDay).not.toHaveBeenCalled();
    expect(document.querySelector(".fhj-heat-readout")!.textContent).toContain("Aug 4");
  });

  it("offers 'Log it' on a day with nothing on it", () => {
    const { onOpenDay } = mount();
    fireEvent.click(square("2026-08-06"));
    const readout = document.querySelector(".fhj-heat-readout")!;
    expect(readout.textContent).toContain("nothing logged this day");
    fireEvent.click(within(readout as HTMLElement).getByText("Log it"));
    expect(onOpenDay).toHaveBeenCalledWith("2026-08-06");
  });

  it("shows the year's headline until a day is chosen", () => {
    mount();
    const readout = document.querySelector(".fhj-heat-readout")!;
    expect(readout.textContent).toContain("3 of 352 days logged");
    expect(readout.textContent).toContain("avg 6");
  });

  it("keeps the readout inert in the read-only viewer", () => {
    mount({ onOpenDay: undefined });
    fireEvent.click(square("2026-08-03"));
    fireEvent.click(square("2026-08-03"));
    const readout = document.querySelector(".fhj-heat-readout")!;
    expect(readout.textContent).toContain("Aug 3");
    expect(within(readout as HTMLElement).queryByText("Open")).toBeNull();
  });

  it("walks the year with the arrow keys", () => {
    mount();
    fireEvent.click(square("2026-08-03"));
    fireEvent.keyDown(square("2026-08-03"), { key: "ArrowRight" });
    expect(document.querySelector(".fhj-heat-readout")!.textContent).toContain("Aug 4");
    fireEvent.keyDown(square("2026-08-04"), { key: "ArrowUp" });
    expect(document.querySelector(".fhj-heat-readout")!.textContent).toContain("Jul 4");
    fireEvent.keyDown(square("2026-07-04"), { key: "Home" });
    expect(document.querySelector(".fhj-heat-readout")!.textContent).toContain("Sep 1");
  });
});

describe("the non-chart fallback", () => {
  it("writes the same twelve months out in words", () => {
    mount();
    fireEvent.click(screen.getByText("Read it month by month"));
    const rows = document.querySelectorAll(".fhj-heat-table tbody tr");
    expect(rows).toHaveLength(12);
    const aug = [...rows].find((r) => r.textContent?.startsWith("Aug 2026"))!;
    expect(aug.textContent).toContain("2/18");   // two rated days of eighteen elapsed
    expect(aug.textContent).toContain("4.5");    // (7 + 2) / 2
    const heads = [...document.querySelectorAll(".fhj-heat-table thead th")].map((n) => n.textContent);
    expect(heads).toEqual(["Month", "Logged", "Avg", "Best", "Hardest"]);
  });

  it("names the year's best and hardest day in the metric's direction", () => {
    mount();
    fireEvent.click(screen.getByText("Read it month by month"));
    const panel = document.querySelector(".fhj-disclose-panel")!;
    expect(panel.textContent).toContain("Best: Tue, Aug 4 at 2");
    expect(panel.textContent).toContain("hardest: Fri, Jul 10 at 9");
  });

  it("flips best and hardest for a metric where high is good", () => {
    mount({ dir: "pos" });
    fireEvent.click(screen.getByText("Read it month by month"));
    const panel = document.querySelector(".fhj-disclose-panel")!;
    expect(panel.textContent).toContain("Best: Fri, Jul 10 at 9");
  });
});
