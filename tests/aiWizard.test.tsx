/* Guided AI setup.

   What these pin is the "impossible to get lost" property, which is really a
   set of small guarantees: you can't advance past a step you haven't
   completed, you're never told to go somewhere else to finish, a rejected key
   is a fixable step rather than a dead end, and the flow ends with a result
   instead of an instruction. Each of those is easy to erode by accident. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import App, { __internals as I } from "../src/App";
import { clearKey, saveKey } from "../src/lib/ai";

const GOOD_KEY = "AIzaSyEXAMPLEexampleEXAMPLEexample1234";

beforeAll(() => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: q.includes("reduce"), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  } as any));
  window.scrollTo = vi.fn();
  window.open = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

let kv: Map<string, string>;

/** Mount, then land on Insights.

    Possible Patterns — and with it the AI setup entry point — moved off the
    first screen when the dashboard was split in two: Today is for logging,
    Insights is for what the app has worked out. Everything these tests are
    about is on the second one. */
async function mountApp(entryCount?: number, aiEnabled = false) {
  const db: any = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  if (entryCount !== undefined) db.entries = db.entries.slice(-entryCount);
  if (aiEnabled) db.ai = { ...db.ai, enabled: true };
  kv = new Map([["fhj_v1", JSON.stringify(db)]]);
  (window as any).storage = {
    async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
    async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
    async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
    async list() { return { keys: [...kv.keys()] }; },
  };
  const r = render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Insights" }, { timeout: 10000 }));
  return r;
}

/** The provider says yes to everything unless a test says otherwise. Model
    discovery and the chat call are separate round trips, so both are answered. */
function stubGoogle(opts: { keyOk?: boolean; patterns?: unknown[]; models?: string[] } = {}) {
  const { keyOk = true, patterns = [], models = ["gemini-3.5-flash"] } = opts;
  const fetchMock = vi.fn(async (url: string) => {
    if (!keyOk) return { ok: false, status: 403, text: async () => "denied" } as any;
    if (String(url).endsWith("/models")) {
      return {
        ok: true,
        json: async () => ({ models: models.map((m) => ({ name: `models/${m}` })) }),
      } as any;
    }
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ patterns }) }] } }],
      }),
    } as any;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const openWizard = async () => {
  const start = await screen.findByRole(
    "button", { name: /Set it up — about a minute/i }, { timeout: 10000 }
  );
  fireEvent.click(start);
  return screen.findByRole("dialog", { name: /Set up AI observations/i });
};

const STEPS = 5;
const step = (n: number) => screen.findByText(new RegExp(`Step ${n} of ${STEPS}`));
/** Step 1 → 2 (intro) → 3 (provider) — the shared run-up to the key steps. */
async function toKeyIntro() {
  fireEvent.click(btn(/^Get started$/));
  await step(2);
  fireEvent.click(btn(/^Use Google Gemini$/));
  await step(3);
}
const btn = (name: RegExp) => screen.getByRole("button", { name });

beforeEach(async () => { cleanup(); await clearKey(); });
afterEach(() => vi.unstubAllGlobals());

describe("getting in", () => {
  it("offers one guided button on the Insights screen, not a trip to Settings", async () => {
    stubGoogle();
    await mountApp();
    const start = await screen.findByRole(
      "button", { name: /Set it up — about a minute/i }, { timeout: 10000 }
    );
    expect(start).toBeTruthy();
    // The old copy sent people to another screen to work it out themselves.
    expect(document.body.textContent).not.toContain("Set this up in Settings");
  });

  it("opens in place, without navigating away from Insights", async () => {
    stubGoogle();
    await mountApp();
    await openWizard();
    await step(1);
    expect(document.body.textContent).toContain("A second opinion on your own logs");
  });

  it("states what leaves the device before asking for anything", async () => {
    stubGoogle();
    await mountApp();
    await openWizard();
    expect(document.body.textContent).toContain("Only numbers leave this device");
    expect(document.body.textContent).toContain("Nothing sends by itself");
  });
});

