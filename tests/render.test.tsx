/* Render smoke test: mounts the full App in jsdom and checks the two
   critical first-run paths — onboarding appears, and loading the Connor
   example data lands on a populated dashboard. Catches import-time and
   render-time crashes that pure-function tests can't. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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
