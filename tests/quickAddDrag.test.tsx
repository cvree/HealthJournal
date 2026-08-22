/* Hold a button, move it, let go.

   The row on Today is the most-pressed thing in the app, and this is the
   gesture that lets somebody own it. What is pinned here is the whole of the
   bargain it makes with the thumb:

   - a hold and a drag moves a button, and it is still there tomorrow;
   - a tap is still a tap, and does not become a drag;
   - a scroll is still a scroll, and does not become a drag either — the row
     covers half the screen, and a dashboard that eats a swipe is broken in a
     way people cannot name but never forgive;
   - the drag that ends on a button does not also press it;
   - and none of it is mouse-only: Alt with an arrow key does the same thing.

   jsdom lays nothing out, so the grid's geometry is stubbed to the real thing:
   two across, 150×88, ten pixels apart. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import App, { __internals as I } from "../src/App";

const W = 150, H = 88, GAP = 10, COLS = 2;
const slotX = (i: number) => (i % COLS) * (W + GAP);
const slotY = (i: number) => Math.floor(i / COLS) * (H + GAP);
const centre = (i: number) => ({ clientX: slotX(i) + W / 2, clientY: slotY(i) + H / 2 });

const rect = (left: number, top: number, width: number, height: number) => ({
  left, top, width, height, right: left + width, bottom: top + height,
  x: left, y: top, toJSON() { return this; },
}) as DOMRect;

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
  Element.prototype.setPointerCapture = function () { /* jsdom has no pointers */ };
  Element.prototype.releasePointerCapture = function () {};
  Element.prototype.getBoundingClientRect = function () {
    const el = this as HTMLElement;
    const idx = el.getAttribute?.("data-sort");
    if (idx != null) return rect(slotX(Number(idx)), slotY(Number(idx)), W, H);
    if (el.classList?.contains("fhj-sortable")) return rect(0, 0, COLS * W + GAP, 400);
    return rect(0, 0, 0, 0);
  };
});

let kv: Map<string, string>;

async function mountApp(mutate?: (db: any) => void) {
  const db: any = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  mutate?.(db);
  kv = new Map([["fhj_v1", JSON.stringify(db)]]);
  (window as any).storage = {
    async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
    async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
    async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
    async list() { return { keys: [...kv.keys()] }; },
  };
  render(<App />);
  await screen.findByText("Quick Add", {}, { timeout: 10000 });
}

const saved = () => JSON.parse(kv.get("fhj_v1")!);
const tiles = () => [...document.querySelectorAll(".fhj-tiles .fhj-tile")] as HTMLElement[];
const labels = () =>
  [...document.querySelectorAll(".fhj-tiles .fhj-tile-label")].map((t) => t.textContent);

/** Press and keep pressing, until it lifts. */
async function press(el: HTMLElement, at = 0) {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, pointerType: "touch", ...centre(at) });
  await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
}
const dragTo = (el: HTMLElement, slot: number) =>
  fireEvent.pointerMove(el, { pointerId: 1, pointerType: "touch", ...centre(slot) });
const drop = (el: HTMLElement, slot: number) =>
  fireEvent.pointerUp(el, { pointerId: 1, pointerType: "touch", ...centre(slot) });

beforeEach(() => cleanup());

