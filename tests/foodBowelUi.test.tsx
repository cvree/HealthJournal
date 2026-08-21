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

async function mountApp(opts: { ai?: boolean; auto?: boolean } = {}) {
  const { __internals: I, default: App } = await import("../src/App");
  const db = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  if (opts.ai) db.ai = { ...db.ai, enabled: true, auto: !!opts.auto };
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

/** Open a logging action by its label — from the Quick Add row when it is
    there, and from the + sheet's "Everything else" when it is not.

    Which buttons sit on the dashboard is the person's own choice now (and
    starts from what their conditions reach for), so a test about logging a
    bowel movement should not also be a test about where that button lives. */
const openTile = async (name: RegExp) => {
  const tile = [...document.querySelectorAll(".fhj-tile")].find((t) => name.test(t.textContent || ""));
  if (tile) { fireEvent.click(tile); return; }
  fireEvent.click(within(document.querySelector("nav")!).getByRole("button", { name: "Add to today" }));
  const dlg = await screen.findByRole("dialog");
  const more = within(dlg).queryByRole("button", { name: /Everything else/ });
  if (more) fireEvent.click(more);
  fireEvent.click((await within(dlg).findAllByRole("button", { name }))[0]);
};

/** The picker dialog, scoped — the timeline behind it carries the same food
    names, so an unscoped query matches twice. */
const pickerDialog = async () => {
  const search = await screen.findByPlaceholderText("Search your foods");
  return search.closest('[role="dialog"]') as HTMLElement;
};

/** A log sheet's primary action, which is pinned to the bottom of the sheet.
    A new row reads "Log it"; an existing one being edited reads "Save". */
const saveSheet = (root: any = screen) =>
  fireEvent.click(root.getByRole("button", { name: /^(Log it|Save changes)$/ }));

/** Open one of a sheet's folded sections by its heading. The everyday path
    through these sheets doesn't touch them — that is the point of folding
    them — so a test that wants a detail field has to ask for it, exactly as a
    user filling one in would. */
const openSection = async (name: RegExp, root: any = screen) =>
  fireEvent.click(await root.findByRole("button", { name }));

/** Quick Add → Food opens the *picker*, which is the one-tap path for a food
    already saved. The long form is one step further in, behind "Something
    new" — this walks that route. */
const openFoodForm = async () => {
  await openTile(/^Food/);
  fireEvent.click(await screen.findByRole("button", { name: /Something new/ }));
  await screen.findByText("Log food");
};

describe("Quick Add", () => {
  it("offers what this journal's own conditions reach for", async () => {
    await mountApp();
    const tiles = document.querySelectorAll(".fhj-tile");
    const labels = [...tiles].map((t) => t.querySelector(".fhj-tile-label")?.textContent);
    // Skin + diet: a camera, a routine, a flare and the day's meals. The set
    // is derived from the packs rather than fixed, so a gut journal gets a
    // bowel tile and this one does not.
    expect(labels[0]).toBe("Check-in");
    expect(labels).toContain("Food");
    expect(labels).toContain("Photo");
    expect(labels).toContain("Routine");
  });

  it("shows an empty timeline before anything is logged today", async () => {
    await mountApp();
    expect(screen.getByText(/Nothing logged yet/)).toBeTruthy();
  });
});

describe("logging a meal", () => {
  it("saves it and shows it on today's timeline", async () => {
    await mountApp();
    await openFoodForm();

    fireEvent.click(screen.getByRole("button", { name: "Lunch" }));
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), {
      target: { value: "Grilled salmon and greens" },
    });
    await openSection(/^Serving size/);
    fireEvent.change(screen.getByPlaceholderText("1 bowl"), { target: { value: "1 plate" } });
    saveSheet();

    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    expect(screen.getByText("Grilled salmon and greens")).toBeTruthy();
    expect(document.body.textContent).toContain("Lunch");
  });

  it("keeps a hand-typed nutrition value as the user's, unbadged", async () => {
    await mountApp();
    await openFoodForm();
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), { target: { value: "Oats" } });
    fireEvent.change(screen.getByLabelText(/Calories in kcal/), { target: { value: "420" } });
    saveSheet();

    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    expect(document.body.textContent).toContain("420 kcal");
    // No "about", and no AI badge — this is a number the person entered.
    expect(document.body.textContent).not.toContain("about 420");
    expect(document.querySelector(".fhj-ai-badge")).toBeNull();
  });

  it("persists across a reload", async () => {
    const { kv, unmount } = await mountApp();
    await openFoodForm();
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), { target: { value: "Rye toast" } });
    saveSheet();
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
    await openFoodForm();
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Soup" } });
    saveSheet();
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());

    fireEvent.click(screen.getByText("Soup"));
    await screen.findByText("Edit meal");
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), { target: { value: "Soup and bread" } });
    saveSheet();

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
    await openSection(/^Amount, colour and consistency/);
    fireEvent.click(screen.getByRole("button", { name: "Medium" }));
    fireEvent.click(screen.getByRole("button", { name: "Brown" }));
    saveSheet();

    await waitFor(() => expect(screen.queryByText("Log bowel movement")).toBeNull());
    expect(screen.getByText("Bowel movement")).toBeTruthy();
    expect(document.body.textContent).toContain("Type 4 · Medium · Brown");
  });

  /* Bristol is drawn as the ordered scale it is — seven numbered targets with
     the selected type named underneath — rather than seven stacked paragraphs.
     Every type is still individually reachable and still carries its name;
     asserting on the accessible name rather than on visible text is the
     stronger claim, because it is the one a screen reader depends on too. */
  it("offers all seven Bristol types, each reachable and named", async () => {
    await mountApp();
    await openTile(/^Bowel/);
    await screen.findByText("Log bowel movement");
    for (const label of [
      "Separate hard lumps", "Lumpy sausage", "Cracked sausage", "Smooth sausage",
      "Soft blobs", "Mushy ragged", "Entirely liquid",
    ]) {
      expect(screen.getByRole("button", { name: `Bristol type: ${label}` }), label).toBeTruthy();
    }
  });

  it("names the type it has selected, with its description", async () => {
    await mountApp();
    await openTile(/^Bowel/);
    await screen.findByText("Log bowel movement");
    fireEvent.click(screen.getByRole("button", { name: "Bristol type: Soft blobs" }));
    expect(screen.getByText("Soft blobs")).toBeTruthy();
    expect(document.body.textContent).toContain("Soft blobs with clear edges");
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
    await openFoodForm();
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
    await openFoodForm();
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Eggs" } });
    fireEvent.change(screen.getByLabelText(/Protein in g/), { target: { value: "14" } });
    saveSheet();
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    // On the timeline, and on the one-tap Again row — hence the scoping.
    const timeline = document.querySelector(".fhj-tl") as HTMLElement;
    expect(within(timeline).getByText("Eggs")).toBeTruthy();
    expect(within(document.querySelector(".fhj-scroller") as HTMLElement).getByText("Eggs")).toBeTruthy();
  });

  it("makes no network request at any point", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await mountApp({ ai: false });
    await openFoodForm();
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Toast" } });
    saveSheet();
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("the timeline", () => {
  it("orders entries by the time they happened, not the order they were added", async () => {
    await mountApp();

    // Log a late meal first, then an early one.
    await openFoodForm();
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Late dinner" } });
    const timeInputs = () => document.querySelectorAll('input[type="time"]');
    await openSection(/^When/);
    fireEvent.change(timeInputs()[0], { target: { value: "20:00" } });
    saveSheet();
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());

    await openFoodForm();
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Early breakfast" } });
    await openSection(/^When/);
    fireEvent.change(timeInputs()[0], { target: { value: "07:00" } });
    saveSheet();
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());

    const titles = [...document.querySelectorAll(".fhj-tl-title")].map((n) => n.textContent);
    expect(titles.indexOf("Early breakfast")).toBeLessThan(titles.indexOf("Late dinner"));
  });

  it("tints each row by category so kinds are told apart before they are read", async () => {
    await mountApp();
    await openFoodForm();
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Lunch" } });
    saveSheet();
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());

    await openTile(/^Bowel/);
    saveSheet(screen);
    await waitFor(() => expect(screen.queryByText("Log bowel movement")).toBeNull());

    expect(document.querySelector(".fhj-tl-item.fhj-cat-food")).toBeTruthy();
    expect(document.querySelector(".fhj-tl-item.fhj-cat-bowel")).toBeTruthy();
  });

  it("shows today's calorie total once a meal carries one", async () => {
    await mountApp();
    await openFoodForm();
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Pasta" } });
    fireEvent.change(screen.getByLabelText(/Calories in kcal/), { target: { value: "600" } });
    saveSheet();
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());

    // On Today it is one line in the glance card; the full macro strip is on
    // Insights, where the rest of the day's numbers are.
    const glance = screen.getByText("How you're doing").closest(".fhj-card") as HTMLElement;
    expect(glance.textContent).toContain("600");
    expect(glance.textContent).toContain("kcal");

    fireEvent.click(within(document.querySelector("nav")!).getByRole("button", { name: "History" }));
    fireEvent.click(screen.getByRole("button", { name: /^Insights/ }));
    await waitFor(() => expect(document.body.textContent).toContain("Food today"));
  });
});

