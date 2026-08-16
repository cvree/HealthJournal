/* One feedback system.

   Before this file, "how a tap feels" was spread across three places: a haptic
   pattern table in App.tsx, an instrument in lib/sound.ts, and a scattering of
   CSS `:active` rules. A call site said `feedback("save")` and got a buzz and a
   note, but nothing else — no visual acknowledgement, no vocabulary for
   failure, and no idea that a phone with a Taptic Engine can do far better than
   `navigator.vibrate`.

   This is the single door. A call site names *what the person did*, once, and
   this decides how that reads on the current device:

     feedback("save")            — the whole moment: haptic + sound
     feedback("error")           — the same, in the failure register
     feedback("tap", { el })     — plus a visual acknowledgement on that element

   Four channels, one vocabulary:

   - **Haptics.** Capacitor's Taptic Engine bridge when the app is running
     natively (real impact styles and notification patterns — the thing iOS
     users recognise as "native"), `navigator.vibrate` everywhere else, and
     silence on a laptop that has neither. Nothing here ever throws.
   - **Sound.** lib/sound.ts, unchanged in character, extended with the two
     voices this vocabulary needed and did not have: `error` and `warn`.
   - **Motion.** A short transform on the element that was touched, driven by a
     CSS class rather than a tween, so it costs one class toggle and cannot
     stack with GSAP.
   - **State.** Success and failure are the same call shape as everything else,
     so a screen never has to reach past this module to report a result.

   Everything degrades in the same direction: quieter. Sound off, haptics off,
   `prefers-reduced-motion`, no vibration motor, no AudioContext, a browser that
   throws on any of it — each of those subtracts a channel and leaves the others
   working. */

import { playSound, playPitched, setSoundEnabled, setSoundVolume } from "./sound";
import { prefersReducedMotion } from "./motion";

/* ---------- vocabulary ----------

   Named for the action, never for the sensation. `feedback("delete")` survives
   someone deciding a deletion should feel different; `feedback("doubleBuzz")`
   does not. */

export type FeedbackEvent =
  /* touch */
  | "tap" | "select" | "expand" | "nav" | "reorder" | "skip"
  | "toggleOn" | "toggleOff"
  /* surfaces and menus */
  | "sheetOpen" | "sheetClose" | "menu"
  /* text and number entry */
  | "key" | "erase" | "clear"
  /* commit */
  | "quickadd" | "batch" | "include" | "save" | "photo" | "delete"
  /* moments */
  | "complete" | "milestone"
  /* result */
  | "error" | "warn" | "syncDone";

/** Events whose meaning includes a *position* — which rung of a scale, which
    step of a flow, which digit. `place()` takes the position; `feedback()`
    still works and just picks a neutral pitch. */
export type PlacedEvent = "scale" | "step" | "key";

export interface FeedbackPrefs {
  sound?: boolean;
  haptics?: boolean;
  hapticStrength?: HapticStrength;
  /** Sound level, 0–1.5. Undefined means the engine default. */
  soundVolume?: number;
}

export type HapticStrength = "soft" | "medium" | "strong" | "vivid";

/* ---------- haptics ----------

   Two implementations of the same intent, picked at runtime.

   On the web there is exactly one lever: `navigator.vibrate` takes durations,
   not intensities. Strength is therefore expressed as pulse length, which a
   phone's rotary motor renders as firmness. The silences inside a multi-part
   pattern scale far less than the pulses (see HAPTIC_GAP_SCALE) because
   stretching those too turns a crisp double-tap into two separate events.

   Natively, iOS exposes the Taptic Engine properly: three impact weights, a
   dedicated selection tick, and success/warning/error notification patterns
   that every other app on the phone already uses. Mapping onto those is what
   makes the app feel like it belongs on the device rather than like a web page
   that found the vibration API. */

