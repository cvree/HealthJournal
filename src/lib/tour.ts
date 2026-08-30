/* The first morning.

   First run ends with a journal that has one day in it and a home screen the
   person has never seen. Everything on that screen was chosen by them twenty
   seconds ago — the questions, the camera, the row of buttons — and none of it
   is labelled with what it *does*. The pulse card looks like a rating widget
   rather than a queue. The + looks like one button rather than three. The row
   of tiles looks fixed rather than rearrangeable. And Settings, which is where
   every one of those decisions can be taken again, looks like a gear.

   So: one pass over the finished thing, once, on the morning it is finished.

   Three rules hold it, and they are the difference between a tour and an
   advert:

   1. **It points at the real screen.** Nothing here is a mock-up or a
      screenshot. Each stop dims the app and cuts a hole around the actual
      control, in its actual place, at its actual size — because the thing
      being taught is *where your thumb goes*, and a picture of a button
      teaches nobody where a button is.
   2. **Every stop is a fact, not a boast.** What it is, what it does, and the
      one thing about it that is not obvious — the gesture, the second
      meaning, the way back. A stop that says "beautiful insights await" has
      wasted somebody's morning.
   3. **It is over.** Six stops, a way out on every one of them, and it never
      appears again on this device. A tour that can be re-triggered is a tour
      somebody has to dismiss twice.

   A stop whose control is not on the screen is skipped rather than drawn
   somewhere arbitrary: somebody who turned every extra off has no Quick Add
   row, and pointing at where one would have been is worse than saying nothing.
   That check happens at run time against the live DOM, which is why the
   targets here are selectors rather than refs — the tour is a guest on the
   dashboard, and nothing on the dashboard should have to know it exists. */

export interface TourStop {
  id: string;
  /** The control this stop is about, as a CSS selector. Absent for the stops
      that are about the app rather than about a control. */
  target?: string;
  /** How much room to leave around the cut-out, in px. */
  pad?: number;
  eyebrow: string;
  title: string;
  body: string;
  /** The two or three things worth knowing, where a sentence is not enough. */
  points?: [string, string, string][];
  /** Drawn on the card: a gesture this stop is teaching. */
  gesture?: "hold" | "drag" | "tap";
}

/** The stops, in the order a thumb meets them: down the screen, then the bar
    under it, then the gear that reopens every decision. */
export const TOUR: TourStop[] = [
  {
    id: "pulse",
    target: ".fhj-pulse-card",
    pad: 8,
    eyebrow: "The one thing worth doing every day",
    title: "One question at a time, in one place",
    body:
      "Tap a number and the day is on the record — there is no Save button and no confirmation step. "
      + "Then this same slot turns over to the next question, and the next, so the whole daily review "
      + "happens here without a form ever opening.",
    points: [
      ["right", "Answer it and it moves on", "A 1–10 or a yes/no hands over by itself. Anything you type stays put until you say Next."],
      ["left", "Back returns to the number", "Nothing is left behind — you can always walk back to what you answered and change it."],
      ["spark", "Skip is not remembered", "Wave a question past today and it asks again tomorrow. Only you decide what this journal tracks."],
    ],
  },
  {
    id: "quickadd",
    target: ".fhj-tiles",
    pad: 10,
    eyebrow: "The buttons you chose",
    title: "Everything else a day holds",
    body:
      "These are the extras you said yes to, and nothing else. One tap each — a meal, a dose, a flare, "
      + "a photo — and none of them opens a screen you did not ask for.",
    gesture: "drag",
    points: [
      ["grip", "Hold one and drag", "The order is yours. Hold a button until it lifts, then move it where your thumb actually goes."],
      ["sliders", "Edit changes the set", "Add the ones you skipped, drop the ones you never press. It is the same list the + button offers."],
    ],
  },
  {
    id: "checkin",
    target: ".fhj-checkin",
    pad: 8,
    eyebrow: "The whole of today",
    title: "Today's check-in",
    body:
      "The ring is how much of today is on the record, read straight out of your journal rather than out "
      + "of having been here. Tap it for the full round — every question, the camera, the note — on one screen.",
  },
  {
    id: "add",
    target: ".fhj-thumb-add",
    pad: 14,
    eyebrow: "Under your thumb",
    title: "Tap + to add anything",
    body:
      "It sits in the corner your hand already rests in, and it opens the same set of buttons as the row "
      + "above — plus everything else the app can put in a day.",
    gesture: "tap",
  },
  {
    id: "hold",
    target: ".fhj-thumb-add",
    pad: 14,
    eyebrow: "The same button, held",
    title: "Hold + to go anywhere",
    body:
      "Press and keep pressing, and every screen in the app arcs out from that corner. Keep holding and "
      + "slide your thumb onto one to go there — one gesture, without your hand leaving the bottom of the phone.",
    gesture: "hold",
    points: [
      ["repeat", "It follows your hand", "Left-handed? The bar flips, and so does the arc. That is in the fan itself."],
      ["right", "Or press ↑ on a keyboard", "Every gesture in this app has a key, because a gesture is not a place to hide a destination."],
    ],
  },
  {
    id: "history",
    target: "[data-tour=\"history\"]",
    pad: 10,
    eyebrow: "The other half",
    title: "History is where it pays off",
    body:
      "Every day you log lands here — as a timeline, a year at a glance, trends, flares, and a page you can "
      + "print for an appointment. It is thin today and it is the reason to keep going.",
  },
  {
    id: "settings",
    target: "[data-tour=\"settings\"]",
    pad: 10,
    eyebrow: "Nothing you chose is permanent",
    title: "And all of it is adjustable",
    body:
      "Every decision from setup is in here, with more on the table than first run showed you — and a few "
      + "things first run never mentioned.",
  },
];

