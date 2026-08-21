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
  arcLayout, arcRadii, backProgress, edgeDirection, edgeStart, pickArcTarget,
  shouldCompleteBack, type Destination, type Hand,
} from "../lib/oneHanded";
import { feedback } from "../lib/feedback";
import { prefersReducedMotion } from "../lib/motion";

type IconComponent = React.ComponentType<{ name: string; size?: number; color?: string }>;

/* ---------- the fan ---------- */

interface FanProps {
  destinations: Destination[];
  active: string;
  hand: Hand;
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

function Fan({ destinations, active, hand, Icon, steerRef, commitRef, onGo, onFlipHand, onClose }: FanProps) {
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
  const pivotRef = useRef<HTMLDivElement | null>(null);

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

  const radii = arcRadii(size.w, size.h, destinations.length > 5 ? 2 : 1);
  const points = arcLayout(destinations.length, { hand, radii });

  /* The press that opened the fan is still down and still captured by the bar,
     so steering arrives here as plain coordinates rather than as events. They
     are turned pivot-relative once, here, and the geometry module does the
     rest. */
  useEffect(() => {
    steerRef.current = (x: number, y: number) => {
      const el = pivotRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const i = pickArcTarget(points, x - (r.left + r.width / 2), y - (r.top + r.height / 2));
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
    <div className="fhj-fan" data-hand={hand} role="dialog" aria-modal="true" aria-label="Go anywhere">
      <button type="button" className="fhj-fan-scrim" aria-label="Close" onClick={onClose} />
      <div className={"fhj-fan-stage" + (shown ? " is-in" : "")}>
        <div ref={pivotRef} className="fhj-fan-pivot" aria-hidden="true" />
        <ul className="fhj-fan-items">
          {destinations.map((d, i) => {
            const p = points[i];
            const isHot = i === hot;
            return (
              <li key={d.id} className="fhj-fan-slot"
                style={{
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
      {/* One line, live: what the thumb is currently resting on. It is the
          only text in the fan that changes, so it reads as an answer rather
          than as chrome. */}
      <p className="fhj-fan-hint" aria-live="polite">{hint}</p>
      <button type="button" className="fhj-fan-hand" onClick={onFlipHand}>
        {hand === "right" ? "Left-handed?" : "Right-handed?"}
      </button>
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
  Icon: IconComponent;
  onBack: () => void;
  onGo: (id: string) => void;
  onAdd: () => void;
  onFlipHand: () => void;
  /** Pull down on the bar: bring the top of the screen into reach. */
  onReach: () => void;
}

export function ThumbNav({
  screen, canBack, backLabel, destinations, hand, viewer, Icon,
  onBack, onGo, onAdd, onFlipHand, onReach,
}: ThumbNavProps) {
  const [fan, setFan] = useState(false);
  const steerRef = useRef<((x: number, y: number) => void) | null>(null);
  const commitRef = useRef<(() => boolean) | null>(null);
  /* The click that follows a press the fan already answered. The browser
     dispatches it after pointerup, by which time React may have re-rendered
     with the fan closed — so the guard has to be a ref, not state, or holding
     the button to navigate also opens the add sheet behind it. */
  const handled = useRef(false);
  const press = useRef<{ id: number; x: number; y: number; timer: number | null; opened: boolean; moved: boolean } | null>(null);

  const openFan = useCallback(() => {
    setFan((was) => {
      if (!was) feedback("menu");
      return true;
    });
  }, []);

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
    target.setPointerCapture?.(e.pointerId);
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
      aria-current={screen === id ? "page" : undefined}
      onClick={() => onGo(id)}>
      <span aria-hidden="true" className="fhj-thumb-glyph">
        <Icon name={icon} size={19} color="currentColor" />
      </span>
      <span className="fhj-thumb-label">{label}</span>
    </button>
  );

  return (
    <>
      {fan && (
        <Fan destinations={destinations} active={screen} hand={hand} Icon={Icon}
          steerRef={steerRef} commitRef={commitRef} onGo={go} onFlipHand={onFlipHand} onClose={closeFan} />
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
          {tab("dashboard", "home", "Today")}
          {!viewer && (
            /* The one control that is both a button and a handle: tap to add,
               hold to go anywhere, pull down to bring the screen into reach.
               All three are the same thumb in the same place. */
            <button type="button" className="fhj-thumb-add"
              aria-label="Add to today" aria-haspopup="dialog"
              onClick={() => {
                if (handled.current) { handled.current = false; return; }
                if (!fan) onAdd();
              }}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove}
              onPointerUp={endPress} onPointerCancel={endPress}
              onContextMenu={(e) => e.preventDefault()}>
              <span className="fhj-thumb-add-disc" aria-hidden="true">
                <Icon name="plus" size={22} color="currentColor" />
              </span>
            </button>
          )}
          {tab("history", "calendar", "History")}
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
  const drag = useRef<{ id: number; x0: number; dir: -1 | 1; t: number; travel: number; live: boolean } | null>(null);
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
      drag.current = { id: e.pointerId, x0: e.clientX, dir: edgeDirection(e.clientX, width), t: Date.now(), travel: 0, live: false };
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const width = window.innerWidth || 390;
      const travel = (e.clientX - d.x0) * d.dir;
      if (!d.live) {
        /* Claim the gesture only once it is unambiguously horizontal and
           inward. Anything else is a scroll, and stealing a scroll from
           somebody reading their own journal is unforgivable. */
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
