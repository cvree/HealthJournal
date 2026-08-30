/* The thumb layer.

   Three surfaces, one idea: nothing in this app should require the hand that
   is holding the coffee.

   - **`ThumbNav`** — the bar at the bottom, which now carries *navigation*
     rather than three destinations. On a root screen it is Today · + ·
     History, exactly as it was. On any screen you navigated into, the left
     slot becomes Back and says where back goes, so the top-left arrow is a
     convenience rather than the only exit.
   - **The fan** — hold the bar, or push up off it, and every destination in
     the app arcs out from the corner under your thumb. Keep holding and slide:
     the item under the thumb lights up and letting go opens it, so the whole
     journey is one press. Let go without moving and it stays open to be
     tapped, because a menu that vanishes when you hesitate is a menu you stop
     trusting.
   - **`EdgeBack`** — drag in from either side edge and the screen peels off
     under your thumb, revealing where you came from. Let go short and it
     springs back; the gesture tells you which it is going to be the whole way.

   None of it is the only way to do anything. Every destination in the fan is
   still a tap somewhere on a screen, Back is still in the header, and the
   gestures are additions on top of a layout that already worked. That is
   deliberate: a gesture nobody discovers must cost nothing, and a gesture
   somebody discovers should feel like the app was waiting for it. */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ARC_OPEN_DY, EDGE_ZONE, LONG_PRESS_MS, REACH_TRIGGER,
  backProgress, edgeDirection, edgeStart, fanLayout, fanSeen,
  markFanSeen, pickArcTarget, shouldCompleteBack, type Destination, type Hand,
} from "../lib/oneHanded";
import { feedback } from "../lib/feedback";
import { lockPageScroll, prefersReducedMotion } from "../lib/motion";

type IconComponent = React.ComponentType<{ name: string; size?: number; color?: string }>;

/* ---------- the fan ---------- */

interface FanProps {
  destinations: Destination[];
  active: string;
  hand: Hand;
  /** Viewport coordinates of the + button's centre, measured when the fan
      opened. The fan blooms out of the control that was pressed, and the
      thumb is already resting on that point — which is what makes sliding
      onto an item a push in a direction rather than a journey to a place. */
  pivot: { x: number; y: number };
  Icon: IconComponent;
  /** Set while a press is still down, so the fan can be steered by sliding. */
  steerRef: React.MutableRefObject<((x: number, y: number) => void) | null>;
  /** Answers the release: opens whatever the thumb was resting on, and says
      whether there was anything. */
  commitRef: React.MutableRefObject<(() => boolean) | null>;
  onGo: (id: string) => void;
  onFlipHand: () => void;
  onClose: () => void;
}