describe("nothing is sent without consent", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the analysis button only once AI is switched on", async () => {
    await mountApp({ ai: true });
    await openFoodForm();
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), { target: { value: "Salmon" } });
    expect(await screen.findByText(/Estimate nutrition with AI/)).toBeTruthy();
  });

  it("makes no request until the consent sheet is confirmed", async () => {
    const sent = stubProvider({ nutrition: { calories: 520 }, confidence: "medium" });
    await mountApp({ ai: true });
    await openFoodForm();
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
    await openFoodForm();
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
    await openFoodForm();
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Salmon" } });
    fireEvent.click(await screen.findByText(/Estimate nutrition with AI/));
    fireEvent.click(await screen.findByRole("button", { name: /^Send$/ }));

    await screen.findByText(/Grilled salmon and salad/);
    expect(document.querySelector(".fhj-ai-badge")).toBeTruthy();

    saveSheet();
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    // On the timeline it is still hedged and still badged.
    expect(document.body.textContent).toContain("about 520 kcal");
    expect(document.querySelector(".fhj-ai-badge")).toBeTruthy();
  });

  it("stops hedging once the user accepts the estimate as their own", async () => {
    stubProvider({ nutrition: { calories: 520 }, confidence: "high" });
    await mountApp({ ai: true });
    await openFoodForm();
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Salmon" } });
    fireEvent.click(await screen.findByText(/Estimate nutrition with AI/));
    fireEvent.click(await screen.findByRole("button", { name: /^Send$/ }));

    fireEvent.click(await screen.findByRole("button", { name: "Use these" }));
    saveSheet();
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    expect(document.body.textContent).toContain("520 kcal");
    expect(document.body.textContent).not.toContain("about 520 kcal");
  });

  it("never sends an image on the text-only path", async () => {
    const sent = stubProvider({ nutrition: { calories: 100 }, confidence: "low" });
    await mountApp({ ai: true });
    await openFoodForm();
    fireEvent.change(await screen.findByPlaceholderText(/Chicken salad/), { target: { value: "Toast" } });
    fireEvent.click(await screen.findByText(/Estimate nutrition with AI/));
    fireEvent.click(await screen.findByRole("button", { name: /^Send$/ }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(JSON.stringify(sent[0])).not.toContain("inlineData");
  });
});

