/* Food and bowel logging, through the actual UI.

   The module tests pin the data rules; these pin that the screens honour them.
   The ones that matter most are negative: with AI switched off there is no way
   to reach an analysis button, and with it on, nothing is sent until a consent
   sheet has been confirmed. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
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

const CONN = JSON.stringify({
  provider: "gemini", key: "AQ.AbTESTkeyTESTkeyTESTkey1234", model: "gemini-9-flash",
});

async function mountApp(opts: { ai?: boolean } = {}) {
  const { __internals: I, default: App } = await import("../src/App");
  const db = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  if (opts.ai) db.ai = { ...db.ai, enabled: true };
  const kv = mockStorage(
    opts.ai
      ? { fhj_v1: JSON.stringify(db), fhj_ai_conn_v1: CONN }
      : { fhj_v1: JSON.stringify(db) }
  );
  const utils = render(<App />);
  await screen.findByText(/Quick Add/);
  return { ...utils, kv };
}

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

/** Open a Quick Add tile by its label. */
const openTile = async (name: RegExp) => {
  const tile = (await screen.findAllByRole("button", { name }))[0];
  fireEvent.click(tile);
};

describe("Quick Add", () => {
  it("offers the four things worth logging", async () => {
    await mountApp();
    const tiles = document.querySelectorAll(".fhj-tile");
    const labels = [...tiles].map((t) => t.querySelector(".fhj-tile-label")?.textContent);
    expect(labels).toEqual(["Check-in", "Food", "Bowel", "Photo"]);
  });

  it("shows an empty timeline before anything is logged today", async () => {
    await mountApp();
    expect(screen.getByText(/Nothing logged yet today/)).toBeTruthy();
  });
});

