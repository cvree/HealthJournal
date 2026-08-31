/* Choosing how often the journal asks, and the app actually meaning it.

   The module tests (tests/cadence.test.ts) pin the arithmetic. These pin the
   promise: that the choice reaches the screens. A frequency setting that the
   check-in card, the streak and the questions all quietly ignore is worse than
   no setting at all — it is the app telling somebody their preference was
   recorded and then behaving exactly as before.

   The one worth failing the build over is the quiet state. On a weekly journal
   that has had its week, Today must say *nothing is due*. If it keeps showing
   an unfinished ring, choosing "once a week" bought nothing but a slower kind
   of guilt. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
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
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const saved = () => JSON.parse(kv.get("fhj_v1")!);

async function mount(mutate?: (db: any) => void) {
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
  await screen.findByRole("button", { name: /Overall skin severity 6 out of 10/ }, { timeout: 10000 });
  return db;
}

const openSettings = async () => {
  fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
  await screen.findByText("How often to ask", {}, { timeout: 5000 });
};

/** Log today under whatever the sample journal's key metric is. */
const logToday = (db: any, date = today()) => {
  db.entries.push({
    id: `e_${date}`, date, answers: { overall_skin_severity: 4 },
    quickLogCompleted: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
};

beforeEach(() => cleanup());

describe("choosing how often", () => {
  it("puts the question in Settings, with every answer on one screen", async () => {
    await mount();
    await openSettings();
    for (const label of [
      "Every day", "Weekdays", "Every other day", "Three times a week",
      "Twice a week", "Once a week", "Every two weeks", "Once a month",
      "Only when I open it",
    ]) {
      expect(screen.getByRole("radio", { name: new RegExp(label, "i") })).toBeTruthy();
    }
  });

  it("starts on every day, because that is what every journal already was", async () => {
    await mount();
    await openSettings();
    expect(screen.getByRole("radio", { name: /Every day/i }).getAttribute("aria-checked")).toBe("true");
    expect(saved().profile.cadence).toBeUndefined();
  });

  it("writes the choice down, and reads it back after a reload", async () => {
    await mount();
    await openSettings();
    fireEvent.click(screen.getByRole("radio", { name: /Once a week/i }));
    await waitFor(() => expect(saved().profile.cadence?.unit).toBe("week"));
    expect(saved().profile.cadence.times).toBe(1);
    /* An anchor is stamped on the way in — "every other week" has to count
       from somewhere, and a grid that moved on every launch would put the same
       journal on a different schedule each time. */
    expect(saved().profile.cadence.anchor).toBe(today());

    cleanup();
    await mount((db) => { db.profile.cadence = saved().profile.cadence; });
    await openSettings();
    expect(screen.getByRole("radio", { name: /Once a week/i }).getAttribute("aria-checked")).toBe("true");
  });
});

/** The Monday of the week `date` falls in, which is where a weekly period
    starts. Used to build a journal whose current week is deliberately empty. */
const mondayOf = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

describe("the quiet state — what a slower journal actually buys", () => {
  it("says nothing is due once the week has what it asked for", async () => {
    /* The clock is pinned, and it has to be.

       The state under test is "the week has had its check-in and today has
       not been touched" — which on a Monday cannot exist at all: the week
       starts today, so the only day that could have put it in is today, and a
       day that put the week in is not an untouched one. The sample journal
       runs up to yesterday, so this passed six days a week and failed every
       Monday, on a test whose whole subject is which week a day falls in.

       Only Date is faked. Timers stay real, because everything waiting on this
       screen is waiting on React rather than on the clock. */
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 2, 12, 0, 0));   // a Wednesday
    try {
      await mount((db) => {
        db.profile.cadence = { unit: "week", n: 1, times: 1, days: [] };
      });
      /* The card still opens — a journal you cannot write in because you are
         ahead of schedule would be absurd — but it stops asking. */
      const card = await screen.findByRole("button", { name: /Today's check-in/ });
      expect(card.textContent).toMatch(/This week is in/);
      expect(card.textContent).toMatch(/Nothing is due/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("says the week is still open when it is", async () => {
    await mount((db) => {
      db.profile.cadence = { unit: "week", n: 1, times: 1, days: [] };
      const from = mondayOf(today());
      db.entries = db.entries.filter((e: any) => e.date < from);
    });
    const card = await screen.findByRole("button", { name: /Today's check-in/ });
    expect(card.textContent).toMatch(/Nothing in for this week yet/);
    expect(card.textContent).not.toMatch(/Nothing is due/);
  });

  it("leaves a daily journal exactly as it was — no strip, no claim", async () => {
    await mount();
    const card = await screen.findByRole("button", { name: /Today's check-in/ });
    expect(card.textContent).not.toMatch(/Nothing is due/);
    expect(card.textContent).not.toMatch(/This week/);
  });
});

describe("pausing", () => {
  it("offers time off, and then owes nothing", async () => {
    await mount();
    await openSettings();
    fireEvent.click(screen.getByRole("button", { name: /Pause the journal for a while/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^A week$/ }));
    await waitFor(() => expect(saved().profile.cadence?.pause?.from).toBe(today()));
    /* Said in both places it has to be said: the setting, and the card on
       Today that people actually look at. */
    expect((await screen.findAllByText(/Paused until/)).length).toBeGreaterThan(0);
  });

  it("hands the journal back when it is over", async () => {
    await mount((db) => {
      db.profile.cadence = { unit: "day", n: 1, times: 1, days: [], pause: { from: today() } };
    });
    await openSettings();
    fireEvent.click(screen.getByRole("button", { name: /^Resume$/ }));
    await waitFor(() => expect(saved().profile.cadence?.pause).toBeUndefined());
  });
});

describe("a question that asks less often than the journal", () => {
  const openSetup = async () => {
    fireEvent.click(screen.getByRole("button", { name: /edit survey setup/i }));
    await screen.findByText(/Question packs/i, {}, { timeout: 5000 });
  };

  it("offers a frequency on every question but the one Today is built around", async () => {
    await mount();
    await openSetup();
    fireEvent.click(await screen.findByRole("button", { name: /Expand all/i }));
    const pills = await screen.findAllByRole("button", { name: /asked every check-in/i });
    expect(pills.length).toBeGreaterThan(0);
    /* The key metric is exempt: it is the one-tap question the whole of Today
       is, and a version of this app where it goes quiet for three weeks is a
       different app. */
    expect(screen.queryByRole("button", { name: /Overall skin severity: asked/i })).toBeNull();
  });

  it("writes the question's own schedule down without touching its answers", async () => {
    const before = await mount();
    const answered = before.entries.filter((e: any) => e.answers.itch != null).length;
    await openSetup();
    fireEvent.click(await screen.findByRole("button", { name: /Expand all/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Itch: asked every check-in$/i }));
    fireEvent.click(await screen.findByRole("radio", { name: /Once a week/i }));
    await waitFor(
      () => expect(saved().profile.fieldCadence?.itch?.unit).toBe("week"),
      { timeout: 4000 }
    );
    /* A quieter question is not a disabled one. */
    expect(saved().profile.disabledFields || []).not.toContain("itch");
    expect(saved().entries.filter((e: any) => e.answers.itch != null).length).toBe(answered);
  });
});

describe("the days the period still has room for", () => {
  const goHistory = async () => {
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    await screen.findByRole("heading", { name: "History" }, { timeout: 5000 });
  };

  it("offers a way back to the days that have already passed", async () => {
    /* A monthly journal with this month cleared: every day of it that has
       already happened is open, and the row offers the nearest few. */
    const first = `${today().slice(0, 7)}-01`;
    if (first === today()) return;   // the 1st: only today is open, and today has a card
    await mount((db) => {
      db.profile.cadence = { unit: "month", n: 1, times: 1, days: [] };
      db.entries = db.entries.filter((e: any) => e.date < first);
    });
    await goHistory();
    expect(screen.getByText(/This month still has room/)).toBeTruthy();
    const chips = screen.getAllByRole("button", { name: /^Log / });
    /* Capped: twenty-odd chips is a wall, not an offer. And never today, which
       has the card above it, and never a day that has not happened — filling
       in tomorrow is the one thing a journal must not make easy. */
    const past = Number(today().slice(8)) - 1;
    expect(chips.length).toBe(Math.min(7, past));
  });

  it("says nothing at all on a daily journal", async () => {
    await mount();
    await goHistory();
    expect(screen.queryByText(/still has room/)).toBeNull();
  });

  it("says nothing once the period has what it asked for", async () => {
    /* The sample journal runs up to yesterday, so this week is already in. */
    await mount((db) => {
      db.profile.cadence = { unit: "week", n: 1, times: 1, days: [] };
    });
    await goHistory();
    expect(screen.queryByText(/still has room/)).toBeNull();
  });
});
