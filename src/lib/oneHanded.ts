/* One hand, every corner.

   The app was built phone-first and it shows everywhere except in one place:
   the *reach*. A 6.7" phone held in one hand gives a thumb an arc that starts
   at the bottom corner nearest the palm and sweeps maybe two thirds of the way
   up the far edge. Everything outside that arc — the back button in the top
   left, the gear in the top right, the top half of a long screen — is a
   two-handed instruction wearing a one-handed interface.

   That is a real cost here rather than a stylistic one. This is a journal
   somebody opens while holding a coffee, a child, a shopping bag, or a
   steering wheel at a red light, and often on the days they feel worst. A
   surface that quietly requires the second hand is a surface that gets skipped.

   This module is the arithmetic behind the fix. Four ideas, all pure and all
   testable without a browser:

   1. **A real navigation stack** (`navGo`/`navBack`). "Back" only means
      something if the app remembers where you came from. Today is always the
      floor of the stack, so there is no way to reach a state with nothing
      underneath you.
   2. **A handed geometry** (`arcLayout`/`pickArcTarget`). Every destination in
      the app, fanned along the arc a thumb actually sweeps, anchored to the
      bottom corner on the side you hold the phone. Direction, not position:
      the thing a radial menu is genuinely better at than a grid, and the
      reason it survives being used without looking.
   3. **Gesture thresholds** (`backProgress`, `shouldCompleteBack`,
      `reachDrop`), kept here so the same numbers describe the gesture in the
      component and in the tests.
   4. **Which hand** (`readHand`/`setHand`), stored per device rather than in
      the journal — which hand you hold *this* phone in is a fact about the
      phone, not about the person's health record, and it has to work in the
      read-only viewer where there is no journal to write to.

   Nothing in here imports React or touches the DOM apart from the storage
   helpers at the end, which are wrapped so a locked-down browser degrades to
   "right-handed" instead of throwing. */

/* ---------- which hand ---------- */

export type Hand = "right" | "left";

export const HANDS: Hand[] = ["right", "left"];

export const isHand = (v: unknown): v is Hand =>
  v === "right" || v === "left";

export const HAND_STORAGE_KEY = "fhj_hand_v1";

/** The hand this device is held in. Right, unless the person said otherwise —
    a default, never a guess dressed up as a detection. */
export function readHand(): Hand {
  try {
    if (typeof localStorage === "undefined") return "right";
    const v = localStorage.getItem(HAND_STORAGE_KEY);
    return isHand(v) ? v : "right";
  } catch {
    return "right";
  }
}

type HandListener = (hand: Hand) => void;
const handListeners = new Set<HandListener>();

/** Persist the hand, mirror it onto <html data-hand> for the stylesheet, and
    tell anything listening. Storage failing is not a reason to refuse the
    change for this session. */
export function setHand(hand: Hand): Hand {
  const next: Hand = isHand(hand) ? hand : "right";
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(HAND_STORAGE_KEY, next);
  } catch {
    /* private mode, storage disabled — the preference still applies until reload */
  }
  applyHand(next);
  handListeners.forEach((fn) => fn(next));
  return next;
}

export function applyHand(hand: Hand): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-hand", hand);
}

export function onHandChange(fn: HandListener): () => void {
  handListeners.add(fn);
  return () => { handListeners.delete(fn); };
}

export const otherHand = (hand: Hand): Hand => (hand === "right" ? "left" : "right");

/* ---------- has anybody been told about the fan? ----------

   A gesture nobody discovers is a feature nobody has. One line above the bar,
   once, until it has been used — not a tour, not a modal, and never again
   afterwards. Per device for the same reason the hand is: it describes this
   phone's chrome, not the journal. */
export const FAN_SEEN_KEY = "fhj_fan_seen_v1";

export function fanSeen(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(FAN_SEEN_KEY) === "1";
  } catch {
    /* No storage means the hint shows every cold start, which is a far smaller
       problem than it never showing at all. */
    return false;
  }
}

export function markFanSeen(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(FAN_SEEN_KEY, "1");
  } catch { /* ignore */ }
}

