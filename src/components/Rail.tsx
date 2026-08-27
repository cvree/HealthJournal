/* A row that is wider than the phone, and says so.

   The app had two of these already — the metric picker on Insights and the
   "Again" row on Today — and only one of them worked. The difference was not
   cosmetic. A bare `overflow-x: auto` row is scrollable in exactly one way on
   a desktop: a horizontal trackpad gesture. This app also runs Lenis on the
   document scroller, and Lenis claims the wheel: a vertical wheel over the
   chips scrolled the *page*, a horizontal one on a mouse without a tilt wheel
   does not exist, and the row sat there looking like a row of buttons with
   more buttons visibly cut off at the edge that nothing could reach.

   So this is the picker's own rail, lifted out of it and made general, and it
   is the only horizontal scroller this app is allowed to have:

     · edge fades that appear only when there is something past the edge, so
       "there is more over here" is a visible fact rather than a discovery
     · arrow buttons on pointer devices, hidden on touch where they would just
       cover two chips
     · a vertical wheel over the row scrolls the row, and stops claiming the
       gesture the moment the row runs out — so reaching the end hands the
       scroll back to the page instead of trapping it. The event is stopped
       before it reaches Lenis, which is what stops the page moving underneath
       a sideways gesture
     · ←/→/Home/End move between the items when the focus is inside the row,
       and focus always scrolls its item into view

   Nothing here is required for the row to work by touch: a phone has always
   been able to flick it, and everything above is what makes the same row
   usable with a mouse, a trackpad, or a keyboard. */

/* ---------------------------------------------------------------------------
   NOTE (1.26.1): this component currently has no consumer.

   The "Again" row on Today was the only one, and it moved off a rail
   deliberately — see QuickRepeats in App.tsx. A horizontal scroller answers
   "there is more of this than fits", and that row's problem turned out to be
   the opposite one: most of what was in it did not belong there at all, and
   what was left was short enough to show in full.

   It is kept rather than deleted because the app still has a *second*,
   worse horizontal scroller — the metric picker on Insights keeps its own
   `.fhj-picker-scroll` implementation, which this was extracted from and was
   meant to replace. Deleting the good one and leaving the duplicate would be
   the wrong way round. Migrating MetricPicker onto it is the open task.

   Its styles are scoped to classes only this file emits, so unlike the dead
   `.fhj-rail` wizard block that used to sit below them in the stylesheet, an
   idle component here cannot reach out and restyle anything else. A test in
   tests/rail.test.tsx asserts that stays true.
   --------------------------------------------------------------------------- */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { C } from "../lib/theme";

type Props = {
  /** Accessible name for the row — it is a list of things, and it says which. */
  label: string;
  /** ARIA role for the scrolling element. `list` when the children are items. */
  role?: string;
  className?: string;
  /** How far one arrow tap travels. Roughly two chips is the readable default. */
  step?: number;
  children: React.ReactNode;
};

const STEP = 180;

/** Every focusable child of the rail, in DOM order. */
function itemsOf(el: HTMLElement | null): HTMLElement[] {
  if (!el) return [];
  return Array.from(
    el.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')
  );
}

export default function Rail({ label, role = "list", className = "", step = STEP, children }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({
      start: el.scrollLeft > 2,
      /* 2px of slack: fractional layout widths otherwise leave the end arrow
         flickering on and off at rest. */
      end: el.scrollLeft < max - 2,
    });
  }, []);

  useLayoutEffect(measure, [measure, children]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    /* Chip widths follow the font and the container, and neither of those
       fires a scroll or a resize when it settles. */
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      if (ro) ro.disconnect();
    };
  }, [measure]);

  /* The wheel. Both halves matter:

     A *vertical* wheel over the row scrolls the row sideways — the one gesture
     everyone tries — and only while the row has somewhere left to go, so the
     end of the chips is not the end of the page.

     A *horizontal* one is already the right gesture and the browser handles it
     natively; all this has to do is stop it reaching Lenis, which would
     otherwise preventDefault it and scroll the document instead. That is the
     bug that made this row inert on a trackpad. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
        if ((e.deltaX < 0 && el.scrollLeft <= 0) || (e.deltaX > 0 && el.scrollLeft >= max)) return;
        e.stopPropagation();
        return;
      }
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return;
      e.preventDefault();
      e.stopPropagation();
      el.scrollLeft = el.scrollLeft + e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const scrollBy = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    /* scrollBy is missing in jsdom and in a few older mobile browsers; writing
       scrollLeft works everywhere and only loses the animation. */
    if (typeof el.scrollBy === "function") el.scrollBy({ left: dir * step, behavior: "smooth" });
    else el.scrollLeft += dir * step;
  };

  /* Keeping the focused item on screen is not a nicety: a keyboard user
     tabbing along the row would otherwise be moving an invisible focus ring
     past the edge of a row that never scrolled to follow it. */
  const reveal = (item: HTMLElement) => {
    const el = ref.current;
    if (!el) return;
    const pad = 20; // a sliver of the neighbour stays visible as a hint
    const left = item.offsetLeft;
    const right = left + item.offsetWidth;
    if (left - pad < el.scrollLeft) el.scrollLeft = Math.max(0, left - pad);
    else if (right + pad > el.scrollLeft + el.clientWidth) el.scrollLeft = right + pad - el.clientWidth;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    const items = itemsOf(ref.current);
    if (items.length < 2) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const next = e.key === "ArrowRight" ? Math.min(items.length - 1, i + 1)
      : e.key === "ArrowLeft" ? Math.max(0, i - 1)
        : e.key === "Home" ? 0 : items.length - 1;
    if (next === i) return;
    e.preventDefault();
    items[next].focus();
    reveal(items[next]);
  };

  return (
    <div className="fhj-rail">
      {/* The arrows are supplementary — the row is fully usable by touch,
          wheel and keyboard without them — so they stay out of the
          accessibility tree rather than adding two redundant stops. */}
      <button type="button" aria-hidden="true" tabIndex={-1} onClick={() => scrollBy(-1)}
        className={"fhj-picker-arrow fhj-picker-arrow-start" + (edges.start ? " is-on" : "")}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 6l-6 6 6 6" fill="none" stroke={C.ink} strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        ref={ref}
        role={role}
        aria-label={label}
        onKeyDown={onKeyDown}
        onFocus={(e) => { const t = e.target as HTMLElement; if (t !== e.currentTarget) reveal(t); }}
        className={
          "fhj-scroller"
          + (edges.start ? " fade-start" : "")
          + (edges.end ? " fade-end" : "")
          + (className ? " " + className : "")
        }>
        {children}
      </div>

      <button type="button" aria-hidden="true" tabIndex={-1} onClick={() => scrollBy(1)}
        className={"fhj-picker-arrow fhj-picker-arrow-end" + (edges.end ? " is-on" : "")}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 6l6 6-6 6" fill="none" stroke={C.ink} strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
