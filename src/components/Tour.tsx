/* Being shown around, once.

   This draws the tour described in lib/tour.ts. Everything about how it looks
   comes down to one decision: it points at the app rather than replacing it.

   So there is no carousel of illustrations and no sequence of full-screen
   slides. The dashboard stays exactly where it is, the screen dims around one
   control at a time, and a card explains that control while it is lit. What
   somebody remembers afterwards is a place on the screen, which is the only
   thing worth remembering — a paragraph about a "quick add row" teaches
   nothing that finding the row does not teach better.

   The mechanics that make that work, and the reasons:

   **The hole is a shadow, not a mask.** One absolutely-positioned box sits
   over the target with an enormous spread `box-shadow` in the dim colour. The
   dimming is therefore *outside* the box by construction, at any size, with no
   SVG mask to keep in step and no four-rectangle scrim to leave seams at the
   corners. It also means the hole can be transitioned: moving between two
   stops animates one box between two rects, and the light appears to travel.

   **The target is found, not passed in.** Stops name a CSS selector. Nothing
   on the dashboard imports this file, holds a ref for it, or knows it exists —
   and a stop whose control is missing (no Quick Add row, because somebody kept
   no extras) is dropped from the run rather than drawn over empty space.

   **Nothing under the dim is live.** The overlay takes every pointer event.
   A tour where the spotlit button is tappable sounds delightful and is a trap:
   the person taps it, the app navigates, and the tour is now describing a
   screen that is not there.

   **It survives the page moving.** Rects are re-measured on scroll, on resize
   and whenever the stop changes, and each stop scrolls its target into view
   first. On a phone this matters constantly: the + button is fixed to the
   bottom of the viewport and the pulse card is not.

   Reduced motion turns off the travel and the pulse ring; the still frame is
   the finished layout, as everywhere else in this app. */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { C } from "../lib/theme";
import { feedback } from "../lib/feedback";
import { prefersReducedMotion } from "../lib/motion";
import { TOUR, SETTINGS_MAP, cardSide, type Rect, type TourStop } from "../lib/tour";

type Props = {
  /** The app's icon set, passed in so this file draws nothing of its own. */
  Icon: React.ComponentType<{ name: string; size?: number; color?: string }>;
  /** What to call them. Empty when they refused a name, which is fine. */
  name?: string;
  appName: string;
  /** Take them to Settings from the last card. */
  onOpenSettings: () => void;
  /** Finished, or left early. Either way it never runs again. */
  onDone: () => void;
};

/** Every stop whose control is actually on the screen. Measured once, when the
    tour opens, because the dashboard does not change underneath it — the
    overlay is eating every event that could change it. */
function liveStops(): TourStop[] {
  return TOUR.filter((s) => !s.target || document.querySelector(s.target));
}

const measure = (sel: string, pad: number): Rect | null => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return {
    top: r.top - pad,
    left: r.left - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
};

/* ---------- the gesture drawings ----------

   Three small diagrams, because "hold it and slide" is a sentence somebody has
   to translate into a movement, and a picture of a thumb on a button with an
   arc coming off it is the movement. They are decorative and marked as such;
   the sentence above them is always the real explanation. */
function Gesture({ kind }: { kind: "hold" | "drag" | "tap" }) {
  return (
    <div className={"fhj-tour-gest is-" + kind} aria-hidden="true">
      <span className="fhj-tour-gest-surface">
        {kind === "hold" && (
          <>
            <span className="fhj-tour-arc" />
            <span className="fhj-tour-arc is-b" />
            <span className="fhj-tour-arc is-c" />
          </>
        )}
        {kind === "drag" && (
          <>
            <span className="fhj-tour-tile" />
            <span className="fhj-tour-tile is-lift" />
            <span className="fhj-tour-tile" />
          </>
        )}
        <span className="fhj-tour-thumb" />
        {kind !== "drag" && <span className="fhj-tour-ripple" />}
      </span>
      <span className="fhj-tour-gest-label">
        {kind === "hold" ? "press · keep pressing · slide"
          : kind === "drag" ? "hold · lift · move"
            : "one tap"}
      </span>
    </div>
  );
}

