/* The one feedback layer.
 *
 * Four channels behind one call, and the thing actually worth testing is not
 * that a buzz happens — it is that every way of *not* having a channel
 * subtracts exactly that channel and leaves the others working. Sound off,
 * haptics off, reduced motion, no motor, no Taptic Engine, a browser that
 * throws when asked to vibrate: none of those may take anything else down with
 * them, and none of them may take a save down.
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  feedback, pulse, setFeedbackPrefs, getFeedbackPrefs, hapticsSupported,
  scaleHaptic, HAPTIC_PATTERNS, HAPTIC_SCALE, NATIVE_HAPTICS, __feedbackInternals,
} from "../src/lib/feedback";

const vibrate = vi.fn();

beforeEach(() => {
  vibrate.mockClear();
  __feedbackInternals.reset();
  (navigator as any).vibrate = vibrate;
  setFeedbackPrefs({ sound: false, haptics: true, hapticStrength: "medium" });
});

afterEach(() => {
  delete (navigator as any).vibrate;
  delete (globalThis as any).Capacitor;
});

/** The rattle guard drops anything within 40ms of the last event. */
const settle = () => new Promise((r) => setTimeout(r, 60));

describe("one call, whatever the device can do", () => {
  it("buzzes on a web device with a motor", async () => {
    feedback("save");
    expect(vibrate).toHaveBeenCalledTimes(1);
    await settle();
  });

  it("stays silent, and stays working, with haptics switched off", async () => {
    setFeedbackPrefs({ sound: false, haptics: false });
    expect(() => feedback("save")).not.toThrow();
    expect(vibrate).not.toHaveBeenCalled();
    await settle();
  });

  it("does nothing at all on a laptop with no motor", async () => {
    delete (navigator as any).vibrate;
    __feedbackInternals.reset();
    expect(hapticsSupported()).toBe(false);
    expect(() => feedback("save")).not.toThrow();
    await settle();
  });

  it("survives a browser that throws when asked to vibrate", async () => {
    (navigator as any).vibrate = () => { throw new Error("denied"); };
    expect(() => feedback("save")).not.toThrow();
    await settle();
  });

  it("collapses a double-tap into one event", async () => {
    feedback("tap");
    feedback("tap");
    expect(vibrate).toHaveBeenCalledTimes(1);
    await settle();
  });

  it("never drops a failure, even inside a burst of taps", async () => {
    // An error swallowed by the rattle guard means a failed save feels exactly
    // like a successful one, which is the worst thing this layer could do.
    feedback("tap");
    feedback("error");
    expect(vibrate).toHaveBeenCalledTimes(2);
    await settle();
  });

  it("never drops the once-a-day moments either", async () => {
    feedback("tap");
    feedback("complete");
    expect(vibrate).toHaveBeenCalledTimes(2);
    await settle();
  });
});

describe("strength, on a platform that only exposes duration", () => {
  it("drives the motor longer at a higher setting", () => {
    const soft = scaleHaptic(HAPTIC_PATTERNS.save, "soft") as number[];
    const vivid = scaleHaptic(HAPTIC_PATTERNS.save, "vivid") as number[];
    expect(vivid[0]).toBeGreaterThan(soft[0]);
  });

  it("stretches pulses far more than the silences between them", () => {
    // Scaling the gaps equally turns a crisp double-tap into two unrelated
    // buzzes, which reads as a glitch rather than as emphasis.
    const [p0, g0] = scaleHaptic(HAPTIC_PATTERNS.delete, "medium") as number[];
    const [p1, g1] = scaleHaptic(HAPTIC_PATTERNS.delete, "vivid") as number[];
    expect(p1 / p0).toBeGreaterThan(g1 / g0);
  });

  it("never rounds a pulse down to nothing", () => {
    expect(scaleHaptic(1, "soft")).toBeGreaterThanOrEqual(1);
  });

  it("falls back to the default rather than going silent on a bad value", () => {
    expect(scaleHaptic(10, "thunderous" as any)).toBe(scaleHaptic(10, "vivid"));
    expect(Object.keys(HAPTIC_SCALE)).toEqual(["soft", "medium", "strong", "vivid"]);
  });

  it("uses the chosen strength, not the last one", async () => {
    setFeedbackPrefs({ sound: false, haptics: true, hapticStrength: "soft" });
    feedback("save");
    const soft = vibrate.mock.calls[0][0];
    await settle();
    setFeedbackPrefs({ sound: false, haptics: true, hapticStrength: "vivid" });
    feedback("save");
    expect(vibrate.mock.calls[1][0][0]).toBeGreaterThan(soft[0]);
    await settle();
  });
});

