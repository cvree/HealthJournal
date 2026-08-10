/* Motion layer: Lenis (smooth scrolling) + GSAP (screen transitions and
   reward moments). Health-journal register: calm, brief, never bouncy-chaotic.

   Every entry point is a no-op when the user prefers reduced motion, so the
   app's own CSS reduced-motion kill-switch and this file agree. */

import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let stRegistered = false;
function ensureScrollTrigger() {
  if (!stRegistered && typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
    stRegistered = true;
  }
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let lenis: Lenis | null = null;

/** Start Lenis on the document scroller. Safe to call once at mount. */
export function initSmoothScroll() {
  if (prefersReducedMotion() || lenis) return;
  lenis = new Lenis({
    duration: 0.95,
    easing: (t: number) => 1 - Math.pow(1 - t, 3), // gentle ease-out cubic
    smoothWheel: true,
    syncTouch: false, // keep native touch scrolling — critical for mobile logging
  });
  // drive Lenis from GSAP's ticker so ScrollTrigger stays in sync
  ensureScrollTrigger();
  lenis.on("scroll", () => ScrollTrigger.update());
  gsap.ticker.add((time) => lenis && lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---------- scroll locking, for anything modal ----------

   Lenis takes ownership of the wheel on the document scroller. That is fine
   until a dialog opens: the wheel event starts inside the sheet, Lenis doesn't
   know the sheet exists, and it scrolls the *page* behind it instead. The sheet
   stays exactly where it was and the content underneath slides away, which is
   the single most disorienting thing a modal can do.

   Two halves fix it, and both are needed:

   1. `data-lenis-prevent` on the scrolling element (set by the Modal), which is
      Lenis's own opt-out for a nested scroller.
   2. Stopping Lenis and pinning the body while any dialog is open, so a wheel
      that lands *outside* the sheet — on the scrim — doesn't move the page
      either.

   The counter is what makes stacked sheets work: the food sheet opening a
   consent sheet on top of it must not un-pin the page when the inner one
   closes. Only the outermost release restores anything. */
let scrollLocks = 0;
let restoreScroll: (() => void) | null = null;

export function lockPageScroll(): () => void {
  scrollLocks++;
  if (scrollLocks === 1 && typeof document !== "undefined") {
    lenis?.stop();
    const body = document.body;
    const y = window.scrollY || window.pageYOffset || 0;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    /* position:fixed rather than overflow:hidden — iOS Safari ignores the
       latter on the body and rubber-bands the page anyway. The scroll offset
       has to be carried on `top` and put back by hand, or closing the dialog
       teleports the user to the top of their journal. */
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    restoreScroll = () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, y);
      lenis?.start();
    };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0 && restoreScroll) {
      const fn = restoreScroll;
      restoreScroll = null;
      fn();
    }
  };
}

export function scrollToTop(immediate = false) {
  if (lenis && !prefersReducedMotion()) lenis.scrollTo(0, { immediate });
  else window.scrollTo({ top: 0, behavior: immediate || prefersReducedMotion() ? "auto" : "smooth" });
}

/** Screen-change transition: quiet fade + 12px rise, 220ms. */
export function animateScreenIn(el: HTMLElement | null) {
  if (!el || prefersReducedMotion()) return;
  gsap.fromTo(
    el,
    { autoAlpha: 0, y: 12 },
    { autoAlpha: 1, y: 0, duration: 0.22, ease: "power2.out", clearProps: "all" }
  );
}

/** Report screens: stagger cards in as a single orchestrated moment. */
export function animateReportCards(container: HTMLElement | null) {
  if (!container || prefersReducedMotion()) return;
  const cards = container.querySelectorAll<HTMLElement>("[data-report-card]");
  if (!cards.length) return;
  gsap.fromTo(
    cards,
    { autoAlpha: 0, y: 16 },
    { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out", stagger: 0.07, clearProps: "all" }
  );
}

/** Quick Log finish moment: one soft scale-settle on the success block. */
export function animateFinish(el: HTMLElement | null) {
  if (!el || prefersReducedMotion()) return;
  gsap.fromTo(
    el,
    { scale: 0.96, autoAlpha: 0 },
    { scale: 1, autoAlpha: 1, duration: 0.45, ease: "back.out(1.4)", clearProps: "all" }
  );
}

/* ---------- P5 / report experience additions ---------- */

/** Swipe deck: fling the top card off screen. dir: 1 include, -1 skip.
    fromX carries the current drag offset so the throw continues naturally. */
export function flingCard(el: HTMLElement | null, dir: 1 | -1, fromX: number, onDone: () => void) {
  if (!el || prefersReducedMotion()) { onDone(); return; }
  const w = el.offsetWidth || 320;
  gsap.fromTo(
    el,
    { x: fromX, rotation: fromX / 22 },
    {
      x: dir * (w * 1.4),
      rotation: dir * 16,
      autoAlpha: 0,
      duration: 0.32,
      ease: "power2.in",
      onComplete: onDone,
    }
  );
}

/** Deck: settle the promoted next card from its peek position.
    onSettled always fires (immediately under reduced motion) so React knows
    when to take transform ownership back. */
export function promoteCard(el: HTMLElement | null, onSettled?: () => void) {
  if (!el || prefersReducedMotion()) { onSettled && onSettled(); return; }
  gsap.fromTo(el, { scale: 0.95, y: 10 }, {
    scale: 1, y: 0, duration: 0.28, ease: "power2.out", clearProps: "transform",
    onComplete: () => onSettled && onSettled(),
  });
}

/** Report "wrapped" reveal: each card fades/rises as it scrolls into view.
    Falls back to visible-immediately under reduced motion. */
export function initReportReveal(container: HTMLElement | null) {
  if (!container || prefersReducedMotion()) return () => {};
  ensureScrollTrigger();
  const cards = Array.from(container.children) as HTMLElement[];
  const triggers: ScrollTrigger[] = [];
  cards.forEach((card, i) => {
    const tween = gsap.fromTo(
      card,
      { autoAlpha: 0, y: 24, scale: 0.97 },
      {
        autoAlpha: 1, y: 0, scale: 1, duration: 0.55, ease: "back.out(1.3)",
        delay: i < 3 ? i * 0.09 : 0, // small opening cascade, then scroll-driven
        scrollTrigger: { trigger: card, start: "top 90%", once: true },
      }
    );
    if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
  });
  return () => triggers.forEach((t) => t.kill());
}

/** Tween a number in a DOM node from 0 (or current) to `to`.
    Instant under reduced motion. */
export function tweenNumber(el: HTMLElement | null, to: number, decimals = 0) {
  if (!el) return;
  if (prefersReducedMotion() || !isFinite(to)) { el.textContent = to.toFixed(decimals); return; }
  const state = { v: 0 };
  gsap.to(state, {
    v: to,
    duration: 0.9,
    ease: "power2.out",
    onUpdate: () => { el.textContent = state.v.toFixed(decimals); },
  });
}

/** Directional continuity when paging between report periods:
    dir -1 slides in from the left (older), +1 from the right (newer). */
export function slideFrom(el: HTMLElement | null, dir: number) {
  if (!el || !dir || prefersReducedMotion()) return;
  gsap.fromTo(el, { x: dir * 36 }, { x: 0, duration: 0.3, ease: "power2.out", clearProps: "x" });
}
