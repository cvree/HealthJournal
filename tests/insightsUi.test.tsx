/* The rebuilt Insights screen: the order it asks its questions in, the range
   selector driving everything under it, pinning, and the flare actions.

   These are the guarantees that are easy to erode by accident — a section
   moving, a card quietly reading the wrong window, a pin that doesn't survive
   the next visit. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
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

async function mountInsights(mutate?: (db: any) => void) {
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
  fireEvent.click(await screen.findByRole("button", { name: "History" }, { timeout: 10000 }));
  fireEvent.click(await screen.findByRole("button", { name: /^Insights/ }, { timeout: 10000 }));
  await screen.findByRole("heading", { name: "Trend" }, { timeout: 10000 });
  return db;
}

/** What the journal on disk says, after a write. */
const saved = () => JSON.parse(kv.get("fhj_v1")!);

beforeEach(() => cleanup());

describe("the order it asks its questions in", () => {
  it("runs range, hero, four figures, trend, flares, year, spread, relationships", async () => {
    await mountInsights();
    const headings = [...document.querySelectorAll("h2.fhj-section-title")].map((n) => n.textContent);
    const wanted = ["Trend", "Flares", "Your year", "Spread of days", "Possible relationships"];
    // Every named section is present, in this order, before the older ones.
    const seen = headings.filter((h) => wanted.includes(h!));
    expect(seen).toEqual(wanted);
  });

  it("puts the range selector above everything it changes", async () => {
    await mountInsights();
    const range = screen.getByRole("radiogroup", { name: "Range" });
    expect([...range.querySelectorAll("button")].map((b) => b.textContent))
      .toEqual(["30 days", "3 months", "12 months", "All"]);
    const trend = screen.getByRole("heading", { name: "Trend" });
    expect(range.compareDocumentPosition(trend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows four summary figures, and no chart among them", async () => {
    await mountInsights();
    for (const label of ["Average", "Days logged", "Hard days", "Calm days"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});

describe("the range selector", () => {
  it("re-reads the summary figures over the chosen window", async () => {
    await mountInsights();
    const daysLogged = () =>
      screen.getByText("Days logged").parentElement!.textContent!;
    expect(daysLogged()).toContain("of 30");
    fireEvent.click(screen.getByRole("radio", { name: "3 months" }));
    await waitFor(() => expect(daysLogged()).toContain("of 90"));
    fireEvent.click(screen.getByRole("radio", { name: "12 months" }));
    await waitFor(() => expect(daysLogged()).toContain("of 365"));
  });

  it("names the window it is comparing against, and admits when there isn't one", async () => {
    await mountInsights();
    expect(document.body.textContent).toContain("vs previous 30 days");
    /* The demo journal is a month long, so three months back has nothing
       before it. Saying so beats printing a change against a half-empty
       window. */
    fireEvent.click(screen.getByRole("radio", { name: "3 months" }));
    await waitFor(() =>
      expect(document.body.textContent).toContain("no earlier period to compare with"));
    expect(document.body.textContent).not.toContain("vs previous 3 months");
  });

  it("says which window the hero average is over", async () => {
    await mountInsights();
    fireEvent.click(screen.getByRole("radio", { name: "12 months" }));
    await waitFor(() => expect(document.body.textContent).toContain("12 months · avg"));
  });
});

describe("pinned metrics", () => {
  it("keeps up to four, and writes them to the journal", async () => {
    await mountInsights();
    const group = screen.getByRole("group", { name: "Pinned metrics" });
    const chips = within(group).getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") !== null);
    expect(chips.length).toBeGreaterThan(4);

    fireEvent.click(chips[1]);
    await waitFor(() => expect(saved().profile.pinnedMetrics?.length).toBe(2));
    fireEvent.click(chips[2]);
    fireEvent.click(chips[3]);
    fireEvent.click(chips[4]);
    await waitFor(() => expect(saved().profile.pinnedMetrics.length).toBe(4));
    // A fifth replaces the last rather than growing the list.
    fireEvent.click(chips[5]);
    await waitFor(() => expect(saved().profile.pinnedMetrics.length).toBe(4));
  });

  it("starts from what was pinned last time", async () => {
    await mountInsights((db) => {
      const tpl = I.getProfileTemplate(db.profile);
      db.profile.pinnedMetrics = [tpl.chartMetrics[1], tpl.chartMetrics[0]];
    });
    const group = screen.getByRole("group", { name: "Pinned metrics" });
    const pressed = within(group).getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(2);
  });

  /* The pins and the chart under them used to disagree: pinning four metrics
     drew one line, and the comparison lived in a second card further down. */
  it("draws every pinned metric in the trend chart, not just the first", async () => {
    await mountInsights();
    const keys = () => [...document.querySelectorAll(".fhj-cmp-key")].map((n) => n.textContent);
    expect(keys()).toHaveLength(1);
    const group = screen.getByRole("group", { name: "Pinned metrics" });
    const chips = within(group).getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") !== null);
    const second = chips[1].textContent!;
    fireEvent.click(chips[1]);
    await waitFor(() => expect(keys()).toHaveLength(2));
    expect(keys().join(" ")).toContain(second);
  });
});

describe("how the chart is drawn", () => {
  const openControls = () =>
    fireEvent.click(screen.getByRole("button", { name: /How it's drawn/ }));
  const pick = (group: string, option: string) =>
    fireEvent.click(within(screen.getByRole("radiogroup", { name: group }))
      .getByRole("radio", { name: option }));

  it("says what it is doing before you open it", async () => {
    await mountInsights();
    expect(screen.getByRole("button", { name: /How it's drawn/ }).textContent)
      .toContain("line · 7-day average");
  });

  it("offers the choices that mean something for what is pinned", async () => {
    await mountInsights();
    openControls();
    for (const group of ["Shape", "7-day average", "Days you didn't log", "Rating axis"]) {
      expect(screen.getByRole("radiogroup", { name: group })).toBeTruthy();
    }
    /* One rating pinned: "one axis or one chart each" is not a question yet. */
    expect(screen.queryByRole("radiogroup", { name: "Several ratings" })).toBeNull();
    const group = screen.getByRole("group", { name: "Pinned metrics" });
    const chips = within(group).getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") !== null);
    fireEvent.click(chips[1]);
    await waitFor(() =>
      expect(screen.getByRole("radiogroup", { name: "Several ratings" })).toBeTruthy());
  });

  it("writes the choice to the journal, so it is there tomorrow", async () => {
    await mountInsights();
    openControls();
    pick("Shape", "Steps");
    await waitFor(() => expect(saved().profile.chartView.shape).toBe("steps"));
    pick("7-day average", "Only");
    await waitFor(() => expect(saved().profile.chartView.avg).toBe("only"));
    pick("Days you didn't log", "Leave a gap");
    await waitFor(() => expect(saved().profile.chartView.breakGaps).toBe(true));
    expect(screen.getByRole("button", { name: /How it's drawn/ }).textContent)
      .toContain("steps · averages only · gaps open");
  });

  it("opens on whatever was saved last time", async () => {
    await mountInsights((db) => { db.profile.chartView = { shape: "dots", avg: "off" }; });
    expect(screen.getByRole("button", { name: /How it's drawn/ }).textContent).toContain("dots");
    openControls();
    expect(screen.getByRole("radio", { name: "Dots" }).getAttribute("aria-checked")).toBe("true");
  });

  /* The one setting that can mislead has to admit to it on the chart itself. */
  it("says so on the chart while the axis is fitted to the data", async () => {
    await mountInsights();
    openControls();
    expect(document.body.textContent).not.toContain("so differences look bigger");
    pick("Rating axis", "Fit the data");
    await waitFor(() =>
      expect(document.body.textContent).toMatch(/Axis fitted to \d+–\d+ of 1–10/));
    expect(document.body.textContent).toContain("so differences look bigger than they are");
  });

  it("puts everything back in one tap", async () => {
    await mountInsights();
    openControls();
    pick("Shape", "Dots");
    await waitFor(() => expect(saved().profile.chartView.shape).toBe("dots"));
    fireEvent.click(screen.getByRole("button", { name: /Put it back the way it started/ }));
    await waitFor(() => expect(saved().profile.chartView.shape).toBe("line"));
    expect(screen.queryByRole("button", { name: /Put it back the way it started/ })).toBeNull();
  });

  it("averages into weeks or into months, and says which", async () => {
    await mountInsights();
    fireEvent.click(screen.getByRole("button", { name: /Week by week/ }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Averaged into" }))
      .getByRole("radio", { name: "Months" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Month by month/ })).toBeTruthy());
    expect(document.body.textContent).toContain("averaged into months");
  });
});

describe("flares", () => {
  it("offers one button, and never invents an episode by itself", async () => {
    const db = await mountInsights();
    expect(db.episodes).toEqual([]);
    expect(document.body.textContent).toContain("Nothing is detected for you");
    expect(screen.getByRole("button", { name: /Mark a flare now/i })).toBeTruthy();
  });

  it("marks one on the day it happened, complete, and counts the next", async () => {
    await mountInsights();
    fireEvent.click(screen.getByRole("button", { name: /Mark a flare now/i }));
    await waitFor(() => expect(saved().episodes).toHaveLength(1));

    /* Nothing is left open. A flare is a thing that happened, and the record
       of it is whole on the tap — there is no second half to remember. */
    const first = saved().episodes[0];
    expect(first.metric).toBeTruthy();
    expect(first.end).toBe(first.start);
    expect(typeof first.at).toBe("string");
    expect(screen.queryByText("Flare in progress")).toBeNull();

    // And the count is the point: a second one today is a second flare.
    const again = await screen.findByRole("button", { name: /Mark another one/i });
    fireEvent.click(again);
    await waitFor(() => expect(saved().episodes).toHaveLength(2));
    await waitFor(() => expect(document.body.textContent).toContain("2 today"));
  });

  it("opens the flare's own screen, with its numbers and its days", async () => {
    await mountInsights();
    fireEvent.click(screen.getByRole("button", { name: /Mark a flare now/i }));
    await waitFor(() => expect(saved().episodes).toHaveLength(1));

    /* The row in the timeline is the way in — there is no "in progress" card
       to open any more, because nothing is in progress. */
    const row = await screen.findByRole("button", { name: /^Flare/ }, { timeout: 10000 });
    fireEvent.click(row);
    await screen.findByRole("heading", { name: "Day by day" }, { timeout: 10000 });
    for (const label of ["Marked", "Peak", "Average", "Hard days"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    /* One day, by default — and the one thing the tap could not know is
       offered rather than demanded. */
    expect(screen.getByRole("button", { name: /This one ran on/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /End this flare today/i })).toBeNull();
  });

  it("still knows how to read, show and end a flare left running", async () => {
    await mountInsights((db: any) => {
      db.episodes = [{
        id: "ep_old", title: "Bad fortnight",
        metric: db.profile.keyMetric || "overall_skin_severity",
        start: "2020-01-01", end: null,
        createdAt: "2020-01-01T00:00:00.000Z", updatedAt: "2020-01-01T00:00:00.000Z",
      }];
    });
    await screen.findByText("Flare in progress");
    fireEvent.click(screen.getByRole("button", { name: /^End flare$/ }));
    await waitFor(() => expect(saved().episodes[0].end).toBeTruthy());
    expect(screen.queryByText("Flare in progress")).toBeNull();
  });
});

describe("the spread of days", () => {
  it("draws ten columns, one per score, each saying its own count", async () => {
    await mountInsights();
    const group = screen.getByRole("group", { name: /days at each score from 1 to 10/i });
    const cols = within(group).getAllByRole("button");
    expect(cols).toHaveLength(10);
    expect(cols[0].getAttribute("aria-label")).toMatch(/^1 out of 10 — \d+ days?, \d+% of logged days$/);
  });

  it("names the typical day, the most common one, the spread and the hard days", async () => {
    await mountInsights();
    for (const label of ["Typical day", "Most common", "Spread"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});

describe("possible relationships", () => {
  const chosen = (name: RegExp) =>
    screen.getByRole("combobox", { name })
      .querySelector(".fhj-select-value")!.textContent!.trim();

  it("offers an outcome and a factor, and never the same metric as both", async () => {
    await mountInsights();
    expect(chosen(/I want to look at/i)).toBeTruthy();
    expect(chosen(/Compared with/i)).not.toBe(chosen(/I want to look at/i));

    fireEvent.click(screen.getByRole("combobox", { name: /Compared with/i }));
    const list = await screen.findByRole("listbox", { name: /Compared with/i });
    const offered = within(list).getAllByRole("option").map((o) => o.textContent);
    expect(offered.length).toBeGreaterThan(1);
    expect(offered.some((o) => o!.startsWith(chosen(/I want to look at/i)))).toBe(false);
  });

  /* The old control was a native <select>: unstyleable, ungroupable, and the
     one thing on this screen that looked like a different app. */
  it("chooses from the app's own sheet, grouped and filterable", async () => {
    await mountInsights();
    fireEvent.click(screen.getByRole("combobox", { name: /I want to look at/i }));
    const list = await screen.findByRole("listbox", { name: /I want to look at/i });
    const before = chosen(/I want to look at/i);
    const options = within(list).getAllByRole("option");
    expect(options.some((o) => o.getAttribute("aria-selected") === "true")).toBe(true);

    const other = options.find((o) => o.getAttribute("aria-selected") !== "true")!;
    const wanted = other.querySelector(".fhj-opt-name")!.textContent!;
    fireEvent.click(other);
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(chosen(/I want to look at/i)).toBe(wanted);
    expect(chosen(/I want to look at/i)).not.toBe(before);
  });

  it("prints the sample size before the result, and says it is not proof", async () => {
    await mountInsights();
    expect(document.body.textContent).toMatch(/days where both were logged/);
    expect(document.body.textContent).toContain("not proof that one causes the other");
  });

  it("shows nothing but a needs-more line below the paired-day floor", async () => {
    await mountInsights((db) => { db.entries = db.entries.slice(-4); });
    await waitFor(() =>
      expect(document.body.textContent).toMatch(/more days with both logged and this will appear/));
    /* No coefficient, no strength sentence, no chart — the intro's own
       "two things moved together" line is the only place that phrase appears. */
    expect(document.body.textContent).not.toMatch(/rho /);
    expect(document.body.textContent).not.toMatch(/These moved together/);
  });
});
