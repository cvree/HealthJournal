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

function mountApp(entryCount?: number, aiEnabled = false) {
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
  return render(<App />);
}

/** Google says yes to everything unless a test says otherwise. */
function stubGoogle(opts: { keyOk?: boolean; patterns?: unknown[] } = {}) {
  const { keyOk = true, patterns = [] } = opts;
  const fetchMock = vi.fn(async (_url: string, init: any) => {
    if (!keyOk) return { ok: false, status: 403, text: async () => "denied" } as any;
    const body = String(init?.body || "");
    const text = /Reply with the single word/.test(body)
      ? "ready"
      : JSON.stringify({ patterns });
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) } as any;
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

const step = (n: number) => screen.findByText(new RegExp(`Step ${n} of 4`));
const btn = (name: RegExp) => screen.getByRole("button", { name });

beforeEach(async () => { cleanup(); await clearKey(); });
afterEach(() => vi.unstubAllGlobals());

describe("getting in", () => {
  it("offers one guided button on the dashboard, not a trip to Settings", async () => {
    stubGoogle();
    mountApp();
    const start = await screen.findByRole(
      "button", { name: /Set it up — about a minute/i }, { timeout: 10000 }
    );
    expect(start).toBeTruthy();
    // The old copy sent people to another screen to work it out themselves.
    expect(document.body.textContent).not.toContain("Set this up in Settings");
  });

  it("opens in place, without navigating away from the dashboard", async () => {
    stubGoogle();
    mountApp();
    await openWizard();
    await step(1);
    expect(document.body.textContent).toContain("A second opinion on your own logs");
  });

  it("states what leaves the device before asking for anything", async () => {
    stubGoogle();
    mountApp();
    await openWizard();
    expect(document.body.textContent).toContain("Only numbers leave this device");
    expect(document.body.textContent).toContain("Nothing sends by itself");
  });
});

describe("the key step can't be skipped or fumbled", () => {
  async function reachKeyStep() {
    await openWizard();
    fireEvent.click(btn(/^Get started$/));
    await step(2);
    fireEvent.click(btn(/I've copied my key/i));
    await step(3);
  }

  it("blocks Continue until a key is verified, and says why", async () => {
    stubGoogle();
    mountApp();
    await reachKeyStep();
    expect(btn(/Save and continue/i)).toHaveProperty("disabled", true);
    expect(document.body.textContent).toContain("Paste your key to continue");
  });

  it("rejects an incomplete key without spending a request", async () => {
    const fetchMock = stubGoogle();
    mountApp();
    await reachKeyStep();
    fireEvent.change(screen.getByLabelText(/Your Gemini API key/i), { target: { value: "AIza-short" } });
    await waitFor(() => expect(document.body.textContent).toMatch(/doesn't look like a full key/));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(btn(/Save and continue/i)).toHaveProperty("disabled", true);
  });

  it("verifies on paste — there is no Test button to know about", async () => {
    const fetchMock = stubGoogle();
    mountApp();
    await reachKeyStep();
    expect(screen.queryByRole("button", { name: /^Test/i })).toBeNull();
    fireEvent.change(screen.getByLabelText(/Your Gemini API key/i), { target: { value: GOOD_KEY } });
    await waitFor(() => expect(document.body.textContent).toContain("That key works."), { timeout: 5000 });
    expect(fetchMock).toHaveBeenCalled();
    expect(btn(/Save and continue/i)).toHaveProperty("disabled", false);
  });

  it("keeps a rejected key fixable instead of dead-ending", async () => {
    stubGoogle({ keyOk: false });
    mountApp();
    await reachKeyStep();
    fireEvent.change(screen.getByLabelText(/Your Gemini API key/i), { target: { value: GOOD_KEY } });
    await waitFor(() => expect(document.body.textContent).toMatch(/Google rejected that key/), { timeout: 5000 });
    expect(btn(/Save and continue/i)).toHaveProperty("disabled", true);

    // A flaky network or a key Google hasn't propagated yet must not trap anyone.
    fireEvent.click(btn(/Use this key anyway/i));
    await waitFor(() => expect(btn(/Save and continue/i)).toHaveProperty("disabled", false));
    expect(document.body.textContent).toMatch(/Saved without a successful check/);
  });

  it("saves the key only once the step is actually completed", async () => {
    stubGoogle();
    mountApp();
    await reachKeyStep();
    fireEvent.change(screen.getByLabelText(/Your Gemini API key/i), { target: { value: GOOD_KEY } });
    await waitFor(() => expect(document.body.textContent).toContain("That key works."), { timeout: 5000 });
    expect(kv.has("fhj_ai_key_v1")).toBe(false); // typed, not committed
    fireEvent.click(btn(/Save and continue/i));
    await waitFor(() => expect(kv.get("fhj_ai_key_v1")).toBe(GOOD_KEY));
  });

  it("never renders the key back in full", async () => {
    stubGoogle();
    mountApp();
    await reachKeyStep();
    const field = screen.getByLabelText(/Your Gemini API key/i) as HTMLInputElement;
    fireEvent.change(field, { target: { value: GOOD_KEY } });
    await waitFor(() => expect(document.body.textContent).toContain("That key works."), { timeout: 5000 });
    expect(field.type).toBe("password");
    expect(document.body.textContent).not.toContain(GOOD_KEY);
  });
});

describe("the last step", () => {
  async function reachReview(entries?: number) {
    mountApp(entries);
    await openWizard();
    fireEvent.click(btn(/^Get started$/));
    await step(2);
    fireEvent.click(btn(/I've copied my key/i));
    await step(3);
    fireEvent.change(screen.getByLabelText(/Your Gemini API key/i), { target: { value: GOOD_KEY } });
    await waitFor(() => expect(document.body.textContent).toContain("That key works."), { timeout: 5000 });
    fireEvent.click(btn(/Save and continue/i));
    await step(4);
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

describe("someone who is already set up", () => {
  it("skips straight to the run instead of being walked through again", async () => {
    stubGoogle();
    await saveKey(GOOD_KEY, "persist");
    mountApp(undefined, true);
    // With a key present and the feature on, the dashboard offers the analysis
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
    mountApp(); // key on device, feature off
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
