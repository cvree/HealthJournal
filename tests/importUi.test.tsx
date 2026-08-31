/* Importing somebody's own notes, through the actual screen.

   The module tests pin what the data rules are; these pin that the screen
   honours the two that are promises rather than conveniences:

   1. **Nothing is sent until a sheet listing the payload has been accepted.**
      This is the only feature in the app that puts free text on the wire, so
      the consent step is the feature, not a formality.
   2. **Nothing is written until every proposed row has been seen**, and a row
      switched off in the review does not reach the journal. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";

beforeEach(() => cleanup());
afterEach(() => vi.unstubAllGlobals());

beforeAll(() => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: q.includes("reduce"), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  } as any));
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.confirm = () => true;
});

const CONN = JSON.stringify({
  provider: "gemini", key: "AQ.AbTESTkeyTESTkeyTESTkey1234", model: "gemini-9-flash",
});

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

let kv: Map<string, string>;

async function mountApp({ ai = true, days, dismissed = false }: {
  ai?: boolean; days?: number; dismissed?: boolean;
} = {}) {
  const { __internals: I, default: App } = await import("../src/App");
  const db = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  db.ai = { ...db.ai, enabled: ai };
  if (days != null) db.entries = db.entries.slice(-days);
  if (dismissed) db.profile = { ...db.profile, importOffered: "done" };
  kv = new Map(Object.entries(
    ai ? { fhj_v1: JSON.stringify(db), fhj_ai_conn_v1: CONN } : { fhj_v1: JSON.stringify(db) }
  ));
  (window as any).storage = {
    async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
    async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
    async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
    async list(prefix?: string) { return { keys: [...kv.keys()].filter((k) => !prefix || k.startsWith(prefix)) }; },
  };
  render(<App />);
  await screen.findByText(/Quick Add/);
}

const saved = () => JSON.parse(kv.get("fhj_v1")!);

/** A provider that answers, and a record of everything it was sent. */
function stubProvider(reply: unknown) {
  const sent: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
    if (String(url).endsWith("/models")) {
      return { ok: true, json: async () => ({ models: [{ name: "models/gemini-9-flash" }] }) } as any;
    }
    sent.push(JSON.parse(init.body));
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }),
    } as any;
  }));
  return sent;
}

/** Straight to the screen through the + sheet, which is where it lives. */
async function openImport() {
  fireEvent.click(within(document.querySelector("nav")!).getByRole("button", { name: "Add to today" }));
  const dlg = await screen.findByRole("dialog");
  const more = within(dlg).queryByRole("button", { name: /Everything else/ });
  if (more) fireEvent.click(more);
  fireEvent.click((await within(dlg).findAllByRole("button", { name: /Import notes/ }))[0]);
  await screen.findByRole("heading", { name: /Import your notes/ });
}

const NOTES = "8.21 food, 2.5 hamburger, havarti cheese\n8.21 4pm bowel movement, small firm sank";

const REPLY = {
  items: [
    {
      kind: "food", date: "2026-08-21", time: "12:30", description: "2.5 hamburger, havarti cheese",
      serving: "2.5 patties", source: "8.21 food, 2.5 hamburger, havarti cheese", confidence: "high",
    },
    {
      kind: "bowel", date: "2026-08-21", time: "16:00", consistency: "firm",
      amount: "small", source: "8.21 4pm bowel movement, small firm sank", confidence: "medium",
    },
  ],
};

describe("the door", () => {
  it("is not there at all without the AI connection behind it", async () => {
    await mountApp({ ai: false });
    fireEvent.click(within(document.querySelector("nav")!).getByRole("button", { name: "Add to today" }));
    const dlg = await screen.findByRole("dialog");
    const more = within(dlg).queryByRole("button", { name: /Everything else/ });
    if (more) fireEvent.click(more);
    expect(within(dlg).queryByRole("button", { name: /Import notes/ })).toBeNull();
  });
});