export const HAPTIC_PATTERNS: Record<string, number | number[]> = {
  tap: 10, select: 15, include: 15, skip: 8, expand: 8, nav: 8, reorder: 12,
  toggleOn: 14, toggleOff: 10, delete: [12, 24],
  /* Keypad digits are the lightest thing in the table on purpose: a weight is
     five or six of these in a row, and anything firmer turns entering a number
     into a rattle. */
  key: 6, erase: 9, clear: [10, 20],
  sheetOpen: 10, sheetClose: 6, menu: 10,
  scale: 14, step: [10, 24],
  batch: [10, 30, 10], quickadd: [12, 20], save: [20, 40],
  complete: [18, 40, 18], milestone: [30, 50, 30],
  /* Failure is the one pattern allowed to be a little insistent: two firm
     pulses, which is what iOS's own error notification feels like. */
  error: [26, 60, 26], warn: [16, 50, 16], syncDone: [10, 30],
};

export const HAPTIC_SCALE: Record<HapticStrength, number> = {
  soft: 0.6, medium: 1, strong: 1.7, vivid: 2.4,
};
export const HAPTIC_GAP_SCALE: Record<HapticStrength, number> = {
  soft: 0.9, medium: 1, strong: 1.15, vivid: 1.25,
};
export const HAPTIC_LEVELS: [HapticStrength, string][] = [
  ["soft", "Soft"], ["medium", "Medium"], ["strong", "Strong"], ["vivid", "Vivid"],
];

/** Scale a web pattern for the chosen strength. Even indices are pulses, odd
    ones are the silences between them — that is how `navigator.vibrate` reads
    an array. A bare number is one pulse. */
export function scaleHaptic(
  pattern: number | number[],
  strength?: HapticStrength
): number | number[] {
  const pulse = (strength && HAPTIC_SCALE[strength]) ?? HAPTIC_SCALE.vivid;
  const gap = (strength && HAPTIC_GAP_SCALE[strength]) ?? HAPTIC_GAP_SCALE.vivid;
  const scaleOne = (v: number, i: number) =>
    Math.max(1, Math.round(v * (i % 2 === 0 ? pulse : gap)));
  return Array.isArray(pattern) ? pattern.map(scaleOne) : scaleOne(pattern, 0);
}

/** How each event reads on a device with a real haptic engine.

    `selection` is the light tick iOS uses for a picker detent — the correct
    sensation for choosing among options, and audibly different from an impact.
    `notification` is reserved for outcomes, which is exactly the distinction
    the rest of the platform draws. */
export type NativeHaptic =
  | { kind: "selection" }
  | { kind: "impact"; style: "Light" | "Medium" | "Heavy" }
  | { kind: "notification"; type: "SUCCESS" | "WARNING" | "ERROR" };

export const NATIVE_HAPTICS: Record<string, NativeHaptic> = {
  tap: { kind: "impact", style: "Light" },
  select: { kind: "selection" },
  include: { kind: "selection" },
  skip: { kind: "selection" },
  expand: { kind: "impact", style: "Light" },
  nav: { kind: "impact", style: "Light" },
  reorder: { kind: "impact", style: "Light" },
  toggleOn: { kind: "impact", style: "Medium" },
  toggleOff: { kind: "impact", style: "Light" },
  quickadd: { kind: "impact", style: "Medium" },
  batch: { kind: "impact", style: "Medium" },
  /* A keypad is the textbook case for the selection tick: many events, each
     one a choice among equals, none of them an outcome. */
  key: { kind: "selection" },
  erase: { kind: "impact", style: "Light" },
  clear: { kind: "impact", style: "Medium" },
  sheetOpen: { kind: "impact", style: "Light" },
  sheetClose: { kind: "impact", style: "Light" },
  menu: { kind: "selection" },
  scale: { kind: "selection" },
  step: { kind: "impact", style: "Medium" },
  photo: { kind: "impact", style: "Medium" },
  delete: { kind: "impact", style: "Heavy" },
  save: { kind: "notification", type: "SUCCESS" },
  complete: { kind: "notification", type: "SUCCESS" },
  milestone: { kind: "notification", type: "SUCCESS" },
  syncDone: { kind: "impact", style: "Light" },
  warn: { kind: "notification", type: "WARNING" },
  error: { kind: "notification", type: "ERROR" },
};

