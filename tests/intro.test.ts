/* The first thirty seconds, and the one rule that outranks every effect in it:
 * the flow is never waiting on a tween.
 *
 * Every helper in lib/intro is allowed to do nothing — reduced motion, a
 * missing element, a screen that unmounted mid-flight — and the ones that hand
 * the flow onward have to hand it onward anyway. A welcome that gets stuck on
 * its own hero because an animation did not run is worse than a welcome with no
 * animation at all, and it is the failure that would only ever show up on
 * somebody else's phone.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildTimeline, countUp, heroIn, heroOut, landCard, railAdvance } from "../src/lib/intro";

const motion = (on: boolean) => {
  window.matchMedia = ((q: string) => ({
    matches: q.includes("reduce") ? !on : false,
    media: q,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as any;
};

/** A hero with everything the exit looks for. */
function hero(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <div class="fhj-fr-collage">
      <span data-hero-rail></span>
      <div data-hero-card></div><div data-hero-card></div>
    </div>
    <h1><span><span data-hero-line>Your health,</span></span>
        <span><span data-hero-line>remembered.</span></span></h1>
    <div data-hero-cta><button>Start</button></div>`;
  document.body.appendChild(root);
  return root;
}

beforeEach(() => { document.body.innerHTML = ""; });
afterEach(() => { vi.useRealTimers(); });

describe("nothing blocks the flow", () => {
  it("hands the welcome onward on the same tick when motion is off", () => {
    motion(false);
    const onDone = vi.fn();
    heroOut(hero(), onDone);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("hands it onward with no hero at all", () => {
    motion(false);
    const onDone = vi.fn();
    heroOut(null, onDone);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  /* The case that would strand somebody: motion is on, so the early return
     does not fire, and the markup the exit is written against is not there —
     a redesign, a stripped render, an element renamed. An empty timeline never
     completes, so without a fallback the welcome would simply stop. */
  it("hands it onward when motion is on but there is nothing to animate", async () => {
    motion(true);
    const onDone = vi.fn();
    const empty = document.createElement("div");
    document.body.appendChild(empty);
    heroOut(empty, onDone);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("hands it onward exactly once when the animation does run", async () => {
    motion(true);
    const onDone = vi.fn();
    heroOut(hero(), onDone);
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled(), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 250));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("lands a card that has nowhere to land, rather than holding the screen", () => {
    motion(true);
    const onDone = vi.fn();
    landCard(null, null, onDone);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("finishes building a timeline that is not there", () => {
    motion(false);
    const onDone = vi.fn();
    buildTimeline(null, onDone);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("the still frame is the finished layout", () => {
  /* The rail is the hero's spine and the shape the last act draws for real. It
     was written as a stroke-dash reveal — correct for an SVG path, and a no-op
     on the <span> it actually is, so the one drawing gesture in the hero never
     happened. It is a transform now, which is what the CSS had been declaring
     `transform-origin: top center` for all along. */
  it("draws the hero rail with a transform, not a stroke a span cannot have", async () => {
    motion(true);
    const root = hero();
    const rail = root.querySelector<HTMLElement>("[data-hero-rail]")!;
    const stop = heroIn(root);
    /* What a browser would show mid-draw: a scaled span. `stroke-dashoffset`
       on a <span> is a property nothing reads, which is why the rail used to
       just fade for a second and call it a reveal. */
    await vi.waitFor(() => expect(rail.style.transform).toMatch(/scale/i), { timeout: 2000 });
    expect(rail.style.strokeDashoffset).toBeFalsy();
    stop();
  });

  it("leaves a number at its final value when motion is off", () => {
    motion(false);
    const el = document.createElement("span");
    countUp(el, 1);
    expect(el.textContent).toBe("1");
  });

  it("advances the rail without one being there", () => {
    motion(true);
    expect(() => railAdvance(document.createElement("div"), 1)).not.toThrow();
    expect(() => railAdvance(null, -1)).not.toThrow();
  });
});
