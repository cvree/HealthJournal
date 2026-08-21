/* One hand, driven through the real app.

   The claim this release makes is not "there is a fan component". It is that
   somebody holding a phone in one hand can reach every part of their journal
   and get back out again without regripping. That is a claim about the app,
   so these run against the app: mount it, and use it the way a thumb would. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import App, { __internals as I } from "../src/App";
import { DESTINATIONS, FAN_SEEN_KEY, HAND_STORAGE_KEY } from "../src/lib/oneHanded";

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

async function mountApp() {
  const db: any = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  kv = new Map([["fhj_v1", JSON.stringify(db)]]);
  (window as any).storage = {
    async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
    async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
    async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
    async list() { return { keys: [...kv.keys()] }; },
  };
  render(<App />);
  await screen.findByRole("button", { name: "History" }, { timeout: 10000 });
}

const nav = () => within(document.querySelector("nav")!);
const shell = () => document.querySelector(".fhj-shell")!;
const addButton = () => nav().getByRole("button", { name: "Add to today" });

/* Push up off the + — the fast way in. (Holding it does the same thing after
   240ms; the swipe needs no timers, so it is what these drive.) */
async function openFan() {
  const add = addButton();
  fireEvent.pointerDown(add, { pointerId: 1, clientX: 195, clientY: 760, button: 0 });
  fireEvent.pointerMove(add, { pointerId: 1, clientX: 195, clientY: 690 });
  return await screen.findByRole("dialog", { name: "Go anywhere" });
}

beforeEach(() => {
  cleanup();
  localStorage.removeItem(HAND_STORAGE_KEY);
  localStorage.removeItem(FAN_SEEN_KEY);
  document.documentElement.removeAttribute("data-hand");
});

describe("the bar does not move under the thumb", () => {
  it("is the same three controls in the same three places, on every screen", async () => {
    await mountApp();
    const shape = () => nav().getAllByRole("button")
      .map((b) => b.textContent!.trim() || b.getAttribute("aria-label"));
    expect(shape()).toEqual(["Today", "History", "Add to today"]);

    fireEvent.click(nav().getByRole("button", { name: "History" }));
    // Back joins it, but the three keep their places rather than being
    // displaced — the whole point of a bar a thumb can use without looking.
    await waitFor(() => expect(nav().queryByRole("button", { name: "Back to Today" })).toBeTruthy());
    const labels = nav().getAllByRole("button").map((b) => b.textContent!.trim() || b.getAttribute("aria-label"));
    expect(labels.slice(-3)).toEqual(["Today", "History", "Add to today"]);
  });

  it("offers nothing to go back to on the screen the app opens on", async () => {
    await mountApp();
    expect(nav().queryByRole("button", { name: /^Back to/ })).toBeNull();
  });
});

describe("back means where you came from", () => {
  it("returns to the screen a destination was opened from, not to Today", async () => {
    await mountApp();
    fireEvent.click(nav().getByRole("button", { name: "History" }));
    const fan = await openFan();
    fireEvent.click(within(fan).getByRole("button", { name: "Sun" }));
    await screen.findByRole("heading", { name: /Sun/, level: 1 });

    const back = await nav().findByRole("button", { name: "Back to History" });
    fireEvent.click(back);
    await waitFor(() =>
      expect(nav().getByRole("button", { name: "History" }).getAttribute("aria-current")).toBe("page"));
  });

  it("says the same thing in the header arrow", async () => {
    await mountApp();
    fireEvent.click(nav().getByRole("button", { name: "History" }));
    const fan = await openFan();
    fireEvent.click(within(fan).getByRole("button", { name: "Labs" }));
    expect(await screen.findByRole("button", { name: "Back to History" })).toBeTruthy();
  });

  it("is what the phone's own back button means too", async () => {
    await mountApp();
    fireEvent.click(nav().getByRole("button", { name: "History" }));
    await waitFor(() =>
      expect(nav().getByRole("button", { name: "History" }).getAttribute("aria-current")).toBe("page"));
    fireEvent.popState(window, {});
    await waitFor(() =>
      expect(nav().getByRole("button", { name: "Today" }).getAttribute("aria-current")).toBe("page"));
  });
});

