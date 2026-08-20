/* The first two minutes.

   Six acts, and two of them are new: the screen where somebody shapes the
   questions they will be asked every day, and the screen where they say what
   else the journal should keep. What these tests protect is the shape of that
   flow — that it is one path with no "set everything up in detail" door beside
   it, that every screen after the first arrives already answered so Continue
   is never blocked on work, that what somebody chooses on the shaping screens
   actually reaches the journal they end up with, and that the last act still
   turns their own first entry into the first card on a timeline.

   Motion is not asserted here (jsdom has no layout, and every helper is a
   no-op under reduced motion, which these tests run with). What is asserted is
   that the flow still completes with the motion switched off — which is the
   guarantee that actually matters to somebody who has it switched off. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

beforeAll(() => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = ((q: string) => ({
    matches: q.includes("reduce"), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  } as any)) as any;
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

let kv: Map<string, string>;

async function mountFresh() {
  kv = new Map();
  (window as any).storage = {
    async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
    async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
    async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
    async list() { return { keys: [...kv.keys()] }; },
  };
  const { default: App } = await import("../src/App");
  render(React.createElement(App));
  await screen.findByRole("button", { name: /Start my journal/i }, { timeout: 10000 });
}

const saved = () => JSON.parse(kv.get("fhj_v1")!);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const tap = (re: RegExp) =>
  fireEvent.click(screen.getAllByRole("button").find((b) => re.test(b.textContent || ""))!);
/** Buttons whose trimmed label matches exactly — "Continue" must not also find
    "Continue to photos". */
const exact = (label: string) =>
  screen.getAllByRole("button").find((b) => (b.textContent || "").trim() === label);

/** Hero → pick a pack → the question-shaping screen. */
async function toTune() {
  tap(/Start my journal/i);
  await screen.findByText(/What are you tracking\?/i);
  tap(/Eczema/);
  fireEvent.click(exact("Continue")!);
  await screen.findByText(/What should it ask you\?/i);
}

/** …and on to what else the journal should keep. */
async function toExtras() {
  await toTune();
  fireEvent.click(exact("Continue")!);
  await screen.findByText(/What else should it keep\?/i);
}

/** …and on to the entry itself. */
async function toEntry() {
  await toExtras();
  fireEvent.click(exact("Continue")!);
  await screen.findByText(/How is your skin today\?/i);
}

const countOnScreen = () =>
  Number((document.querySelector(".fhj-fr-cost-num")?.textContent || "0").trim());

beforeEach(() => { cleanup(); localStorage.clear(); });

