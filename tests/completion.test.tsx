/* The completion screen, and the promise it makes.

   Finishing a check-in where every question was skipped used to end in
   confetti, a streak count and a save chime — the app congratulating somebody
   for a blank day, and teaching them that the number on the front of it is not
   to be trusted. These tests are the guardrail on that: the celebration is
   earned by a value in the journal, and by nothing else. */
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
const saved = () => JSON.parse(kv.get("fhj_v1")!);
const todayEntry = () => saved().entries.find((e: any) => e.date === today());

/** Open today's Quick Log with nothing recorded yet. */
async function mountQuickLog() {
  const db: any = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  kv = new Map([["fhj_v1", JSON.stringify(db)]]);
  (window as any).storage = {
    async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
    async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
    async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
    async list() { return { keys: [...kv.keys()] }; },
  };
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /Add more detail/ }, { timeout: 10000 }));
  await screen.findByRole("button", { name: "Skip" }, { timeout: 10000 });
}

/** Skip every batch, then finish. */
async function skipEverything() {
  for (let i = 0; i < 30; i++) {
    const skip = screen.queryByRole("button", { name: "Skip" });
    if (!skip) break;
    fireEvent.click(skip);
  }
  fireEvent.click(await screen.findByRole("button", { name: /Finish Quick Log/ }));
}

beforeEach(() => cleanup());

describe("when every question was skipped", () => {
  it("says nothing was logged, and does not celebrate", async () => {
    await mountQuickLog();
    await skipEverything();

    expect(await screen.findByText("Nothing logged yet")).toBeTruthy();
    expect(screen.queryByText("day streak")).toBeNull();
    expect(document.querySelector(".fhj-confetti")).toBeNull();
  });

  it("does not put a blank day on the record at all", async () => {
    await mountQuickLog();
    await skipEverything();
    await screen.findByText("Nothing logged yet");
    // No entry, so no calendar dot, no streak day, no export row.
    expect(todayEntry()).toBeUndefined();
  });

  it("offers the way back, and one tap that makes it untrue", async () => {
    await mountQuickLog();
    await skipEverything();
    await screen.findByText("Nothing logged yet");

    expect(screen.getByRole("button", { name: "Back to the questions" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 5 out of 10/ }));

    await waitFor(() => expect(todayEntry()?.answers.overall_skin_severity).toBe(5));
    // Having become true, the celebration is now the honest screen.
    expect(await screen.findByText("day streak")).toBeTruthy();
  });

  it("offers no Undo — there is nothing to undo", async () => {
    await mountQuickLog();
    await skipEverything();
    await screen.findByText("Nothing logged yet");
    expect(screen.queryByRole("button", { name: /undo/i })).toBeNull();
  });
});

describe("skipping is not erasing", () => {
  it("leaves an answer already given alone when the batch is skipped", async () => {
    await mountQuickLog();
    fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));
    fireEvent.click(await screen.findByRole("button", { name: /Overall skin severity 7 out of 10/ }));
    await waitFor(() => expect(todayEntry()?.answers.overall_skin_severity).toBe(7));

    fireEvent.click(await screen.findByRole("button", { name: /Add more detail/ }));
    await screen.findByRole("button", { name: "Skip" });
    await skipEverything();

    // The survey's Skip means "don't ask me these", not "delete that".
    expect(todayEntry()?.answers.overall_skin_severity).toBe(7);
  });
});

describe("when something was written", () => {
  it("celebrates, once, on the strength of the value", async () => {
    await mountQuickLog();
    // Recorded on Today with one tap, before the survey was even opened.
    fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));
    fireEvent.click(await screen.findByRole("button", { name: /Overall skin severity 6 out of 10/ }));
    await waitFor(() => expect(todayEntry()?.answers.overall_skin_severity).toBe(6));
    fireEvent.click(await screen.findByRole("button", { name: /Add more detail/ }));
    await screen.findByRole("button", { name: "Skip" });
    await skipEverything();

    expect(await screen.findByText("day streak")).toBeTruthy();
    expect(screen.queryByText("Nothing logged yet")).toBeNull();
  });

  it("counts a note as something written, because it is", async () => {
    await mountQuickLog();
    await skipEverything();
    await screen.findByText("Nothing logged yet");
    fireEvent.click(screen.getByRole("button", { name: "Back to the questions" }));

    // Reach the review step and write a note there.
    for (let i = 0; i < 30; i++) {
      const skip = screen.queryByRole("button", { name: "Skip" });
      if (!skip) break;
      fireEvent.click(skip);
    }
    fireEvent.click(await screen.findByRole("button", { name: /Add a note/ }));
    fireEvent.change(screen.getByPlaceholderText(/Anything worth remembering/), {
      target: { value: "Quiet day, nothing to report." },
    });
    await waitFor(() => expect(todayEntry()?.notes).toBe("Quiet day, nothing to report."));

    fireEvent.click(screen.getByRole("button", { name: /Finish Quick Log/ }));
    expect(await screen.findByText("day streak")).toBeTruthy();
  });
});