function Fan({ destinations, active, hand, pivot, Icon, steerRef, commitRef, onGo, onFlipHand, onClose }: FanProps) {
  const [size, setSize] = useState(() => ({
    w: typeof window === "undefined" ? 390 : window.innerWidth,
    h: typeof window === "undefined" ? 780 : window.innerHeight,
  }));
  /* Which item the thumb is over. -1 is "none", and stays -1 for a press that
     never moves — that is the tap-to-open case, not a selection of item 0. */
  const [hot, setHot] = useState(-1);
  /* The same number, readable synchronously: the release happens in the bar's
     pointerup, which runs before React has re-rendered anything. */
  const hotRef = useRef(-1);
  const [shown, setShown] = useState(false);
  const itemsRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* One frame late, so the browser has a layout to animate *from*. Without it
     the items are already at their final transform when the class lands and
     the whole fan simply appears. */
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* The page underneath must not move while the fan is over it — Lenis owns
     the document scroller and has no idea this exists. Same lock the sheets
     use, and reference-counted for the same reason. */
  useEffect(() => lockPageScroll(), []);

  /* Opened from a keyboard, the fan has to *be* somewhere: without this the
     focus ring stays on the + and Tab walks the screen behind the scrim.
     Opened by a thumb this is invisible and costs nothing. */
  useEffect(() => {
    const first = itemsRef.current?.querySelector<HTMLElement>(".fhj-fan-item");
    first?.focus({ preventScroll: true });
  }, []);

  const points = fanLayout(destinations.length, { hand, width: size.w, height: size.h });

  /* The press that opened the fan is still down and still captured by the bar,
     so steering arrives here as plain coordinates rather than as events. They
     are turned pivot-relative once, here, and the geometry module does the
     rest. */
  useEffect(() => {
    steerRef.current = (x: number, y: number) => {
      const i = pickArcTarget(points, x - pivot.x, y - pivot.y);
      if (i === hotRef.current) return;
      hotRef.current = i;
      /* A tick as the thumb crosses onto each item is what lets somebody use
         this without looking at it. */
      if (i >= 0) feedback("select");
      setHot(i);
    };
    commitRef.current = () => {
      const i = hotRef.current;
      if (i < 0 || i >= destinations.length) return false;
      onGo(destinations[i].id);
      return true;
    };
    return () => { steerRef.current = null; commitRef.current = null; };
  });

  const hint = hot >= 0 ? destinations[hot].hint : "Slide to choose · let go to open";


  return (
    <div className="fhj-fan" data-hand={hand} role="dialog" aria-modal="true" aria-label="Go anywhere"
      style={{
        ["--fan-x" as string]: `${Math.round(pivot.x)}px`,
        ["--fan-y" as string]: `${Math.round(pivot.y)}px`,
      }}>
      <button type="button" className="fhj-fan-scrim" aria-label="Close" onClick={onClose} />
      <div className={"fhj-fan-stage" + (shown ? " is-in" : "")}>
        <ul className="fhj-fan-items" ref={itemsRef}>
          {destinations.map((d, i) => {
            const p = points[i];
            const isHot = i === hot;
            return (
              <li key={d.id} className="fhj-fan-slot"
                style={{
                  left: `${Math.round(pivot.x)}px`,
                  top: `${Math.round(pivot.y)}px`,
                  ["--fx" as string]: `${Math.round(p.x)}px`,
                  ["--fy" as string]: `${Math.round(p.y)}px`,
                  ["--fd" as string]: `${i * 26}ms`,
                }}>
                <button type="button"
                  className={"fhj-fan-item" + (isHot ? " is-hot" : "") + (d.id === active ? " is-here" : "")}
                  aria-current={d.id === active ? "page" : undefined}
                  onClick={() => onGo(d.id)}>
                  <span className="fhj-fan-disc" aria-hidden="true">
                    <Icon name={d.icon} size={21} color="currentColor" />
                  </span>
                  <span className="fhj-fan-label">{d.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {/* The upper half of the screen is empty while the fan is open — it has
          to be, because none of it is anywhere a thumb can go. Rather than
          leave it dark, it reads back what the thumb is resting on, in the
          app's own display face. It is the only text here that changes, so it
          lands as an answer rather than as chrome, and it is legible from
          further away than a 10px label on a disc ever could be. */}
      <div className="fhj-fan-read" aria-live="polite">
        <span className="fhj-fan-eyebrow">Go anywhere</span>
        <strong className="fhj-fan-name">{hot >= 0 ? destinations[hot].label : "Where to?"}</strong>
        <span className="fhj-fan-hint">{hint}</span>
        <button type="button" className="fhj-fan-hand" onClick={onFlipHand}>
          {hand === "right" ? "Left-handed?" : "Right-handed?"}
        </button>
      </div>
    </div>
  );
}

/* ---------- the bar ---------- */

export interface ThumbNavProps {
  screen: string;
  canBack: boolean;
  /** Where Back goes, in words. The bar prints it. */
  backLabel: string;
  destinations: Destination[];
  hand: Hand;
  viewer?: boolean;
  /** Suppress the one-line "hold +" hint, because something else is teaching
      that gesture right now — the first-run tour spends a whole stop on it. */
  hideCoach?: boolean;
  Icon: IconComponent;
  onBack: () => void;
  onGo: (id: string) => void;
  onAdd: () => void;
  onFlipHand: () => void;
  /** Pull down on the bar: bring the top of the screen into reach. */
  onReach: () => void;
  /** Tap the tab you are already on: back to the top of it. */
  onTop: () => void;
}

export function ThumbNav({
  screen, canBack, backLabel, destinations, hand, viewer, hideCoach, Icon,
  onBack, onGo, onAdd, onFlipHand, onReach, onTop,
}: ThumbNavProps) {
  const [fan, setFan] = useState(false);
  const addRef = useRef<HTMLButtonElement | null>(null);
  /* Where the fan pivots: the + button's centre, measured at the moment it
     opens rather than assumed from the stylesheet, so a narrow phone, a wide
     window and a left-handed layout all pivot on the real control. */
  const pivotRef = useRef({ x: 0, y: 0 });
  const steerRef = useRef<((x: number, y: number) => void) | null>(null);
  const commitRef = useRef<(() => boolean) | null>(null);
  /* The click that follows a press the fan already answered. The browser
     dispatches it after pointerup, by which time React may have re-rendered
     with the fan closed — so the guard has to be a ref, not state, or holding
     the button to navigate also opens the add sheet behind it. */
  const handled = useRef(false);
  const press = useRef<{ id: number; x: number; y: number; timer: number | null; opened: boolean; moved: boolean } | null>(null);

  /* Shown above the bar until the fan has been opened once — and never at all
     when something else has just taught the same gesture properly. The tour
     spends a whole stop on it; a one-line hint about the thing somebody was
     shown ninety seconds ago is the app not listening. */
  const [coach, setCoach] = useState(() => !fanSeen());

  const openFan = useCallback(() => {
    const r = addRef.current?.getBoundingClientRect();
    if (r) pivotRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    else if (typeof window !== "undefined") {
      /* No layout to measure (jsdom, or a fan opened before first paint):
         the bottom corner on the held side is where the button would be. */
      pivotRef.current = {
        x: hand === "right" ? window.innerWidth - 56 : 56,
        y: window.innerHeight - 56,
      };
    }
    markFanSeen();
    setCoach(false);
    setFan((was) => {
      if (!was) feedback("menu");
      return true;
    });
  }, [hand]);

  const closeFan = useCallback(() => setFan(false), []);

  const clearTimer = () => {
    const p = press.current;
    if (p && p.timer !== null) { window.clearTimeout(p.timer); p.timer = null; }
  };

  /* The bar owns the whole gesture, including the part that happens over the
     fan: it takes pointer capture on the way down, so a thumb that slides two
     hundred pixels up the screen is still delivering moves here. That is what
     makes press-slide-release one gesture instead of three. */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button > 0 || viewer) return;
    const target = e.currentTarget as HTMLElement;
    /* Capture is what keeps the steering moves coming to this button after
       the thumb has travelled two hundred pixels up the screen. Not every
       browser will grant it — Safari refuses for a pointer it has already
       let go of, and it throws rather than returning false — and a fan that
       opens is worth more than a fan that steers. */
    try { target.setPointerCapture?.(e.pointerId); } catch { /* steering only */ }
    press.current = {
      id: e.pointerId, x: e.clientX, y: e.clientY, opened: false, moved: false,
      timer: window.setTimeout(() => { const p = press.current; if (p) { p.opened = true; openFan(); } }, LONG_PRESS_MS),
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const dy = e.clientY - p.y;
    const dx = e.clientX - p.x;
    if (!p.moved && Math.hypot(dx, dy) > 8) p.moved = true;
    if (!p.opened) {
      if (dy < -ARC_OPEN_DY) { clearTimer(); p.opened = true; openFan(); }
      else if (dy > REACH_TRIGGER) { clearTimer(); press.current = null; feedback("expand"); onReach(); return; }
      else if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) clearTimer(); // a sideways slide is not a hold
      return;
    }
    steerRef.current?.(e.clientX, e.clientY);
  };

  const endPress = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    clearTimer();
    press.current = null;
    if (!p.opened) return;
    handled.current = true;
    /* Steering is answered by the fan, which knows what is under the thumb.
       A release that never moved lands on nothing and leaves the fan open to
       be tapped — hesitating is not a decision. */
    commitRef.current?.();
  };

  const go = (id: string) => { closeFan(); onGo(id); };

  /* The + is three controls in one place: tap to add, hold to fan out every
     destination, pull down to bring the top of the screen into reach. All
     three are the same thumb without moving it, which is the only reason it
     is worth stacking three meanings on one button.

     It sits at the end of the bar on the side the phone is held, not in the
     middle: that corner is where a thumb rests, and it is also the pivot the
     fan blooms from. The two used to be a hundred pixels apart, and the slide
     that chose an item was therefore a slide relative to a point the thumb
     was not on. */
  const plus = !viewer ? (
    <button key="add" type="button" className="fhj-thumb-add" ref={addRef}
      aria-label="Add to today" aria-haspopup="dialog"
      onClick={() => {
        if (handled.current) { handled.current = false; return; }
        if (!fan) onAdd();
      }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={endPress} onPointerCancel={endPress}
      /* The keyboard route to the same place. Long-press has no key, and
         "every destination in the app" is not a thing to leave behind a
         gesture only a thumb can make. */
      onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); openFan(); } }}
      aria-keyshortcuts="ArrowUp"
      title="Tap to add · hold to go anywhere · pull down to reach"
      onContextMenu={(e) => e.preventDefault()}>
      <span className="fhj-thumb-add-disc" aria-hidden="true">
        <Icon name="plus" size={22} color="currentColor" />
      </span>
    </button>
  ) : null;

  /* The bar never changes what is under a given position.

     An earlier version of this morphed the left slot into Back on any screen
     you had navigated into, which read well in a screenshot and was wrong in
     the hand: the entire value of a three-button bar to a thumb is that the
     thumb stops needing to look. A control that is Today on one screen and
     Back on the next is a control you have to read every time, which is the
     tax this release exists to remove.

     So the three are fixed, and Back is a fourth thing in its own place —
     above the bar, on the side the phone is held, naming where it goes. It
     arrives when there is somewhere to go back to and leaves when there is
     not, and it never displaces anything. */
  const tab = (id: string, icon: string, label: string) => (
    <button type="button"
      className={"fhj-thumb-tab" + (screen === id ? " is-active" : "")}
      /* Named for the one-off tour, which points at real controls rather than
         at pictures of them and therefore has to be able to find this one.
         Nothing in this file knows what a tour is. */
      data-tour={id}
      aria-current={screen === id ? "page" : undefined}
      /* Tapping the tab you are already on returns to the top of it. A year
         of History is a very long page, and the alternative is a hundred
         flicks or a reach for the status bar — which is the one place on the
         screen a thumb cannot get to at all. */
      onClick={() => (screen === id ? onTop() : onGo(id))}>
      <span aria-hidden="true" className="fhj-thumb-glyph">
        <Icon name={icon} size={19} color="currentColor" />
      </span>
      <span className="fhj-thumb-label">{label}</span>
    </button>
  );

  return (
    <>
      {fan && (
        <Fan destinations={destinations} active={screen} hand={hand} pivot={pivotRef.current} Icon={Icon}
          steerRef={steerRef} commitRef={commitRef} onGo={go} onFlipHand={onFlipHand} onClose={closeFan} />
      )}
      {coach && !hideCoach && !viewer && !canBack && (
        /* Outside the <nav> deliberately: it is a note about the bar, not a
           destination in it, and a fourth thing inside the landmark would be
           announced as one. */
        <button type="button" className="fhj-thumb-coach" data-hand={hand}
          onClick={() => { markFanSeen(); setCoach(false); openFan(); }}>
          <span className="fhj-thumb-coach-dot" aria-hidden="true" />
          {/* One flex item, not four: a bare text node beside an element in a
              flex row is its own anonymous box, and "Hold + to go anywhere"
              came apart into three of them at three different widths. */}
          <span>Hold <b>+</b> to go anywhere</span>
        </button>
      )}
      <nav className="fhj-thumbnav" aria-label="Main">
        {canBack && (
          <div className="fhj-thumb-backrow" data-hand={hand}>
            {/* The label is the destination alone — "History", not "Back to
                History" — because the arrow beside it already says "back" and
                a pill this size has room for one word. The accessible name
                carries the whole sentence, or a screen reader announces a
                button called "History" that is not the History tab. */}
            <button type="button" className="fhj-thumb-back" onClick={onBack}
              aria-label={`Back to ${backLabel}`}>
              <span aria-hidden="true" className="fhj-thumb-back-arrow">
                <Icon name="left" size={16} color="currentColor" />
              </span>
              <span aria-hidden="true">{backLabel}</span>
            </button>
          </div>
        )}
        <div className="fhj-thumbnav-inner" data-hand={hand}>
          {hand === "left" && plus}
          {tab("dashboard", "home", "Today")}
          {tab("history", "calendar", "History")}
          {hand === "right" && plus}
        </div>
      </nav>
    </>
  );
}

