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
/** The question the one slot is on right now. */
const asked = () => document.querySelector(".fhj-pulse-q")?.textContent?.trim() || "";

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
    expect(screen.getByText(/One tap is a whole day logged/)).toBeTruthy();
    expect(screen.queryByText(/saved for today/)).toBeNull();

    fireEvent.click(rung(8));
    /* The answer is said back in the slot it was given in, and holds there for
       a beat before the slot turns over to the next question. */
    const state = await screen.findByText(/saved for today/);
    expect(state.textContent).toMatch(/8\/10/);
    expect(state.textContent).toMatch(/a hard day/);
    expect(screen.queryByText(/One tap is a whole day logged/)).toBeNull();
  });

  it("clears it again on a second tap of the same number, and stops claiming a save", async () => {
    await mountToday();
    /* Both taps in one tick: the confirmation holds the slot for a beat and
       then the card turns over to the next question, and that beat is short
       on purpose — a morning is twenty of them. Correcting a number after the
       card has moved on is what Back is for, and it is tested below. */
    fireEvent.click(rung(4));
    fireEvent.click(rung(4));

    await waitFor(() => expect(todayEntry()?.answers.overall_skin_severity).toBeNull());
    expect(screen.getByText(/One tap is a whole day logged/)).toBeTruthy();
  });
});

describe("the optional detail after it", () => {
  it("offers nothing until the day is rated", async () => {
    await mountToday();
    expect(document.querySelectorAll(".fhj-pulse-chip")).toHaveLength(0);
  });

  it("keeps the chips for the things a question cannot be, and asks the questions itself", async () => {
    await mountToday();
    fireEvent.click(rung(9));
    await waitFor(() => expect(document.querySelectorAll(".fhj-pulse-chip").length).toBeGreaterThan(0));
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
    expect(line()).toMatch(/^\d+ to answer, about (a|two|three|four|five|six|seven|eight|nine|ten) minutes?\.$/);
    expect(card().querySelector(".fhj-ring-mid")!.textContent).toBe("0");
  });

  /* The estimate is arithmetic, not decoration. The sample journal here is a
     pack, a routine and two rituals — 33 things — and the card used to offer
     all of it as "about a minute", which is one and four fifths of a second
     each. A first promise this screen cannot keep is worse than no promise. */
  it("scales the time estimate to what the day actually asks for", async () => {
    await mountToday();
    expect(line()).toBe("33 to answer, about two minutes.");
  });

  /* One denominator for the day, on the whole screen.

     The count in the pulse card's corner used to read the *questions* in the
     template while the card below it read the questions plus the doses plus
     the rituals — so this journal opened saying "0 of 27" at the top of one
     card and "33 to answer" at the foot of it. lib/checkin exists to stop two
     screens disagreeing about somebody's day; it was being contradicted inside
     one of them. */
  it("says one size for today, wherever on the screen it is said", async () => {
    await mountToday();
    const corner = document.querySelector(".fhj-next-count")!.textContent!.trim();
    expect(corner).toBe("0 of 33");
    expect(line()).toMatch(/^33 to answer/);

    fireEvent.click(rung(5));
    await waitFor(() => expect(line()).toMatch(/to go\.$/));
    expect(document.querySelector(".fhj-next-count")!.textContent!.trim()).toBe("1 of 33");
    expect(card().querySelector(".fhj-ring-mid")!.textContent).toBe("1");
  });

  it("counts the one tap on the pulse, immediately", async () => {
    await mountToday();
    const before = line();
    fireEvent.click(rung(5));
    await waitFor(() => expect(line()).not.toBe(before));
    expect(line()).toMatch(/^\d+ to go\.$/);
    expect(card().querySelector(".fhj-ring-mid")!.textContent).toBe("1");
  });

  it("moves again for a question answered in the queue, without opening a form", async () => {
    await mountToday();
    fireEvent.click(rung(5));
    await waitFor(() => expect(line()).toMatch(/to go\.$/));
    const marks = filledPips();

    /* The slot has turned over to the next question by now — same place, same
       size, and answerable without a form opening. */
    await waitFor(() => expect(asked()).not.toBe("Overall skin severity"));
    const rungs = document.querySelectorAll<HTMLButtonElement>(".fhj-pulse-stage .fhj-scale-rung");
    expect(rungs.length).toBeGreaterThan(0);
    fireEvent.click(rungs[3]);

    await waitFor(() => expect(line()).toMatch(/to go\.$/));
    expect(filledPips()).toBe(marks + 1);
    // Still on Today. Nothing was opened to make that number move.
    expect(screen.getByRole("button", { name: "Today" })).toHaveProperty("ariaCurrent", "page");
  });

  it("goes back down when an answer is cleared — the marks read the journal", async () => {
    await mountToday();
    fireEvent.click(rung(5));
    await waitFor(() => expect(line()).toMatch(/to go\.$/));
    fireEvent.click(rung(5));
    await waitFor(() => expect(todayEntry()?.answers.overall_skin_severity).toBeNull());
    expect(line()).toMatch(/^\d+ to answer, about .+\.$/);
  });
});