/* ---------- the navigation stack ----------

   `screen` used to be one string, and every "back" in the app was therefore a
   guess: the header's arrow went to Today no matter where you had come from,
   so Export → Appointment Pack → back landed two screens away from where the
   person was. A stack costs one array and removes the whole class of bug.

   Today is the floor. Roots (the two destinations in the bar) reset the stack
   rather than piling up, so tapping Today, History, Today, History ten times
   leaves a stack two deep rather than twenty. */

export type ScreenId = string;

/** The floor of the stack. Every path back through the app ends here. */
export const ROOT: ScreenId = "dashboard";

/** Screens the bar itself can reach. Anything else is somewhere you navigated
    *into*, and therefore something Back should return you out of. */
export const ROOTS: ScreenId[] = [ROOT, "history"];

export const isRoot = (id: ScreenId): boolean => ROOTS.includes(id);

/* A stack this deep is a loop, not a journey. Trimming from the bottom (never
   the top) keeps the most recent history intact and keeps the floor. */
const MAX_DEPTH = 12;

export function navTop(stack: ScreenId[]): ScreenId {
  return stack.length ? stack[stack.length - 1] : ROOT;
}

export function canGoBack(stack: ScreenId[]): boolean {
  return stack.length > 1;
}

/** The screen a Back would land on, or null at the floor. Named because the
    bar prints it: "Back to History" beats a bare arrow every time. */
export function navParent(stack: ScreenId[]): ScreenId | null {
  return stack.length > 1 ? stack[stack.length - 2] : null;
}

/** Go to `id`.

    - The root resets to a one-deep stack.
    - The other root sits directly on top of it, so Back from History is Today
      rather than a dead end.
    - A screen already on the stack is *returned to*, not pushed again: History
      → Sun → History leaves History once, at the bottom of its own branch,
      which is what stops a back-back-back walk from retracing a circle. */
export function navGo(stack: ScreenId[], id: ScreenId): ScreenId[] {
  if (!id) return stack;
  const cur = stack.length ? stack : [ROOT];
  if (navTop(cur) === id) return cur;
  if (id === ROOT) return [ROOT];
  if (isRoot(id)) return [ROOT, id];
  const at = cur.indexOf(id);
  if (at >= 0) return cur.slice(0, at + 1);
  const next = [...cur, id];
  return next.length > MAX_DEPTH ? [next[0], ...next.slice(next.length - (MAX_DEPTH - 1))] : next;
}

export function navBack(stack: ScreenId[]): ScreenId[] {
  return stack.length > 1 ? stack.slice(0, -1) : [ROOT];
}

export function navHome(): ScreenId[] {
  return [ROOT];
}

/* ---------- names ----------

   Short enough to sit on a 44px chip beside an arrow. App.tsx keeps its own
   longer titles for the header ("Edit Survey / Tracking Setup"), which is the
   right length for a heading and the wrong length for a button. */
export const SCREEN_LABELS: Record<string, string> = {
  dashboard: "Today",
  history: "History",
  insights: "Insights",
  log: "Daily log",
  food: "Diary",
  routine: "Routine",
  rituals: "Rituals",
  sun: "Sun",
  labs: "Labs",
  experiments: "Experiments",
  gallery: "Photos",
  export: "Export",
  pack: "Appointment pack",
  settings: "Settings",
  setup: "Survey setup",
  calendar: "Calendar",
  report: "Report",
  episode: "Flare",
  fitbit: "Import",
};

export const screenLabel = (id: ScreenId): string => SCREEN_LABELS[id] || "Back";

/* ---------- every destination, one fan ----------

   The order is the reach order: index 0 sits nearest the thumb's resting
   position and the list climbs away from it. Today and History repeat what the
   bar already offers, deliberately — the fan is opened *from* the bar, the
   thumb is already there, and a menu that omits where you are is a menu you
   have to think about before opening. */

export interface Destination {
  id: ScreenId;
  label: string;
  icon: string;
  /** One line, printed under the fan while the thumb rests on the item. */
  hint: string;
  /** False for anything that writes: the read-only viewer must not offer it. */
  viewer: boolean;
}

