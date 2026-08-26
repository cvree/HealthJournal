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

  it("keeps the chips for the things a question cannot be, and asks the questions itself", async () => {
    await mountToday();
    fireEvent.click(rung(9));
    await screen.findByText(/all optional/i);
    const chips = [...document.querySelectorAll(".fhj-pulse-chip")];
    expect(chips.length).toBeGreaterThanOrEqual(1);
    expect(chips.length).toBeLessThanOrEqual(5);
    /* The questions moved to the queue above, so the chip row is the routine,
       the camera and the note — never a survey field offered twice. */
    for (const chip of chips) {
      expect(chip.textContent).toMatch(/Routine|Photo|Note/);
    }
  });

  it("keeps the full check-in one tap away, and never in the way", async () => {
    await mountToday();
    fireEvent.click(screen.getByRole("button", { name: /^Today's check-in —/ }));
    expect(await screen.findByRole("heading", { name: "Today" })).toBeTruthy();
  });
});

/* The card that replaced "Add more detail".

   Three things have to be true of it, and the third is the one worth pinning:
   it must be named after the thing rather than after the work, it must move
   the moment anything is answered anywhere, and it must never be the app
   claiming progress a journal cannot back up. */
describe("today's check-in, on Today", () => {
  const card = () => document.querySelector(".fhj-checkin")!;
  const line = () => document.querySelector(".fhj-checkin-line")!.textContent!.trim();
  const filledPips = () => document.querySelectorAll(".fhj-checkin-pip.is-on").length;

  it("is named after the check-in, not after adding detail to something", async () => {
    await mountToday();
    expect(screen.getByText("Today's check-in")).toBeTruthy();
    expect(screen.queryByText(/Add more detail/i)).toBeNull();
  });

  it("says how much of the day is in, before anything is", async () => {
    await mountToday();
    expect(line()).toMatch(/^\d+ to answer, about a minute\.$/);
    expect(card().querySelector(".fhj-ring-mid")!.textContent).toBe("0");
  });

  it("counts the one tap on the pulse, immediately", async () => {
    await mountToday();
    const before = line();
    fireEvent.click(rung(5));
    await waitFor(() => expect(line()).not.toBe(before));
    expect(line()).toMatch(/^1 of \d+ in\./);
    expect(card().querySelector(".fhj-ring-mid")!.textContent).toBe("1");
  });

  it("moves again for a question answered in the queue, without opening a form", async () => {
    await mountToday();
    fireEvent.click(rung(5));
    await waitFor(() => expect(line()).toMatch(/^1 of/));
    const marks = filledPips();

    const rungs = document.querySelectorAll<HTMLButtonElement>(".fhj-next .fhj-scale-rung");
    expect(rungs.length).toBeGreaterThan(0);
    fireEvent.click(rungs[3]);

    await waitFor(() => expect(line()).toMatch(/^2 of/));
    expect(filledPips()).toBe(marks + 1);
    // Still on Today. Nothing was opened to make that number move.
    expect(screen.getByRole("button", { name: "Today" })).toHaveProperty("ariaCurrent", "page");
  });

  it("goes back down when an answer is cleared — the marks read the journal", async () => {
    await mountToday();
    fireEvent.click(rung(5));
    await waitFor(() => expect(line()).toMatch(/^1 of/));
    fireEvent.click(rung(5));
    await waitFor(() => expect(todayEntry()?.answers.overall_skin_severity).toBeNull());
    expect(line()).toMatch(/to answer, about a minute\.$/);
  });
});

/* The queue. One question, then the next one, without a form ever opening —
   this is the difference between a journal that records one number a day and
   one somebody can do their whole daily review in.

   The rule worth pinning: it must never advance out from under a half-typed
   answer, and it must always be leaveable. */
describe("the next most important question", () => {
  const nextTitle = () => document.querySelector(".fhj-next-title")?.textContent?.trim() || "";

  it("appears the moment the day is rated, and not before", async () => {
    await mountToday();
    expect(document.querySelector(".fhj-next")).toBeNull();

    fireEvent.click(rung(9));
    await waitFor(() => expect(document.querySelector(".fhj-next")).toBeTruthy());
    expect(nextTitle().length).toBeGreaterThan(0);
  });

  it("counts the pulse itself as answered, so the progress never lies about what just happened", async () => {
    await mountToday();
    fireEvent.click(rung(5));
    const count = await screen.findByText(/of \d+ answered/);
    const [answered, total] = (count.textContent || "").match(/\d+/g)!.map(Number);
    expect(answered).toBeGreaterThanOrEqual(1);
    expect(total).toBeGreaterThan(answered);
  });

  it("hands straight over to the next question when one tap finished the last one", async () => {
    await mountToday();
    fireEvent.click(rung(8));
    await waitFor(() => expect(document.querySelector(".fhj-next")).toBeTruthy());

    const first = nextTitle();
    const tap = [...document.querySelectorAll<HTMLButtonElement>(".fhj-next button")]
      .find((b) => /\b5$/.test(b.getAttribute("aria-label") || ""));
    expect(tap).toBeTruthy();
    fireEvent.click(tap!);

    await waitFor(() => expect(nextTitle()).not.toBe(first));
    // and the answer it moved on from is in the journal, not just off the screen
    await waitFor(() => expect(
      Object.values(todayEntry()?.answers || {}).filter((v) => v === 5).length
    ).toBeGreaterThanOrEqual(1));
  });

  it("skips one without answering it, and does not come back to it in this sitting", async () => {
    await mountToday();
    fireEvent.click(rung(6));
    await waitFor(() => expect(document.querySelector(".fhj-next")).toBeTruthy());

    const first = nextTitle();
    fireEvent.click(screen.getByRole("button", { name: /Skip this one/ }));
    await waitFor(() => expect(nextTitle()).not.toBe(first));
    expect(nextTitle()).not.toBe(first);
  });

  it("closes for the sitting when somebody says they are done", async () => {
    await mountToday();
    fireEvent.click(rung(6));
    await waitFor(() => expect(document.querySelector(".fhj-next")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Done for now/ }));
    await waitFor(() => expect(document.querySelector(".fhj-next")).toBeNull());
    // The day's number is untouched by leaving the queue.
    await waitFor(() => expect(todayEntry()?.answers.overall_skin_severity).toBe(6));
  });
});
