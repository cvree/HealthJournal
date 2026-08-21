/* The routine, through the actual UI.

   The module tests pin the data rules; these pin the interaction the whole
   feature is built around and would be worthless without:

       one tap says "took it", the same tap again undoes it.

   Everything else here guards a boundary that is easy to break by accident —
   adjusting today's dose must not edit the plan, and a screen the user has
   never set up must still tell them the feature exists. */
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

/** The demo journal, whose routine deliberately stops at yesterday — today is
    always still to do, which is the state every one of these tests wants. */
async function mountApp(patch: (db: any) => any = (d) => d) {
  const { __internals: I, default: App } = await import("../src/App");
  const db = patch(I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true }));
  const kv = mockStorage({ fhj_v1: JSON.stringify(db) });
  const utils = render(<App />);
  await screen.findByText(/Quick Add/);
  return { ...utils, kv, db };
}

/** The journal on disk once it satisfies `check` — saves are asynchronous, so
    reading straight after a tap reads the version before it. */
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

const row = (name: string | RegExp) => screen.getByRole("button", { name });

describe("the routine on the dashboard", () => {
  it("shows the day's checklist with nothing ticked yet", async () => {
    await mountApp();
    // Heading, not the Quick Add tile of the same name that now sits above it.
    expect(await screen.findByRole("heading", { name: "Routine" })).toBeTruthy();
    expect(screen.getByText(/0 of \d+ done/)).toBeTruthy();
    // Grouped by part of the day, not one undifferentiated list.
    expect(screen.getAllByText("Morning").length).toBeGreaterThan(0);
    expect(row("Mark taken: Vitamin D3, Morning")).toBeTruthy();
  });

  it("logs a dose on one tap, with no form in the way", async () => {
    const { kv } = await mountApp();
    fireEvent.click(row("Mark taken: Vitamin D3, Morning"));

    // No dialog opened — the tap *was* the log.
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(screen.getByText(/1 of \d+ done/)).toBeTruthy());

    const db = await saved(kv, (d) => d.routine.some((r: any) => r.date === today()));
    const logs = db.routine.filter((r: any) => r.date === today());
    expect(logs).toHaveLength(1);
    // The snapshot the log carries is what makes history immune to later edits.
    expect(logs[0]).toMatchObject({ name: "Vitamin D3", dose: "2000 IU", slot: "morning" });
  });

  it("unticks with the same tap, leaving the day saying nothing rather than 'skipped'", async () => {
    const { kv } = await mountApp();
    fireEvent.click(row("Mark taken: Vitamin D3, Morning"));
    await waitFor(() => expect(screen.getByText(/1 of \d+ done/)).toBeTruthy());
    await saved(kv, (d) => d.routine.some((r: any) => r.date === today()));

    fireEvent.click(await screen.findByRole("button", { name: "Undo: Vitamin D3, Morning" }));
    await waitFor(() => expect(screen.getByText(/0 of \d+ done/)).toBeTruthy());

    await saved(kv, (d) => !d.routine.some((r: any) => r.date === today()));
  });

  it("puts a logged dose on today's timeline", async () => {
    await mountApp();
    fireEvent.click(row("Mark taken: Vitamin D3, Morning"));
    await waitFor(() => {
      const timeline = screen.getByText("Today's Logs").closest("button")!.parentElement!;
      expect(within(timeline).getAllByText(/Vitamin D3/).length).toBeGreaterThan(0);
    });
  });

  it("asks for an item once per time of day it is scheduled in", async () => {
    await mountApp();
    // The demo cream is morning *and* bedtime: ticking the morning one leaves
    // the evening one asking.
    fireEvent.click(row("Mark taken: CeraVe moisturising cream, Morning"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Undo: CeraVe moisturising cream, Morning" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "Mark taken: CeraVe moisturising cream, Bedtime" })).toBeTruthy();
  });
});

describe("adjusting one use", () => {
  it("changes today's dose without touching the plan", async () => {
    const { kv } = await mountApp();
    fireEvent.click(row("Mark taken: Vitamin D3, Morning"));
    await waitFor(() => expect(screen.getByText(/1 of \d+ done/)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Adjust Vitamin D3, Morning" }));
    const dialog = await screen.findByRole("dialog");
    const dose = within(dialog).getByDisplayValue("2000 IU");
    fireEvent.change(dose, { target: { value: "1000 IU" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Save changes/ }));

    const db = await saved(kv, (d) => d.routine.some((r: any) => r.dose === "1000 IU"));
    // The item — the plan for every day after this one — is untouched.
    expect(db.routineItems.find((i: any) => i.name === "Vitamin D3").dose).toBe("2000 IU");
  });

  it("records a deliberate skip as a skip, not as an empty box", async () => {
    const { kv } = await mountApp();
    fireEvent.click(screen.getByRole("button", { name: "Adjust Vitamin D3, Morning" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Mark as skipped/ }));

    const db = await saved(kv, (d) =>
      d.routine.some((r: any) => r.skipped && r.name === "Vitamin D3" && r.date === today()));
    expect(db.routine.find((r: any) => r.skipped && r.name === "Vitamin D3").slot).toBe("morning");
    await waitFor(() => expect(screen.getByText(/1 skipped/)).toBeTruthy());
  });
});

describe("setting a routine up", () => {
  it("invites the user in when there is nothing there yet", async () => {
    await mountApp((db) => ({ ...db, routineItems: [], routine: [] }));
    expect(await screen.findByText(/Meds, supplements, creams, products/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage your routine" })).toBeTruthy();
  });

  it("adds an item from the routine screen and asks for it on the dashboard", async () => {
    const { kv } = await mountApp((db) => ({ ...db, routineItems: [], routine: [] }));
    fireEvent.click(screen.getByRole("button", { name: "Manage your routine" }));

    fireEvent.click(await screen.findByRole("button", { name: /Add your first item/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText(/Vitamin D, CeraVe/), {
      target: { value: "Magnesium" },
    });
    fireEvent.change(within(dialog).getByPlaceholderText(/e\.g\./), { target: { value: "400 mg" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Bedtime" }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Add it/ }));

    const db = await saved(kv, (d) => d.routineItems.length === 1);
    expect(db.routineItems[0]).toMatchObject({ name: "Magnesium", dose: "400 mg", times: ["bed"], daily: true });

    // And it is asking to be ticked, on the screen the user starts every day on.
    fireEvent.click(within(document.querySelector("nav")!).getByRole("button", { name: "Today" }));
    expect(await screen.findByRole("button", { name: "Mark taken: Magnesium, Bedtime" })).toBeTruthy();
  });

  it("keeps what a day already said after the item behind it is deleted", async () => {
    const { kv } = await mountApp();
    fireEvent.click(row("Mark taken: Vitamin D3, Morning"));
    await waitFor(() => expect(screen.getByText(/1 of \d+ done/)).toBeTruthy());
    await saved(kv, (d) => d.routine.some((r: any) => r.date === today()));

    fireEvent.click(screen.getByRole("button", { name: "Manage your routine" }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit Vitamin D3" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Delete this item/ }));

    const db = await saved(kv, (d) => !d.routineItems.some((i: any) => i.name === "Vitamin D3"));
    // The history is a record, not a view of the item list.
    expect(db.routine.some((r: any) => r.name === "Vitamin D3")).toBe(true);
  });
});