export const DESTINATIONS: Destination[] = [
  { id: "dashboard", label: "Today", icon: "home", hint: "The day you're in", viewer: true },
  { id: "log", label: "Daily log", icon: "log", hint: "Answer today's survey", viewer: false },
  { id: "history", label: "History", icon: "calendar", hint: "Every day you've logged", viewer: true },
  { id: "insights", label: "Insights", icon: "trends", hint: "Charts and possible patterns", viewer: true },
  { id: "food", label: "Diary", icon: "food", hint: "Meals and bowel movements", viewer: true },
  { id: "sun", label: "Sun", icon: "sun", hint: "Time outside and daylight", viewer: true },
  { id: "labs", label: "Labs", icon: "tube", hint: "Measurements and results", viewer: true },
  { id: "experiments", label: "Experiments", icon: "target", hint: "Try one thing, watch what moves", viewer: true },
  { id: "routine", label: "Routine", icon: "clock", hint: "What you do most days", viewer: false },
  { id: "rituals", label: "Rituals", icon: "drop", hint: "Your routines, step by step", viewer: false },
  { id: "gallery", label: "Photos", icon: "camera", hint: "Progress shots side by side", viewer: true },
  { id: "export", label: "Export", icon: "download", hint: "Spreadsheets, backups, packs", viewer: true },
  { id: "settings", label: "Settings", icon: "gear", hint: "Preferences and privacy", viewer: false },
];

/** The fan for this session. `viewer` drops everything that writes; `exclude`
    is for a screen that has no business offering itself as a destination. */
export function destinationsFor(opts: { viewer?: boolean; exclude?: ScreenId[] } = {}): Destination[] {
  const exclude = new Set(opts.exclude || []);
  return DESTINATIONS.filter((d) => (opts.viewer ? d.viewer : true) && !exclude.has(d.id));
}

/* ---------- the arc ----------

   Coordinates are relative to the pivot — the bottom corner on the held side —
   with the screen's own axes: +x right, +y down. Items are therefore always
   above the pivot (negative y) and always *inward* from it, which is negative
   x for a right hand and positive x for a left one. Mirroring lives here and
   nowhere else, so no component ever has to remember which way round it is.

   The sweep starts a little off vertical (`ARC_FROM`) rather than at 0: an
   item directly above the pivot sits under the knuckle of the thumb rather
   than under its tip, and reads as harder to hit than one a few degrees
   inboard. It stops short of horizontal (`ARC_TO`) for the same reason at the
   other end.

   How many items go on each ring is *computed*, never chosen. A fixed "five
   per ring" is a number that is right for one phone: on a 320px screen five
   items at a comfortable radius overlap each other, and on a tall one the
   second ring is a stretch nobody needed to make. So each ring is asked how
   many items its own arc length can hold, the smallest number of rings that
   can hold everything wins, and the items are shared out in proportion to what
   each ring can take — which is what keeps the spacing even across all of
   them rather than packing the inner ring and stranding two on the outside. */

export interface ArcPoint {
  /** Pivot-relative, in px. */
  x: number;
  y: number;
  /** Degrees from straight-up, increasing inward. Handy for hit-testing. */
  angle: number;
  ring: number;
  index: number;
}

export const ARC_FROM = 10;
export const ARC_TO = 84;
/** Disc plus the air around it: the arc length one item needs to itself.
    Wide enough that the *labels* clear each other, not just the discs — two
    circles with a comfortable gap and their captions overlapping is the same
    mess, in smaller type. */
export const ARC_ITEM_PX = 68;

/** The same measurement on a phone too narrow for it. Below ~360px the fan is
    drawn one notch smaller (see the media query in index.css), and the
    geometry has to agree with the stylesheet or the spacing it is protecting
    is not the spacing on screen. */
export function itemSizeFor(width: number): number {
  return width < 360 ? 56 : ARC_ITEM_PX;
}
/** A fourth ring is not a thumb movement, it is a reach. */
export const ARC_MAX_RINGS = 3;

const rad = (deg: number) => (deg * Math.PI) / 180;
const span = (from: number, to: number) => to - from;

/** How many items fit on one ring without crowding. Two is the floor: a ring
    that can only hold one item is a ring that should not exist, and the plan
    below will have moved on to a larger radius before it matters. */
export function ringCapacity(radius: number, itemPx = ARC_ITEM_PX, from = ARC_FROM, to = ARC_TO): number {
  const length = radius * rad(span(from, to));
  return Math.max(2, Math.floor(length / itemPx) + 1);
}

/** The radii for `rings` rings, spread between a comfortable inner arc and the
    furthest the fan may reach on this screen.

    The outer bound is the constraint that matters: it is what keeps the widest
    item on screen on a small phone and stops a tablet from throwing the fan
    halfway across the page when the thumb is still at the corner. */
