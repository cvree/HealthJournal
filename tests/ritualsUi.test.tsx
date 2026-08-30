/* Rituals, through the actual UI.

   The module tests pin the arithmetic. These pin the three things a person
   would notice on day one and that no unit test can promise:

       one tap on Today finishes the whole ritual,
       the player is a list of big steps that ticks and remembers,
       and the weekly tune-up arrives one at a time, on its own, and pays out.

   The last one is the reason the feature has a scheduler at all, so it gets
   the most attention here: two rituals both owed a tune-up must produce
   exactly one dialog. */
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

async function mountApp(patch: (db: any) => any = (d) => d) {
  const { __internals: I, default: App } = await import("../src/App");
  const db = patch(I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true }));
  const kv = mockStorage({ fhj_v1: JSON.stringify(db) });
  const utils = render(<App />);
  await screen.findByText(/Quick Add/);
  return { ...utils, kv, db };
}

async function saved(kv: Map<string, string>, check: (db: any) => unknown) {
  return await waitFor(() => {
    const db = JSON.parse(kv.get("fhj_v1")!);
    expect(check(db)).toBeTruthy();
    return db;
  });
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const runToday = (db: any, id: string) =>
  (db.ritualRuns || []).find((r: any) => r.ritualId === id && r.date === today());

/* The demo journal's two rituals, both already tuned up this week — so the
   dashboard opens without a dialog unless a test asks for one. */
const noReviews = (d: any) => ({ ...d, ritualReviews: [] });

describe("rituals on Today", () => {
  it("shows what today asks for, with nothing ticked yet", async () => {
    await mountApp();
    // The count rides in the heading's accessible name: "Rituals 0 of 2".
    expect(await screen.findByRole("heading", { name: /^Rituals 0 of 2$/ })).toBeTruthy();
    expect(btn(/Mark done: Shower & after/)).toBeTruthy();
    expect(btn(/Mark done: Morning meds/)).toBeTruthy();
  });

  it("finishes the whole thing on one tap, with no form in the way", async () => {
    const { kv } = await mountApp();
    fireEvent.click(btn(/Mark done: Shower & after/));

    expect(screen.queryByRole("dialog")).toBeNull();
    const db = await saved(kv, (d) => runToday(d, "rt_demo_shower"));
    const run = runToday(db, "rt_demo_shower");
    expect(run.done.length).toBe(run.total);
    expect(run.completedAt).toBeTruthy();
  });

  it("takes it back with the same tap", async () => {
    const { kv } = await mountApp();
    fireEvent.click(btn(/Mark done: Shower & after/));
    await saved(kv, (d) => runToday(d, "rt_demo_shower")?.completedAt);

    fireEvent.click(await screen.findByRole("button", { name: /Undo: Shower & after/ }));
    await saved(kv, (d) => runToday(d, "rt_demo_shower")?.done.length === 0);
    // Taking it back is silence, not a deliberate skip.
    const db = JSON.parse(kv.get("fhj_v1")!);
    expect(runToday(db, "rt_demo_shower").skipped).toBeFalsy();
  });

  it("logs the linked doses too, so the medication history fills in behind it", async () => {
    const { kv } = await mountApp();
    fireEvent.click(btn(/Mark done: Morning meds/));
    const db = await saved(kv, (d) => d.routine.some((r: any) => r.date === today()));
    const names = db.routine.filter((r: any) => r.date === today()).map((r: any) => r.name);
    expect(names).toContain("Vitamin D3");
  });

  it("offers an undo rather than a confirmation", async () => {
    await mountApp();
    fireEvent.click(btn(/Mark done: Shower & after/));
    const toast = await screen.findByText("Shower & after — done");
    expect(within(toast.closest("[role]") || toast.parentElement!)
      .getByRole("button", { name: /^Undo$/i })).toBeTruthy();
  });
});

describe("the step player", () => {
  it("opens on the row's second control, never on the row itself", async () => {
    await mountApp();
    fireEvent.click(btn(/Open Shower & after step by step/));
    const dialog = await screen.findByRole("dialog", { name: "Shower & after" });
    expect(within(dialog).getByRole("button", { name: /Moisturise within 3 minutes/ })).toBeTruthy();
  });

  it("ticks one step at a time and says how far through it is", async () => {
    const { kv } = await mountApp();
    fireEvent.click(btn(/Open Shower & after step by step/));
    const dialog = await screen.findByRole("dialog", { name: "Shower & after" });

    fireEvent.click(within(dialog).getByRole("button", { name: /Lukewarm, not hot/ }));
    await waitFor(() => expect(within(dialog).getByText(/1 of \d+/)).toBeTruthy());

    const db = await saved(kv, (d) => runToday(d, "rt_demo_shower"));
    expect(runToday(db, "rt_demo_shower").done).toHaveLength(1);
  });

  it("finishes the rest in one tap from inside the sheet", async () => {
    const { kv } = await mountApp();
    fireEvent.click(btn(/Open Shower & after step by step/));
    const dialog = await screen.findByRole("dialog", { name: "Shower & after" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Did it all" }));

    const db = await saved(kv, (d) => runToday(d, "rt_demo_shower")?.completedAt);
    const run = runToday(db, "rt_demo_shower");
    expect(run.done.length).toBe(run.total);
  });

  it("records 'not today' as a decision rather than as silence", async () => {
    const { kv } = await mountApp();
    fireEvent.click(btn(/Open Shower & after step by step/));
    const dialog = await screen.findByRole("dialog", { name: "Shower & after" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Not today" }));

    const db = await saved(kv, (d) => runToday(d, "rt_demo_shower")?.skipped);
    expect(runToday(db, "rt_demo_shower").skipped).toBe(true);
  });

  it("closes on Escape", async () => {
    await mountApp();
    fireEvent.click(btn(/Open Shower & after step by step/));
    await screen.findByRole("dialog", { name: "Shower & after" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Shower & after" })).toBeNull());
  });
});

describe("the weekly tune-up", () => {
  it("stays away entirely when nothing is owed", async () => {
    await mountApp();
    expect(screen.queryByRole("dialog", { name: /Weekly tune-up/ })).toBeNull();
  });

  it("arrives one at a time, even when both rituals are owed one", async () => {
    await mountApp(noReviews);
    await waitFor(() => expect(screen.getAllByRole("dialog", { name: /Weekly tune-up/ })).toHaveLength(1));
  });

  it("opens with the week that happened, not with a question", async () => {
    await mountApp(noReviews);
    const dialog = await screen.findByRole("dialog", { name: /Weekly tune-up/ });
    // A count of days, a headline and a way on — no answer asked for yet.
    expect(within(dialog).getByText("days")).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: /Nailed it/ })).toBeNull();
  });

  it("is answered in a handful of taps and writes one review", async () => {
    const { kv } = await mountApp(noReviews);
    const dialog = await screen.findByRole("dialog", { name: /Weekly tune-up/ });

    fireEvent.click(within(dialog).getByRole("button", { name: /quick questions|Nice/ }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Good" }));

    // The friction card only appears on a week something got in the way of.
    const skip = within(dialog).queryByRole("button", { name: "Skip" });
    if (skip) fireEvent.click(skip);

    const keep = await within(dialog).findByRole("button", { name: /leave it/i });
    fireEvent.click(keep);

    fireEvent.click(await within(dialog).findByRole("button", { name: "Done" }));

    const db = await saved(kv, (d) => (d.ritualReviews || []).length > 0);
    expect(db.ritualReviews).toHaveLength(1);
    expect(db.ritualReviews[0]).toMatchObject({ felt: 4, date: today(), tweak: "keep" });
  });

  it("does not show a second one the moment the first is answered", async () => {
    await mountApp(noReviews);
    const dialog = await screen.findByRole("dialog", { name: /Weekly tune-up/ });
    fireEvent.click(within(dialog).getByRole("button", { name: /quick questions|Nice/ }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Good" }));
    const skip = within(dialog).queryByRole("button", { name: "Skip" });
    if (skip) fireEvent.click(skip);
    fireEvent.click(await within(dialog).findByRole("button", { name: /leave it/i }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Done" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Weekly tune-up/ })).toBeNull());
  });

  it("takes 'not now' for an answer, and writes it down so it comes back later", async () => {
    const { kv } = await mountApp(noReviews);
    const dialog = await screen.findByRole("dialog", { name: /Weekly tune-up/ });
    fireEvent.click(within(dialog).getByRole("button", { name: /Not now/ }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Weekly tune-up/ })).toBeNull());
    const db = await saved(kv, (d) => (d.ritualReviews || []).length > 0);
    expect(db.ritualReviews[0].snoozed).toBe(true);
  });

  it("applies the change it offered, to the plan, on the tap", async () => {
    /* A month of showers where the last step is never done — which is exactly
       the case the tune-up exists to catch. */
    const { kv } = await mountApp((d) => {
      const shower = d.rituals.find((r: any) => r.id === "rt_demo_shower");
      const required = shower.steps.filter((s: any) => !s.optional);
      const runs = (d.ritualRuns || [])
        .filter((r: any) => r.ritualId !== "rt_demo_shower")
        .concat((d.ritualRuns || [])
          .filter((r: any) => r.ritualId === "rt_demo_shower")
          .map((r: any) => ({
            ...r,
            total: required.length,
            done: required.slice(0, -1).map((s: any) => s.id),
            completedAt: undefined,
          })));
      return { ...d, ritualReviews: [], ritualRuns: runs, rituals: [shower] };
    });

    const dialog = await screen.findByRole("dialog", { name: /Weekly tune-up/ });
    fireEvent.click(within(dialog).getByRole("button", { name: /quick questions|Nice/ }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Patchy" }));
    const skip = within(dialog).queryByRole("button", { name: "Skip" });
    if (skip) fireEvent.click(skip);

    // The suggestion is written from the week: the step that never happened.
    const ease = await within(dialog).findByRole("button", { name: /Make .*optional/ });
    fireEvent.click(ease);
    fireEvent.click(await within(dialog).findByRole("button", { name: "Done" }));

    const db = await saved(kv, (d) => (d.ritualReviews || []).length > 0);
    const shower = db.rituals.find((r: any) => r.id === "rt_demo_shower");
    expect(shower.steps.some((s: any) => s.optional && s.label.includes("Moisturise"))).toBe(true);
  });
});

describe("managing them", () => {
  it("lists each ritual with the day its tune-up lands on", async () => {
    const { __internals: I, default: App } = await import("../src/App");
    const db = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
    mockStorage({ fhj_v1: JSON.stringify(db) });
    render(<App />);
    await screen.findByText(/Quick Add/);

    fireEvent.click(screen.getByRole("button", { name: "Manage your rituals" }));
    expect(await screen.findByRole("heading", { name: "Your Rituals" })).toBeTruthy();
    expect(screen.getAllByText(/Tune-up (Sun|Mon|Tue|Wed|Thu|Fri|Sat)/).length).toBe(2);
  });

  it("gives the two rituals different tune-up days, so they can never collide", async () => {
    const { db } = await mountApp();
    const days = db.rituals.map((r: any) => r.reviewDay);
    expect(new Set(days).size).toBe(days.length);
  });

  it("adds one from a starter that is already written out", async () => {
    const { kv } = await mountApp();
    fireEvent.click(screen.getByRole("button", { name: "Manage your rituals" }));
    fireEvent.click(await screen.findByRole("button", { name: /Add a ritual/ }));

    const picker = await screen.findByRole("dialog", { name: "Add a ritual" });
    fireEvent.click(within(picker).getByRole("button", { name: /Wind-down/ }));

    const editor = await screen.findByRole("dialog", { name: "New ritual" });
    fireEvent.click(within(editor).getByRole("button", { name: "Add it" }));

    const saveddb = await saved(kv, (d) => d.rituals.length === 3);
    const added = saveddb.rituals.find((r: any) => r.name === "Wind-down");
    expect(added.steps.length).toBeGreaterThan(3);
  });

  it("spreads the new one onto a day the others are not already using", async () => {
    const { kv } = await mountApp();
    fireEvent.click(screen.getByRole("button", { name: "Manage your rituals" }));
    fireEvent.click(await screen.findByRole("button", { name: /Add a ritual/ }));
    const picker = await screen.findByRole("dialog", { name: "Add a ritual" });
    fireEvent.click(within(picker).getByRole("button", { name: /Wind-down/ }));
    const editor = await screen.findByRole("dialog", { name: "New ritual" });
    fireEvent.click(within(editor).getByRole("button", { name: "Add it" }));

    const db = await saved(kv, (d) => d.rituals.length === 3);
    const days = db.rituals.map((r: any) => r.reviewDay);
    expect(new Set(days).size).toBe(3);
  });

  it("refuses to save one with no name", async () => {
    await mountApp();
    fireEvent.click(screen.getByRole("button", { name: "Manage your rituals" }));
    fireEvent.click(await screen.findByRole("button", { name: /Add a ritual/ }));
    const picker = await screen.findByRole("dialog", { name: "Add a ritual" });
    fireEvent.click(within(picker).getByRole("button", { name: "Start from blank" }));

    const editor = await screen.findByRole("dialog", { name: "New ritual" });
    expect(within(editor).getByRole("button", { name: "Add it" })).toHaveProperty("disabled", true);
  });
});