describe("nothing leaves before the sheet says what leaves", () => {
  it("asks first, lists the whole payload, and sends nothing if it is declined", async () => {
    const sent = stubProvider(REPLY);
    await mountApp();
    await openImport();

    fireEvent.change(screen.getByLabelText(/Your notes/), { target: { value: NOTES } });
    fireEvent.click(screen.getByRole("button", { name: /Read my notes/ }));

    const sheet = await screen.findByRole("dialog", { name: /This sends your notes/ });
    expect(sheet.textContent).toMatch(/characters of notes you pasted/);
    expect(sheet.textContent).toMatch(/names of your \d+ questions/);
    expect(sent).toHaveLength(0);

    fireEvent.click(within(sheet).getByRole("button", { name: /Not now/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sent).toHaveLength(0);
  });

  it("sends the notes only once the sheet is accepted, and writes nothing on the way back", async () => {
    const sent = stubProvider(REPLY);
    await mountApp();
    const before = saved();
    await openImport();

    fireEvent.change(screen.getByLabelText(/Your notes/), { target: { value: NOTES } });
    fireEvent.click(screen.getByRole("button", { name: /Read my notes/ }));
    const sheet = await screen.findByRole("dialog", { name: /This sends your notes/ });
    fireEvent.click(within(sheet).getByRole("button", { name: /Send and read/ }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(JSON.stringify(sent[0])).toContain("8.21 food, 2.5 hamburger");

    // The reply is a proposal. The journal has not moved.
    await screen.findByText(/Nothing is written yet/);
    expect(saved().bowel.length).toBe(before.bowel.length);
  });
});

describe("the review", () => {
  const readNotes = async () => {
    await openImport();
    fireEvent.change(screen.getByLabelText(/Your notes/), { target: { value: NOTES } });
    fireEvent.click(screen.getByRole("button", { name: /Read my notes/ }));
    const sheet = await screen.findByRole("dialog", { name: /This sends your notes/ });
    fireEvent.click(within(sheet).getByRole("button", { name: /Send and read/ }));
    await screen.findByText(/Nothing is written yet/);
  };

  it("shows each row beside the words it was read from", async () => {
    stubProvider(REPLY);
    await mountApp();
    await readNotes();
    const rows = [...document.querySelectorAll(".fhj-import-row")];
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.textContent).join(" ")).toContain("8.21 food, 2.5 hamburger");
    expect(rows.map((r) => r.textContent).join(" ")).toContain("Bowel movement");
  });

  it("writes what was left switched on, and nothing that was switched off", async () => {
    stubProvider(REPLY);
    await mountApp();
    const beforeBowel = saved().bowel.length;
    await readNotes();

    // Switch the bowel row off, then commit.
    const row = [...document.querySelectorAll(".fhj-import-row")]
      .find((r) => /Bowel movement/.test(r.textContent || ""))!;
    fireEvent.click(within(row as HTMLElement).getByRole("switch"));

    fireEvent.click(await screen.findByRole("button", { name: /Add 1 row to my journal/ }));

    await waitFor(() => expect(
      saved().food.some((f: any) => f.description === "2.5 hamburger, havarti cheese")
    ).toBe(true));
    expect(saved().bowel.length).toBe(beforeBowel);
  });

  it("throws the whole reading away without touching the journal", async () => {
    stubProvider(REPLY);
    await mountApp();
    const before = JSON.stringify(saved().food);
    await readNotes();
    fireEvent.click(screen.getByRole("button", { name: /Throw this away/ }));
    await screen.findByLabelText(/Your notes/);
    expect(JSON.stringify(saved().food)).toBe(before);
  });

  it("files a row on the date the notes gave it, not on today", async () => {
    stubProvider({
      items: [{
        kind: "food", date: "2026-08-21", time: "17:15", description: "Chuck steak",
        source: "8.21 5:15 pm, chuck steak", confidence: "high",
      }],
    });
    await mountApp();
    await openImport();
    fireEvent.change(screen.getByLabelText(/Your notes/), { target: { value: "8.21 5:15 pm, chuck steak" } });
    fireEvent.click(screen.getByRole("button", { name: /Read my notes/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /Send and read/ }));
    await screen.findByText(/Nothing is written yet/);
    fireEvent.click(await screen.findByRole("button", { name: /Add 1 row to my journal/ }));

    await waitFor(() => {
      const log = saved().food.find((f: any) => f.description === "Chuck steak");
      expect(log).toBeTruthy();
      /* Either the date in the notes, or — once that date is more than three
         years old — today, flagged. Never silently today while the sample
         journal is young. */
      expect([log.date === "2026-08-21", log.date === today()]).toContain(true);
      expect(log.time).toBe("17:15");
    });
  });
});

/* The offer on Today.

   Import's problem is not what it does, it is that somebody in their first
   week will never go looking for it. So a young journal is offered it where it
   already is — and an established one is not, because at that point it is
   clutter on the screen somebody opens every morning. */
describe("the offer on Today", () => {
  const invite = () => document.querySelector(".fhj-invite");

  it("is there while the journal is young enough for it to be worth doing", async () => {
    await mountApp({ days: 3 });
    expect(invite()).toBeTruthy();
    expect(invite()!.textContent).toMatch(/been tracking somewhere else/i);
    expect(invite()!.textContent).toMatch(/on the days your own notes give/i);
  });

  it("retires itself once the journal has a fortnight of its own history", async () => {
    await mountApp({ days: 20 });
    expect(invite()).toBeNull();
  });

  it("goes away for good when it is sent away, and does not come back on the next launch", async () => {
    await mountApp({ days: 3 });
    fireEvent.click(within(invite() as HTMLElement).getByRole("button", { name: /not for me/i }));
    await waitFor(() => expect(document.querySelector(".fhj-invite")).toBeNull());
    await waitFor(() => expect(saved().profile.importOffered).toBe("done"));
  });

  it("does not come back for a journal that already sent it away", async () => {
    await mountApp({ days: 3, dismissed: true });
    expect(invite()).toBeNull();
  });

  it("opens the import when AI is ready, and says so plainly when it is not", async () => {
    await mountApp({ days: 3 });
    fireEvent.click(within(invite() as HTMLElement).getByRole("button", { name: /import my notes/i }));
    expect(await screen.findByRole("heading", { name: /Import your notes/ })).toBeTruthy();

    cleanup();
    await mountApp({ ai: false, days: 3 });
    /* An offer that quietly turns into a setup screen is a bait. It says what
       it needs, and its button goes where that is set up. */
    expect(invite()!.textContent).toMatch(/needs the optional AI switched on first/i);
    expect(within(invite() as HTMLElement).queryByRole("button", { name: /import my notes/i })).toBeNull();
    expect(within(invite() as HTMLElement).getByRole("button", { name: /set it up/i })).toBeTruthy();
  });
});

describe("switching a whole day off", () => {
  it("takes every row on that day with it, and leaves the other day alone", async () => {
    stubProvider({
      items: [
        { kind: "food", date: "2026-08-21", time: "08:00", description: "Porridge", source: "a", confidence: "high" },
        { kind: "food", date: "2026-08-21", time: "19:00", description: "Steak", source: "b", confidence: "high" },
        { kind: "food", date: "2026-08-20", time: "12:00", description: "Soup", source: "c", confidence: "high" },
      ],
    });
    await mountApp();
    await openImport();
    fireEvent.change(screen.getByLabelText(/Your notes/), { target: { value: "three meals" } });
    fireEvent.click(screen.getByRole("button", { name: /Read my notes/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /Send and read/ }));
    await screen.findByText(/Nothing is written yet/);

    expect(screen.getByRole("button", { name: /Add 3 rows to my journal/ })).toBeTruthy();

    // The day with two rows on it, switched off in one tap.
    fireEvent.click(screen.getByRole("button", { name: /^None · 2$/ }));
    await screen.findByRole("button", { name: /Add 1 row to my journal/ });
    // ...and back on again, because a switch that only goes one way is a delete.
    fireEvent.click(screen.getByRole("button", { name: /^All · 2$/ }));
    await screen.findByRole("button", { name: /Add 3 rows to my journal/ });
  });
});

/* ---------- a paragraph, not a log ----------

   The half of this feature 1.33 added: somebody who never kept a dated log,
   who arrives and describes how the last fortnight went in three sentences.
   Every promise below is about *not* making that person do more work than the
   person with the tidy log file. */

/** Dates relative to today, so a stretch is never accidentally in the future
    or three years adrift on a machine whose clock is not the author's. */
const back = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const readWith = async (notes: string) => {
  await openImport();
  fireEvent.change(screen.getByLabelText(/Your notes/), { target: { value: notes } });
  fireEvent.click(screen.getByRole("button", { name: /Read my notes/ }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /Send and read/ }));
  await screen.findByText(/Nothing is written yet/);
};

describe("a course that ran for days", () => {
  const COURSE = {
    items: [{
      kind: "routine", date: back(4), until: back(0), name: "Amitriptyline", dose: "10 mg",
      routineKind: "med", time: "22:00",
      source: "started 10mg amitriptyline on Tuesday, every night since", confidence: "high",
    }],
  };

  it("stays one row to approve, and says how many days it covers", async () => {
    stubProvider(COURSE);
    await mountApp();
    await readWith("started 10mg amitriptyline on Tuesday, every night since");
    const rows = [...document.querySelectorAll(".fhj-import-row")];
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("5 days");
    /* And the button counts what the tap actually writes. */
    expect(screen.getByRole("button", { name: /Add 5 rows to my journal/ })).toBeTruthy();
  });

  it("writes one dose per day when it is approved", async () => {
    stubProvider(COURSE);
    await mountApp();
    await readWith("started 10mg amitriptyline on Tuesday, every night since");
    fireEvent.click(screen.getByRole("button", { name: /Add 5 rows to my journal/ }));
    await waitFor(() => {
      const rows = saved().routine.filter((r: any) => r.name === "Amitriptyline");
      expect(rows).toHaveLength(5);
      expect(new Set(rows.map((r: any) => r.date)).size).toBe(5);
    });
  });
});

describe("what it had to decide", () => {
  const AMBIGUOUS = {
    items: [{
      kind: "routine", date: back(1), name: "Cetirizine", dose: "10 mg", routineKind: "med",
      source: "took the antihistamine", confidence: "medium",
    }],
    questions: [{
      ask: "Which antihistamine did you mean?",
      why: "There is more than one it could be.",
      options: ["Cetirizine", "Loratadine"],
      assumed: "Cetirizine",
    }],
  };

  it("asks, and answers itself — the plan under the question is already complete", async () => {
    stubProvider(AMBIGUOUS);
    await mountApp();
    await readWith("took the antihistamine yesterday");
    expect(screen.getByText(/Which antihistamine did you mean\?/)).toBeTruthy();
    /* The option it used is marked, and the rows are already built on it. */
    const chosen = screen.getByRole("button", { name: /Cetirizine/ });
    expect(chosen.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector(".fhj-import-row")!.textContent).toContain("Cetirizine");
    /* Nothing is blocked: the commit button is live without answering. */
    expect((screen.getByRole("button", { name: /Add 1 row to my journal/ }) as HTMLButtonElement).disabled)
      .toBe(false);
  });

  it("offers a re-read only once an answer differs, and asks before sending again", async () => {
    const sent = stubProvider(AMBIGUOUS);
    await mountApp();
    await readWith("took the antihistamine yesterday");
    expect(screen.queryByRole("button", { name: /Read it again/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Loratadine/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Read it again with these answers/ }));

    /* Still a second request, so still the sheet — and it names the answers. */
    const sheet = await screen.findByRole("dialog", { name: /This sends your notes/ });
    expect(sheet.textContent).toMatch(/answer to what it asked last time/);
    expect(sent).toHaveLength(1);

    fireEvent.click(within(sheet).getByRole("button", { name: /Send and read/ }));
    await waitFor(() => expect(sent).toHaveLength(2));
    const wire = JSON.stringify(sent[1]);
    expect(wire).toContain("Loratadine");
    expect(wire).toContain("took the antihistamine yesterday");
  });
});

describe("what is already there, and what has nowhere to go", () => {
  it("marks a row the journal already has, before the button rather than after it", async () => {
    const MEAL = {
      items: [{
        kind: "food", date: back(1), time: "12:30", description: "Porridge",
        source: "porridge at half twelve", confidence: "high",
      }],
    };
    stubProvider(MEAL);
    await mountApp();
    await readWith("porridge at half twelve");
    /* First time through, nothing is already there. */
    expect(screen.queryByText(/Already in your journal/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Add 1 row to my journal/ }));
    await waitFor(() => expect(saved().food.some((f: any) => f.description === "Porridge")).toBe(true));

    /* Run the same notes again — which is what everybody does, because the
       first run is a test. */
    fireEvent.click(await screen.findByRole("button", { name: /Import more/ }));
    fireEvent.change(await screen.findByLabelText(/Your notes/), { target: { value: "porridge at half twelve" } });
    fireEvent.click(screen.getByRole("button", { name: /Read my notes/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /Send and read/ }));
    await screen.findByText(/Nothing is written yet/);

    expect(await screen.findByText(/Already in your journal/)).toBeTruthy();
    expect(screen.getByText(/would be skipped rather than doubled up/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Switch it off/ }));
    await screen.findByRole("button", { name: /Nothing selected/ });
  });

  it("says what this journal had nowhere to put, rather than being quietly shorter", async () => {
    stubProvider({
      items: [
        { kind: "answer", key: "blood_pressure", number: 120, date: back(1),
          source: "bp 120/80", confidence: "high" },
        { kind: "note", text: "Felt rough.", date: back(1), source: "felt rough", confidence: "high" },
      ],
    });
    await mountApp();
    await readWith("bp 120/80, felt rough");
    expect(screen.getByText(/nowhere to put/)).toBeTruthy();
    expect(screen.getByText(/bp 120\/80/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add 1 row to my journal/ })).toBeTruthy();
  });
});

describe("saying what can be pasted", () => {
  it("names both shapes of notes, behind a disclosure so neither is in the way", async () => {
    await mountApp();
    await openImport();
    expect(screen.queryByText(/how things have been, in sentences/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /What can I paste\?/ }));
    expect(await screen.findByText(/A log you already keep/i)).toBeTruthy();
    expect(screen.getByText(/how things have been, in sentences/i)).toBeTruthy();
  });
});