/* ---------- the edge gesture ---------- */

export interface EdgeBackProps {
  enabled: boolean;
  hand: Hand;
  /** The element that moves. Everything except the bar, which stays put — the
      bar is the one thing that must never slide out from under the thumb. */
  shellRef: React.MutableRefObject<HTMLElement | null>;
  onBack: () => void;
}

export function EdgeBack({ enabled, hand, shellRef, onBack }: EdgeBackProps) {
  const drag = useRef<{ id: number; x0: number; y0: number; dir: -1 | 1; t: number; travel: number; live: boolean } | null>(null);
  const [peek, setPeek] = useState<{ dir: -1 | 1; p: number } | null>(null);

  const paint = useCallback((dir: number, travel: number, width: number) => {
    const el = shellRef.current;
    const p = backProgress(travel, width);
    if (el) {
      el.style.transition = "none";
      el.style.transform = `translate3d(${dir * travel * 0.86}px, 0, 0) scale(${1 - 0.05 * p})`;
      el.style.borderRadius = p > 0.02 ? "22px" : "";
      el.style.opacity = String(1 - 0.22 * p);
    }
    setPeek({ dir: dir as -1 | 1, p });
  }, [shellRef]);

  const release = useCallback((finish: boolean) => {
    const el = shellRef.current;
    setPeek(null);
    if (!el) { if (finish) onBack(); return; }
    if (finish) {
      const width = window.innerWidth || 390;
      const dir = drag.current?.dir ?? -1;
      if (prefersReducedMotion()) {
        el.style.transition = ""; el.style.transform = ""; el.style.opacity = ""; el.style.borderRadius = "";
        onBack();
        return;
      }
      el.style.transition = "transform 180ms cubic-bezier(0.4,0,1,1), opacity 180ms linear";
      el.style.transform = `translate3d(${dir * width * 0.5}px, 0, 0) scale(0.94)`;
      el.style.opacity = "0";
      window.setTimeout(() => {
        el.style.transition = "none";
        el.style.transform = "";
        el.style.opacity = "";
        el.style.borderRadius = "";
        onBack();
        /* Handing the element back to the stylesheet has to wait a frame, or
           the "none" above is still in force when the new screen animates in
           and the entrance plays as a jump cut. */
        requestAnimationFrame(() => { el.style.transition = ""; });
      }, 175);
      return;
    }
    el.style.transition = "transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 220ms linear";
    el.style.transform = "";
    el.style.opacity = "";
    window.setTimeout(() => {
      if (!drag.current) { el.style.transition = ""; el.style.borderRadius = ""; }
    }, 330);
  }, [onBack, shellRef]);

  useEffect(() => {
    if (!enabled) return;
    const onDown = (e: PointerEvent) => {
      if (drag.current || e.pointerType === "mouse") return;
      const width = window.innerWidth || 390;
      if (!edgeStart(e.clientX, width, hand)) return;
      /* Some surfaces own sideways movement already: the report's period
         pager, the metric rail, the photo A/B slider. A back gesture that
         started on one of them would be two things happening at once, and the
         one the person meant would lose. */
      const t = e.target;
      if (t instanceof Element && t.closest(
        "[data-noswipe], input[type=range], .fhj-scroller, .fhj-picker-scroll, .overflow-x-auto, .fhj-sheet, .fhj-scrim, .fhj-fan"
      )) return;
      drag.current = {
        id: e.pointerId, x0: e.clientX, y0: e.clientY,
        dir: edgeDirection(e.clientX, width), t: Date.now(), travel: 0, live: false,
      };
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const width = window.innerWidth || 390;
      const travel = (e.clientX - d.x0) * d.dir;
      if (!d.live) {
        /* Claim the gesture only once it is unambiguously horizontal and
           inward. Anything else is a scroll, and stealing a scroll from
           somebody reading their own journal is unforgivable — so a drag
           that has moved further down the screen than across it is let go
           of entirely rather than left armed to change its mind later. */
        if (Math.abs(e.clientY - d.y0) > Math.abs(e.clientX - d.x0)) { drag.current = null; return; }
        if (travel < 12) return;
        d.live = true;
        feedback("nav");
      }
      d.travel = Math.max(0, travel);
      e.preventDefault();
      paint(d.dir, d.travel, width);
    };
    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      drag.current = null;
      if (!d.live) return;
      const width = window.innerWidth || 390;
      release(shouldCompleteBack(d.travel, width, Date.now() - d.t));
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove as EventListener);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [enabled, hand, paint, release]);

  if (!peek) return null;
  return (
    <div className="fhj-edgeback" data-side={peek.dir === -1 ? "right" : "left"}
      style={{ ["--ep" as string]: peek.p.toFixed(3) }} aria-hidden="true">
      <span className="fhj-edgeback-puck">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={peek.dir === -1 ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
        </svg>
      </span>
    </div>
  );
}

export const EDGE_HOT_ZONE = EDGE_ZONE;
export default ThumbNav;
