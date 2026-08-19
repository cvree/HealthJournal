/* The Daily Pulse on Today: one tap writes, the saved state is true, and the
   detail that follows is an offer rather than a screen.

   The guarantee worth pinning hardest is the negative one — the card must not
   say "saved" unless the number is in the journal. */
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
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function mountToday(mutate?: (db: any) => void) {
  const db: any = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  /* The demo journal stops at yesterday, which is exactly the state this card
     is designed for: today, unrecorded. */
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

const saved = () => JSON.parse(kv.get("fhj_v1")!);
const todayEntry = () => saved().entries.find((e: any) => e.date === today());
const rung = (n: number) => screen.getByRole("button", { name: `Overall skin severity ${n} out of 10` });

beforeEach(() => cleanup());

describe("one tap", () => {
  it("writes the day's number without opening anything", async () => {
    await mountToday();
    expect(todayEntry()).toBeUndefined();

    fireEvent.click(rung(6));

    await waitFor(() => expect(todayEntry()?.answers.overall_skin_severity).toBe(6));
    // Still on Today — no screen was opened by the tap.
    expect(screen.getByRole("button", { name: "Today" })).toHaveProperty("ariaCurrent", "page");
  });

  it("says nothing is recorded until something is, and then says what", async () => {
    await mountToday();
    expect(screen.getByText(/Nothing recorded yet/)).toBeTruthy();
    expect(screen.queryByText(/saved for today/)).toBeNull();

    fireEvent.click(rung(8));
    const state = await screen.findByText(/saved for today/);
    expect(state.textContent).toMatch(/8\/10/);
    expect(state.textContent).toMatch(/a hard day/);
    expect(screen.queryByText(/Nothing recorded yet/)).toBeNull();
  });

  it("clears it again on a second tap of the same number, and stops claiming a save", async () => {
    await mountToday();
    fireEvent.click(rung(4));
    await waitFor(() => expect(todayEntry()?.answers.overall_skin_severity).toBe(4));

    fireEvent.click(rung(4));
    await waitFor(() => expect(todayEntry()?.answers.overall_skin_severity).toBeNull());
    expect(screen.getByText(/Nothing recorded yet/)).toBeTruthy();
  });
});

describe("the optional detail after it", () => {
  it("offers nothing until the day is rated", async () => {
    await mountToday();
    expect(screen.queryByText(/all optional/i)).toBeNull();
  });

  it("offers three to five follow-ups, chosen for today's score", async () => {
    await mountToday();
    fireEvent.click(rung(9));
    await screen.findByText(/all optional/i);
    const chips = document.querySelectorAll(".fhj-pulse-chip");
    expect(chips.length).toBeGreaterThanOrEqual(3);
    expect(chips.length).toBeLessThanOrEqual(5);
    // A hard day asks about the symptoms, not about sleep.
    expect(screen.getByRole("button", { name: /Itch/ })).toBeTruthy();
  });

  it("answers one inline, and drops it from the offers once answered", async () => {
    await mountToday();
    fireEvent.click(rung(7));
    await screen.findByText(/all optional/i);

    fireEvent.click(screen.getByRole("button", { name: /Itch/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Itch 5" }));

    await waitFor(() => expect(todayEntry()?.answers.itch).toBe(5));
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Itch1–10/ })).toBeNull());
  });

  it("keeps the full check-in one tap away, and never in the way", async () => {
    await mountToday();
    fireEvent.click(screen.getByRole("button", { name: /Add more detail/ }));
    expect(await screen.findByRole("heading", { name: "Today" })).toBeTruthy();
  });
});