describe("the hero", () => {
  it("leads with the promise and one way in", async () => {
    await mountFresh();
    expect(screen.getByText("Your health,")).toBeTruthy();
    expect(screen.getByText("remembered.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start my journal/i })).toBeTruthy();
  });

  it("says what the app is and is not, before anything is tapped", async () => {
    await mountFresh();
    const fine = screen.getByRole("button", { name: /stays on this device/i });
    expect(fine.textContent).toMatch(/no account/i);
    expect(fine.textContent).toMatch(/not medical advice/i);
    // ...and the whole disclaimer is one tap away, not buried in a settings screen.
    fireEvent.click(fine);
    expect(await screen.findByText(/does not diagnose, treat, cure/i)).toBeTruthy();
  });

  it("lists the checkable facts about the build, not a privacy paragraph", async () => {
    await mountFresh();
    fireEvent.click(screen.getByRole("button", { name: /stays on this device/i }));
    const text = await waitFor(() => {
      const t = document.body.textContent || "";
      expect(t).toMatch(/no sign-up/i);
      return t;
    });
    expect(text).toMatch(/no server holding it/i);
    expect(text).toMatch(/no analytics|no trackers/i);
    expect(text).toMatch(/export the whole thing/i);
    expect(text).toMatch(/delete everything/i);
  });

  it("keeps the way in for somebody who just wants a look", async () => {
    await mountFresh();
    tap(/example data/i);
    await waitFor(() => expect(document.body.textContent).toMatch(/streak/i), { timeout: 10000 });
  });

  it("shows a journal already alive rather than explaining one", async () => {
    await mountFresh();
    // A rating, a photograph, a note, a dose, a flare, a trend: everything the
    // app records, shown rather than described.
    const collage = document.querySelector(".fhj-fr-collage")!;
    expect(collage).toBeTruthy();
    expect(collage.textContent).toMatch(/overall severity/i);
    expect(collage.textContent).toMatch(/Slept badly/i);
    expect(collage.textContent).toMatch(/CeraVe/i);
    expect(collage.textContent).toMatch(/Flare ended/i);
    expect(collage.querySelector(".fhj-fr-photo")).toBeTruthy();
  });
});

describe("one path, and no door beside it", () => {
  it("never offers a longer setup somewhere else", async () => {
    await mountFresh();
    tap(/Start my journal/i);
    await screen.findByText(/What are you tracking\?/i);
    // The escape hatch is gone on purpose: a link to a "detailed" setup is an
    // admission that the main path does not do the job.
    expect(document.body.textContent).not.toMatch(/in detail instead/i);
    tap(/Eczema/);
    fireEvent.click(exact("Continue")!);
    await screen.findByText(/What should it ask you\?/i);
    expect(document.body.textContent).not.toMatch(/in detail instead/i);
  });

  it("asks what somebody is tracking first, and will not continue without it", async () => {
    await mountFresh();
    tap(/Start my journal/i);
    await screen.findByText(/What are you tracking\?/i);
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    const cta = screen.getAllByRole("button").find((b) => /Pick what you're tracking/.test(b.textContent || ""))!;
    expect((cta as HTMLButtonElement).disabled).toBe(true);
  });

  it("never blocks a later step: every screen arrives already answered", async () => {
    await mountFresh();
    await toTune();
    // Something is already on, and Continue is live without a single tap.
    expect(countOnScreen()).toBeGreaterThan(0);
    expect((exact("Continue") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(exact("Continue")!);
    await screen.findByText(/What else should it keep\?/i);
    expect((exact("Continue") as HTMLButtonElement).disabled).toBe(false);
  });

  it("walks back to any earlier answer", async () => {
    await mountFresh();
    await toExtras();
    fireEvent.click(exact("Back")!);
    await screen.findByText(/What should it ask you\?/i);
    fireEvent.click(exact("Back")!);
    await screen.findByText(/What are you tracking\?/i);
  });
});

describe("shaping the check-in", () => {
  it("shows what the day will cost, and changes it when a question goes off", async () => {
    await mountFresh();
    await toTune();
    const before = countOnScreen();
    expect(before).toBeGreaterThan(0);
    expect(document.body.textContent).toMatch(/a day/i);

    // "Itch" is one of the eczema pack's everyday questions.
    fireEvent.click(screen.getAllByRole("switch").find((b) => /^Itch/.test((b.textContent || "").trim()))!);
    await waitFor(() => expect(countOnScreen()).toBe(before - 1));
  });

  it("offers a shorter and a longer version, without hiding the middle", async () => {
    await mountFresh();
    await toTune();
    const balanced = countOnScreen();
    fireEvent.click(exact("Quick")!);
    await waitFor(() => expect(countOnScreen()).toBeLessThan(balanced));
    fireEvent.click(exact("Thorough")!);
    await waitFor(() => expect(countOnScreen()).toBeGreaterThan(balanced));
  });

  it("keeps the daily number switched on, because a journal without one is not one", async () => {
    await mountFresh();
    await toTune();
    const metric = screen.getAllByRole("switch")
      .find((b) => /Overall skin severity/.test(b.textContent || ""))!;
    expect(metric.getAttribute("aria-checked")).toBe("true");
    expect((metric as HTMLButtonElement).disabled).toBe(true);
    expect(metric.textContent).toMatch(/your daily number/i);
  });

  it("takes a question of somebody's own, in their own words", async () => {
    await mountFresh();
    await toTune();
    const before = countOnScreen();
    tap(/Ask me something of my own/);
    fireEvent.change(await screen.findByLabelText(/Your question/i), {
      target: { value: "Hands · how bad today?" },
    });
    fireEvent.click(exact("Add it")!);
    await waitFor(() => expect(countOnScreen()).toBe(before + 1));
    expect(screen.getByText("Hands · how bad today?")).toBeTruthy();
  });
});

describe("what else the journal keeps", () => {
  it("draws the one-tap buttons being chosen, rather than filing the choice away", async () => {
    await mountFresh();
    await toExtras();
    const row = () => document.querySelector(".fhj-fr-preview-row")!.textContent || "";
    // Check-in always leads it; the eczema pack suggests photos and a routine.
    expect(row()).toMatch(/Check-in/);
    expect(row()).toMatch(/Photo/);

    fireEvent.click(screen.getAllByRole("button").find((b) => /Bathroom/.test(b.textContent || ""))!);
    await waitFor(() => expect(row()).toMatch(/Bowel/));
  });

  it("offers a nudge without demanding one", async () => {
    await mountFresh();
    await toExtras();
    expect(document.body.textContent).toMatch(/A nudge to write it down/i);
    const off = screen.getAllByRole("button").find((b) => /Not now/.test(b.textContent || ""))!;
    fireEvent.click(off);
    await waitFor(() => expect(off.getAttribute("aria-pressed")).toBe("true"));
  });
});

describe("the moment the journal begins", () => {
  it("writes the entry the person actually made — number and note", async () => {
    await mountFresh();
    await toEntry();

    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 7 out of 10/ }));
    expect(screen.getByText("a hard day")).toBeTruthy();

    tap(/Add a note/);
    fireEvent.change(await screen.findByLabelText("Note for today"), {
      target: { value: "Flared after the gym." },
    });
    tap(/Save my first entry/);

    expect(await screen.findByText("Your journal has begun.")).toBeTruthy();
    tap(/Open my journal/);

    await waitFor(() => {
      const db = saved();
      const entry = db.entries.find((e: any) => e.date === today());
      expect(entry.answers.overall_skin_severity).toBe(7);
      expect(entry.notes).toBe("Flared after the gym.");
    }, { timeout: 10000 });
  });

  it("shows the entry as the first card on a timeline, with the days ahead behind it", async () => {
    await mountFresh();
    await toEntry();
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 4 out of 10/ }));
    tap(/Save my first entry/);

    await screen.findByText("Your journal has begun.");
    const card = document.querySelector(".fhj-fr-card.is-landed")!;
    expect(card.textContent).toMatch(/4\/10/);
    expect(card.textContent).toMatch(/Overall skin severity/);
    // The future, drawn as the faintest thing on the screen.
    expect(document.querySelectorAll("[data-tl-ghost]").length).toBe(3);
    expect(screen.getByText("day on the record")).toBeTruthy();
  });

  it("hands over a journal that is already set up and already has today in it", async () => {
    await mountFresh();
    await toEntry();
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 6 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);

    // Today, with the number already recorded and the pulse showing it back.
    expect(await screen.findByText(/saved for today/, {}, { timeout: 10000 })).toBeTruthy();
    await waitFor(() => {
      const db = saved();
      expect(db.onboarded).toBe(true);
      expect(db.ack).toBe(true);                       // the disclaimer was on the hero
      expect(db.profile.modules).toEqual(["eczema"]);
      expect(db.profile.keyMetric).toBe("overall_skin_severity");
      // The pack's quick questions came with it — the survey exists, it just
      // wasn't the price of entry.
      expect(db.profile.disabledFields.length).toBeGreaterThan(0);
    });
  });

  it("hands over the buttons and the reminder the person chose, not a default set", async () => {
    await mountFresh();
    await toExtras();
    // Bathroom is not suggested for eczema; ticking it has to reach the journal.
    fireEvent.click(screen.getAllByRole("button").find((b) => /Bathroom/.test(b.textContent || ""))!);
    fireEvent.click(screen.getAllByRole("button").find((b) => /Morning/.test(b.textContent || ""))!);
    fireEvent.click(exact("Continue")!);
    await screen.findByText(/How is your skin today\?/i);
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 5 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);

    await waitFor(() => {
      const db = saved();
      expect(db.profile.quickAdd).toContain("bowel");
      expect(db.profile.quickAdd[0]).toBe("checkin");
      expect(db.profile.reminders[0].time).toBe("08:00");
    }, { timeout: 10000 });
  });

  it("carries a question somebody wrote themselves into their setup", async () => {
    await mountFresh();
    await toTune();
    tap(/Ask me something of my own/);
    fireEvent.change(await screen.findByLabelText(/Your question/i), {
      target: { value: "Hands today" },
    });
    fireEvent.click(exact("Add it")!);
    fireEvent.click(exact("Continue")!);
    await screen.findByText(/What else should it keep\?/i);
    fireEvent.click(exact("Continue")!);
    await screen.findByText(/How is your skin today\?/i);
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 3 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);

    await waitFor(() => {
      const db = saved();
      const own = db.profile.customQuestions.find((q: any) => q.label === "Hands today");
      expect(own).toBeTruthy();
      expect(own.type).toBe("scale");
    }, { timeout: 10000 });
  });

  it("does not write a day when nobody rated one", async () => {
    await mountFresh();
    await toEntry();
    const cta = screen.getAllByRole("button").find((b) => /Pick a number to save it/.test(b.textContent || ""))!;
    expect((cta as HTMLButtonElement).disabled).toBe(true);
  });
});