describe("the one-tap loop", () => {
  /** Log a food through the long form so the library learns it. */
  async function teachLibrary(name: string, kcal: string) {
    await openFoodForm();
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), { target: { value: name } });
    await openSection(/^Serving size/);
    fireEvent.change(screen.getByPlaceholderText("1 bowl"), { target: { value: "1 plate" } });
    fireEvent.change(screen.getByLabelText(/Calories in kcal/), { target: { value: kcal } });
    saveSheet();
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
  }

  it("saves a food to the library the first time it is logged", async () => {
    await mountApp();
    await teachLibrary("Chicken burrito bowl", "640");

    await openTile(/^Food/);
    const dlg = await pickerDialog();
    expect(within(dlg).getByText("Chicken burrito bowl")).toBeTruthy();
    expect(within(dlg).getByText(/1 plate/)).toBeTruthy();
  });

  it("re-logs a saved food in a single tap", async () => {
    await mountApp();
    await teachLibrary("Oats", "300");

    await openTile(/^Food/);
    fireEvent.click(await screen.findByRole("button", { name: /log one 1 plate of Oats/ }));

    await waitFor(() => expect(screen.queryByPlaceholderText("Search your foods")).toBeNull());
    // Two logs now, so the day's total is doubled.
    expect(document.body.textContent).toContain("600");
  });

  it("searches the library by name", async () => {
    await mountApp();
    await teachLibrary("Chicken burrito bowl", "640");
    await teachLibrary("Greek yoghurt", "120");

    await openTile(/^Food/);
    const dlg = await pickerDialog();
    fireEvent.change(within(dlg).getByPlaceholderText("Search your foods"), { target: { value: "yog" } });
    await waitFor(() => expect(within(dlg).queryByText("Chicken burrito bowl")).toBeNull());
    expect(within(dlg).getByText("Greek yoghurt")).toBeTruthy();
  });

  it("quick-adds bare calories without asking for a description", async () => {
    await mountApp();
    await openTile(/^Food/);
    fireEvent.change(await screen.findByPlaceholderText("e.g. 250"), { target: { value: "180" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.queryByPlaceholderText("Search your foods")).toBeNull());
    expect(document.body.textContent).toContain("Quick add");
    expect(document.body.textContent).toContain("180 kcal");
  });

  it("scales a serving without touching the saved food", async () => {
    await mountApp();
    await teachLibrary("Oats", "300");

    await openTile(/^Food/);
    const dlg = await pickerDialog();
    fireEvent.click(within(dlg).getByText("Oats")); // opens the serving stepper
    fireEvent.click(await screen.findByRole("button", { name: "more servings" }));
    fireEvent.click(screen.getByRole("button", { name: /^Add to (breakfast|lunch|dinner|snack|drink)/i }));

    await waitFor(() => expect(screen.queryByPlaceholderText("Search your foods")).toBeNull());
    // 300 from the original log + 450 from 1.5 servings.
    expect(document.body.textContent).toContain("750");
  });

  it("tells the user what the library is for before there is one", async () => {
    await mountApp();
    await openTile(/^Food/);
    expect(await screen.findByText(/build up as you log/i)).toBeTruthy();
  });

  it("keeps an unconfirmed estimate labelled when it is logged again", async () => {
    stubProvider({ nutrition: { calories: 400 }, confidence: "low" });
    await mountApp({ ai: true });
    await openFoodForm();
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), { target: { value: "Mystery curry" } });
    fireEvent.click(await screen.findByText(/Estimate nutrition with AI/));
    fireEvent.click(await screen.findByRole("button", { name: /^Send$/ }));
    await screen.findByText(/AI Estimated/);
    saveSheet();
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());

    // Logged again from the library, it is still an estimate — saving a food
    // must not launder a guess into a measurement.
    await openTile(/^Food/);
    fireEvent.click(await screen.findByRole("button", { name: /log one .* of Mystery curry/ }));
    await waitFor(() => expect(screen.queryByPlaceholderText("Search your foods")).toBeNull());
    expect(document.body.textContent).toContain("about 400 kcal");
  });
});

