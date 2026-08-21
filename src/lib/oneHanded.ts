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

   The sweep starts a little off vertical (`FROM`) rather than at 0: an item
   directly above the pivot sits under the knuckle of the thumb rather than
   under its tip, and reads as harder to hit than one a few degrees inboard.
   It stops short of horizontal (`TO`) for the same reason at the other end. */

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
/** More than this on one arc and neighbours start to collide at a comfortable
    radius; the overflow moves to the next ring out. */
export const ARC_PER_RING = 5;

export interface ArcOptions {
  hand: Hand;
  /** Radius per ring, innermost first. The component measures these from the
      viewport so the fan fits a small phone and uses a large one. */
  radii: number[];
  perRing?: number;
  from?: number;
  to?: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Fan `count` items across one or more rings. Ring 0 is nearest the pivot and
    fills first, so on a journal with few destinations everything sits in the
    closest arc and nothing is further away than it needs to be. */
export function arcLayout(count: number, opts: ArcOptions): ArcPoint[] {
  const per = Math.max(1, opts.perRing ?? ARC_PER_RING);
  const from = opts.from ?? ARC_FROM;
  const to = opts.to ?? ARC_TO;
  const radii = opts.radii.length ? opts.radii : [180];
  const sign = opts.hand === "right" ? -1 : 1;
  const points: ArcPoint[] = [];
  for (let i = 0; i < count; i++) {
    const ring = Math.min(Math.floor(i / per), radii.length - 1);
    const inRing = i - ring * per;
    /* How many items land on *this* ring, so the last, part-full ring spreads
       its two or three items across the same sweep rather than bunching them
       at the bottom of it. */
    const ringCount = Math.min(per, count - ring * per);
    const span = to - from;
    const angle = ringCount <= 1 ? from + span / 2 : from + (span * inRing) / (ringCount - 1);
    const r = radii[ring];
    points.push({
      x: sign * Math.sin(rad(angle)) * r,
      y: -Math.cos(rad(angle)) * r,
      angle,
      ring,
      index: i,
    });
  }
  return points;
}

/** Which item a thumb at (x, y) — pivot-relative — is choosing, or -1.

    Nearest-centre inside `slop`, which is generous on purpose: this is meant
    to be usable without looking, and a menu that demands a 44px landing is a
    menu that demands a glance. */
export function pickArcTarget(points: ArcPoint[], x: number, y: number, slop = 56): number {
  let best = -1;
  let bestD = slop;
  points.forEach((p, i) => {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/** Radii that fit the fan inside the viewport with room for the labels.

    Two rings, the outer 1.44× the inner, both clamped so the widest item stays
    on screen and the tallest stays clear of the status bar. The upper bound on
    the inner radius is what keeps a tablet from throwing the fan halfway
    across a 1024px page when the thumb is still at the corner. */
export function arcRadii(width: number, height: number, rings = 2): number[] {
  const room = Math.max(120, Math.min(width - 96, height * 0.68 - 96));
  const inner = Math.max(104, Math.min(room * 0.56, 208));
  const out: number[] = [];
  for (let i = 0; i < rings; i++) out.push(Math.round(inner * Math.pow(1.44, i)));
  return out;
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
/** Hold the bar this long and the fan opens under the thumb. */
export const LONG_PRESS_MS = 240;
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