/* The queue, in the one slot at the top of the card.

   This is the change worth pinning hardest. There is no second card: the
   question the day is on takes the top of the pulse card, and answering it
   turns that same slot over to the next one. Two questions are never on the
   screen at once, and nothing appears underneath the thing somebody just
   answered.

   The rules: the answer is said back before the slot turns over, it never
   advances out from under a half-typed answer, it is always leaveable, and
   Back walks out the way it came — all the way to the number, which is how
   "tap it again to clear" is still true five questions later. */
describe("one question, in one place", () => {
  it("asks the day's number first, in the slot, and nothing else beside it", async () => {
    await mountToday();
    expect(asked()).toBe("Overall skin severity");
    // The second card is gone: one slot, one question.
    expect(document.querySelectorAll(".fhj-pulse-q").length).toBe(1);
    expect(document.querySelector(".fhj-next")).toBeNull();
  });

  it("turns the slot over to the next question once the number is answered", async () => {
    await mountToday();
    fireEvent.click(rung(9));

    /* First the answer, said back where it was given. */
    await screen.findByText(/saved for today/);
    expect(asked()).toBe("Overall skin severity");

    /* Then the slot turns over — in place, still one question on screen. */
    await waitFor(() => expect(asked()).not.toBe("Overall skin severity"), { timeout: 4000 });
    expect(asked().length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".fhj-pulse-q").length).toBe(1);
  });

  it("counts the pulse itself as answered, so the progress never lies about what just happened", async () => {
    await mountToday();
    fireEvent.click(rung(5));
    const count = document.querySelector(".fhj-next-count")!;
    await waitFor(() => expect(count.textContent).toMatch(/^\d+ of \d+$/));
    const [answered, total] = (count.textContent || "").match(/\d+/g)!.map(Number);
    expect(answered).toBeGreaterThanOrEqual(1);
    expect(total).toBeGreaterThan(answered);
  });

  it("hands straight over to the next question when one tap finished the last one", async () => {
    await mountToday();
    fireEvent.click(rung(8));
    await waitFor(() => expect(asked()).not.toBe("Overall skin severity"), { timeout: 4000 });

    const first = asked();
    const tap = [...document.querySelectorAll<HTMLButtonElement>(".fhj-pulse-stage button")]
      .find((b) => /\b5$/.test(b.getAttribute("aria-label") || ""));
    expect(tap).toBeTruthy();
    fireEvent.click(tap!);

    await waitFor(() => expect(asked()).not.toBe(first), { timeout: 4000 });
    // and the answer it moved on from is in the journal, not just off the screen
    await waitFor(() => expect(
      Object.values(todayEntry()?.answers || {}).filter((v) => v === 5).length
    ).toBeGreaterThanOrEqual(1));
  });

  it("skips one without answering it, and does not come back to it in this sitting", async () => {
    await mountToday();
    fireEvent.click(rung(6));
    await waitFor(() => expect(asked()).not.toBe("Overall skin severity"), { timeout: 4000 });

    const first = asked();
    fireEvent.click(screen.getByRole("button", { name: /Skip this question/ }));
    await waitFor(() => expect(asked()).not.toBe(first), { timeout: 4000 });
    expect(asked()).not.toBe(first);
  });

  it("walks back out the way it came, all the way to the number", async () => {
    await mountToday();
    fireEvent.click(rung(6));
    await waitFor(() => expect(asked()).not.toBe("Overall skin severity"), { timeout: 4000 });

    fireEvent.click(screen.getByRole("button", { name: /Back to the previous question/ }));
    await waitFor(() => expect(asked()).toBe("Overall skin severity"), { timeout: 4000 });
    // And it is still clearable from there, which is the point of going back.
    expect(screen.getByText(/Tap it again to clear/)).toBeTruthy();
  });

  it("closes for the sitting when somebody says they are done", async () => {
    await mountToday();
    fireEvent.click(rung(6));
    await waitFor(() => expect(asked()).not.toBe("Overall skin severity"), { timeout: 4000 });

    fireEvent.click(screen.getByRole("button", { name: /Stop asking for now/ }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Stop asking for now/ })).toBeNull());
    // The slot falls back to the number, untouched by leaving the queue.
    expect(asked()).toBe("Overall skin severity");
    await waitFor(() => expect(todayEntry()?.answers.overall_skin_severity).toBe(6));
  });
});
