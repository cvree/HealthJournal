/* The first thirty seconds.

   Every other motion in this app is deliberately quiet: a 12px rise, a 220ms
   fade, nothing that asks to be watched. This file is the one exception, and
   it is an exception for a reason. A journal is a promise about the future —
   *keep writing this down and in six months it will tell you something* — and
   a promise is the hardest thing for a blank screen to make. Showing somebody
   their journal being built, out of their own first entry, in one continuous
   movement, makes the argument in three seconds that a paragraph of copy
   cannot make at all.

   The rules it still obeys:

   1. **Reduced motion is not a degraded path.** Every function here returns
      immediately under `prefers-reduced-motion`, and the screens are composed
      so that the still frame is the finished layout — nothing is animated
      *into* existence that isn't already laid out where it belongs.
   2. **Nothing blocks.** Each helper takes an `onDone` and calls it even when
      it does nothing at all, so the flow never waits on a tween.
   3. **It ends.** Idle loops are handed back a killer; the caller unmounts and
      the timeline dies with it. An animation still running on a screen nobody
      is looking at is a battery bug. */

import { gsap } from "gsap";
import { prefersReducedMotion } from "./motion";

type El = HTMLElement | null | undefined;

const kill = (tl: gsap.core.Timeline | gsap.core.Tween | null) => () => { tl?.kill(); };
const NOOP = () => {};

/** Children of `el` marked with a data attribute, in document order. */
const parts = (el: El, name: string): HTMLElement[] =>
  el ? Array.from(el.querySelectorAll<HTMLElement>(`[data-${name}]`)) : [];

/* ---------- act one: the hero ---------- */

/**
 * The masthead assembles, then the collage of journal fragments drifts in
 * behind it and keeps breathing.
 *
 * The order is the argument: the line first ("your health, remembered"), then
 * the evidence for it (a rating, a photograph, a note, a trend), then the way
 * in. Reversing that — cards first — reads as a screensaver.
 */
export function heroIn(root: El): () => void {
  if (!root || prefersReducedMotion()) return NOOP;

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  const lines = parts(root, "hero-line");
  const cards = parts(root, "hero-card");
  const cta = parts(root, "hero-cta");
  const rail = root.querySelector<HTMLElement>("[data-hero-rail]");

  if (lines.length) {
    /* A clip reveal rather than a fade: the words rise out from behind their
       own edge, which reads as type being set rather than as a slide. */
    tl.fromTo(lines,
      { yPercent: 115, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.85, stagger: 0.09 }, 0.05);
  }

  if (rail) {
    /* The rail grows downward — the same movement `buildTimeline` makes at the
       other end of the flow, which is the point: the line the collage hangs
       off in the first three seconds is the line somebody's own days hang off
       in the last three.

       It used to be written as a stroke-dash reveal, which is the right
       technique for an SVG path and does nothing at all to the `<span>` this
       actually is. `stroke-dashoffset` on a div is a property nothing reads,
       so the rail quietly fell back to a one-second opacity fade and the one
       drawing gesture in the hero never happened. The CSS had it right the
       whole time — `.fhj-fr-rail` has carried `transform-origin: top center`
       since the day it was written, waiting for this. */
    tl.fromTo(rail,
      { scaleY: 0, opacity: 0 },
      { scaleY: 1, opacity: 1, duration: 1.1, ease: "power2.inOut" }, 0.25);
  }

  if (cards.length) {
    tl.fromTo(cards,
      { autoAlpha: 0, y: 26, scale: 0.94, rotateZ: (i: number) => (i % 2 ? 1.6 : -1.6) },
      { autoAlpha: 1, y: 0, scale: 1, rotateZ: 0, duration: 0.7, stagger: 0.085 }, 0.3);
  }

  if (cta.length) {
    tl.fromTo(cta, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.07 }, 0.75);
  }

  /* And then it keeps living. Each fragment floats on its own period so the
     collage never resolves into a single pulse — the whole point is that it
     looks like a thing continuing rather than a thing waiting. */
  const floats = cards.map((el, i) =>
    gsap.to(el, {
      y: i % 2 ? -9 : 9,
      duration: 3.4 + (i % 3) * 0.7,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      delay: 0.9 + i * 0.12,
    })
  );

  return () => { tl.kill(); floats.forEach((f) => f.kill()); };
}

/**
 * The hero leaves.
 *
 * The one cut in this flow that was worth not making. Pressing Start took a
 * full-bleed dark screen — a collage breathing behind display type — and
 * replaced it, on the frame, with a plain column on a plain background. The
 * biggest change of register in the app's first minute, and it happened
 * between two frames, which reads as the promise being withdrawn rather than
 * kept.
 *
 * So it recedes instead. The buttons go first, because they have just been
 * pressed and there is nothing left for them to offer. The headline unsets
 * itself — the two lines slide back down behind the edges they rose out of,
 * which is the entrance played backwards and therefore the only exit that
 * cannot look like a different idea. And the collage lifts away last and
 * furthest, because it is the thing furthest back.
 *
 * Under four hundred milliseconds, and it never blocks: `onDone` is called on
 * the same tick under reduced motion, so the flow is never waiting on this.
 */