/* Native strength has no dial, so the strength preference is honoured the only
   way it can be: by shifting which impact weight an event uses. "Soft" takes
   everything down a step, "vivid" takes it up. Selection ticks and notification
   patterns are system-defined and stay put — re-weighting those would just make
   the app disagree with the rest of the phone. */
const IMPACT_ORDER = ["Light", "Medium", "Heavy"] as const;
function shiftImpact(h: NativeHaptic, strength?: HapticStrength): NativeHaptic {
  if (h.kind !== "impact") return h;
  const delta = strength === "soft" ? -1 : strength === "strong" || strength === "vivid" ? 1 : 0;
  if (!delta) return h;
  const i = IMPACT_ORDER.indexOf(h.style);
  const next = IMPACT_ORDER[Math.min(IMPACT_ORDER.length - 1, Math.max(0, i + delta))];
  return { kind: "impact", style: next };
}

/* The native bridge is loaded lazily and only on a native platform, so a web
   build never pays for a plugin it cannot use — and the very first haptic is
   allowed to be a web vibrate while the import lands, rather than being
   dropped. */
type HapticsPlugin = {
  impact(o: { style: string }): Promise<void>;
  notification(o: { type: string }): Promise<void>;
  selectionStart(): Promise<void>;
  selectionChanged(): Promise<void>;
  selectionEnd(): Promise<void>;
};
let nativePlugin: HapticsPlugin | null = null;
let nativeRequested = false;
let nativeChecked = false;
let nativeAvailable = false;

function isNativePlatform(): boolean {
  if (nativeChecked) return nativeAvailable;
  nativeChecked = true;
  try {
    // Read through the global the Capacitor runtime installs. Importing
    // @capacitor/core here would pull the runtime into every web bundle for an
    // answer that is statically "no" on the web.
    const cap = (globalThis as any).Capacitor;
    nativeAvailable = !!cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform();
  } catch {
    nativeAvailable = false;
  }
  return nativeAvailable;
}

function ensureNativePlugin() {
  if (nativeRequested || !isNativePlatform()) return;
  nativeRequested = true;
  import("@capacitor/haptics")
    .then((m: any) => { nativePlugin = m.Haptics as HapticsPlugin; })
    .catch(() => { nativePlugin = null; });
}

function fireNative(event: string, strength?: HapticStrength): boolean {
  const plugin = nativePlugin;
  if (!plugin) return false;
  const spec = shiftImpact(NATIVE_HAPTICS[event] || NATIVE_HAPTICS.tap, strength);
  try {
    if (spec.kind === "selection") void plugin.selectionChanged();
    else if (spec.kind === "impact") void plugin.impact({ style: spec.style });
    else void plugin.notification({ type: spec.type });
    return true;
  } catch {
    return false;
  }
}

/** True when this device can vibrate at all — web motor or native engine. Drives
    whether Settings offers the switch, so a laptop is never shown a control
    that does nothing. */