export function fanRadii(width: number, height: number, rings = 2): number[] {
  /* 104px is the width of one item, label included — the fan is measured to
     the item's *edge*, not to its centre, or the outermost label runs off the
     side of a small phone. */
  const max = Math.max(140, Math.min(width - 104, height * 0.62, 340));
  const inner = Math.max(96, Math.round(max * 0.42));
  const n = Math.max(1, rings);
  if (n === 1) return [inner];
  const step = (max - inner) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round(inner + step * i));
}

/** How many items go on each ring. Rings fill in proportion to what they can
    hold, so the spacing looks the same on the inside arc as on the outside
    one; largest remainder settles the rounding, and anything still left over
    (a screen too small for the fan it was asked for) goes to the outermost
    ring rather than being dropped. */
export function ringPlan(count: number, radii: number[], itemPx = ARC_ITEM_PX, from = ARC_FROM, to = ARC_TO): number[] {
  if (count <= 0) return radii.map(() => 0);
  const caps = radii.map((r) => ringCapacity(r, itemPx, from, to));
  const total = caps.reduce((a, b) => a + b, 0);
  const share = caps.map((c) => (count * c) / total);
  const plan = share.map((v) => Math.min(Math.floor(v), count));
  let left = count - plan.reduce((a, b) => a + b, 0);
  const order = share
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (left <= 0) break;
    if (plan[i] < caps[i]) { plan[i]++; left--; }
  }
  if (left > 0) plan[plan.length - 1] += left;
  return plan;
}

/** The fewest rings that can hold `count` items on this screen. */
export function ringsNeeded(count: number, width: number, height: number, itemPx = ARC_ITEM_PX): number {
  for (let n = 1; n < ARC_MAX_RINGS; n++) {
    const caps = fanRadii(width, height, n).map((r) => ringCapacity(r, itemPx));
    if (caps.reduce((a, b) => a + b, 0) >= count) return n;
  }
  return ARC_MAX_RINGS;
}

export interface ArcOptions {
  hand: Hand;
  /** Radius per ring, innermost first. */
  radii: number[];
  from?: number;
  to?: number;
}

/** Lay out `counts[r]` items on ring `r`. The primitive: everything about
    *how many* go where has already been decided by the time this runs. */
export function arcLayout(counts: number[], opts: ArcOptions): ArcPoint[] {
  const from = opts.from ?? ARC_FROM;
  const to = opts.to ?? ARC_TO;
  const sign = opts.hand === "right" ? -1 : 1;
  const points: ArcPoint[] = [];
  let index = 0;
  counts.forEach((n, ring) => {
    const r = opts.radii[Math.min(ring, opts.radii.length - 1)];
    for (let i = 0; i < n; i++) {
      /* One item on a ring sits in the middle of the sweep rather than at the
         start of it — an arc of one is a point, and the point belongs where
         the thumb rests. */
      const angle = n <= 1 ? from + span(from, to) / 2 : from + (span(from, to) * i) / (n - 1);
      points.push({
        x: sign * Math.sin(rad(angle)) * r,
        y: -Math.cos(rad(angle)) * r,
        angle,
        ring,
        index: index++,
      });
    }
  });
  return points;
}

/** The whole fan, from a count and a viewport. This is what the component
    calls; everything above it is the reasoning, exposed so it can be tested
    without a browser. */
export function fanLayout(
  count: number,
  opts: { hand: Hand; width: number; height: number; itemPx?: number }
): ArcPoint[] {
  const itemPx = opts.itemPx ?? itemSizeFor(opts.width);
  const radii = fanRadii(opts.width, opts.height, ringsNeeded(count, opts.width, opts.height, itemPx));
  return arcLayout(ringPlan(count, radii, itemPx), { hand: opts.hand, radii });
}

/** Which item a thumb at (x, y) — pivot-relative — is choosing, or -1.

    Nearest centre inside `slop`, which is generous on purpose: this is meant
    to be usable without looking, and a menu that demands a 44px landing is a
    menu that demands a glance. Nearest, rather than first-inside, so the
    answer is never ambiguous where two catch areas overlap. */