describe("logging a meal", () => {
  it("saves it and shows it on today's timeline", async () => {
    await mountApp();
    await openTile(/^Food/);
    await screen.findByText("Log food");

    fireEvent.click(screen.getByRole("button", { name: "Lunch" }));
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), {
      target: { value: "Grilled salmon and greens" },
    });
    fireEvent.change(screen.getByPlaceholderText("1 bowl"), { target: { value: "1 plate" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    expect(screen.getByText("Grilled salmon and greens")).toBeTruthy();
    expect(document.body.textContent).toContain("Lunch");
  });

  it("keeps a hand-typed nutrition value as the user's, unbadged", async () => {
    await mountApp();
    await openTile(/^Food/);
    await screen.findByText("Log food");
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), { target: { value: "Oats" } });
    fireEvent.change(screen.getByLabelText(/Calories in kcal/), { target: { value: "420" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    expect(document.body.textContent).toContain("420 kcal");
    // No "about", and no AI badge — this is a number the person entered.
    expect(document.body.textContent).not.toContain("about 420");
    expect(document.querySelector(".fhj-ai-badge")).toBeNull();
  });

  it("persists across a reload", async () => {
    const { kv, unmount } = await mountApp();
    await openTile(/^Food/);
    await screen.findByText("Log food");
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), { target: { value: "Rye toast" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    await waitFor(() => expect(kv.get("fhj_v1")).toContain("Rye toast"));

    unmount();
    cleanup();
    const { default: App } = await import("../src/App");
    render(<App />);
    expect(await screen.findByText("Rye toast")).toBeTruthy();
  });

  it("reopens an existing meal for editing rather than adding a second one", async () => {
    await mountApp();
    await openTile(/^Food/);
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Soup" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());

    fireEvent.click(screen.getByText("Soup"));
    await screen.findByText("Edit meal");
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), { target: { value: "Soup and bread" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByText("Edit meal")).toBeNull());
    expect(screen.getByText("Soup and bread")).toBeTruthy();
    expect(screen.queryByText("Soup")).toBeNull();
  });
});

describe("logging a bowel movement", () => {
  it("records the descriptive fields and summarises them on the timeline", async () => {
    await mountApp();
    await openTile(/^Bowel/);
    await screen.findByText("Log bowel movement");

    fireEvent.click(screen.getByRole("button", { name: /Smooth sausage/ }));
    fireEvent.click(screen.getByRole("button", { name: "Medium" }));
    fireEvent.click(screen.getByRole("button", { name: "Brown" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByText("Log bowel movement")).toBeNull());
    expect(screen.getByText("Bowel movement")).toBeTruthy();
    expect(document.body.textContent).toContain("Type 4 · Medium · Brown");
  });

  it("offers all seven Bristol types with their descriptions", async () => {
    await mountApp();
    await openTile(/^Bowel/);
    await screen.findByText("Log bowel movement");
    for (const label of [
      "Separate hard lumps", "Lumpy sausage", "Cracked sausage", "Smooth sausage",
      "Soft blobs", "Mushy ragged", "Entirely liquid",
    ]) {
      expect(screen.getByText(label), label).toBeTruthy();
    }
  });

  it("lets a selected option be unselected, so a mis-tap isn't permanent", async () => {
    await mountApp();
    await openTile(/^Bowel/);
    const btn = await screen.findByRole("button", { name: /Smooth sausage/ });
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("AI stays out of the way when it is off", () => {
  it("shows no analysis button anywhere in the food sheet", async () => {
    await mountApp({ ai: false });
    await openTile(/^Food/);
    await screen.findByText("Log food");
    expect(screen.queryByText(/Estimate nutrition with AI/)).toBeNull();
    expect(document.querySelector(".fhj-ai-badge")).toBeNull();
  });

  it("shows no analysis button in the bowel sheet", async () => {
    await mountApp({ ai: false });
    await openTile(/^Bowel/);
    await screen.findByText("Log bowel movement");
    expect(screen.queryByText(/Describe the photo with AI/)).toBeNull();
  });

  it("still records everything the two sheets are for", async () => {
    // The whole app has to work with no key and no network. This is that claim.
    await mountApp({ ai: false });
    await openTile(/^Food/);
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Eggs" } });
    fireEvent.change(screen.getByLabelText(/Protein in g/), { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    expect(screen.getByText("Eggs")).toBeTruthy();
  });

  it("makes no network request at any point", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await mountApp({ ai: false });
    await openTile(/^Food/);
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Toast" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("the timeline", () => {
  it("orders entries by the time they happened, not the order they were added", async () => {
    await mountApp();

    // Log a late meal first, then an early one.
    await openTile(/^Food/);
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Late dinner" } });
    const timeInputs = () => document.querySelectorAll('input[type="time"]');
    fireEvent.change(timeInputs()[0], { target: { value: "20:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());

    await openTile(/^Food/);
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Early breakfast" } });
    fireEvent.change(timeInputs()[0], { target: { value: "07:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());

    const titles = [...document.querySelectorAll(".fhj-tl-title")].map((n) => n.textContent);
    expect(titles.indexOf("Early breakfast")).toBeLessThan(titles.indexOf("Late dinner"));
  });

  it("tints each row by category so kinds are told apart before they are read", async () => {
    await mountApp();
    await openTile(/^Food/);
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Lunch" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());

    await openTile(/^Bowel/);
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Log bowel movement")).toBeNull());

    expect(document.querySelector(".fhj-tl-item.fhj-cat-food")).toBeTruthy();
    expect(document.querySelector(".fhj-tl-item.fhj-cat-bowel")).toBeTruthy();
  });

  it("shows today's calorie total once a meal carries one", async () => {
    await mountApp();
    await openTile(/^Food/);
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Pasta" } });
    fireEvent.change(screen.getByLabelText(/Calories in kcal/), { target: { value: "600" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    expect(document.body.textContent).toContain("Food today");
  });
});

describe("nothing is sent without consent", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the analysis button only once AI is switched on", async () => {
    await mountApp({ ai: true });
    await openTile(/^Food/);
    await screen.findByText("Log food");
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), { target: { value: "Salmon" } });
    expect(await screen.findByText(/Estimate nutrition with AI/)).toBeTruthy();
  });

  it("makes no request until the consent sheet is confirmed", async () => {
    const sent = stubProvider({ nutrition: { calories: 520 }, confidence: "medium" });
    await mountApp({ ai: true });
    await openTile(/^Food/);
    await screen.findByText("Log food");
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), { target: { value: "Salmon salad" } });

    fireEvent.click(await screen.findByText(/Estimate nutrition with AI/));
    await screen.findByText(/Send this for an estimate/);
    // The sheet is up and the payload is described — but nothing has gone yet.
    expect(sent).toHaveLength(0);
    expect(document.body.textContent).toContain("Salmon salad");

    fireEvent.click(screen.getByRole("button", { name: /^Send$/ }));
    await waitFor(() => expect(sent).toHaveLength(1));
  });

  it("sends nothing at all if the sheet is cancelled", async () => {
    const sent = stubProvider({ nutrition: { calories: 1 }, confidence: "low" });
    await mountApp({ ai: true });
    await openTile(/^Food/);
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Toast" } });
    fireEvent.click(await screen.findByText(/Estimate nutrition with AI/));
    const dialog = (await screen.findByText(/Send this for an estimate/)).closest('[role="dialog"]')!;
    fireEvent.click(within(dialog as HTMLElement).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText(/Send this for an estimate/)).toBeNull());
    expect(sent).toHaveLength(0);
  });

  it("badges the result as an estimate and keeps it out of the user's own fields", async () => {
    stubProvider({
      identified: "Grilled salmon and salad",
      nutrition: { calories: 520, protein: 41 },
      confidence: "medium",
    });
    await mountApp({ ai: true });
    await openTile(/^Food/);
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Salmon" } });
    fireEvent.click(await screen.findByText(/Estimate nutrition with AI/));
    fireEvent.click(await screen.findByRole("button", { name: /^Send$/ }));

    await screen.findByText(/Grilled salmon and salad/);
    expect(document.querySelector(".fhj-ai-badge")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    // On the timeline it is still hedged and still badged.
    expect(document.body.textContent).toContain("about 520 kcal");
    expect(document.querySelector(".fhj-ai-badge")).toBeTruthy();
  });

  it("stops hedging once the user accepts the estimate as their own", async () => {
    stubProvider({ nutrition: { calories: 520 }, confidence: "high" });
    await mountApp({ ai: true });
    await openTile(/^Food/);
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Salmon" } });
    fireEvent.click(await screen.findByText(/Estimate nutrition with AI/));
    fireEvent.click(await screen.findByRole("button", { name: /^Send$/ }));

    fireEvent.click(await screen.findByRole("button", { name: "Use these" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    expect(document.body.textContent).toContain("520 kcal");
    expect(document.body.textContent).not.toContain("about 520 kcal");
  });

  it("never sends an image on the text-only path", async () => {
    const sent = stubProvider({ nutrition: { calories: 100 }, confidence: "low" });
    await mountApp({ ai: true });
    await openTile(/^Food/);
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Toast" } });
    fireEvent.click(await screen.findByText(/Estimate nutrition with AI/));
    fireEvent.click(await screen.findByRole("button", { name: /^Send$/ }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(JSON.stringify(sent[0])).not.toContain("inlineData");
  });
});