export function hapticsSupported(): boolean {
  if (isNativePlatform()) return true;
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/* ---------- preferences ----------

   Module-level, like the theme tokens, so any of several thousand lines of
   markup can report a tap without a provider threaded through it. App.tsx keeps
   this in step with the saved profile. */

const prefs: FeedbackPrefs = { sound: true, haptics: true, hapticStrength: "vivid" };

export function setFeedbackPrefs(next: FeedbackPrefs | null | undefined) {
  if (!next) return;
  prefs.sound = next.sound;
  prefs.haptics = next.haptics;
  prefs.hapticStrength = next.hapticStrength;
  prefs.soundVolume = next.soundVolume;
  setSoundEnabled(next.sound !== false);
  if (typeof next.soundVolume === "number") setSoundVolume(next.soundVolume);
  if (next.haptics !== false) ensureNativePlugin();
}

export function getFeedbackPrefs(): Readonly<FeedbackPrefs> {
  return prefs;
}

/* ---------- visual acknowledgement ----------

   The third channel, and the one that works for every user on every device —
   including the ones who have sound off, haptics off, and no motor. A press
   should be *visible* within a frame.

   CSS owns the animation (`.fhj-fb-pulse` / `.fhj-fb-shake` in index.css); this
   only toggles the class and cleans up after itself. Restarting an already-
   running pulse means removing the class and forcing a reflow, or a second tap
   inside the animation window shows nothing at all. */

const PULSE_MS = 260;
const SHAKE_MS = 400;

export function pulse(el: Element | null | undefined, kind: "pulse" | "shake" = "pulse") {
  if (!el || prefersReducedMotion()) return;
  const cls = kind === "shake" ? "fhj-fb-shake" : "fhj-fb-pulse";
  const node = el as HTMLElement;
  node.classList.remove(cls);
  // Force a reflow so a re-added class restarts the animation.
  void node.offsetWidth;
  node.classList.add(cls);
  window.setTimeout(() => node.classList.remove(cls), kind === "shake" ? SHAKE_MS : PULSE_MS);
}

/* ---------- the door ----------

   One rattle guard for everything. Two taps 20ms apart are one tap as far as a
   person's hand is concerned, and firing twice reads as a glitch rather than as
   responsiveness. The two once-a-day moments are exempt: a celebration that
   happens to land 30ms after a tap must not be swallowed.

   Failures are exempt too, and for a sharper reason — an error that arrives
   during a burst of taps is the one message the user most needs, and dropping
   it would mean a failed save feeling exactly like a successful one. */

const UNMISSABLE = new Set<string>(["complete", "milestone", "error", "warn"]);
const RATTLE_MS = 40;
let lastAt = 0;

export interface FeedbackOptions {
  /** Element to acknowledge visually. Errors shake, everything else pulses. */
  el?: Element | null;
  /** Skip the haptic for this one call (e.g. a sound-only confirmation). */
  silentHaptic?: boolean;
}

/** Report that something happened. Never throws, never blocks, and never waits
    on a network, a plugin, or an audio device. */
export function feedback(event: FeedbackEvent | string, opts: FeedbackOptions = {}) {
  const now = Date.now();
  if (now - lastAt < RATTLE_MS && !UNMISSABLE.has(event)) return;
  lastAt = now;

  if (prefs.haptics !== false && !opts.silentHaptic) {
    ensureNativePlugin();
    if (!fireNative(event, prefs.hapticStrength)) {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate(scaleHaptic(HAPTIC_PATTERNS[event] ?? 10, prefs.hapticStrength) as any);
        } catch { /* a device that refuses to buzz is not an error */ }
      }
    }
  }

  playSound(event);

  if (opts.el) pulse(opts.el, event === "error" ? "shake" : "pulse");
}

/** Report that something happened *at a position* — rung `pos` of `outOf`.

    Same four channels as `feedback`, with the sound carrying where in the
    series this landed. The rattle window is shorter than the general one
    because the input this covers is deliberately repetitive: running a finger
    up a 1-10 scale or typing six digits of a weight is a run of intended
    events, not a double-tap to be tidied away. */
export function place(
  event: PlacedEvent | string,
  pos: number,
  outOf: number,
  opts: FeedbackOptions = {}
) {
  const now = Date.now();
  if (now - lastAt < 24) return;
  lastAt = now;

  if (prefs.haptics !== false && !opts.silentHaptic) {
    ensureNativePlugin();
    if (!fireNative(event, prefs.hapticStrength)) {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate(scaleHaptic(HAPTIC_PATTERNS[event] ?? 10, prefs.hapticStrength) as any);
        } catch { /* see feedback() */ }
      }
    }
  }

  playPitched(event, pos, outOf);

  if (opts.el) pulse(opts.el);
}

/** Success and failure, spelled out, because "did that work?" is the question
    every commit path has to answer and it should never be answered by silence. */
export const succeed = (el?: Element | null) => feedback("save", { el });
export const fail = (el?: Element | null) => feedback("error", { el });

/** Test/diagnostic hook. */
export const __feedbackInternals = {
  isNativePlatform, fireNative, shiftImpact,
  get nativePlugin() { return nativePlugin; },
  set nativePlugin(p: HapticsPlugin | null) { nativePlugin = p; },
  reset() {
    nativePlugin = null; nativeRequested = false;
    nativeChecked = false; nativeAvailable = false; lastAt = 0;
  },
};