describe("holding a button and moving it", () => {
  it("puts it where it was dropped, and writes that down", async () => {
    await mountApp();
    const before = labels();
    expect(before.length).toBeGreaterThan(2);

    const first = tiles()[0];
    await press(first, 0);
    // It is in the air: the row says so, and so does the tile.
    expect(first.className).toContain("is-lifted");
    expect(document.querySelector(".fhj-sortable.is-sorting")).toBeTruthy();

    dragTo(first, 2);
    // The gap has moved to where it will land.
    expect(document.querySelector(".fhj-sort-gap")).toBeTruthy();
    await act(async () => { drop(first, 2); });

    // Third from the top now, and the two it passed have each moved up one.
    await waitFor(() => expect(labels()[2]).toBe(before[0]));
    expect(labels()[0]).toBe(before[1]);
    expect(labels()[1]).toBe(before[2]);
    expect(labels().length).toBe(before.length);

    // ...and it is the journal's own arrangement now, not a guess to be redone.
    await waitFor(() => expect(saved().profile.quickAddOrder).toBe("manual"));
    expect(before[0]).toBe("Check-in");
    expect(saved().profile.quickAdd[2]).toBe("checkin");
    expect(saved().profile.quickAddDragged).toBe(true);
  });

  it("does not also press the button it just moved", async () => {
    await mountApp();
    const first = tiles()[0];
    await press(first, 0);
    dragTo(first, 1);
    await act(async () => { drop(first, 1); });
    fireEvent.click(first);
    // Nothing opened, nothing was logged: the gesture was a rearrangement.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves an ordinary tap alone", async () => {
    await mountApp();
    const food = tiles().find((t) => /^Food/.test(t.textContent!))!;
    const before = labels();
    fireEvent.pointerDown(food, { pointerId: 1, button: 0, pointerType: "touch", ...centre(0) });
    fireEvent.pointerUp(food, { pointerId: 1, pointerType: "touch", ...centre(0) });
    fireEvent.click(food);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(labels()).toEqual(before);
  });

  it("gives a scrolling finger its gesture back", async () => {
    await mountApp();
    const first = tiles()[0];
    const before = labels();
    fireEvent.pointerDown(first, { pointerId: 1, button: 0, pointerType: "touch", ...centre(0) });
    // Away down the page before the hold could ever fire: this is a scroll.
    fireEvent.pointerMove(first, { pointerId: 1, clientX: slotX(0) + W / 2, clientY: 400 });
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    fireEvent.pointerMove(first, { pointerId: 1, clientX: slotX(0) + W / 2, clientY: 600 });
    fireEvent.pointerUp(first, { pointerId: 1, clientX: slotX(0) + W / 2, clientY: 600 });

    expect(first.className).not.toContain("is-lifted");
    expect(labels()).toEqual(before);
    expect(saved().profile.quickAddDragged).toBeFalsy();
  });

  it("moves the same button from a keyboard", async () => {
    await mountApp();
    const before = labels();
    fireEvent.keyDown(tiles()[0], { key: "ArrowRight", altKey: true });
    await waitFor(() => expect(labels()[1]).toBe(before[0]));
    // Down is a whole row on a two-across grid, not one place.
    fireEvent.keyDown(tiles()[1], { key: "ArrowDown", altKey: true });
    await waitFor(() => expect(labels()[3]).toBe(before[0]));
    // ...and a bare arrow key is still just an arrow key.
    const now = labels();
    fireEvent.keyDown(tiles()[3], { key: "ArrowUp" });
    expect(labels()).toEqual(now);
  });

  it("stops telling somebody about a gesture they have used", async () => {
    await mountApp();
    expect(screen.getByText(/Hold a button to move it/)).toBeTruthy();
    const first = tiles()[0];
    await press(first, 0);
    dragTo(first, 1);
    await act(async () => { drop(first, 1); });
    await waitFor(() => expect(screen.queryByText(/Hold a button to move it/)).toBeNull());
  });

  it("offers the same gesture in the + sheet, on the same list", async () => {
    await mountApp();
    fireEvent.click(screen.getByRole("button", { name: "Add to today" }));
    const sheet = await screen.findByRole("dialog");
    const chosen = [...sheet.querySelectorAll(".fhj-add-grid.fhj-sortable .fhj-add-tile")];
    expect(chosen.length).toBeGreaterThan(1);
    expect(chosen[0].getAttribute("data-sort")).toBe("0");
    // "Everything else" is a menu of what exists, not part of the arrangement.
    expect(sheet.querySelectorAll(".fhj-add-grid:not(.fhj-sortable) [data-sort]").length).toBe(0);
  });
});