describe("the fan", () => {
  it("puts every part of the app one press from the corner", async () => {
    await mountApp();
    const fan = await openFan();
    for (const d of DESTINATIONS) {
      expect(within(fan).getByRole("button", { name: d.label })).toBeTruthy();
    }
  });

  it("goes where it is told", async () => {
    await mountApp();
    const fan = await openFan();
    fireEvent.click(within(fan).getByRole("button", { name: "Experiments" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Go anywhere" })).toBeNull());
    expect(await screen.findByRole("heading", { name: /Experiment/i })).toBeTruthy();
  });

  it("marks where you already are without offering it as news", async () => {
    await mountApp();
    const fan = await openFan();
    expect(within(fan).getByRole("button", { name: "Today" }).getAttribute("aria-current")).toBe("page");
  });

  it("closes on Escape, having changed nothing", async () => {
    await mountApp();
    await openFan();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Go anywhere" })).toBeNull());
    expect(nav().getByRole("button", { name: "Today" }).getAttribute("aria-current")).toBe("page");
  });

  it("opens from the keyboard as well as from a thumb", async () => {
    await mountApp();
    fireEvent.keyDown(addButton(), { key: "ArrowUp" });
    expect(await screen.findByRole("dialog", { name: "Go anywhere" })).toBeTruthy();
  });

  it("moves to the other hand, and takes the + with it", async () => {
    await mountApp();
    const fan = await openFan();
    expect(fan.getAttribute("data-hand")).toBe("right");
    fireEvent.click(within(fan).getByRole("button", { name: /Left-handed/ }));
    await waitFor(() => expect(document.documentElement.getAttribute("data-hand")).toBe("left"));
    expect(localStorage.getItem(HAND_STORAGE_KEY)).toBe("left");
    // The whole point: the + is under the thumb that is actually holding the
    // phone, so it leads the bar rather than ending it.
    const labels = nav().getAllByRole("button").map((b) => b.textContent!.trim() || b.getAttribute("aria-label"));
    expect(labels).toEqual(["Add to today", "Today", "History"]);
  });

  it("is said once and then never again", async () => {
    await mountApp();
    expect(screen.getByRole("button", { name: /Hold . to go anywhere/ })).toBeTruthy();
    await openFan();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Go anywhere" })).toBeNull());
    expect(screen.queryByRole("button", { name: /Hold . to go anywhere/ })).toBeNull();
    expect(localStorage.getItem(FAN_SEEN_KEY)).toBe("1");
  });

  it("does not offer the read-only viewer a door it would be thrown out of", async () => {
    (window as any).storage = {
      async get() { return null; }, async set() { return null; },
      async delete() { return null; }, async list() { return { keys: [] }; },
    };
    render(<App viewer />);
    fireEvent.click(screen.getByText(/browse example data/i));
    await waitFor(() => expect(document.querySelector("nav")).toBeTruthy());
    // No +, so no fan, and nothing that writes is reachable from the bar.
    expect(nav().queryByRole("button", { name: "Add to today" })).toBeNull();
  });
});

describe("bringing the screen into reach", () => {
  it("slides the page down to the thumb and offers a way to put it back", async () => {
    await mountApp();
    const add = addButton();
    fireEvent.pointerDown(add, { pointerId: 2, clientX: 195, clientY: 700, button: 0 });
    fireEvent.pointerMove(add, { pointerId: 2, clientX: 195, clientY: 760 });
    await waitFor(() => expect(shell().className).toContain("is-reaching"));

    const back = screen.getByRole("button", { name: "Put the screen back" });
    fireEvent.click(back);
    await waitFor(() => expect(shell().className).not.toContain("is-reaching"));
  });

  it("puts the page back by itself when you navigate away", async () => {
    await mountApp();
    const add = addButton();
    fireEvent.pointerDown(add, { pointerId: 3, clientX: 195, clientY: 700, button: 0 });
    fireEvent.pointerMove(add, { pointerId: 3, clientX: 195, clientY: 760 });
    await waitFor(() => expect(shell().className).toContain("is-reaching"));
    fireEvent.click(nav().getByRole("button", { name: "History" }));
    await waitFor(() => expect(shell().className).not.toContain("is-reaching"));
  });

  it("leaves a plain tap on the + doing what it always did", async () => {
    await mountApp();
    fireEvent.pointerDown(addButton(), { pointerId: 4, clientX: 195, clientY: 700, button: 0 });
    fireEvent.pointerUp(addButton(), { pointerId: 4, clientX: 195, clientY: 700 });
    fireEvent.click(addButton());
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});
