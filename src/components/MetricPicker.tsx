/* Horizontal metric selector for the 30-day trend chart.

   The old version was a bare `overflow-x-auto` row inside a card, with the
   app's global stylesheet hiding every scrollbar. On a desktop that produced a
   strip of chips with no scrollbar, no fade, and no wheel handling — so the
   metrics past the fourth or fifth were reachable only by a horizontal
   trackpad gesture nobody knew was there. On a phone it scrolled, but the
   selected chip could sit off-screen with nothing to say so.

   This component keeps the same one-line strip (it is the compact shape that
   belongs on a phone) and fixes what was actually wrong:
     · edge fades + arrow buttons that appear only when there is more to see,
       so "there are more metrics" is visible rather than discovered
     · vertical wheel gestures translated to horizontal scroll on desktop
     · roving-tabindex keyboard navigation (←/→/Home/End, Enter/Space to
       toggle) with the whole strip exposed as a single tab stop
     · the selected chip is always scrolled into view, including when the
       selection changes from elsewhere
     · a live count of what is selected and how many metrics exist in total
   Nothing is ever clipped: the strip is allowed to bleed to the card's edges
   so a chip is never half-hidden behind a rounded corner. */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { C } from "../lib/theme";

export type MetricOption = {
  /** Field key. */
  k: string;
  label: string;
  /** Series colour when this metric is part of a multi-metric comparison. */
  dot?: string | null;
};

type Props = {
  options: MetricOption[];
  selected: string[];
  onToggle: (k: string) => void;
  /** Upper bound on simultaneous selections, for the hint line. */
  max?: number;
  label?: string;
};

const SCROLL_STEP = 168; // ≈ two chips — far enough to feel like progress

export default function MetricPicker({
  options,
  selected,
  onToggle,
  max = 4,
  label = "Metrics to chart",
}: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [edges, setEdges] = useState({ start: false, end: false });
  // Roving tabindex: one tab stop for the strip, arrows move within it.
  const [focusKey, setFocusKey] = useState<string>(() => selected[0] || options[0]?.k || "");

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max_ = el.scrollWidth - el.clientWidth;
    setEdges({
      start: el.scrollLeft > 2,
      // 2px of slack keeps the arrow from flickering at the exact end on
      // fractional-pixel layouts.
      end: el.scrollLeft < max_ - 2,
    });
  }, []);

  useLayoutEffect(measure, [measure, options.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    // Chip widths depend on font loading and container width, neither of which
    // fires a scroll or resize event on its own.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      if (ro) ro.disconnect();
    };
  }, [measure]);

  /* Desktop: a vertical wheel over the strip should scroll it sideways. Without
     this the strip is inert to the one gesture most people try. Only claim the
     event while there is somewhere left to go, so reaching the end hands the
     scroll back to the page instead of trapping it. */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // already horizontal
      const max_ = el.scrollWidth - el.clientWidth;
      if (max_ <= 0) return;
      const next = el.scrollLeft + e.deltaY;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max_)) return;
      e.preventDefault();
      el.scrollLeft = next;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* scrollTo/scrollBy are missing in jsdom and in a few older mobile browsers;
     assigning scrollLeft works everywhere and just skips the animation. */
  const scrollTo = (el: HTMLElement, left: number, behavior: ScrollBehavior) => {
    if (typeof el.scrollTo === "function") el.scrollTo({ left, behavior });
    else el.scrollLeft = left;
  };

  const scrollChipIntoView = useCallback((k: string, behavior: ScrollBehavior = "smooth") => {
    const chip = chipRefs.current[k];
    const el = scrollerRef.current;
    if (!chip || !el) return;
    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    const pad = 20; // leave a sliver of the neighbour visible as a scroll hint
    if (left - pad < el.scrollLeft) scrollTo(el, Math.max(0, left - pad), behavior);
    else if (right + pad > el.scrollLeft + el.clientWidth) {
      scrollTo(el, right + pad - el.clientWidth, behavior);
    }
  }, []);

  /* Keep the primary selection visible even when it changed from somewhere
     else (a different pack enabled, a reset, a restored backup). */
  const primary = selected[0];
  useEffect(() => {
    if (primary) scrollChipIntoView(primary, "auto");
  }, [primary, scrollChipIntoView]);

  const nudge = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (typeof el.scrollBy === "function") el.scrollBy({ left: dir * SCROLL_STEP, behavior: "smooth" });
    else el.scrollLeft += dir * SCROLL_STEP;
  };

  const onKeyDown = (e: React.KeyboardEvent, k: string) => {
    const i = options.findIndex((o) => o.k === k);
    let next = -1;
    if (e.key === "ArrowRight") next = Math.min(options.length - 1, i + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, i - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    else return;
    e.preventDefault();
    const target = options[next];
    if (!target) return;
    setFocusKey(target.k);
    chipRefs.current[target.k]?.focus();
    scrollChipIntoView(target.k);
  };

  const selectedCount = selected.length;
  const roving = options.some((o) => o.k === focusKey) ? focusKey : options[0]?.k;

  return (
    <div className="fhj-picker">
      <div className="fhj-picker-rail">
        {/* Arrows are supplementary — the strip is fully usable by touch,
            wheel, and keyboard without them — so they are hidden from
            assistive tech rather than adding two redundant stops. */}
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => nudge(-1)}
          className={"fhj-picker-arrow fhj-picker-arrow-start" + (edges.start ? " is-on" : "")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 6l-6 6 6 6" fill="none" stroke={C.ink} strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div
          ref={scrollerRef}
          className={
            "fhj-picker-scroll" +
            (edges.start ? " fade-start" : "") +
            (edges.end ? " fade-end" : "")
          }
          role="group"
          aria-label={label}
        >
          {options.map((o) => {
            const active = selected.includes(o.k);
            return (
              <button
                key={o.k}
                type="button"
                ref={(el) => { chipRefs.current[o.k] = el; }}
                onClick={() => { setFocusKey(o.k); onToggle(o.k); scrollChipIntoView(o.k); }}
                onKeyDown={(e) => onKeyDown(e, o.k)}
                onFocus={() => setFocusKey(o.k)}
                tabIndex={o.k === roving ? 0 : -1}
                aria-pressed={active}
                className={"fhj-chip" + (active ? " is-active" : "")}
              >
                {o.dot && <span className="fhj-chip-dot" style={{ background: o.dot }} />}
                {o.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => nudge(1)}
          className={"fhj-picker-arrow fhj-picker-arrow-end" + (edges.end ? " is-on" : "")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 6l6 6-6 6" fill="none" stroke={C.ink} strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="fhj-picker-hint" style={{ color: C.subtle }}>
        <span aria-live="polite">
          {selectedCount} of {options.length} selected
        </span>
        <span aria-hidden="true">·</span>
        <span>Tap to compare up to {max}</span>
      </div>
    </div>
  );
}
