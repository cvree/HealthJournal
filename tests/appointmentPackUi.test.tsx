/* The Appointment Pack, end to end through the app.

   What these pin down is the part of the feature that is a *promise* rather
   than a calculation: that the pack is the first thing on Export and not the
   fourth, that one tap on a range produces a printable page, that the sections
   somebody switches off stay off, and that the questions they wrote down are
   still there the next time they open it — which is the entire reason those
   questions live on the profile instead of in screen state. */
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
  window.print = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.confirm = () => true;
});

let kv: Map<string, string>;

async function mountExport(mutate?: (db: any) => void) {
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
  fireEvent.click(await screen.findByRole("button", { name: /Export data/i }, { timeout: 10000 }));
  await screen.findByRole("heading", { name: "Prepare an Appointment Pack" }, { timeout: 10000 });
  return db;
}

const openPack = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Prepare the pack" }));
  return screen.findByText("Appointment pack", {}, { timeout: 10000 });
};

/** What the journal on disk says, after a write. */
const saved = () => JSON.parse(kv.get("fhj_v1")!);
const savedPrefs = () => saved().profile.appointment;

beforeEach(() => cleanup());

describe("where it sits on Export", () => {
  it("is the first thing on the screen, above every file format", async () => {
    await mountExport();
    const pack = screen.getByRole("heading", { name: "Prepare an Appointment Pack" });
    for (const label of ["Download CSV", "Download Excel (.xlsx)", "Download JSON (data only)"]) {
      const btn = screen.getByRole("button", { name: new RegExp(label.replace(/[().]/g, "\\$&")) });
      expect(pack.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("says what the pack would rest on before anybody commits to making one", async () => {
    await mountExport();
    expect(screen.getByText(/of 30 days \(\d+%\)/)).toBeTruthy();
  });

  it("offers 'since my last appointment' only once there is a date to go from", async () => {
    await mountExport();
    const chip = screen.getByRole("button", { name: /Since my last appointment/ });
    expect((chip as HTMLButtonElement).disabled).toBe(true);

    const field = screen.getByLabelText("Date of my last appointment") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "2026-08-01" } });
    await waitFor(() => expect(savedPrefs().lastAppointment).toBe("2026-08-01"));
    expect((screen.getByRole("button", { name: /Since my last appointment/ }) as HTMLButtonElement).disabled)
      .toBe(false);
  });
});

describe("the pack itself", () => {
  it("is one tap away, and prints the sections in consultation order", async () => {
    await mountExport();
    await openPack();
    const heads = [...document.querySelectorAll("h2.fhj-pack-head")].map((n) => n.textContent);
    expect(heads).toEqual([
      "How it's been", "Best, hardest, usual", "Biggest changes", "Routine",
      "Notes", "Questions for my appointment",
    ]);
  });

  it("carries the average with the coverage behind it, never on its own", async () => {
    await mountExport();
    await openPack();
    const figure = screen.getByText("How it's been").closest("section")!;
    expect(within(figure).getByText(/of 30 days \(\d+%\)/)).toBeTruthy();
    expect(within(figure).getByText("Days logged")).toBeTruthy();
  });

  it("prints Print / PDF rather than pretending to make a file itself", async () => {
    await mountExport();
    await openPack();
    fireEvent.click(screen.getByRole("button", { name: "Print / PDF" }));
    expect(window.print).toHaveBeenCalled();
  });

  it("keeps the app's own chrome off the paper", async () => {
    await mountExport();
    await openPack();
    // The controls are marked no-print; the pack itself is the print area.
    expect(document.querySelector(".fhj-pack.print-area")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Print / PDF" }).closest(".no-print")).toBeTruthy();
  });
});

describe("choosing what appears", () => {
  it("switches a section off, and remembers it", async () => {
    await mountExport();
    await openPack();
    fireEvent.click(screen.getByRole("button", { name: /Choose what's in it/ }));
    fireEvent.click(screen.getByRole("switch", { name: /Best, hardest, usual/ }));

    await waitFor(() => expect(savedPrefs().sections.scores).toBe(false));
    expect(screen.queryByRole("heading", { name: "Best, hardest, usual" })).toBeNull();
  });

  it("explains a section that is on but has nothing to say", async () => {
    await mountExport(() => {});
    await openPack();
    fireEvent.click(screen.getByRole("button", { name: /Choose what's in it/ }));
    // The demo journal has no flares marked, so the switch is on and the row
    // says why nothing prints, instead of the pack quietly dropping it.
    expect(screen.getByText(/No flares marked in this range/)).toBeTruthy();
  });
});

describe("the questions", () => {
  it("takes one, prints it, and still has it after a reload", async () => {
    await mountExport();
    await openPack();
    fireEvent.change(screen.getByLabelText("Add a question for your appointment"),
      { target: { value: "Should I stay on this cream?" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(savedPrefs().questions).toEqual(["Should I stay on this cream?"]));
    expect(screen.getByText("Should I stay on this cream?")).toBeTruthy();

    // Same journal, opened fresh: the question is still in the pack.
    cleanup();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "History" }, { timeout: 10000 }));
  fireEvent.click(await screen.findByRole("button", { name: /^Insights/ }, { timeout: 10000 }));
    fireEvent.click(await screen.findByRole("button", { name: /Export data/i }, { timeout: 10000 }));
    await openPack();
    expect(screen.getByText("Should I stay on this cream?")).toBeTruthy();
  });

  it("offers starters only while the list is empty, and takes one on a tap", async () => {
    await mountExport();
    await openPack();
    const starter = screen.getByRole("button", { name: /What should I do when a flare starts/ });
    fireEvent.click(starter);
    await waitFor(() => expect(savedPrefs().questions).toEqual(["What should I do when a flare starts?"]));
    expect(screen.queryByRole("button", { name: /\+ Is this the right treatment/ })).toBeNull();
  });

  it("removes one again", async () => {
    await mountExport((db) => {
      db.profile.appointment = { questions: ["Drop me"], sections: {}, noteDates: [] };
    });
    await openPack();
    fireEvent.click(screen.getByRole("button", { name: "Remove question: Drop me" }));
    await waitFor(() => expect(savedPrefs().questions).toEqual([]));
  });
});

describe("after the appointment", () => {
  it("marks today, so the next pack covers exactly the time since this visit", async () => {
    await mountExport();
    await openPack();
    fireEvent.click(screen.getByRole("button", { name: "My appointment was today" }));
    const today = new Date();
    const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    await waitFor(() => expect(savedPrefs().lastAppointment).toBe(stamp));
    expect(screen.getByRole("button", { name: "Today is marked" })).toBeTruthy();
  });
});

describe("notes", () => {
  it("prints only what was ticked, and ticks nothing on its own", async () => {
    await mountExport();
    await openPack();
    const section = screen.getByText("Notes").closest("section")!;
    expect(within(section).getByText(/nothing is chosen for you/i)).toBeTruthy();

    fireEvent.click(within(section).getByRole("button", { name: "Choose notes" }));
    const rows = screen.getAllByRole("button", { name: /^Include the note from / });
    expect(rows.length).toBeGreaterThan(0);
    fireEvent.click(rows[0]);
    await waitFor(() => expect(savedPrefs().noteDates.length).toBe(1));
  });
});