export function pickArcTarget(points: ArcPoint[], x: number, y: number, slop = 46): number {
  let best = -1;
  let bestD = slop;
  points.forEach((p, i) => {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/* ---------- gestures ----------

   All four numbers below were chosen against the same constraint: a thumb
   moving at arm's-length precision, on a screen the person may not be looking
   at. Nothing here fires on a movement small enough to be a tremor, and
   nothing demands a movement long enough to need a regrip. */

/** How far in from the edge counts as an edge gesture. Wider than Apple's ~20
    because the held side of the phone is where a palm already rests. */
export const EDGE_ZONE = 32;
/** Past this fraction of the screen's width, letting go completes the back. */
export const BACK_COMPLETE = 0.3;
/** …or this fast, at any distance. A flick is an answer too. */
export const BACK_FLING = 0.5; // px/ms
/** Hold the bar this long and the fan opens under the thumb.

    Short on purpose. The whole promise of this gesture is that going anywhere
    costs one thumb and no journey, and every millisecond before the fan
    appears is spent staring at a button wondering whether the press took. It
    has to stay clear of a tap — a deliberate tap-and-release is under ~120ms
    on a phone — and nothing else. 180 is the far side of that with room to
    spare, and it is the difference between a menu that opens and a menu you
    wait for. */
export const LONG_PRESS_MS = 180;
/** …or push up off the bar this far, which is the same intent, stated faster. */
export const ARC_OPEN_DY = 24;
/** Pull down on the bar this far and the screen comes to the thumb. */
export const REACH_TRIGGER = 40;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Is a pointer starting a back gesture? `hand` decides which edge: the thumb
    holding the phone reaches its own side without a regrip, and the far edge
    only with one. Both edges stay live — a phone handed over, or a second
    thumb, should not find the gesture missing — but the held side is the one
    the layout is tuned for. */
export function edgeStart(x: number, width: number, hand: Hand): boolean {
  const near = hand === "right" ? x >= width - EDGE_ZONE : x <= EDGE_ZONE;
  const far = hand === "right" ? x <= EDGE_ZONE : x >= width - EDGE_ZONE;
  return near || far;
}

/** Which way the screen should travel for a gesture that started at `x`.
    Dragging in from the right edge peels the screen off to the left, and the
    mirror image on the other side. */
export function edgeDirection(x: number, width: number): -1 | 1 {
  return x > width / 2 ? -1 : 1;
}

/** 0 → nothing has happened, 1 → the screen is fully peeled. Deliberately
    reaches 1 well before the finger reaches the far edge: a gesture that needs
    the whole width is a gesture that needs the other hand. */
export function backProgress(travel: number, width: number): number {
  return clamp01(travel / Math.max(1, width * 0.62));
}

export function shouldCompleteBack(travel: number, width: number, ms: number): boolean {
  if (travel <= 0) return false;
  if (travel >= width * BACK_COMPLETE) return true;
  return travel / Math.max(1, ms) >= BACK_FLING && travel > 24;
}

/** How far the screen slides down when someone pulls it into reach. A third of
    the viewport puts a phone's header squarely in the thumb arc; the cap stops
    a tablet from sliding a metre of nothing into view. */
export function reachDrop(height: number): number {
  return Math.round(Math.max(120, Math.min(height * 0.34, 320)));
}

/* ---------- the phone's own Back ----------

   Android's hardware back, the browser's back button, a two-finger swipe on a
   trackpad, and — because Capacitor routes the hardware button through
   `history.back()` when the WebView has history — the native shell too. All of
   them arrive here as one event, and all of them should mean what the bar's
   Back means.

   The mechanism is a single buffer entry pushed ahead of the app. A back
   consumes it, the handler answers whether it used it, and if it did a fresh
   one is pushed for next time. When the handler declines — the stack is at
   Today, there is nowhere left to go — nothing is re-armed and the next back
   leaves the app, which is exactly what somebody pressing back on the home
   screen of an app is asking for. */
export function onSystemBack(handler: () => boolean): () => void {
  if (typeof window === "undefined" || !window.history || !window.history.pushState) return () => {};
  const arm = () => {
    try { window.history.pushState({ fhjBack: 1 }, ""); } catch { /* history blocked — the in-app Back still works */ }
  };
  const onPop = () => { if (handler()) arm(); };
  arm();
  window.addEventListener("popstate", onPop);
  return () => window.removeEventListener("popstate", onPop);
}
