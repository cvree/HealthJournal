/* The day closing.

   Finishing today's check-in is the moment this whole app exists to produce,
   and for a long time it was drawn at the weight of a checkbox: the ring swapped
   a numeral for a tick and the sentence under it changed. Nothing marked it.

   What it gets now is a seal — a moment (see sealDay in lib/motion), and a
   thing the finished card is left holding: the fortnight behind today, with
   today's mark solid on the end of it.

   These tests pin the two halves that are easy to get wrong. The moment must
   be a *transition*, fired once, by the answer that closed the day — never by
   arriving on a day that was already finished, which would make the receipt
   worthless. And the row of days must never turn into a scoreboard: no red,
   no count of what was missed, no praise. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const seals: unknown[] = [];
vi.mock("../src/lib/motion", async (orig) => {
  const actual = await orig<typeof import("../src/lib/motion")>();
  return { ...actual, sealDay: (el: HTMLElement | null) => { seals.push(el); return actual.sealDay(el); } };
});

const sounded: string[] = [];
vi.mock("../src/lib/feedback", async (orig) => {
  const actual = await orig<typeof import("../src/lib/feedback")>();
  return {
    ...actual,
    feedback: (e: string, o?: any) => { sounded.push(e); return actual.feedback(e as any, o); },
  };
});

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
const shift = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** A journal whose whole daily ask is the one number on the front of the card:
    every other question off, no routine, no rituals. One tap closes the day,
    which is what makes the transition testable at all. */
function oneQuestion(db: any) {
  const tpl = I.getProfileTemplate(db.profile);
  /* Union, never replacement: the sample journal already has fields switched
     off, and handing back only the enabled ones would switch those back on. */
  db.profile.disabledFields = [...new Set([
    ...(db.profile.disabledFields || []),
    ...tpl.fields.map((f: any) => f.k).filter((k: string) => k !== tpl.keyMetric),
  ])];
  db.routineItems = [];
  db.routine = [];
  db.rituals = [];
  db.ritualRuns = [];
}

async function mountToday(mutate?: (db: any) => void) {
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

const rung = (n: number) => screen.getByRole("button", { name: `Overall skin severity ${n} out of 10` });
const strip = () => document.querySelector(".fhj-record-strip");
const pips = () => document.querySelector(".fhj-checkin-pips");

beforeEach(() => { cleanup(); seals.length = 0; sounded.length = 0; });

describe("the moment", () => {
  it("fires once, on the answer that closes the day", async () => {
    await mountToday(oneQuestion);
    expect(seals).toHaveLength(0);

    fireEvent.click(rung(5));

    await waitFor(() => expect(seals).toHaveLength(1), { timeout: 3000 });
    expect(seals[0]).toBeTruthy();
    expect(sounded).toContain("complete");
  });

  /* The one thing that would make it worthless. A receipt is issued when the
     thing happens; an app that plays the day's closing every time somebody
     opens it after dinner has taught them to ignore it by Thursday. */
  it("stays silent on a day that was already finished before you arrived", async () => {
    await mountToday((db) => {
      oneQuestion(db);
      db.entries.push({
        id: "e_today", profileId: db.profile.id, date: today(),
        answers: { overall_skin_severity: 4 }, notes: "", photos: {},
        quickLogCompleted: true, detailedLogCompleted: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });
    /* The card is already finished — the row of days is the proof of it. */
    await waitFor(() => expect(strip()).toBeTruthy());
    await new Promise((r) => setTimeout(r, 400));
    expect(seals).toHaveLength(0);
    expect(sounded).not.toContain("complete");
  });

  /* Clearing the number re-opens the day. Answering it again is a second
     closing of the same day, and it is a real one — the card genuinely went
     back to asking in between. */
  it("fires again if the day is re-opened and closed a second time", async () => {
    await mountToday(oneQuestion);
    fireEvent.click(rung(5));
    await waitFor(() => expect(seals).toHaveLength(1), { timeout: 3000 });

    fireEvent.click(rung(5));           // same rung again clears it
    await waitFor(() => expect(pips()).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(rung(7));
    await waitFor(() => expect(seals).toHaveLength(2), { timeout: 3000 });
  });
});

describe("what the finished card is left holding", () => {
  it("swaps today's questions for the days behind today", async () => {
    await mountToday(oneQuestion);
    expect(pips()).toBeTruthy();
    expect(strip()).toBeNull();

    fireEvent.click(rung(5));

    await waitFor(() => expect(strip()).toBeTruthy(), { timeout: 3000 });
    /* One row of marks, not two. A row of identical solid pips beside a row of
       days is the card saying the same shape twice. */
    expect(pips()).toBeNull();
  });

  it("says the row in words, as a fact about the journal", async () => {
    await mountToday(oneQuestion);
    fireEvent.click(rung(5));
    const row = await waitFor(() => {
      const el = strip();
      if (!el) throw new Error("no strip yet");
      return el;
    }, { timeout: 3000 });
    const label = row.getAttribute("aria-label") || "";
    expect(label).toMatch(/of the last 14 days are on the record\.$/);
    expect(label).not.toMatch(/missed|streak|well done|keep it up/i);
  });

  it("marks the days the journal actually holds, and today among them", async () => {
    await mountToday((db) => {
      oneQuestion(db);
      /* A journal with a gap in it. The gap is drawn, and drawn as nothing —
         see the rule in lib/checkin. */
      db.entries = db.entries.filter((e: any) => e.date === shift(-1) || e.date === shift(-3));
    });
    fireEvent.click(rung(5));

    await waitFor(() => expect(strip()).toBeTruthy(), { timeout: 3000 });
    const marks = Array.from(document.querySelectorAll(".fhj-record-mark"));
    expect(marks).toHaveLength(14);
    expect(marks.filter((m) => m.classList.contains("is-on"))).toHaveLength(3);
    const last = marks[marks.length - 1];
    expect(last.classList.contains("is-today")).toBe(true);
    expect(last.classList.contains("is-on")).toBe(true);
  });
});
