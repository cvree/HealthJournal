/* Locking the page behind a sheet, and — the part that was wrong — putting it
   back afterwards.

   `window.scrollTo` is animated twice over in this app: the stylesheet sets
   `html { scroll-behavior: smooth }`, and Lenis replaces the method with its
   own eased version. Restoring the offset through it sent the page to the top
   and then flew it back down over about a second, every time any sheet closed.
   The restore has to be a jump, so it goes through the native scrollTop. */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { lockPageScroll } from "../src/lib/motion";

const root = () => document.documentElement;

beforeEach(() => {
  document.body.removeAttribute("style");
  root().removeAttribute("style");
  Object.defineProperty(window, "scrollY", { value: 640, configurable: true });
});

afterEach(() => vi.restoreAllMocks());

describe("lockPageScroll", () => {
  it("pins the body at the offset it was read at", () => {
    const release = lockPageScroll();
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-640px");
    expect(document.body.style.overflow).toBe("hidden");
    release();
    expect(document.body.style.position).toBe("");
    expect(document.body.style.top).toBe("");
  });

  it("holds the scrollbar's gutter open so the page doesn't jump sideways", () => {
    Object.defineProperty(root(), "clientWidth", { value: window.innerWidth - 15, configurable: true });
    const release = lockPageScroll();
    expect(document.body.style.paddingRight).toBe("15px");
    release();
    expect(document.body.style.paddingRight).toBe("");
    Object.defineProperty(root(), "clientWidth", { value: window.innerWidth, configurable: true });
  });

  it("leaves no gutter where the scrollbar is an overlay", () => {
    Object.defineProperty(root(), "clientWidth", { value: window.innerWidth, configurable: true });
    const release = lockPageScroll();
    expect(document.body.style.paddingRight).toBe("");
    release();
  });

  /* The regression: any animated route back to the offset is a page that
     scrolls itself for no reason in front of the reader. */
  it("puts the page back without an animated scroll", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const release = lockPageScroll();
    release();
    expect(scrollTo).not.toHaveBeenCalled();
    // Smooth behaviour is suspended for the jump and handed straight back.
    expect(root().style.scrollBehavior).toBe("");
  });

  it("only the outermost release puts anything back", () => {
    const outer = lockPageScroll();
    const inner = lockPageScroll();
    inner();
    expect(document.body.style.position).toBe("fixed");
    outer();
    expect(document.body.style.position).toBe("");
  });

  it("ignores a release called twice", () => {
    const outer = lockPageScroll();
    const inner = lockPageScroll();
    inner();
    inner();
    expect(document.body.style.position).toBe("fixed");
    outer();
    expect(document.body.style.position).toBe("");
  });
});
