/* Render smoke test: mounts the full App in jsdom and checks the two
   critical first-run paths — onboarding appears, and loading the Connor
   example data lands on a populated dashboard. Catches import-time and
   render-time crashes that pure-function tests can't. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

// This file doesn't run under vitest's `globals: true`, so @testing-library's
// auto-cleanup (which detects a global `afterEach`) never registers on its
// own — without this, renders from one test leak into the next test's DOM.
// Harmless for the earlier tests here (they only assert on substrings of
// document.body.textContent), but the App-lock tests below use single-match
// queries (getByLabelText/getByText) that throw on any leaked duplicate.
beforeEach(() => cleanup());

beforeAll(() => {
  // recharts needs ResizeObserver
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia =
    window.matchMedia ||
    ((q: string) =>
      ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as any));
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.confirm = () => true;
});

/** Minimal artifact-style storage mock preloaded with data. */
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

describe("App render smoke", () => {
  it("mounts straight to the dashboard with existing local data", async () => {
    const { __internals: I, default: App } = await import("../src/App");
    const db = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
    mockStorage({ fhj_v1: JSON.stringify(db) });
    render(React.createElement(App));
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/streak/i); // dashboard, not onboarding
      expect(document.body.textContent).not.toMatch(/welcome/i);
    });
    delete (window as any).storage;
  });

  it("shows the recovery screen (not a crash or silent reset) on corrupt local data", async () => {
    const { default: App } = await import("../src/App");
    const kv = mockStorage({ fhj_v1: "{ this is not json" });
    render(React.createElement(App));
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/couldn't be read/i);
      expect(document.body.textContent).toMatch(/download recovery file/i);
    });
    expect(kv.get("fhj_v1")).toBe("{ this is not json"); // untouched
    delete (window as any).storage;
  });

  it("recovers to a structurally-invalid-but-parsable db the same way", async () => {
    const { default: App } = await import("../src/App");
    mockStorage({ fhj_v1: JSON.stringify({ profile: "broken", entries: "also broken" }) });
    render(React.createElement(App));
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/couldn't be read/i);
    });
    delete (window as any).storage;
  });

  it("mounts to the onboarding wizard on a fresh install", async () => {
    const { default: App } = await import("../src/App");
    render(React.createElement(App));
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/not medical advice/i);
    });
  });

  it("loads the Connor example data and shows a populated dashboard", async () => {
    const { default: App } = await import("../src/App");
    render(React.createElement(App));
    const btn = await waitFor(() => {
      const b = screen
        .getAllByRole("button")
        .find((el) => /example|sample/i.test(el.textContent || ""));
      expect(b).toBeTruthy();
      return b!;
    });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/streak/i);
    });
  });
});

describe("App lock", () => {
  it("is off by default — existing journal data with no PIN record opens straight to the dashboard", async () => {
    const { __internals: I, default: App } = await import("../src/App");
    const db = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
    mockStorage({ fhj_v1: JSON.stringify(db) });
    render(React.createElement(App));
    await waitFor(() => expect(document.body.textContent).toMatch(/streak/i));
    expect(document.body.textContent).not.toMatch(/enter your pin/i);
    delete (window as any).storage;
  });

  it("locks the app when a PIN record exists, hiding journal content behind it", async () => {
    const { __internals: I, default: App } = await import("../src/App");
    const { createPinRecord } = await import("../src/lib/lock");
    const db = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
    const record = await createPinRecord("1234");
    mockStorage({ fhj_v1: JSON.stringify(db), fhj_lock_v1: JSON.stringify(record) });
    render(React.createElement(App));
    await waitFor(() => expect(document.body.textContent).toMatch(/enter your pin/i));
    expect(document.body.textContent).not.toMatch(/streak/i);
    delete (window as any).storage;
  });

  it("rejects a wrong PIN and stays locked, then unlocks on the correct one", async () => {
    const { __internals: I, default: App } = await import("../src/App");
    const { createPinRecord } = await import("../src/lib/lock");
    const db = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
    const record = await createPinRecord("4321");
    mockStorage({ fhj_v1: JSON.stringify(db), fhj_lock_v1: JSON.stringify(record) });
    render(React.createElement(App));
    const input = await waitFor(() => screen.getByLabelText(/enter your pin/i));

    fireEvent.change(input, { target: { value: "0000" } });
    await waitFor(() => expect(document.body.textContent).toMatch(/doesn't match/i));
    expect(document.body.textContent).not.toMatch(/streak/i);

    fireEvent.change(input, { target: { value: "4321" } });
    await waitFor(() => expect(document.body.textContent).toMatch(/streak/i));
    delete (window as any).storage;
  });

  it("turning a PIN on, then changing it via Settings, doesn't leak state between steps (regression)", async () => {
    // Each PIN-flow step renders a fresh LockScreen instance (distinct `key`s
    // in App.tsx) specifically so a stale value from one step can't bleed
    // into the next — this test pins that behavior down end to end.
    const { default: App } = await import("../src/App");
    mockStorage({});
    render(React.createElement(App));

    // fresh install -> demo data -> dashboard
    const demoBtn = await waitFor(() => {
      const b = screen.getAllByRole("button").find((el) => /example|sample/i.test(el.textContent || ""));
      expect(b).toBeTruthy();
      return b!;
    });
    fireEvent.click(demoBtn);
    await waitFor(() => expect(document.body.textContent).toMatch(/streak/i));

    // dashboard -> settings
    fireEvent.click(screen.getByLabelText("settings"));
    await waitFor(() => expect(document.body.textContent).toMatch(/taps & sounds/i));

    // turn on PIN lock: 1357 / 1357
    fireEvent.click(screen.getByText("Turn on PIN lock"));
    let input = await waitFor(() => screen.getByLabelText(/choose a pin/i));
    fireEvent.change(input, { target: { value: "1357" } });
    input = await waitFor(() => screen.getByLabelText(/confirm your pin/i));
    fireEvent.change(input, { target: { value: "1357" } });
    await waitFor(() => expect(document.body.textContent).toMatch(/taps & sounds/i));
    expect(document.body.textContent).toMatch(/change pin/i);

    // change PIN: verify 1357, then set 2468 / 2468 — this is exactly the
    // verify -> create transition that used to carry over stale input state
    fireEvent.click(screen.getByText("Change PIN"));
    input = await waitFor(() => screen.getByLabelText(/enter your current pin/i));
    fireEvent.change(input, { target: { value: "1357" } });
    input = await waitFor(() => screen.getByLabelText(/choose a new pin/i));
    fireEvent.change(input, { target: { value: "2468" } });
    input = await waitFor(() => screen.getByLabelText(/confirm your pin/i));
    fireEvent.change(input, { target: { value: "2468" } });
    await waitFor(() => expect(document.body.textContent).toMatch(/taps & sounds/i));
    expect(document.body.textContent).not.toMatch(/didn't match/i);

    // the new PIN (2468) verifies; the old one (1357) no longer does
    fireEvent.click(screen.getByText("Turn off PIN lock"));
    input = await waitFor(() => screen.getByLabelText(/turn off the lock/i));
    fireEvent.change(input, { target: { value: "1357" } });
    await waitFor(() => expect(document.body.textContent).toMatch(/doesn't match/i));
    fireEvent.change(input, { target: { value: "2468" } });
    await waitFor(() => expect(document.body.textContent).toMatch(/turn on pin lock/i));
    delete (window as any).storage;
  });
});