describe("choosing a provider", () => {
  it("offers a choice, with the easiest one preselected", async () => {
    stubGoogle();
    await mountApp();
    const dialog = await openWizard();
    fireEvent.click(btn(/^Get started$/));
    await step(2);
    /* Scoped to the wizard: Insights behind it now carries its own radiogroup
       (the time-range control). The wizard is aria-modal, so a screen reader
       never sees those — but a global getAllByRole does. */
    const options = within(dialog).getAllByRole("radio");
    expect(options.length).toBeGreaterThanOrEqual(3);
    expect(options.find((o) => o.getAttribute("aria-checked") === "true")!.textContent)
      .toMatch(/Google Gemini/);
  });

  it("answers the ChatGPT question in place instead of letting people hit a wall", async () => {
    stubGoogle();
    await mountApp();
    await openWizard();
    fireEvent.click(btn(/^Get started$/));
    await step(2);
    expect(document.body.textContent).toMatch(/What about ChatGPT\?/);
    expect(document.body.textContent).toMatch(/browser/i);
  });

  it("carries the choice into the steps that follow", async () => {
    stubGoogle();
    await mountApp();
    await openWizard();
    fireEvent.click(btn(/^Get started$/));
    await step(2);
    fireEvent.click(screen.getByRole("radio", { name: /OpenRouter/i }));
    fireEvent.click(btn(/^Use OpenRouter$/));
    await step(3);
    expect(document.body.textContent).toMatch(/Open OpenRouter/);
    fireEvent.click(btn(/I've copied my key/i));
    await step(4);
    expect(screen.getByLabelText(/Your OpenRouter API key/i)).toBeTruthy();
  });

  it("asks a custom provider for an endpoint as well as a key", async () => {
    stubGoogle();
    await mountApp();
    await openWizard();
    fireEvent.click(btn(/^Get started$/));
    await step(2);
    fireEvent.click(screen.getByRole("radio", { name: /Something else/i }));
    fireEvent.click(btn(/^Use Something else$/));
    await step(3);
    fireEvent.click(btn(/I've copied my key/i));
    await step(4);
    expect(screen.getByLabelText(/Endpoint address/i)).toBeTruthy();
    expect(document.body.textContent).toMatch(/Enter the endpoint address and your key/);
  });
});

describe("the key step can't be skipped or fumbled", () => {
  async function reachKeyStep() {
    await openWizard();
    await toKeyIntro();
    fireEvent.click(btn(/I've copied my key/i));
    await step(4);
  }

  it("blocks Continue until a key is verified, and says why", async () => {
    stubGoogle();
    await mountApp();
    await reachKeyStep();
    expect(btn(/Save and continue/i)).toHaveProperty("disabled", true);
    expect(document.body.textContent).toContain("Paste your key to continue");
  });

  it("rejects an incomplete key without spending a request", async () => {
    const fetchMock = stubGoogle();
    await mountApp();
    await reachKeyStep();
    fireEvent.change(screen.getByLabelText(/Your Google Gemini API key/i), { target: { value: "AIza-short" } });
    await waitFor(() => expect(document.body.textContent).toMatch(/doesn't look like a full key/));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(btn(/Save and continue/i)).toHaveProperty("disabled", true);
  });

  it("verifies on paste — there is no Test button to know about", async () => {
    const fetchMock = stubGoogle();
    await mountApp();
    await reachKeyStep();
    expect(screen.queryByRole("button", { name: /^Test/i })).toBeNull();
    fireEvent.change(screen.getByLabelText(/Your Google Gemini API key/i), { target: { value: GOOD_KEY } });
    await waitFor(() => expect(document.body.textContent).toMatch(/Connected\. Using/), { timeout: 5000 });
    expect(fetchMock).toHaveBeenCalled();
    expect(btn(/Save and continue/i)).toHaveProperty("disabled", false);
  });

  it("keeps a rejected key fixable instead of dead-ending", async () => {
    stubGoogle({ keyOk: false });
    await mountApp();
    await reachKeyStep();
    fireEvent.change(screen.getByLabelText(/Your Google Gemini API key/i), { target: { value: GOOD_KEY } });
    await waitFor(() => expect(document.body.textContent).toMatch(/rejected that key/i), { timeout: 5000 });
    expect(btn(/Save and continue/i)).toHaveProperty("disabled", true);

    // A flaky network or a key Google hasn't propagated yet must not trap anyone.
    fireEvent.click(btn(/Use this key anyway/i));
    await waitFor(() => expect(btn(/Save and continue/i)).toHaveProperty("disabled", false));
    expect(document.body.textContent).toMatch(/Saved without a successful check/);
  });

  it("saves the key only once the step is actually completed", async () => {
    stubGoogle();
    await mountApp();
    await reachKeyStep();
    fireEvent.change(screen.getByLabelText(/Your Google Gemini API key/i), { target: { value: GOOD_KEY } });
    await waitFor(() => expect(document.body.textContent).toMatch(/Connected\. Using/), { timeout: 5000 });
    expect(kv.has("fhj_ai_conn_v1")).toBe(false); // typed, not committed
    fireEvent.click(btn(/Save and continue/i));
    await waitFor(() => expect(kv.get("fhj_ai_conn_v1")).toContain(GOOD_KEY));
  });

  it("never renders the key back in full", async () => {
    stubGoogle();
    await mountApp();
    await reachKeyStep();
    const field = screen.getByLabelText(/Your Google Gemini API key/i) as HTMLInputElement;
    fireEvent.change(field, { target: { value: GOOD_KEY } });
    await waitFor(() => expect(document.body.textContent).toMatch(/Connected\. Using/), { timeout: 5000 });
    expect(field.type).toBe("password");
    expect(document.body.textContent).not.toContain(GOOD_KEY);
  });
});

describe("the last step", () => {
  async function reachReview(entries?: number) {
    await mountApp(entries);
    await openWizard();
    await toKeyIntro();
    fireEvent.click(btn(/I've copied my key/i));
    await step(4);
    fireEvent.change(screen.getByLabelText(/Your Google Gemini API key/i), { target: { value: GOOD_KEY } });
    await waitFor(() => expect(document.body.textContent).toMatch(/Connected\. Using/), { timeout: 5000 });
    fireEvent.click(btn(/Save and continue/i));
    await step(5);
  }

  it("shows the payload before anything is sent", async () => {
    stubGoogle();
    await reachReview();
    expect(document.body.textContent).toContain("Here's exactly what gets sent");
    expect(document.body.textContent).toContain("Not sending");
    expect(document.body.textContent).toMatch(/your written notes/);
  });

  it("ends with a result rather than an instruction to go and find one", async () => {
    stubGoogle({
      patterns: [{
        title: "Your entries show itch running higher after short sleep",
        detail: "Itch averaged 6.4 on those days, against 4.8 otherwise.",
        evidence: "9 days vs 24.", metrics: ["Itch"], strength: "moderate", kind: "sleep-mood",
      }],
    });
    await reachReview();
    fireEvent.click(btn(/Send and analyse/i));
    await waitFor(
      () => expect(document.body.textContent).toContain("Your entries show itch running higher"),
      { timeout: 10000 }
    );
    // and the wizard got out of the way
    expect(screen.queryByRole("dialog", { name: /Set up AI observations/i })).toBeNull();
  });

  it("completes setup without a doomed send when the journal is too thin", async () => {
    stubGoogle();
    await reachReview(2);
    expect(document.body.textContent).toContain("You're set up");
    expect(document.body.textContent).toMatch(/needs at least 5/);
    expect(screen.queryByRole("button", { name: /Send and analyse/i })).toBeNull();
    expect(btn(/^Done$/)).toBeTruthy();
  });

  it("turns the feature on only at the end, not when the wizard opens", async () => {
    stubGoogle();
    await reachReview(2);
    expect(JSON.parse(kv.get("fhj_v1")!).ai?.enabled).not.toBe(true);
    fireEvent.click(btn(/^Done$/));
    await waitFor(() => expect(JSON.parse(kv.get("fhj_v1")!).ai?.enabled).toBe(true));
  });
});

describe("the model is discovered, never assumed", () => {
  it("picks a model the key can actually reach and shows which", async () => {
    // A key issued today cannot see gemini-2.5-flash; the old build hard-coded
    // it and 404'd for every new user.
    stubGoogle({ models: ["gemini-3.5-flash", "gemini-3.5-pro", "text-embedding-004"] });
    await mountApp();
    await openWizard();
    fireEvent.click(btn(/^Get started$/));
    await step(2);
    fireEvent.click(btn(/^Use Google Gemini$/));
    await step(3);
    fireEvent.click(btn(/I've copied my key/i));
    await step(4);
    fireEvent.change(screen.getByLabelText(/Your Google Gemini API key/i), { target: { value: GOOD_KEY } });
    await waitFor(
      () => expect(document.body.textContent).toContain("Connected. Using gemini-3.5-flash."),
      { timeout: 5000 }
    );
  });

  it("blocks the step when a key works but has no usable model behind it", async () => {
    stubGoogle({ models: ["text-embedding-004"] });
    await mountApp();
    await openWizard();
    fireEvent.click(btn(/^Get started$/));
    await step(2);
    fireEvent.click(btn(/^Use Google Gemini$/));
    await step(3);
    fireEvent.click(btn(/I've copied my key/i));
    await step(4);
    fireEvent.change(screen.getByLabelText(/Your Google Gemini API key/i), { target: { value: GOOD_KEY } });
    await waitFor(
      () => expect(document.body.textContent).toMatch(/no usable chat model/i),
      { timeout: 5000 }
    );
    expect(btn(/Save and continue/i)).toHaveProperty("disabled", true);
  });
});

describe("someone who is already set up", () => {
  it("skips straight to the run instead of being walked through again", async () => {
    stubGoogle();
    await saveKey(GOOD_KEY, "persist");
    await mountApp(undefined, true);
    // With a key present and the feature on, Insights offers the analysis
    // rather than the walkthrough.
    await waitFor(
      () => expect(document.body.textContent).toMatch(/Analyse my last 90 days|Regenerate/),
      { timeout: 10000 }
    );
    expect(screen.queryByRole("button", { name: /Set it up — about a minute/i })).toBeNull();
  });

  it("offers a one-tap re-enable, not a rerun of setup, when only the toggle is off", async () => {
    stubGoogle();
    await saveKey(GOOD_KEY, "persist");
    await mountApp(); // key on device, feature off
    await waitFor(
      () => expect(document.body.textContent).toMatch(/Turn it back on/),
      { timeout: 10000 }
    );
    expect(screen.queryByRole("button", { name: /Set it up — about a minute/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Turn it back on/i }));
    await waitFor(
      () => expect(document.body.textContent).toMatch(/Analyse my last 90 days/),
      { timeout: 10000 }
    );
  });
});
