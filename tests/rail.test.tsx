/* The horizontal rail, and the "Again" row that sits in one.

   The bug this fixes: the Again row on Today was a bare `overflow-x: auto` div
   with the app's global stylesheet hiding every scrollbar and Lenis owning the
   wheel on the document. So on a desktop the chips past the fourth were
   unreachable — a vertical wheel over them scrolled the page, a horizontal one
   was swallowed by the smooth-scroll driver before the browser saw it, and
   there was nothing on screen to say there was more. On a phone it flicked,
   which is why it survived so long.

   jsdom has no layout, so the parts that can be pinned here are the ones that
   are structural: every item is in the tree and reachable, the wheel is
   claimed rather than left to the page, and the keyboard walks the row. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";
import Rail from "../src/components/Rail";
import App, { __internals as I } from "../src/App";

beforeEach(() => cleanup());

beforeAll(() => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: q.includes("reduce"), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  } as any));
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

/** jsdom reports every element as zero-sized, so a rail is never "scrollable"
    unless its measurements are stubbed. This makes one that has 400px of
    content hidden past its right edge. */
function withOverflow(el: HTMLElement, scrollWidth = 900, clientWidth = 500) {
  Object.defineProperty(el, "scrollWidth", { value: scrollWidth, configurable: true });
  Object.defineProperty(el, "clientWidth", { value: clientWidth, configurable: true });
  return el;
}

const chips = (n: number) =>
  Array.from({ length: n }, (_, i) => <button key={i} type="button">Chip {i}</button>);

const railOf = () => document.querySelector(".fhj-scroller") as HTMLElement;

describe("the rail", () => {
  it("renders every item — nothing is dropped because it does not fit", () => {
    render(<Rail label="Things">{chips(9)}</Rail>);
    const list = screen.getByRole("list", { name: "Things" });
    expect(within(list).getAllByRole("button")).toHaveLength(9);
  });

  it("claims a vertical wheel and scrolls sideways with it", () => {
    render(<Rail label="Things">{chips(9)}</Rail>);
    const el = withOverflow(railOf());
    el.scrollLeft = 0;

    const ev = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);

    expect(el.scrollLeft).toBe(120);
    // Claimed, so Lenis never sees it and the page underneath stays put.
    expect(ev.defaultPrevented).toBe(true);
  });

  it("hands the wheel back at the end of the row rather than trapping it", () => {
    render(<Rail label="Things">{chips(9)}</Rail>);
    const el = withOverflow(railOf());
    el.scrollLeft = 400; // the end: 900 - 500

    const ev = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);

    expect(el.scrollLeft).toBe(400);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("lets a native horizontal gesture through, but not as far as the page", () => {
    render(<Rail label="Things">{chips(9)}</Rail>);
    const el = withOverflow(railOf());
    el.scrollLeft = 0;
    let reachedWindow = false;
    const spy = () => { reachedWindow = true; };
    window.addEventListener("wheel", spy);

    const ev = new WheelEvent("wheel", { deltaX: 80, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    window.removeEventListener("wheel", spy);

    // The browser does this one itself, so it must NOT be prevented...
    expect(ev.defaultPrevented).toBe(false);
    // ...and it must not reach the smooth-scroll driver on the window either.
    expect(reachedWindow).toBe(false);
  });

  it("does nothing at all to a wheel over a row that fits", () => {
    render(<Rail label="Things">{chips(2)}</Rail>);
    const el = withOverflow(railOf(), 300, 500);
    const ev = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("walks the row with the arrow keys and stops at both ends", () => {
    render(<Rail label="Things">{chips(4)}</Rail>);
    const list = screen.getByRole("list", { name: "Things" });
    const items = within(list).getAllByRole("button");

    items[0].focus();
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(list, { key: "End" });
    expect(document.activeElement).toBe(items[3]);
    fireEvent.keyDown(list, { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("keeps its arrows out of the accessibility tree — they are a second way, not a second stop", () => {
    render(<Rail label="Things">{chips(9)}</Rail>);
    expect(screen.getAllByRole("button")).toHaveLength(9);
    expect(document.querySelectorAll(".fhj-picker-arrow")).toHaveLength(2);
  });
});

describe("the Again row on Today", () => {
  it("is a rail, so every repeat past the edge of the screen can be reached", async () => {
    (window as any).storage = (() => {
      const db = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
      const kv = new Map([["fhj_v1", JSON.stringify(db)]]);
      return {
        async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
        async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
        async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
        async list() { return { keys: [...kv.keys()] }; },
      };
    })();
    render(<App />);
    await screen.findByText(/Quick Add/);

    const again = await waitFor(() => {
      const el = screen.getByRole("list", { name: /again/i });
      expect(within(el).getAllByRole("listitem").length).toBeGreaterThan(0);
      return el;
    });
    expect(again.classList.contains("fhj-scroller")).toBe(true);
    expect(again.closest(".fhj-rail")).toBeTruthy();
  });
});