export function heroOut(root: El, onDone: () => void = NOOP): void {
  if (!root || prefersReducedMotion()) { onDone(); return; }
  const lines = parts(root, "hero-line");
  const cards = parts(root, "hero-card");
  const cta = parts(root, "hero-cta");
  const collage = root.querySelector<HTMLElement>(".fhj-fr-collage");

  let called = false;
  const done = () => { if (!called) { called = true; onDone(); } };
  /* A safety net rather than a second timer: if a tween is ever dropped — a
     backgrounded tab, a killed timeline — the flow still moves on. It cannot
     fire twice, and it cannot fire early. */
  const guard = setTimeout(done, 700);

  const tl = gsap.timeline({
    defaults: { ease: "power2.in" },
    onComplete: () => { clearTimeout(guard); done(); },
  });
  if (cta.length) tl.to(cta, { autoAlpha: 0, y: 8, duration: 0.16, stagger: 0.03 }, 0);
  if (lines.length) tl.to(lines, { yPercent: 60, opacity: 0, duration: 0.3, stagger: 0.05 }, 0.06);
  if (collage) tl.to(collage, { y: -34, autoAlpha: 0, duration: 0.34 }, 0.04);
  else if (cards.length) tl.to(cards, { y: -34, autoAlpha: 0, duration: 0.34, stagger: 0.03 }, 0.04);
  /* An empty timeline never completes, so nothing above having matched has to
     still hand the flow onward. */
  if (!tl.getChildren().length) { clearTimeout(guard); done(); }
}

/* ---------- act transitions ---------- */

/** One act leaves, the next arrives. Direction is +1 forward, -1 back. */
export function actIn(root: El, dir: 1 | -1 = 1): () => void {
  if (!root || prefersReducedMotion()) return NOOP;
  const blocks = parts(root, "act-block");
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  tl.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.28 }, 0);
  if (blocks.length) {
    tl.fromTo(blocks,
      { autoAlpha: 0, y: 22 * dir },
      { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.07, clearProps: "transform" }, 0.04);
  }
  return kill(tl);
}

/**
 * The rail advances.
 *
 * The five segments across the top of every numbered act used to change state
 * on the cut: you left one screen with three bars lit and arrived at the next
 * with four, and the fourth had simply always been lit. Nothing was *shown* to
 * happen, which is the definition of a progress indicator you have to read
 * rather than see.
 *
 * So the segment you have just arrived on draws itself, left to right, in the
 * time it takes the act behind it to settle — and the line under the rail, the
 * one sentence saying what this act is about, arrives after it rather than
 * with it. That order is the whole effect: the place, then the reason. A
 * sentence that lands before the bar that explains where it applies is a
 * caption with no picture.
 *
 * Backwards is not the same movement reversed. Going back is a correction, and
 * a correction that replays the fanfare of progress is the app congratulating
 * somebody for undoing something.
 */
export function railAdvance(root: El, dir: 1 | -1 = 1): void {
  if (!root || prefersReducedMotion()) return;
  const bar = root.querySelector<HTMLElement>('[data-rail-bar="now"]');
  const note = root.querySelector<HTMLElement>("[data-rail-note]");
  if (bar && dir > 0) {
    gsap.fromTo(bar,
      { scaleX: 0, transformOrigin: "left center" },
      { scaleX: 1, duration: 0.5, ease: "power2.out", clearProps: "transform" });
  }
  if (note) {
    gsap.fromTo(note,
      { autoAlpha: 0, y: 6 },
      { autoAlpha: 1, y: 0, duration: 0.42, ease: "power3.out", delay: dir > 0 ? 0.24 : 0.06,
        clearProps: "transform" });
  }
}

/* ---------- act three: choosing the number ---------- */

/** The chosen rung answers back: a quick swell, and the reading behind it
    changes weight rather than blinking. */
export function rungPop(el: El): void {
  if (!el || prefersReducedMotion()) return;
  gsap.fromTo(el, { scale: 0.86 }, { scale: 1, duration: 0.42, ease: "back.out(2.6)", clearProps: "transform" });
}

export function readoutSwap(el: El): void {
  if (!el || prefersReducedMotion()) return;
  gsap.fromTo(el,
    { scale: 1.22, filter: "blur(3px)", autoAlpha: 0.2 },
    { scale: 1, filter: "blur(0px)", autoAlpha: 1, duration: 0.36, ease: "power3.out", clearProps: "all" });
}

/* ---------- act four: the journal begins ---------- */