export default function Tour({ Icon, name, appName, onOpenSettings, onDone }: Props) {
  /* Which stops are real, worked out once — after the first commit, never
     during a render. The dashboard this tour points at is a sibling in the
     same tree: during the render that mounts both, none of it is in the
     document yet, so a `useMemo` here finds nothing and the tour is a list of
     zero controls. It has to be a layout effect, and it has to run before
     paint, or the first card is drawn against the wrong count. */
  const [stops, setStops] = useState<TourStop[]>([]);
  useLayoutEffect(() => { setStops(liveStops()); }, []);
  /* -1 is the welcome, stops.length is the map of Settings, and one past that
     is the goodbye. Three cards that are about the app rather than about a
     control, and they are the only three that sit in the middle of the screen. */
  const [at, setAt] = useState(-1);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const stop = at >= 0 && at < stops.length ? stops[at] : null;
  const last = at >= stops.length + 1;
  const total = stops.length + 2;

  const finish = useCallback(() => { feedback("complete"); onDone(); }, [onDone]);
  const leave = useCallback(() => { feedback("tap"); onDone(); }, [onDone]);

  /* Where the light is. Re-measured on every scroll and resize because the
     bar is fixed to the viewport and the cards above it are not — a hole
     measured once would slide off its own button on the first flick. */
  const remeasure = useCallback(() => {
    if (!stop?.target) { setRect(null); return; }
    setRect(measure(stop.target, stop.pad ?? 10));
  }, [stop]);

  useLayoutEffect(() => {
    if (!stop?.target) { setRect(null); return; }
    const el = document.querySelector(stop.target);
    /* Into view first, then measure — measuring a target that is about to
       scroll is measuring where it used to be. `center` rather than `nearest`
       because a control level with the top of the viewport has the card
       nowhere to go. */
    el?.scrollIntoView?.({
      block: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    setRect(measure(stop.target, stop.pad ?? 10));
    const t = window.setTimeout(remeasure, 420);   // after the scroll settles
    return () => window.clearTimeout(t);
  }, [stop, remeasure]);

  useEffect(() => {
    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);
    return () => {
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
    };
  }, [remeasure]);

  /* The keyboard route through it. A tour that can only be advanced by a
     thumb is a tour somebody on a laptop is trapped in. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); leave(); return; }
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (at >= stops.length + 1) finish();
        else setAt((i) => i + 1);
        return;
      }
      if (e.key === "ArrowLeft") { e.preventDefault(); setAt((i) => Math.max(-1, i - 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, stops.length, leave, finish]);

  /* Focus lands on the card, so a screen reader reads the stop rather than
     whatever was behind it. */
  useEffect(() => { cardRef.current?.focus?.(); }, [at]);

  /* ---------- the card scrolls, the app does not ----------

     The tour cannot pin the page the way a sheet does: it *scrolls the page
     on purpose*, once per stop, to bring each control into the light. So the
     usual lock is unavailable and the containment has to be done a gesture at
     a time.

     Which is the bug this fixes. A card taller than the space it was given —
     the map of Settings, on a phone — could not be read past its first
     screenful: a wheel over it was claimed by the smooth-scroll driver, which
     knows nothing about this card, and spent on the document behind the dim.
     The card stood still, the app slid away underneath it, and the rest of
     the list was simply unreachable.

     So every wheel and every drag that lands anywhere on this overlay is
     answered here. If it starts inside the card and the card has room left to
     move in that direction, it is left alone to scroll natively and stopped
     from travelling any further — the driver never sees it. Everything else —
     a flick on the dim, a wheel that runs past the end of the list — is
     cancelled outright. Nothing behind the tour moves unless the tour moves
     it. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const roomFor = (dy: number) => {
      const card = cardRef.current;
      if (!card || !dy) return false;
      const room = card.scrollHeight - card.clientHeight;
      if (room <= 1) return false;
      return dy < 0 ? card.scrollTop > 0 : card.scrollTop < room - 1;
    };
    const inCard = (t: EventTarget | null) =>
      t instanceof Node && !!cardRef.current?.contains(t);

    const onWheel = (e: WheelEvent) => {
      e.stopPropagation();
      if (inCard(e.target) && roomFor(e.deltaY)) return;
      if (e.cancelable) e.preventDefault();
    };
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => { startY = e.touches[0]?.clientY ?? 0; };
    const onTouchMove = (e: TouchEvent) => {
      e.stopPropagation();
      /* Positive means the finger moved up the screen, which is a request to
         see further down the card. */
      const dy = startY - (e.touches[0]?.clientY ?? startY);
      if (inCard(e.target) && roomFor(dy)) return;
      if (e.cancelable) e.preventDefault();
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  const next = () => {
    if (last) { finish(); return; }
    feedback("nav");
    setAt((i) => i + 1);
  };
  const back = () => { feedback("tap"); setAt((i) => Math.max(-1, i - 1)); };

  const side = cardSide(rect, typeof window === "undefined" ? 800 : window.innerHeight);
  const first = (name || "").trim().split(/\s+/)[0] || "";

  /* The card's own place. Below the hole, above it, or in the middle when
     there is no hole — set in px against the viewport, because the thing it
     is positioned against is a viewport rect.

     The height is set here too, and it has to be: a card pinned 14px under a
     control near the bottom of the screen has whatever is left, which on a
     phone is often less than the stylesheet's 78vh. Without this the card
     simply ran off the end of the viewport, and the part hanging past the
     bottom edge was unreachable — there was no scrollbar to find, because
     the element was not overflowing, the screen was. Measuring the gap and
     handing it to `max-height` is what turns the overflow back into a scroll
     inside the card, where the containment below can keep it. */
  const viewH = typeof window === "undefined" ? 800 : window.innerHeight;
  const GAP = 14;
  const cardStyle: React.CSSProperties = !rect || side === "center"
    ? {}
    : side === "below"
      ? {
        top: Math.round(rect.top + rect.height + GAP),
        maxHeight: Math.max(160, Math.round(viewH - (rect.top + rect.height) - GAP * 2)),
      }
      : {
        bottom: Math.round(viewH - rect.top + GAP),
        maxHeight: Math.max(160, Math.round(rect.top - GAP * 2)),
      };

  return (
    <div className="fhj-tour" ref={rootRef} role="dialog" aria-modal="true"
      aria-label={`${appName} — a look around`}>
      {/* The light. One box, one enormous shadow: everything outside it is the
          dim, at any size, with no seams and nothing to keep in step. */}
      <div
        className={"fhj-tour-hole" + (rect ? " is-on" : " is-off") + (prefersReducedMotion() ? " is-still" : "")}
        aria-hidden="true"
        style={rect
          ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
          : undefined} />

      {/* data-lenis-prevent is the smooth-scroll driver's own opt-out for a
          nested scroller: without it a wheel that starts inside this card is
          claimed by Lenis and spent on the document behind the tour, so the
          card stays exactly where it is while the app slides away underneath
          it. The handler on the overlay covers the other half — a flick that
          lands on the dim, or one that runs past the end of the card. */}
      <div className={"fhj-tour-card is-" + (rect ? side : "center")} style={cardStyle}
        ref={cardRef} tabIndex={-1} data-lenis-prevent>
        {at < 0 ? (
          /* The welcome. It says how long this is and how to leave, before it
             asks for a second of anybody's morning. */
          <>
            <div className="fhj-tour-eyebrow">{appName}</div>
            <h2 className="fhj-tour-title">
              {first ? `Your journal is ready, ${first}.` : "Your journal is ready."}
            </h2>
            <p className="fhj-tour-body">
              Everything on this screen is something you chose a minute ago. Here is where each of it
              lives, and the two or three things about it that are not obvious — {stops.length + 2} short
              stops, and you can leave at any point.
            </p>
            <ul className="fhj-tour-points">
              {[
                ["log", "Today", "One question at a time, answered without a form opening."],
                ["plus", "The + button", "Tap it to add. Hold it to go anywhere."],
                ["gear", "Settings", "Every decision from setup, and more besides."],
              ].map(([icon, t, b]) => (
                <li key={t}>
                  <span className="fhj-tour-point-mark"><Icon name={icon} size={13} color={C.accentText} /></span>
                  <span><b>{t}</b><span>{b}</span></span>
                </li>
              ))}
            </ul>
          </>
        ) : stop ? (
          <>
            <div className="fhj-tour-eyebrow">{stop.eyebrow}</div>
            <h2 className="fhj-tour-title">{stop.title}</h2>
            <p className="fhj-tour-body">{stop.body}</p>
            {stop.gesture && <Gesture kind={stop.gesture} />}
            {stop.points && (
              <ul className="fhj-tour-points">
                {stop.points.map(([icon, t, b]) => (
                  <li key={t}>
                    <span className="fhj-tour-point-mark"><Icon name={icon} size={13} color={C.accentText} /></span>
                    <span><b>{t}</b><span>{b}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : at === stops.length ? (
          /* What is behind the gear. The one stop that is a list rather than a
             spotlight, because spotlighting fourteen settings cards one at a
             time is a tour nobody finishes. */
          <>
            <div className="fhj-tour-eyebrow">Everything in Settings</div>
            <h2 className="fhj-tour-title">What is behind the gear</h2>
            <p className="fhj-tour-body">
              Not a wall of switches — this is the whole of it, in the order you are likely to want it.
              Nothing here is on by default that sends anything anywhere.
            </p>
            <ul className="fhj-tour-map">
              {SETTINGS_MAP.map(([icon, t, b]) => (
                <li key={t}>
                  <span className="fhj-tour-point-mark"><Icon name={icon} size={13} color={C.accentText} /></span>
                  <span><b>{t}</b><span>{b}</span></span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          /* The goodbye. One line about what happens next, and then out of the
             way for good. */
          <>
            <div className="fhj-tour-eyebrow">That's the whole app</div>
            <h2 className="fhj-tour-title">
              {first ? `It's yours now, ${first}.` : "It's yours now."}
            </h2>
            <p className="fhj-tour-body">
              Today is already on the record. Come back tomorrow and answer the same few questions, and
              in a few weeks History starts telling you things you could not have remembered.
            </p>
            <ul className="fhj-tour-points">
              {[
                ["spark", "One number is a whole day", "On the worst mornings, the tap is the log. That is the point of it."],
                ["gear", "Change anything, any time", "Questions, how often it asks, what it looks like — none of it is fixed."],
                ["device", "It stays here", "No account, and nothing leaves this device unless you switch something on yourself."],
              ].map(([icon, t, b]) => (
                <li key={t}>
                  <span className="fhj-tour-point-mark"><Icon name={icon} size={13} color={C.accentText} /></span>
                  <span><b>{t}</b><span>{b}</span></span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="fhj-tour-bar" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={"fhj-tour-seg" + (i < at + 1 ? " is-done" : i === at + 1 ? " is-now" : "")} />
          ))}
        </div>

        <div className="fhj-tour-foot">
          <button type="button" className="fhj-tour-next" onClick={next}>
            <span>
              {at < 0 ? "Show me around"
                : last ? "Start my day"
                  : at === stops.length ? "Nearly done"
                    : "Next"}
            </span>
            <Icon name="right" size={16} color={C.onAccent} />
          </button>
          <div className="fhj-tour-foot-row">
            {at >= 0 && (
              <button type="button" className="fhj-tour-quiet" onClick={back}>Back</button>
            )}
            {at === stops.length && (
              <button type="button" className="fhj-tour-quiet"
                onClick={() => { feedback("nav"); onDone(); onOpenSettings(); }}>
                Open Settings now
              </button>
            )}
            {!last && (
              <button type="button" className="fhj-tour-quiet" onClick={leave}>
                {at < 0 ? "I'll explore myself" : "Skip the rest"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