describe("the food diary", () => {
  const goToDiary = async () => {
    fireEvent.click(within(document.querySelector("nav")!).getByRole("button", { name: "History" }));
  fireEvent.click(screen.getByRole("button", { name: /^Diary/ }));
    await screen.findByRole("button", { name: "previous day" });
  };

  it("keeps a one-tap path into every meal, whether or not it has anything in it", async () => {
    await mountApp();
    await goToDiary();
    // Empty meals are chips rather than five empty cards — the labels and the
    // add path are unchanged, which is the whole point of the compression.
    for (const meal of ["Breakfast", "Lunch", "Dinner", "Snack", "Drink"]) {
      expect(screen.getByRole("button", { name: `Add food to ${meal}` }), meal).toBeTruthy();
    }
    expect(screen.getAllByRole("button", { name: /Add food to/ })).toHaveLength(5);
  });

  it("files a meal under the section it was added from", async () => {
    await mountApp();
    await goToDiary();
    fireEvent.click(screen.getByRole("button", { name: "Add food to Dinner" }));
    fireEvent.change(await screen.findByPlaceholderText("e.g. 250"), { target: { value: "700" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(screen.queryByPlaceholderText("Search your foods")).toBeNull());
    // Dinner now has something in it, so it is a card — with its own add button
    // still in reach, in the header this time.
    const dinnerCard = screen.getByText("Dinner").closest(".fhj-card")!;
    expect(within(dinnerCard as HTMLElement).getByText("Quick add")).toBeTruthy();
    expect(within(dinnerCard as HTMLElement).getByRole("button", { name: "Add food to Dinner" })).toBeTruthy();
  });

  it("pages back to a previous day", async () => {
    await mountApp();
    await goToDiary();
    const diary = () => within(document.getElementById("main")!);
    expect(diary().getByText("Today")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "previous day" }));
    await waitFor(() => expect(diary().queryByText("Today")).toBeNull());
  });

  it("won't page into the future", async () => {
    await mountApp();
    await goToDiary();
    expect(screen.getByRole("button", { name: "next day" })).toHaveProperty("disabled", true);
  });

  it("offers to set targets rather than inventing one", async () => {
    await mountApp();
    await goToDiary();
    expect(screen.getByText("Set daily targets")).toBeTruthy();
    // No goal means no progress bar and no ring — just what was eaten.
    expect(document.querySelector('[role="progressbar"]')).toBeNull();
  });
});