/**
 * The entry becomes the timeline card.
 *
 * A FLIP: the card the person just filled in is cloned, pinned over its own
 * position, and flown to where its finished form is waiting. It is the single
 * most important moment in the app's first minute — the claim that what they
 * just did *became* something — and a cross-fade cannot make that claim,
 * because a cross-fade is two things where this needs one thing moving.
 */
export interface CardFlight {
  clone: HTMLElement;
  from: DOMRect;
}

/**
 * Lift the card the person just filled in off the page.
 *
 * Split from the landing on purpose: the act it came from unmounts in between,
 * so the flying thing has to be a copy that already exists and is already
 * pinned in place by the time React tears the original down. Capturing the
 * rect first and cloning later would animate from a position that no longer
 * means anything.
 */
export function liftCard(from: El): CardFlight | null {
  if (!from || prefersReducedMotion()) return null;
  const rect = from.getBoundingClientRect();
  if (!rect.width) return null;
  const clone = from.cloneNode(true) as HTMLElement;
  clone.setAttribute("aria-hidden", "true");
  clone.style.cssText = [
    "position:fixed", `left:${rect.left}px`, `top:${rect.top}px`,
    `width:${rect.width}px`, `height:${rect.height}px`,
    "margin:0", "z-index:80", "pointer-events:none", "transform-origin:top left",
  ].join(";");
  document.body.appendChild(clone);
  gsap.to(clone, { scale: 1.03, duration: 0.2, ease: "power2.out" });
  return { clone, from: rect };
}

/**
 * Land it as the timeline card.
 *
 * This is the most important half-second in the app's first minute: the claim
 * that what somebody just did *became* something. A cross-fade cannot make
 * that claim, because a cross-fade is two things where this needs one thing
 * moving.
 */
export function landCard(flight: CardFlight | null, to: El, onDone: () => void = NOOP): () => void {
  if (!flight) { onDone(); return NOOP; }
  const target = to?.getBoundingClientRect();
  if (!to || !target || !target.width) {
    flight.clone.remove();
    onDone();
    return NOOP;
  }
  to.style.visibility = "hidden";
  const tl = gsap.timeline({
    onComplete: () => { to.style.visibility = ""; flight.clone.remove(); onDone(); },
  });
  tl.to(flight.clone, {
    left: target.left, top: target.top, width: target.width, height: target.height,
    scale: 1, duration: 0.78, ease: "power3.inOut",
  }).to(flight.clone, { autoAlpha: 0, duration: 0.18 }, "-=0.14");
  return () => { tl.kill(); flight.clone.remove(); to.style.visibility = ""; };
}

/** The rail grows downward, the markers land on it, the future fades in
    behind them. This is the journal drawing itself. */
export function buildTimeline(root: El, onDone: () => void = NOOP): () => void {
  if (!root || prefersReducedMotion()) { onDone(); return NOOP; }
  const tl = gsap.timeline({ defaults: { ease: "power3.out" }, onComplete: onDone });
  const rail = root.querySelector<HTMLElement>("[data-tl-rail]");
  const dot = root.querySelector<HTMLElement>("[data-tl-dot]");
  const ghosts = parts(root, "tl-ghost");
  const lines = parts(root, "tl-line");

  if (rail) tl.fromTo(rail, { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: "power2.inOut" }, 0);
  if (dot) tl.fromTo(dot, { scale: 0 }, { scale: 1, duration: 0.5, ease: "back.out(3)" }, 0.28);
  if (ghosts.length) {
    tl.fromTo(ghosts,
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.1 }, 0.5);
  }
  if (lines.length) {
    tl.fromTo(lines,
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.09 }, 0.65);
  }
  return kill(tl);
}

/** A brief bloom of light behind the moment something is kept. Twelve
    particles, one second, no confetti storm — the register is "this mattered",
    not "you won a prize". */
export function bloom(el: El): void {
  if (!el || prefersReducedMotion()) return;
  const dots = parts(el, "bloom-dot");
  if (!dots.length) return;
  gsap.fromTo(dots,
    { scale: 0, autoAlpha: 1, x: 0, y: 0 },
    {
      scale: (i: number) => 0.5 + (i % 4) * 0.25,
      x: (i: number) => Math.cos((i / dots.length) * Math.PI * 2) * (60 + (i % 3) * 26),
      y: (i: number) => Math.sin((i / dots.length) * Math.PI * 2) * (60 + (i % 3) * 26),
      autoAlpha: 0,
      duration: 1.05,
      ease: "power2.out",
      stagger: 0.012,
    });
}

/** Count a number up into place — used once, on the streak the person has
    just started. */
export function countUp(el: El, to: number, duration = 0.7): void {
  if (!el) return;
  if (prefersReducedMotion()) { el.textContent = String(to); return; }
  const obj = { v: 0 };
  gsap.to(obj, {
    v: to, duration, ease: "power2.out",
    onUpdate: () => { el.textContent = String(Math.round(obj.v)); },
  });
}