describe("a device with a real haptic engine", () => {
  const plugin = () => ({
    impact: vi.fn(async () => {}),
    notification: vi.fn(async () => {}),
    selectionStart: vi.fn(async () => {}),
    selectionChanged: vi.fn(async () => {}),
    selectionEnd: vi.fn(async () => {}),
  });

  it("uses the engine instead of the vibration API", async () => {
    const p = plugin();
    __feedbackInternals.nativePlugin = p as any;
    feedback("save");
    expect(p.notification).toHaveBeenCalledWith({ type: "SUCCESS" });
    expect(vibrate).not.toHaveBeenCalled();
    await settle();
  });

  it("uses the selection tick for choosing, not an impact", async () => {
    // Picking among options is a detent, not a knock — this is the difference
    // between feeling like an iOS app and feeling like a web page.
    const p = plugin();
    __feedbackInternals.nativePlugin = p as any;
    feedback("select");
    expect(p.selectionChanged).toHaveBeenCalled();
    expect(p.impact).not.toHaveBeenCalled();
    await settle();
  });

  it("reserves notification patterns for outcomes", () => {
    for (const name of ["save", "complete", "milestone", "warn", "error"]) {
      expect(NATIVE_HAPTICS[name].kind).toBe("notification");
    }
    for (const name of ["tap", "quickadd", "delete", "toggleOn"]) {
      expect(NATIVE_HAPTICS[name].kind).toBe("impact");
    }
  });

  it("shifts impact weight with the strength setting", async () => {
    const p = plugin();
    __feedbackInternals.nativePlugin = p as any;
    setFeedbackPrefs({ sound: false, haptics: true, hapticStrength: "soft" });
    feedback("quickadd"); // Medium by default
    expect(p.impact).toHaveBeenCalledWith({ style: "Light" });
    await settle();
    setFeedbackPrefs({ sound: false, haptics: true, hapticStrength: "vivid" });
    feedback("quickadd");
    expect(p.impact).toHaveBeenLastCalledWith({ style: "Heavy" });
    await settle();
  });

  it("leaves system-defined patterns where the platform put them", async () => {
    // Re-weighting a selection tick or a success chime would only make the app
    // disagree with every other app on the phone.
    const p = plugin();
    __feedbackInternals.nativePlugin = p as any;
    setFeedbackPrefs({ sound: false, haptics: true, hapticStrength: "soft" });
    feedback("save");
    expect(p.notification).toHaveBeenCalledWith({ type: "SUCCESS" });
    await settle();
  });

  it("falls back to the vibration API when the engine refuses", async () => {
    const p = plugin();
    p.notification = vi.fn(() => { throw new Error("no engine"); }) as any;
    __feedbackInternals.nativePlugin = p as any;
    feedback("save");
    expect(vibrate).toHaveBeenCalled();
    await settle();
  });

  it("has a native mapping for every pattern the web side knows", () => {
    for (const name of Object.keys(HAPTIC_PATTERNS)) {
      expect(NATIVE_HAPTICS[name], `missing native mapping for ${name}`).toBeTruthy();
    }
  });
});

describe("the visual channel", () => {
  it("acknowledges the element that was touched", () => {
    const el = document.createElement("button");
    document.body.appendChild(el);
    feedback("quickadd", { el });
    expect(el.classList.contains("fhj-fb-pulse")).toBe(true);
    el.remove();
  });

  it("shakes on failure rather than pulsing", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    feedback("error", { el });
    expect(el.classList.contains("fhj-fb-shake")).toBe(true);
    expect(el.classList.contains("fhj-fb-pulse")).toBe(false);
    el.remove();
  });

  it("restarts on a second tap inside the animation window", () => {
    // Removing and re-adding the class without forcing a reflow shows nothing
    // at all — the browser coalesces it into no change.
    const el = document.createElement("button");
    document.body.appendChild(el);
    pulse(el);
    pulse(el);
    expect(el.classList.contains("fhj-fb-pulse")).toBe(true);
    el.remove();
  });

  it("stays still for anyone who asked for less motion", () => {
    const el = document.createElement("button");
    document.body.appendChild(el);
    const prev = window.matchMedia;
    (window as any).matchMedia = (q: string) => ({
      matches: q.includes("reduce"), media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
      dispatchEvent: () => false,
    });
    pulse(el);
    expect(el.classList.contains("fhj-fb-pulse")).toBe(false);
    (window as any).matchMedia = prev;
    el.remove();
  });

  it("does nothing, quietly, when there is no element", () => {
    expect(() => pulse(null)).not.toThrow();
    expect(() => pulse(undefined)).not.toThrow();
  });
});

describe("preferences", () => {
  it("reports back exactly what it was given", () => {
    setFeedbackPrefs({ sound: true, haptics: false, hapticStrength: "strong" });
    expect(getFeedbackPrefs()).toMatchObject({ sound: true, haptics: false, hapticStrength: "strong" });
  });

  it("ignores an empty update instead of resetting to defaults", () => {
    setFeedbackPrefs({ sound: true, haptics: true, hapticStrength: "vivid" });
    setFeedbackPrefs(null);
    expect(getFeedbackPrefs().hapticStrength).toBe("vivid");
  });

  it("treats an undefined switch as on — a journal that predates it isn't muted", () => {
    setFeedbackPrefs({});
    expect(getFeedbackPrefs().haptics).not.toBe(false);
  });
});