/* ============================================================
   Quick Add is the user's, not ours
   ============================================================ */

describe("editing Quick Add", () => {
  const tileLabels = () =>
    [...document.querySelectorAll(".fhj-tile")].map((t) => t.querySelector(".fhj-tile-label")?.textContent);

  const openEditor = async () => {
    // "Edit" alone said nothing out of context, so the control carries a label
    // that names what it edits.
    fireEvent.click(await screen.findByRole("button", { name: /Edit which Quick Add/ }));
    return (await screen.findByText("Edit Quick Add")).closest('[role="dialog"]') as HTMLElement;
  };

  it("opens an editor from the section heading", async () => {
    await mountApp();
    const dialog = await openEditor();
    // Everything on offer is listed, including the ones not currently shown.
    expect(within(dialog).getByText("Drink")).toBeTruthy();
    expect(within(dialog).getByText("Diary")).toBeTruthy();
  });

  it("adds a tile, and it appears on the dashboard", async () => {
    await mountApp();
    const dialog = await openEditor();
    fireEvent.click(within(dialog).getByText("Drink"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Edit Quick Add")).toBeNull());
    expect(tileLabels()).toContain("Drink");
  });

  it("reorders with the arrows", async () => {
    await mountApp();
    const dialog = await openEditor();
    const before = tileLabels();
    const wasAbove = before[before.indexOf("Food") - 1];
    fireEvent.click(within(dialog).getByRole("button", { name: "Move Food up" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Edit Quick Add")).toBeNull());
    const after = tileLabels();
    // Food traded places with whatever was above it, and nothing else moved.
    expect(after.indexOf("Food")).toBe(before.indexOf("Food") - 1);
    expect(after[before.indexOf("Food")]).toBe(wasAbove);
    expect(after.length).toBe(before.length);
  });

  it("removes a tile, and Cancel throws the change away", async () => {
    await mountApp();
    let dialog = await openEditor();
    fireEvent.click(within(dialog).getByRole("button", { name: /Remove Photo/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Edit Quick Add")).toBeNull());
    expect(tileLabels()).toContain("Photo");

    dialog = await openEditor();
    fireEvent.click(within(dialog).getByRole("button", { name: /Remove Photo/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Edit Quick Add")).toBeNull());
    expect(tileLabels()).not.toContain("Photo");
  });

  it("suggests the buttons this journal's conditions reach for", async () => {
    await mountApp();
    const dialog = await openEditor();
    fireEvent.click(within(dialog).getByRole("button", { name: /Remove Photo/ }));
    // Removed, and immediately offered back as a suggestion rather than
    // buried at the bottom of a list of everything.
    const suggest = await within(dialog).findByRole("button", { name: /Add Photo to Quick Add/ });
    fireEvent.click(suggest);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Edit Quick Add")).toBeNull());
    expect(tileLabels()).toContain("Photo");
  });

  it("keeps the choice across a reload", async () => {
    const { kv, unmount } = await mountApp();
    const dialog = await openEditor();
    fireEvent.click(within(dialog).getByText("Drink"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(kv.get("fhj_v1")).toContain("quickAdd"));

    unmount();
    cleanup();
    const { default: App } = await import("../src/App");
    render(<App />);
    await screen.findByText(/Quick Add/);
    expect(tileLabels()).toContain("Drink");
  });

  it("files a drink as a drink, not as whatever meal the clock says", async () => {
    await mountApp();
    let dialog = await openEditor();
    fireEvent.click(within(dialog).getByText("Drink"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByText("Edit Quick Add")).toBeNull());

    await openTile(/^Drink/);
    const picker = await pickerDialog();
    await openSection(/^When and which meal/, within(picker));
    expect((within(picker).getByLabelText(/Which meal/) as HTMLSelectElement).value).toBe("drink");
  });
});

describe("Today's Logs is a way in, not just a heading", () => {
  it("opens today's check-in when the heading row is pressed", async () => {
    await mountApp();
    fireEvent.click(await screen.findByRole("button", { name: /today's check-in/i }));
    /* The Log screen is up. Its header says which *day* rather than which
       screen — the nav already says that, and a second title row was what
       pushed the first question a third of the way down the phone — so this
       looks for the mode switch and the day pager instead. */
    await waitFor(() => expect(screen.getByRole("button", { name: /quick log/i })).toBeTruthy());
    expect(screen.getByRole("button", { name: "previous day" })).toBeTruthy();
  });
});

/* ============================================================
   Time on the fast path
   ============================================================ */

describe("saying when something was eaten", () => {
  it("stamps a one-tap log with the time in the picker, not the clock", async () => {
    await mountApp();
    await openTile(/^Food/);
    const picker = await pickerDialog();
    await openSection(/^When and which meal/, within(picker));
    fireEvent.change(within(picker).getByLabelText(/Time this was eaten/), { target: { value: "07:05" } });
    // The meal follows the time until the user says otherwise.
    expect((within(picker).getByLabelText(/Which meal/) as HTMLSelectElement).value).toBe("breakfast");

    fireEvent.change(within(picker).getByPlaceholderText(/e.g. 250/), { target: { value: "180" } });
    fireEvent.click(within(picker).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.queryByPlaceholderText("Search your foods")).toBeNull());

    const row = [...document.querySelectorAll(".fhj-tl-item")].find((r) => /Quick add/.test(r.textContent || ""))!;
    expect(row.textContent).toContain("7:05 am");
  });

  it("keeps a meal the user picked even if the time changes afterwards", async () => {
    await mountApp();
    await openTile(/^Food/);
    const picker = await pickerDialog();
    await openSection(/^When and which meal/, within(picker));
    fireEvent.change(within(picker).getByLabelText(/Which meal/), { target: { value: "snack" } });
    fireEvent.change(within(picker).getByLabelText(/Time this was eaten/), { target: { value: "07:05" } });
    expect((within(picker).getByLabelText(/Which meal/) as HTMLSelectElement).value).toBe("snack");
  });

  it("carries the time into the long form when the meal turns out to be new", async () => {
    await mountApp();
    await openTile(/^Food/);
    const picker = await pickerDialog();
    await openSection(/^When and which meal/, within(picker));
    fireEvent.change(within(picker).getByLabelText(/Time this was eaten/), { target: { value: "21:40" } });
    fireEvent.click(within(picker).getByRole("button", { name: /Something new/ }));
    await screen.findByText("Log food");
    // The long form folds When away too — the carried time is what it holds.
    expect(screen.getByRole("button", { name: /^When/ }).textContent).toContain("9:40 pm");
    await openSection(/^When/);
    expect((document.querySelector('input[type="time"]') as HTMLInputElement).value).toBe("21:40");
  });
});

/* ============================================================
   The photo leads, and can answer the form
   ============================================================ */

/** Index of a node in document order, for "does X come before Y" claims. */
const orderOf = (root: HTMLElement, el: Element) => [...root.querySelectorAll("*")].indexOf(el);

describe("the photo is the first thing asked for", () => {
  it("puts the camera above the description in the food sheet", async () => {
    await mountApp();
    await openFoodForm();
    const dialog = screen.getByText("Log food").closest('[role="dialog"]') as HTMLElement;
    const camera = within(dialog).getByRole("button", { name: /photo of the meal/i });
    const description = within(dialog).getByPlaceholderText(/Chicken salad/);
    expect(orderOf(dialog, camera)).toBeLessThan(orderOf(dialog, description));
  });

  /* In the bowel sheet the camera leads only when it is about to do the work.
     With auto-judging on, one photo answers type, amount, colour and
     consistency, so asking for it first saves four taps. With AI off — the
     shipped default — it answers nothing, and leading with it pushed the one
     control most people opened the sheet for below the fold. */
  it("puts the camera above the Bristol scale when auto-judging is on", async () => {
    await mountApp({ ai: true, auto: true });
    await openTile(/^Bowel/);
    const dialog = (await screen.findByText("Log bowel movement")).closest('[role="dialog"]') as HTMLElement;
    const camera = within(dialog).getByRole("button", { name: /take a photo/i });
    const bristol = within(dialog).getByRole("button", { name: /Smooth sausage/ });
    expect(orderOf(dialog, camera)).toBeLessThan(orderOf(dialog, bristol));
  });

  it("leads with the Bristol scale instead when AI is off", async () => {
    await mountApp();
    await openTile(/^Bowel/);
    const dialog = (await screen.findByText("Log bowel movement")).closest('[role="dialog"]') as HTMLElement;
    const bristol = within(dialog).getByRole("button", { name: /Smooth sausage/ });
    // The camera is still there, one section down, and still says so.
    await openSection(/^Photo and notes/, within(dialog));
    const camera = within(dialog).getByRole("button", { name: /take a photo/i });
    expect(orderOf(dialog, bristol)).toBeLessThan(orderOf(dialog, camera));
  });

  it("still asks every question it used to", async () => {
    // Folding fields away must not have dropped one on the way past. Each is
    // one tap from the top of the sheet, and none of them has gone.
    await mountApp();
    await openTile(/^Bowel/);
    await screen.findByText("Log bowel movement");
    await openSection(/^Amount, colour and consistency/);
    await openSection(/^How it felt/);
    await openSection(/^Photo and notes/);
    for (const label of ["Bristol type", "Amount", "Colour", "Consistency", "Urgency", "Straining", "Discomfort", "Notes"]) {
      expect(screen.getByText(label), label).toBeTruthy();
    }
  });
});

describe("letting AI answer the form is opt-in, per device", () => {
  const openAiSettings = async () => {
    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    return await screen.findByText("AI observations");
  };

  it("is off even when AI itself is on, and asks before sending", async () => {
    await mountApp({ ai: true });
    await openAiSettings();
    expect(
      screen.getByRole("switch", { name: /Let AI fill in the log for you/ }).getAttribute("aria-checked")
    ).toBe("false");
    // With it off, the bowel sheet still routes through the consent button.
    // Out of Settings the way a thumb would: the Today tab, which is in the
    // same place on every screen in the app.
    fireEvent.click(within(document.querySelector("nav")!).getByRole("button", { name: "Today" }));
    await screen.findByText(/Quick Add/);
    await openTile(/^Bowel/);
    await screen.findByText("Log bowel movement");
    expect(screen.queryByText(/Describe the photo with AI/)).toBeNull(); // no photo yet
  });

  it("is not offered at all while AI is switched off", async () => {
    await mountApp({ ai: false });
    await openAiSettings();
    expect(screen.queryByText(/Let AI fill in the log for you/)).toBeNull();
  });

  it("says in the switch itself that the confirm step is what's being traded away", async () => {
    await mountApp({ ai: true });
    await openAiSettings();
    const desc = screen.getByRole("switch", { name: /Let AI fill in the log for you/ }).textContent || "";
    expect(desc).toMatch(/without the confirm-before-sending step/i);
    expect(desc).toMatch(/never overwritten/i);
  });

  it("does not travel in a backup — a restore never switches sending on", async () => {
    const { __internals: I } = await import("../src/App");
    const db = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
    db.ai = { ...db.ai, enabled: true, auto: true };
    const backup = await I.buildFullBackup(db);
    expect(JSON.stringify(backup.ai)).not.toContain("auto");
    expect(I.migrateDb({ ...db, ai: { analysis: null, dismissed: [] } }).ai.auto).toBe(false);
  });
});

/* ============================================================
   A sheet scrolls itself, never the page behind it
   ============================================================ */

describe("scrolling inside a sheet", () => {
  it("marks the sheet as a scroller the smooth-scroll driver must not touch", async () => {
    /* Lenis owns the document scroller. Without this opt-out, a wheel event
       that starts inside the dialog moves the dashboard behind it and leaves
       the dialog exactly where it was. */
    await mountApp();
    await openTile(/^Bowel/);
    const dialog = (await screen.findByText("Log bowel movement")).closest('[role="dialog"]')!;
    expect(dialog.hasAttribute("data-lenis-prevent")).toBe(true);
    expect(dialog.classList.contains("fhj-sheet")).toBe(true);
  });

  it("pins the page while a sheet is open and puts it back afterwards", async () => {
    await mountApp();
    expect(document.body.style.position).not.toBe("fixed");

    await openTile(/^Bowel/);
    await screen.findByText("Log bowel movement");
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByText("Log bowel movement")).toBeNull());
    expect(document.body.style.position).not.toBe("fixed");
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("stays pinned when a second sheet closes on top of the first", async () => {
    // The consent sheet opening and closing over the food form must not
    // release the page while the form underneath is still up.
    const sent = stubProvider({ nutrition: { calories: 300 }, confidence: "low" });
    await mountApp({ ai: true });
    await openFoodForm();
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), { target: { value: "Toast" } });
    fireEvent.click(await screen.findByText(/Estimate nutrition with AI/));

    const consent = (await screen.findByText(/Send this for an estimate/)).closest('[role="dialog"]') as HTMLElement;
    expect(document.body.style.position).toBe("fixed");
    fireEvent.click(within(consent).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText(/Send this for an estimate/)).toBeNull());

    expect(sent).toHaveLength(0);
    expect(document.body.style.position).toBe("fixed"); // the food sheet is still open
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByText("Log food")).toBeNull());
    expect(document.body.style.position).not.toBe("fixed");
    vi.unstubAllGlobals();
  });
});

describe("what the sheet promises about the photo", () => {
  /* This is a claim about where someone's data goes, and it is keyed on the
     setting rather than on whether a photo happens to be attached yet — an
     earlier version said "nothing is sent unless you ask" on a screen that
     had already sent it. */
  it("says nothing is sent while auto-judging is off", async () => {
    await mountApp({ ai: true });
    await openTile(/^Bowel/);
    const dialog = (await screen.findByText("Log bowel movement")).closest('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toMatch(/Nothing is sent anywhere unless you ask/);
  });

  it("says the photo goes as soon as it is added once auto-judging is on", async () => {
    await mountApp({ ai: true, auto: true });
    await openTile(/^Bowel/);
    const bowel = (await screen.findByText("Log bowel movement")).closest('[role="dialog"]') as HTMLElement;
    expect(bowel.textContent).toMatch(/sent for a reading as soon as you add it/);
    expect(bowel.textContent).not.toMatch(/Nothing is sent anywhere unless you ask/);

    fireEvent.click(within(bowel).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByText("Log bowel movement")).toBeNull());

    await openFoodForm();
    const food = screen.getByText("Log food").closest('[role="dialog"]') as HTMLElement;
    expect(food.textContent).toMatch(/sent for a nutrition estimate as soon as you add it/);
  });

  it("skips the consent sheet on the text path too, since the switch already answered it", async () => {
    const sent = stubProvider({ nutrition: { calories: 410 }, confidence: "medium" });
    await mountApp({ ai: true, auto: true });
    await openFoodForm();
    fireEvent.change(screen.getByPlaceholderText(/Chicken salad/), { target: { value: "Porridge" } });
    fireEvent.click(await screen.findByText(/Estimate nutrition with AI/));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(screen.queryByText(/Send this for an estimate/)).toBeNull();
    vi.unstubAllGlobals();
  });
});