/** What is actually behind the gear, said in a list rather than discovered in
    six weeks. It is the last stop of the tour and the only one that is not a
    control on the screen, because the alternative — walking somebody through
    fourteen cards of a settings screen one spotlight at a time — is a tour
    that outstays its welcome by a factor of three.

    Ordered by how likely somebody is to want it in the first week. */
export const SETTINGS_MAP: [string, string, string][] = [
  ["sliders", "Your survey",
    "Every question, added, dropped or written from scratch — with the whole catalogue on the table, not just the groups first run walked you through."],
  ["calendar", "How often it asks",
    "Daily, every other day, three times a week, weekdays, or your own pattern. Pause it for a holiday and nothing counts as missed."],
  ["bell", "Reminders",
    "A nudge at a time you choose, on this device. It can also be written into your phone's calendar so it still arrives with the app closed."],
  ["sun", "Appearance",
    "Light, dark or whatever the phone is doing, a backdrop, and the type size. This app is read first thing in the morning; it should look like something you want to open."],
  ["target", "Goals",
    "A number worth aiming at, if one helps. Off by default, because a journal that scolds you is one you stop opening."],
  ["spark", "Taps & sounds",
    "How much the app answers back — vibration, its strength, and a small set of sounds. All of it can be switched off entirely."],
  ["key", "App lock",
    "A PIN before the journal opens, for a shared device. Off by default."],
  ["refresh", "Sync across your devices",
    "Optional, and encrypted on this device before anything leaves it — the server only ever holds unreadable blocks."],
  ["spark", "The optional AI",
    "Off until you switch it on and give it a key. It never sees anything you have not handed it yourself."],
  ["download", "Export & backup",
    "CSV, Excel and JSON, plus an appointment pack you can print. Your journal is yours to take out."],
  ["log", "Import",
    "Wearable exports — steps, heart rate, sleep, weight — and your own written notes, read on this device only."],
  ["device", "What leaves this device",
    "One page listing everything that can, and what is switched on right now. Nothing is on by default."],
];

/* ---------- has this device been shown around? ----------

   Per device rather than per journal, for the same reason the fan hint is: it
   describes this phone's chrome and this phone's gestures, not the journal.
   Somebody who restores a backup onto a new phone has still never held that
   phone's + button. */
export const TOUR_SEEN_KEY = "fhj_tour_seen_v1";

export function tourSeen(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    /* No storage means it would show on every cold start, so treat the absence
       of storage as "already seen" — an unskippable tour every morning is far
       worse than never being shown around at all. */
    return true;
  }
}

export function markTourSeen(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch { /* ignore */ }
}

export interface Rect { top: number; left: number; width: number; height: number; }

/**
 * Where the card goes, given the hole and the viewport.
 *
 * Below the target when there is room, above it when there is not, and pinned
 * to the middle when the target is missing or the viewport is too short for
 * either — which is the case that matters, because it is a small phone in
 * landscape and the alternative is a card half off the screen.
 *
 * Returned as a placement rather than a style so the caller keeps the units.
 */
export function cardSide(rect: Rect | null, viewportH: number, cardH = 260): "below" | "above" | "center" {
  if (!rect) return "center";
  const below = viewportH - (rect.top + rect.height);
  const above = rect.top;
  if (below >= cardH) return "below";
  if (above >= cardH) return "above";
  return below >= above ? "below" : "above";
}
