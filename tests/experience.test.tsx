/* P5 / reward-experience tests: report customization deck (buttons-only path),
   3-card floor, prefs persistence, reduced-motion behavior, feedback settings,
   and cautious-language audit over all user-facing report copy. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { causalLanguageAudit } from "../src/lib/validate";

let I: any;

beforeAll(async () => {
  (globalThis as any).ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  };
  // reduced motion ON for deterministic tests: GSAP flings/count-ups resolve instantly
  window.matchMedia = ((q: string) =>
    ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as any)) as any;
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  I = (await import("../src/App")).__internals;
});

beforeEach(() => cleanup());

const sample = () => I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });

function renderDeck(onDone = vi.fn(), catalogOverride?: any[]) {
  const db = sample();
  const tpl = I.getProfileTemplate(db.profile);
  const catalog = catalogOverride || I.availableReportCards(tpl);
  render(React.createElement(I.SwipeDeck, { catalog, initialPrefs: null, tint: "#33685A", onDone }));
  return { catalog, onDone };
}

describe("swipe deck (buttons-only accessibility path)", () => {
  it("shows n-of-m progress and completes with Include buttons", async () => {
    const { catalog, onDone } = renderDeck();
    expect(screen.getByText(`1 of ${catalog.length}`)).toBeTruthy();
    for (let i = 0; i < catalog.length; i++) {
      fireEvent.click(screen.getByLabelText("include this card"));
      await waitFor(() => {}); // let state settle
    }
    await waitFor(() => expect(screen.getByText(/your report is personalized/i)).toBeTruthy());
    fireEvent.click(screen.getByText(/show my report/i));
    expect(onDone).toHaveBeenCalledTimes(1);
    const prefs = onDone.mock.calls[0][0];
    expect(catalog.every((c: any) => prefs[c.key] === true)).toBe(true);
  });

  it("enforces the 3-card floor with a friendly message and a redo path", async () => {
    const { catalog, onDone } = renderDeck();
    for (let i = 0; i < catalog.length; i++) {
      fireEvent.click(screen.getByLabelText("skip this card"));
      await waitFor(() => {});
    }
    await waitFor(() => expect(screen.getByText(/at least 3/i)).toBeTruthy());
    const show = screen.getByText(/show my report/i).closest("button")!;
    expect((show as HTMLButtonElement).disabled).toBe(true);
    expect(onDone).not.toHaveBeenCalled();
    // redo path exists and restarts the deck
    fireEvent.click(screen.getByText(/go through the cards again/i));
    await waitFor(() => expect(screen.getByText(`1 of ${catalog.length}`)).toBeTruthy());
  });
});

describe("reportPrefs persistence & filtering", () => {
  it("prefs survive a save/load/migrate cycle and filter buildReport", () => {
    const db = sample();
    db.profile.reportPrefs = { streak: false, notes: false };
    const roundTripped = I.migrateDb(JSON.parse(JSON.stringify(db)));
    expect(roundTripped.profile.reportPrefs).toEqual({ streak: false, notes: false });
    const range = I.pickReportRange(roundTripped.entries, "week");
    const cards = I.buildReport(roundTripped, range);
    expect(cards.some((c: any) => c.type === "streak")).toBe(false);
    expect(cards.some((c: any) => c.type === "notes")).toBe(false);
  });

  it("customization catalog only offers cards that apply to the active setup", () => {
    const db = sample();
    const tpl = I.getProfileTemplate(db.profile);
    const noPhotoTpl = { ...tpl, fields: tpl.fields.filter((f: any) => f.type !== "photo") };
    const keys = I.availableReportCards(noPhotoTpl).map((c: any) => c.key);
    expect(keys).not.toContain("photoCompare");
    const noPairs = { ...tpl, pairs: [] };
    expect(I.availableReportCards(noPairs).map((c: any) => c.key)).not.toContain("patterns");
  });
});

describe("reduced motion", () => {
  it("finish celebration skips confetti and shows the full streak instantly", () => {
    const { container } = render(
      React.createElement(I.FinishCelebration, { streak: 12, tint: "#33685A", onDone: () => {} })
    );
    expect(container.querySelectorAll(".fhj-confetti").length).toBe(0);
    expect(container.textContent).toContain("12");
    expect(container.textContent).toMatch(/saved on this device only/i);
  });
});

describe("milestone moments", () => {
  it("streak milestones show their special line and fire milestone feedback", () => {
    const vibrate = vi.fn();
    (navigator as any).vibrate = vibrate;
    I.FB.prefs = { sound: false, haptics: true };
    const { container } = render(
      React.createElement(I.FinishCelebration, { streak: 7, tint: "#33685A", onDone: () => {} })
    );
    expect(container.textContent).toMatch(/one full week/i);
    expect(vibrate).toHaveBeenCalled();
    delete (navigator as any).vibrate;
  });
  it("non-milestone days use the rotating lines", () => {
    const { container } = render(
      React.createElement(I.FinishCelebration, { streak: 8, tint: "#33685A", onDone: () => {} })
    );
    expect(container.textContent).not.toMatch(/one full week/i);
    expect(container.textContent).toContain("8");
  });
});

describe("haptics & sound settings", () => {
  it("haptics fire only when enabled and supported", async () => {
    await new Promise((r) => setTimeout(r, 60)); // clear feedback() debounce window
    const vibrate = vi.fn();
    (navigator as any).vibrate = vibrate;
    I.FB.prefs = { sound: false, haptics: true };
    I.feedback("include");
    expect(vibrate).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 60));
    I.FB.prefs = { sound: false, haptics: false };
    I.feedback("skip");
    expect(vibrate).toHaveBeenCalledTimes(1); // unchanged — disabled
    delete (navigator as any).vibrate;
  });

  it("prefs (sound/haptics/backdrop) survive serialize + migrate", () => {
    const db = sample();
    db.profile.prefs = { sound: true, haptics: false, backdrop: true };
    const back = I.migrateDb(JSON.parse(JSON.stringify(db)));
    expect(back.profile.prefs).toEqual({ sound: true, haptics: false, backdrop: true });
  });
});

describe("cautious language", () => {
  it("report copy, card catalog, and a full Connor report contain no causal/medical claims", () => {
    const db = sample();
    const range = I.pickReportRange(db.entries, "week");
    const cards = I.buildReport(db, range);
    expect(causalLanguageAudit(I.REPORT_COPY)).toEqual([]);
    expect(causalLanguageAudit(I.REPORT_CARD_CATALOG)).toEqual([]);
    expect(causalLanguageAudit(cards)).toEqual([]);
    expect(JSON.stringify(cards)).toContain("in review"); // new header title present
  });
});

describe("editable report time frame", () => {
  it("rangeForOffset is total and contiguous across weeks", () => {
    const db = sample();
    const r0 = I.rangeForOffset(db.entries, "week", 0);
    const r1 = I.rangeForOffset(db.entries, "week", -1);
    expect(I.offsetOfPeriod(r0.start, "week")).toBe(0);
    expect(I.offsetOfPeriod(r1.start, "week")).toBe(-1);
    // previous week ends the day before this week starts
    const gap = (Date.parse(r0.start) - Date.parse(r1.end)) / 86400000;
    expect(gap).toBe(1);
    expect(typeof r0.days).toBe("number");
  });

  it("minPeriodOffset reaches the earliest logged entry and no further", () => {
    const db = sample();
    const min = I.minPeriodOffset(db.entries, "week");
    expect(min).toBeLessThanOrEqual(0);
    const atMin = I.rangeForOffset(db.entries, "week", min);
    expect(atMin.days).toBeGreaterThan(0);
    const beyond = I.rangeForOffset(db.entries, "week", min - 1);
    expect(beyond.days).toBe(0);
  });

  it("report screen navigates periods and toggles week/month", async () => {
    const db = sample();
    db.profile.reportPrefs = {}; // skip the swipe deck
    render(React.createElement(I.ReportScreen, {
      db, setDb: vi.fn(), params: { type: "week" }, goBack: () => {},
    }));
    const startLabel = screen.getByText(/days? logged/i).parentElement!.textContent;
    fireEvent.click(screen.getByLabelText("previous period"));
    await waitFor(() => {
      expect(screen.getByText(/days? logged/i).parentElement!.textContent).not.toBe(startLabel);
    });
    expect(screen.getByText(/latest/i)).toBeTruthy(); // jump-back affordance appears
    fireEvent.click(screen.getByText("Month"));
    await waitFor(() => expect(screen.getByText(/in review/i)).toBeTruthy());
    // next-period button disabled at the current period
    const next = screen.getByLabelText("next period") as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it("survives the card picker handing off to the report on the very first run", async () => {
    // Regression: ReportScreen used to declare refs and a layout effect *after*
    // its `if (needsPrefs) return <SwipeDeck/>` early return. The first render
    // (picker) ran fewer hooks than the second (report), so finishing the deck
    // threw React error #310 and dropped every new user into the error boundary
    // the first time they opened a report. Hooks now all sit above that return.
    const db = sample();
    delete db.profile.reportPrefs; // undefined => the picker is shown
    let current = db;
    const setDb = vi.fn((updater: any) => {
      current = typeof updater === "function" ? updater(current) : updater;
      rerender(React.createElement(I.ReportScreen, {
        db: current, setDb, params: { type: "week" }, goBack: () => {},
      }));
    });
    const { rerender } = render(React.createElement(I.ReportScreen, {
      db: current, setDb, params: { type: "week" }, goBack: () => {},
    }));

    const catalog = I.availableReportCards(I.getProfileTemplate(db.profile));
    for (let i = 0; i < catalog.length; i++) {
      fireEvent.click(screen.getByLabelText("include this card"));
      await waitFor(() => {});
    }
    fireEvent.click(screen.getByText(/show my report/i));

    await waitFor(() => expect(document.body.textContent).toMatch(/in review/i));
    expect(document.body.textContent).not.toMatch(/something went wrong/i);
  });

  it("thin periods show the friendly quiet state instead of a report", async () => {
    const db = sample();
    db.profile.reportPrefs = {};
    db.entries = db.entries.slice(0, 2); // almost nothing logged
    render(React.createElement(I.ReportScreen, {
      db, setDb: vi.fn(), params: { type: "week" }, goBack: () => {},
    }));
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/quiet week|days logged/i);
    });
    expect(document.body.textContent).not.toMatch(/save this report/i);
  });
});

describe("swipe between report periods", () => {
  const renderReport = () => {
    const db = sample();
    db.profile.reportPrefs = {};
    render(React.createElement(I.ReportScreen, {
      db, setDb: vi.fn(), params: { type: "week" }, goBack: () => {},
    }));
  };
  // scoped to the period-nav header (`.no-print`) so it can't also match the
  // "quiet period" empty-state copy, which reuses the phrase "days logged"
  // and would otherwise make this ambiguous whenever the current calendar
  // period doesn't yet have 4+ logged days (sample data never logs "today").
  const label = () => within(document.querySelector(".no-print")!).getByText(/days? logged/i).parentElement!.textContent;
  const area = () => document.querySelector(".print-area")!;

  it("horizontal swipe pages to the previous period; swipe back returns", async () => {
    renderReport();
    const start = label();
    // right-swipe (drag right) = back in time
    fireEvent.pointerDown(area(), { clientX: 200, clientY: 300 });
    fireEvent.pointerMove(area(), { clientX: 280, clientY: 305 });
    fireEvent.pointerUp(area(), { clientX: 300, clientY: 305 });
    await waitFor(() => expect(label()).not.toBe(start));
    // left-swipe = forward in time, back to where we started
    fireEvent.pointerDown(area(), { clientX: 300, clientY: 300 });
    fireEvent.pointerMove(area(), { clientX: 220, clientY: 303 });
    fireEvent.pointerUp(area(), { clientX: 200, clientY: 303 });
    await waitFor(() => expect(label()).toBe(start));
  });

  it("vertical drags and gestures starting on buttons do not change the period", async () => {
    renderReport();
    const start = label();
    fireEvent.pointerDown(area(), { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(area(), { clientX: 205, clientY: 320 }); // axis locks to y
    fireEvent.pointerUp(area(), { clientX: 210, clientY: 380 });
    const btn = screen.getByLabelText("previous period");
    fireEvent.pointerDown(btn, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(btn, { clientX: 260, clientY: 100 }); // starts on a button -> ignored
    await new Promise((r) => setTimeout(r, 50));
    expect(label()).toBe(start);
  });

  it("cannot swipe forward past the current period", async () => {
    renderReport();
    // the default landing period is the best *reportable* one (>=4 logged
    // days), which isn't necessarily offset 0 - e.g. sample data never logs
    // "today", so a real current week with only a couple of days logged so
    // far gets skipped in favor of the last full week. Jump to true offset 0
    // via the "latest" affordance (a no-op if already there) before probing
    // the forward-navigation cap.
    const latestBtn = screen.queryByText("latest");
    if (latestBtn) fireEvent.click(latestBtn);
    await waitFor(() => expect(screen.queryByText("latest")).toBeNull());
    const start = label();
    fireEvent.pointerDown(area(), { clientX: 300, clientY: 300 });
    fireEvent.pointerMove(area(), { clientX: 220, clientY: 302 });
    fireEvent.pointerUp(area(), { clientX: 180, clientY: 302 });
    await new Promise((r) => setTimeout(r, 50));
    expect(label()).toBe(start); // already at the latest period
  });
});
