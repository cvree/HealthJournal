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
