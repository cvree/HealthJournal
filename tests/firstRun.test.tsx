/* The first two minutes.

   Nine screens: a promise, a doorway that asks who this is for, six numbered
   acts, and a birth — plus one card at the end that is not part of the path.
   What these tests protect is the shape of that flow — that it is one path
   with no "set everything up in detail" door beside it, that every screen
   after the first arrives already answered so Continue is never blocked on
   work, that the two personal questions are genuinely refusable and genuinely
   used when they are answered, that the question somebody came with changes
   what is *suggested* and never what is switched on, that somebody can see and
   shape the survey they are signing up for (including which questions are
   yes/no ones), that "photos" is a question about *what* rather than a switch,
   that all of it reaches the journal they end up with, that the last act still
   turns their own first entry into the first card on a timeline — and that it
   ends by putting dates on the promise it just made.

   Motion is not asserted here (jsdom has no layout, and every helper is a
   no-op under reduced motion, which these tests run with). What is asserted is
   that the flow still completes with the motion switched off — which is the
   guarantee that actually matters to somebody who has it switched off. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

beforeAll(() => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = ((q: string) => ({
    matches: q.includes("reduce"), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  } as any)) as any;
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

let kv: Map<string, string>;

async function mountFresh() {
  kv = new Map();
  (window as any).storage = {
    async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
    async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
    async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
    async list() { return { keys: [...kv.keys()] }; },
  };
  const { default: App } = await import("../src/App");
  render(React.createElement(App));
  await screen.findByRole("button", { name: /Start my journal/i }, { timeout: 10000 });
}

const saved = () => JSON.parse(kv.get("fhj_v1")!);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const tap = (re: RegExp) =>
  fireEvent.click(screen.getAllByRole("button").find((b) => re.test(b.textContent || ""))!);
/** Buttons whose trimmed label matches exactly — "Continue" must not also find
    "Continue to photos". */
const exact = (label: string) =>
  screen.getAllByRole("button").find((b) => (b.textContent || "").trim() === label);

/** Who is going through the flow. Undefined means they refused both, which is
    the path most of these tests take — everything downstream has to work for
    somebody who told the app nothing about themselves. */
type Who = { name?: string; age?: number };

/** Hero → the doorway. */
async function toYou() {
  tap(/Start my journal/i);
  await screen.findByText(/Who is this journal for\?/i);
}

/** …and past it, answering or refusing. */
async function toFocus(who?: Who) {
  await toYou();
  if (who?.name) {
    fireEvent.change(screen.getByLabelText(/What should it call you/i), { target: { value: who.name } });
  }
  if (who?.age != null) {
    fireEvent.change(screen.getByLabelText(/Your age/i), { target: { value: String(who.age) } });
  }
  if (who) tap(/^Continue/);
  else tap(/Skip this/);
  await screen.findByText(/what are you tracking\?/i);
}

/** Where the pass says it is. Every one of the three walked acts prints it. */
/* Where the flow is, read the way the flow now says it.
 *
 * This used to read a printed "Step 2 of 5 · group 1 of 4" eyebrow. That
 * eyebrow was two facts the two bars above it were already drawing, so it is
 * gone from the screen — but it is not gone from the app: the rail and the
 * walkbar carry it as their accessible names, which is the one audience that
 * cannot see a bar. So the probe reads what a screen reader would be told. */
const stepText = () => [
  document.querySelector(".fhj-fr-rail-block")?.getAttribute("aria-label"),
  document.querySelector(".fhj-fr-walkbar")?.getAttribute("aria-label"),
].filter(Boolean).join(" · ");
/** The card's own heading — the group, the subject, or the thing being kept. */
const cardTitle = () => document.querySelector(".fhj-fr-display")?.textContent || "";

/** …pick a pack → the screen that asks what they came to find out. */
async function toAim(who?: Who) {
  await toFocus(who);
  tap(/Eczema/);
  fireEvent.click(exact("Continue")!);
  await screen.findByText(/what do you want to find out\?/i);
}

/** …and past it, either naming an aim or refusing to.

    `aim` is a label to tap; undefined means walking past it without answering,
    which is the path most of these tests take — everything downstream has to
    work for somebody who told the app nothing about why they are here. */
async function toTune(who?: Who, aim?: RegExp) {
  await toAim(who);
  if (aim) tap(aim);
  fireEvent.click(exact(aim ? "Continue" : "Skip this one")!);
  await waitFor(() => expect(stepText()).toMatch(/Step 3 of 6.*group 1 of/i));
}

/** Through every group of questions, and the card that takes one of your own,
    to the first photograph. `each` runs on every group card before it is left,
    which is how a test switches a question on inside the pass. */
async function throughQuestions(each?: (i: number) => void) {
  for (let i = 0; i < 20; i++) {
    if (/of your own/i.test(stepText())) break;
    each?.(i);
    const on = exact("Next group") || exact("Last one");
    if (!on) break;
    fireEvent.click(on);
  }
  await waitFor(() => expect(stepText()).toMatch(/of your own/i));
  fireEvent.click(exact("Continue")!);
  await waitFor(() => expect(stepText()).toMatch(/Step 4 of 6/i));
}

async function toPhotos(who?: Who, aim?: RegExp) {
  await toTune(who, aim);
  await throughQuestions();
}

/** Through the photographs pass, saying yes to whatever this test wanted
    photographed (nothing, by default) and no to everything else.

    A yes or a no moves the deck on by itself — except on the last card, where
    there is nowhere further to move and the way out is the button in the foot.
    Hence the step-did-not-change check rather than a fixed count: a yes to the
    body map or to progress shots *adds* a card, so the length of this deck is
    not knowable in advance. */
async function throughPhotos(wanted: RegExp[] = []) {
  for (let n = 0; n < 40; n++) {
    if (!/Step 4 of 6/.test(stepText())) break;
    const before = stepText();
    const yes = exact("Yes — I'll photograph this");
    if (yes) {
      const title = cardTitle();
      fireEvent.click(wanted.some((re) => re.test(title)) ? yes : exact("Not this one")!);
      if (stepText() !== before) continue;
    }
    const out = exact("These are my shots") || exact("Continue without photos") || exact("Continue");
    if (!out) break;
    fireEvent.click(out);
  }
  await waitFor(() => expect(stepText()).toMatch(/Step 5 of 6/i));
}

/** …and on to what else the journal should keep. */
async function toExtras(who?: Who, photos: RegExp[] = [], aim?: RegExp) {
  await toPhotos(who, aim);
  await throughPhotos(photos);
}

/** Through the extras, the cadence and the nudge, to the first entry. */
async function throughExtras(wanted: RegExp[] = []) {
  for (let n = 0; n < 40; n++) {
    if (!/Step 5 of 6/.test(stepText())) break;
    const before = stepText();
    const yes = exact("Yes — keep this");
    if (yes) {
      const title = cardTitle();
      fireEvent.click(wanted.some((re) => re.test(title)) ? yes : exact("Not this one")!);
      if (stepText() !== before) continue;
    }
    const out = exact("Continue");
    if (!out) break;
    fireEvent.click(out);
  }
  await screen.findByText(/How is your skin today\?/i);
}

/** …and on to the entry itself. */
async function toEntry(who?: Who, photos: RegExp[] = [], extras: RegExp[] = [], aim?: RegExp) {
  await toExtras(who, photos, aim);
  await throughExtras(extras);
}

/** The running total of questions, which every group card carries. */
const countOnScreen = () =>
  Number((document.querySelector(".fhj-fr-walk-tally-num")?.textContent || "0").trim());

beforeEach(() => { cleanup(); localStorage.clear(); });

describe("the hero", () => {
  it("leads with the promise and one way in", async () => {
    await mountFresh();
    expect(screen.getByText("Your health,")).toBeTruthy();
    expect(screen.getByText("remembered.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start my journal/i })).toBeTruthy();
  });

  it("says what the app is and is not, before anything is tapped", async () => {
    await mountFresh();
    const fine = screen.getByRole("button", { name: /nothing leaves unless you say so/i });
    expect(fine.textContent).toMatch(/no account/i);
    expect(fine.textContent).toMatch(/not medical advice/i);
    // ...and the whole disclaimer is one tap away, not buried in a settings screen.
    fireEvent.click(fine);
    expect(await screen.findByText(/does not diagnose, treat, cure/i)).toBeTruthy();
  });

  it("lists the checkable facts about the build, not a privacy paragraph", async () => {
    await mountFresh();
    fireEvent.click(screen.getByRole("button", { name: /nothing leaves unless you say so/i }));
    const text = await waitFor(() => {
      const t = document.body.textContent || "";
      expect(t).toMatch(/no sign-up/i);
      return t;
    });
    expect(text).toMatch(/no server holding it/i);
    expect(text).toMatch(/no analytics|no trackers/i);
    expect(text).toMatch(/export the whole thing/i);
    expect(text).toMatch(/delete everything/i);
  });

  /* The promise that replaced an absolute. Four switches in this build can
     reach the network, so the first screen names them rather than claiming
     nothing ever leaves — a privacy claim is worth exactly as much as its
     worst case, and this list has to print the worst case. */
  it("names what can leave rather than promising that nothing ever does", async () => {
    await mountFresh();
    fireEvent.click(screen.getByRole("button", { name: /nothing leaves unless you say so/i }));
    const text = await waitFor(() => {
      const t = document.body.textContent || "";
      expect(t).toMatch(/nothing leaves this device unless you switch it on/i);
      return t;
    });
    for (const switchable of [/sync/i, /\bAI\b/, /weather/i, /notes/i]) {
      expect(text).toMatch(switchable);
    }
    // ...and it promises the confirmation, which is the part that makes it safe.
    expect(text).toMatch(/names what it sends/i);
    // No absolute survives on this screen.
    expect(text).not.toMatch(/never leaves this device/i);
  });

  it("keeps the way in for somebody who just wants a look", async () => {
    await mountFresh();
    tap(/example data/i);
    await waitFor(() => expect(document.body.textContent).toMatch(/streak/i), { timeout: 10000 });
  });

  it("shows a journal already alive rather than explaining one", async () => {
    await mountFresh();
    // A rating, a photograph, a note, a dose, a flare, a trend: everything the
    // app records, shown rather than described.
    const collage = document.querySelector(".fhj-fr-collage")!;
    expect(collage).toBeTruthy();
    expect(collage.textContent).toMatch(/overall severity/i);
    expect(collage.textContent).toMatch(/Slept badly/i);
    expect(collage.textContent).toMatch(/CeraVe/i);
    expect(collage.textContent).toMatch(/Flare ended/i);
    expect(collage.querySelector(".fhj-fr-photo")).toBeTruthy();
  });
});

/* The flow used to say where it was four times on every numbered screen: the
   rail across the top, a printed "Step 2 of 5 · group 1 of 4" under it, a
   second bar drawing the inner half again, and — on the first act — a
   four-paragraph list headed "What happens next" whose four items were the
   rail's four remaining segments spelled out. Four indicators and a wall for
   two facts.

   What is left is the two bars, plus one sentence saying the thing no bar can
   draw: what this act is going to ask for. */
describe("the rail says it once", () => {
  it("draws the position instead of printing it beside itself", async () => {
    await mountFresh();
    await toTune();
    expect(document.querySelector(".fhj-fr-rail-steps")).toBeTruthy();
    expect(document.querySelector(".fhj-fr-walkbar")).toBeTruthy();
    // Not written out anywhere a sighted person reads it.
    const seen = [...document.querySelectorAll<HTMLElement>(".fhj-fr-act *")]
      .filter((el) => !el.closest("[aria-hidden='true']"))
      .map((el) => el.textContent || "").join(" ");
    expect(seen).not.toMatch(/Step \d of 6/);
  });

  it("still tells a screen reader exactly where it is", async () => {
    /* The bars are aria-hidden, so dropping the printed line without this
       would have taken the position away from the one audience that cannot
       see a bar at all. */
    await mountFresh();
    await toTune();
    expect(document.querySelector(".fhj-fr-rail-block")!.getAttribute("aria-label"))
      .toMatch(/^Step 3 of 6 — Questions$/);
    expect(document.querySelector(".fhj-fr-walkbar")!.getAttribute("aria-label"))
      .toMatch(/^Group 1 of \d+$/);
  });

  it("demonstrates a mechanism once, with the real thing rather than a picture of it", async () => {
    /* The extras card used to draw a mock-up of one tile with an arrow and a
       caption reading "One tap on your home screen, every day you need it" —
       directly above the row where the person's own buttons assemble as they
       answer. Two demonstrations of one mechanism, and the drawing was the
       weaker: it showed a button, and the row below shows theirs. */
    await mountFresh();
    await toExtras();
    expect(document.querySelector(".fhj-fr-preview")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/One tap on your home screen/i);
    expect(document.querySelectorAll(".fhj-fr-preview-tile.is-hero")).toHaveLength(0);
  });

  it("carries the orientation a line at a time, on the screen it is about", async () => {
    await mountFresh();
    await toFocus();
    const note = () => document.querySelector(".fhj-fr-rail-note")?.textContent || "";
    expect(note()).toMatch(/changes later in Settings/i);
    /* And the wall it replaced is gone — including the promise that was made
       twice on the same screen. */
    expect(document.body.textContent).not.toMatch(/What happens next/i);
    tap(/Eczema/);
    fireEvent.click(exact("Continue")!);
    /* …the screen that asks what they came for carries its own line… */
    await waitFor(() => expect(note()).toMatch(/what gets suggested/i));
    fireEvent.click(exact("Skip this one")!);
    await waitFor(() => expect(note()).toMatch(/Nothing is on yet/i));
  });
});

describe("one path, and no door beside it", () => {
  it("never offers a longer setup somewhere else", async () => {
    await mountFresh();
    await toFocus();
    // The escape hatch is gone on purpose: a link to a "detailed" setup is an
    // admission that the main path does not do the job.
    expect(document.body.textContent).not.toMatch(/in detail instead/i);
    tap(/Eczema/);
    fireEvent.click(exact("Continue")!);
    fireEvent.click(exact("Skip this one")!);
    await waitFor(() => expect(stepText()).toMatch(/group 1 of/i));
    expect(document.body.textContent).not.toMatch(/in detail instead/i);
  });

  it("asks what somebody is tracking first, and will not continue without it", async () => {
    await mountFresh();
    await toFocus();
    expect(stepText()).toMatch(/Step 1 of 6/);
    const cta = screen.getAllByRole("button").find((b) => /Pick what you're tracking/.test(b.textContent || ""))!;
    expect((cta as HTMLButtonElement).disabled).toBe(true);
  });

  /* Nothing is demanded — every card can be moved past — and nothing is
     assumed either. Those are different promises and the flow makes both:
     the way forward is never greyed out, and the way forward never leaves an
     answer behind that nobody gave. */
  it("never blocks a card: the way on is live before anything is tapped", async () => {
    await mountFresh();
    await toTune();
    expect((exact("Next group") as HTMLButtonElement).disabled).toBe(false);
    await throughQuestions();
    // The photographs: a yes, a no, and a way past without either.
    expect(exact("Not this one")).toBeTruthy();
    expect(exact("Decide later")).toBeTruthy();
    await throughPhotos();
    expect(exact("Not this one")).toBeTruthy();
    expect(exact("Decide later")).toBeTruthy();
  });

  it("walks back to any earlier answer, all the way to the doorway", async () => {
    await mountFresh();
    await toExtras();
    // Out of the extras, back through the photographs and the questions, to
    // the doorway — one Back at a time, without losing a screen.
    for (let i = 0; i < 60; i++) {
      const back = exact("Back");
      if (!back) break;
      fireEvent.click(back);
      if (/Who is this journal for\?/i.test(document.body.textContent || "")) break;
    }
    await screen.findByText(/Who is this journal for\?/i);
  });
});

/* ---------- act three: the question they came with ----------

   The screen the flow did not have, and the one everything after it is
   pointed at. What is protected here is that it is a *decision with
   consequences* rather than a personality question: nothing arrives chosen,
   choosing one says out loud what the app will do about it and when, the
   suggestion it makes downstream is visibly a suggestion, and it is genuinely
   skippable — a person who does not want to name a reason still gets the
   whole app.

   The one thing that must never be true: an aim switching something on. Every
   question, photograph and button in this journal has to have been tapped by
   the person who is going to live with it. */
describe("the question they came with", () => {
  it("asks it after what they track, and arrives with nothing chosen", async () => {
    await mountFresh();
    await toAim();
    expect(stepText()).toMatch(/Step 2 of 6/);
    expect(document.querySelectorAll('.fhj-fr-aim[aria-pressed="true"]')).toHaveLength(0);
    // Every aim is offered, and the honest refusal is one of them, last.
    const cards = [...document.querySelectorAll(".fhj-fr-aim")].map((el) => el.textContent || "");
    expect(cards.length).toBeGreaterThanOrEqual(4);
    expect(cards[cards.length - 1]).toMatch(/Nothing in particular/i);
  });

  it("answers with machinery and a date, not with encouragement", async () => {
    await mountFresh();
    await toAim();
    tap(/Find what sets it off/);
    const card = await waitFor(() => {
      const el = document.querySelector('.fhj-fr-aim[aria-pressed="true"]')!;
      expect(el.querySelector(".fhj-fr-aim-open")).toBeTruthy();
      return el;
    });
    // What it will actually do: a comparison of their own days.
    expect(card.textContent).toMatch(/compares them/i);
    // What arrives suggested because of it — named, so the person can see the
    // consequence of their own answer rather than meeting it three screens on.
    expect(card.textContent).toMatch(/Meals & drinks/);
    // And when the first answer can exist at all.
    expect(card.querySelector(".fhj-fr-aim-when")!.textContent).toMatch(/12 days on the record/);
    // Nothing about it congratulates anybody.
    expect(card.textContent).not.toMatch(/great choice|good choice|perfect/i);
  });

  it("is genuinely skippable, and skipping costs nothing downstream", async () => {
    await mountFresh();
    await toAim();
    expect(exact("Skip this one")).toBeTruthy();
    fireEvent.click(exact("Skip this one")!);
    await waitFor(() => expect(stepText()).toMatch(/Step 3 of 6.*group 1 of/i));
    // The rest of the flow is the same flow.
    await throughQuestions();
    await throughPhotos();
    await throughExtras();
    await screen.findByText(/How is your skin today\?/i);
  });

  it("changes what is suggested, and says which of their answers is talking", async () => {
    /* Meals are not suggested for eczema. Somebody who said they want to find
       what sets it off is offered them anyway — and told why. */
    await mountFresh();
    await toExtras(undefined, [], /Find what sets it off/);
    let seen = "";
    for (let n = 0; n < 12; n++) {
      if (/Meals & drinks/i.test(cardTitle())) { seen = document.body.textContent || ""; break; }
      const on = exact("Not this one") || exact("Continue");
      if (!on) break;
      fireEvent.click(on);
    }
    expect(seen).toMatch(/you said you want to find what sets it off/i);
    expect(seen).toMatch(/suggestion, not a decision/i);
  });

  it("never switches anything on by itself", async () => {
    await mountFresh();
    await toTune(undefined, /Find what sets it off/);
    // The questions still arrive off — the aim marks, it does not tick.
    await throughQuestions();
    await throughPhotos();
    // Nothing was answered in the photographs pass, so nothing is photographed.
    await throughExtras();
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 5 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);

    await waitFor(() => {
      const db = saved();
      // The aim itself is remembered…
      expect(db.profile.aim).toBe("triggers");
      // …and it bought nothing: no food button, no photo questions, because
      // every card in between was answered "not this one".
      expect(db.profile.quickAdd).not.toContain("food");
      expect((db.profile.customQuestions || []).filter((q: any) => q.type === "photo")).toHaveLength(0);
    }, { timeout: 10000 });
  });

  it("marks the questions that bear on it, without ticking them", async () => {
    await mountFresh();
    await toTune(undefined, /Find what sets it off/);
    let marked: HTMLElement | null = null;
    for (let i = 0; i < 20 && !marked; i++) {
      marked = document.querySelector(".fhj-fr-extra-tag.is-aim")?.closest(".fhj-fr-wq") as HTMLElement;
      if (marked) break;
      const on = exact("Next group") || exact("Last one");
      if (!on) break;
      fireEvent.click(on);
    }
    expect(marked).toBeTruthy();
    expect(marked!.textContent).toMatch(/your aim/i);
    // Marked, and still off until somebody taps it.
    expect(marked!.getAttribute("aria-checked")).toBe("false");
  });

  it("leaves the journal with no aim at all when nobody named one", async () => {
    await mountFresh();
    await toEntry();
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 5 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);
    await waitFor(() => expect(saved().profile.aim).toBeUndefined(), { timeout: 10000 });
  });
});

/* ---------- act four: the questions, one group at a time ----------

   There is no list any more and no preset to arrive on. Both were the same
   mistake in two shapes: a check-in assembled by a default rather than by the
   person who has to answer it at 7am on the morning they feel worst.

   What is protected here is that nothing arrives switched on, that every group
   is genuinely put in front of somebody, that the running cost answers back as
   they choose, that a question turned down inside the pass is a question their
   journal does not ask — and that the pass does not end by asking them to
   agree with a list they have just built row by row. */
describe("choosing the questions, one group at a time", () => {
  const groups = () => document.querySelectorAll(".fhj-fr-walkbar-seg").length - 1;
  const switches = () => screen.getAllByRole("switch");
  const rowFor = (re: RegExp) => switches().find((b) => re.test((b.textContent || "").trim()));

  it("has no Quick, Balanced or Thorough to hide behind", async () => {
    await mountFresh();
    await toTune();
    for (const preset of ["Quick", "Balanced", "Thorough"]) {
      expect(exact(preset)).toBeUndefined();
    }
    expect(document.querySelector(".fhj-fr-depth")).toBeNull();
  });

  it("puts one group on the screen, says what it costs, and takes an answer", async () => {
    await mountFresh();
    await toTune();
    expect(stepText()).toMatch(/group 1 of \d/i);

    // The shape of the group, in the words an answer is given in.
    expect(document.querySelector(".fhj-fr-sub")!.textContent).toMatch(/question(s)? here/i);
    expect(document.querySelectorAll(".fhj-fr-wq").length).toBeGreaterThan(0);

    // All of them: the running total under the thumb answers back, and the
    // card turns over — an answer that covers the whole group ends the group.
    const start = countOnScreen();
    tap(/^Ask me all/);
    await waitFor(() => expect(countOnScreen()).toBeGreaterThan(start));
    await waitFor(() => expect(stepText()).toMatch(/group 2 of \d/i));
  });

  /* The one that used to strand people. "None of these" answered the card and
     then left them on it, looking at eight rows they had just declined, with
     the way forward a second tap away at the foot of the screen — which reads
     as the button not having worked. */
  it("moves on when the answer to a whole group is none of them", async () => {
    await mountFresh();
    await toTune();
    expect(stepText()).toMatch(/group 1 of \d/i);
    const before = countOnScreen();

    fireEvent.click(exact("None of these")!);

    await waitFor(() => expect(stepText()).not.toMatch(/group 1 of \d/i));
    // Nothing was switched on by declining them, and nothing was lost either.
    expect(countOnScreen()).toBe(before);
  });

  /* The whole reason the presets are gone. A check-in that arrives with four
     questions already on is a check-in somebody was handed. */
  it("switches nothing on for anybody but the daily number", async () => {
    await mountFresh();
    await toTune();
    expect(countOnScreen()).toBe(1);
    const metric = rowFor(/^Overall skin severity/)!;
    expect(metric.getAttribute("aria-checked")).toBe("true");
    expect((metric as HTMLButtonElement).disabled).toBe(true);
    expect(metric.textContent).toMatch(/your daily number/i);
    // The pack still has an opinion. It says it rather than acting on it.
    const itch = rowFor(/^Itch/);
    if (itch) {
      expect(itch.getAttribute("aria-checked")).toBe("false");
      expect(itch.textContent).toMatch(/most people keep this/i);
    }
  });

  it("draws the answer beside every question, so a yes/no needs no explaining", async () => {
    await mountFresh();
    await toTune();
    // The daily number, drawn as ten rungs rather than described as a range.
    expect(rowFor(/^Overall skin severity/)!
      .querySelectorAll(".fhj-fr-mini-ctl.is-scale > span").length).toBe(10);

    // And somewhere in the deck, a yes/no drawn as a Yes beside a No.
    let yn: Element | undefined;
    for (let i = 0; i < 20 && !yn; i++) {
      yn = [...document.querySelectorAll(".fhj-fr-wq .fhj-fr-mini-ctl.is-toggle")][0];
      if (yn) break;
      const on = exact("Next group") || exact("Last one");
      if (!on) break;
      fireEvent.click(on);
    }
    expect(yn!.textContent).toBe("YesNo");
  });

  it("walks every group, and never asks anybody to confirm what they just built", async () => {
    await mountFresh();
    await toTune();
    const total = groups();
    expect(total).toBeGreaterThan(1);
    for (let i = 1; i <= total; i++) {
      expect(stepText()).toMatch(new RegExp(`group ${i} of ${total}`, "i"));
      fireEvent.click((exact("Next group") || exact("Last one"))!);
    }
    // The last card takes a question of their own. It is not a review: there
    // is no preview of the finished check-in and nothing to agree with.
    expect(stepText()).toMatch(/of your own/i);
    expect(document.body.textContent).not.toMatch(/This is your check-in/i);
    expect(document.querySelector(".fhj-fr-pv")).toBeNull();
    expect(exact("That's my check-in")).toBeUndefined();

    fireEvent.click(exact("Continue")!);
    await waitFor(() => expect(stepText()).toMatch(/Step 4 of 6/i));
  });

  it("takes a question of somebody's own, in their own words", async () => {
    await mountFresh();
    await toTune();
    for (let i = 0; i < 20 && !/of your own/i.test(stepText()); i++) {
      fireEvent.click((exact("Next group") || exact("Last one"))!);
    }
    const before = countOnScreen();
    tap(/Ask me something of my own/);
    fireEvent.change(await screen.findByLabelText(/Your question/i), {
      target: { value: "Hands · how bad today?" },
    });
    fireEvent.click(exact("Add it")!);
    await waitFor(() => expect(countOnScreen()).toBe(before + 1));
    expect(screen.getByText("Hands · how bad today?")).toBeTruthy();
  });

  it("takes a yes/no question of somebody's own, and files it as one", async () => {
    await mountFresh();
    await toTune();
    for (let i = 0; i < 20 && !/of your own/i.test(stepText()); i++) {
      fireEvent.click((exact("Next group") || exact("Last one"))!);
    }
    tap(/Ask me something of my own/);
    fireEvent.change(await screen.findByLabelText(/Your question/i), {
      target: { value: "Slept through the night" },
    });
    const types = document.querySelector(".fhj-fr-own-types") as HTMLElement;
    fireEvent.click(within(types).getByRole("button", { name: /Yes \/ no/ }));
    // The question they are writing, drawn as it will be asked.
    await waitFor(() => {
      const pv = document.querySelector(".fhj-fr-own-pv")!;
      expect(pv.textContent).toMatch(/Slept through the night/);
      expect(pv.querySelector(".fhj-fr-pv-yn")).toBeTruthy();
    });

    fireEvent.click(exact("Add it")!);
    fireEvent.click(exact("Continue")!);
    await waitFor(() => expect(stepText()).toMatch(/Step 4 of 6/i));
    await throughPhotos();
    await throughExtras();
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 3 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);

    await waitFor(() => {
      const own = saved().profile.customQuestions.find((q: any) => q.label === "Slept through the night");
      expect(own.type).toBe("toggle");
    }, { timeout: 10000 });
  });

  /* The point of the whole act: a question somebody switched on inside it is a
     question their journal asks, and one they left alone is one it does not. */
  it("writes what was chosen in the pass into the journal itself", async () => {
    await mountFresh();
    await toTune();
    let found = false;
    await throughQuestions(() => {
      if (found) return;
      const itch = rowFor(/^Itch/);
      if (!itch) return;
      fireEvent.click(itch);
      found = true;
    });
    expect(found).toBe(true);
    await throughPhotos();
    await throughExtras();
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 4 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);

    await waitFor(() => {
      // Switched on in the pass, so it is not among the questions turned off.
      expect((saved().profile.disabledFields || []).includes("itch")).toBe(false);
    }, { timeout: 10000 });
  });
});

/* ---------- act six: what else it should keep ----------

   The same change, for the same reason. These used to be five rows with the
   app's suggestions already ticked, and the row of buttons under somebody's
   thumb for the next year was therefore assembled by a default. */
describe("what else the journal keeps", () => {
  it("holds up one thing a day can hold at a time, with a yes beside a no", async () => {
    await mountFresh();
    await toExtras();
    expect(stepText()).toMatch(/Step 5 of 6.*\b1 of \d/i);
    expect(exact("Yes — keep this")).toBeTruthy();
    expect(exact("Not this one")).toBeTruthy();

    const first = cardTitle();
    tap(/Not this one/);
    await waitFor(() => expect(stepText()).toMatch(/2 of \d/i));
    expect(cardTitle()).not.toBe(first);
  });

  it("draws the one-tap buttons being chosen, rather than filing the choice away", async () => {
    await mountFresh();
    await toExtras(undefined, [/Flare-ups/]);
    const row = () => document.querySelector(".fhj-fr-preview-row")!.textContent || "";
    // Check-in always leads it; the camera follows because the act before this
    // one was told there was something worth photographing.
    expect(row()).toMatch(/Check-in/);
    expect(row()).toMatch(/Photo/);

    // Walk to the bathroom card and say yes: a button appears in the row.
    for (let i = 0; i < 20 && !/Bathroom/.test(cardTitle()); i++) {
      const on = exact("Yes — keep this") ? exact("Not this one")! : exact("Continue")!;
      fireEvent.click(on);
    }
    expect(cardTitle()).toMatch(/Bathroom/);
    fireEvent.click(exact("Yes — keep this")!);
    await waitFor(() => expect(row()).toMatch(/Bowel/));
  });

  /* The one offer this flow makes on the app's own behalf.

     Three things have to hold, and the third is the one that matters: it is
     made at the moment it is obviously in somebody's interest, it is refusable
     with one tap, and refusing it leaves the journal exactly as it would have
     been. An AI that arrives switched on because somebody said yes to logging
     their dinner is the opposite of what this app promises on its first
     screen. */
  it("offers the AI at the yes it is actually about, and takes no for an answer", async () => {
    await mountFresh();
    await toExtras();
    for (let i = 0; i < 20 && !/Meals/.test(cardTitle()); i++) {
      const no = exact("Not this one");
      if (!no) break;
      fireEvent.click(no);
    }
    expect(cardTitle()).toMatch(/Meals/);
    // Nothing has been offered up to this point.
    expect(document.querySelector(".fhj-aic")).toBeNull();

    fireEvent.click(exact("Yes — keep this")!);

    const offer = await waitFor(() => {
      const el = document.querySelector(".fhj-aic");
      expect(el).toBeTruthy();
      return el!;
    });
    expect(offer.textContent).toMatch(/read the plate/i);
    // Said as what it does, with the cost and the privacy fact before the button.
    expect(offer.textContent).toMatch(/free/i);
    expect(offer.textContent).toMatch(/never your name/i);

    // One tap past it, and the card underneath has already moved on.
    fireEvent.click(screen.getByRole("button", { name: /Not now/i }));
    await waitFor(() => expect(document.querySelector(".fhj-aic")).toBeNull());
    expect(cardTitle()).not.toMatch(/Meals/);

    // …and it is not asked again for the rest of the flow.
    await throughExtras();
    expect(document.querySelector(".fhj-aic")).toBeNull();
  });

  it("leaves the AI off in the journal it hands over, when no key was given", async () => {
    await mountFresh();
    /* Kept the meal log, was offered the AI, never connected one — which is
       the path almost everybody takes. The journal that arrives has to be the
       journal they would have had without the offer at all. */
    await toEntry(undefined, [], [/Meals/]);
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 6 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);
    await waitFor(() => expect(saved().onboarded).toBe(true), { timeout: 10000 });
    expect(saved().profile.quickAdd).toContain("food");   // the yes did land
    expect(saved().ai?.enabled).toBe(false);
    expect(saved().ai?.auto).toBe(false);
  });

  it("asks how often before it asks about a nudge, and demands neither", async () => {
    await mountFresh();
    await toExtras();
    // Past the extras themselves to the two questions about when.
    for (let i = 0; i < 20 && !/How often should it ask/i.test(cardTitle()); i++) {
      const no = exact("Not this one");
      if (!no) break;
      fireEvent.click(no);
    }
    expect(cardTitle()).toMatch(/How often should it ask/i);
    const weekly = screen.getAllByRole("button").find((b) => /Once a week/.test(b.textContent || ""))!;
    fireEvent.click(weekly);
    await waitFor(() => expect(weekly.getAttribute("aria-pressed")).toBe("true"));

    fireEvent.click(exact("Continue")!);
    await waitFor(() => expect(cardTitle()).toMatch(/A nudge to write it down/i));
    const off = screen.getAllByRole("button").find((b) => /Not now/.test(b.textContent || ""))!;
    fireEvent.click(off);
    await waitFor(() => expect(off.getAttribute("aria-pressed")).toBe("true"));
  });
});

describe("the doorway: who this is for", () => {
  it("asks the two personal things without numbering itself a step", async () => {
    await mountFresh();
    await toYou();
    // A step number here would turn a welcome into a registration form.
    expect(document.body.textContent).not.toMatch(/Step \d of/);
    expect(screen.getByLabelText(/What should it call you/i)).toBeTruthy();
    expect(screen.getByLabelText(/Your age/i)).toBeTruthy();
    // And the way past is a button, not a greyed-out apology.
    expect(screen.getAllByRole("button").some((b) => /Skip this/.test(b.textContent || ""))).toBe(true);
  });

  it("argues by consequence: the greeting and the printed header fill in as you type", async () => {
    await mountFresh();
    await toYou();
    expect(document.body.textContent).toMatch(/Name not given/i);

    fireEvent.change(screen.getByLabelText(/What should it call you/i), { target: { value: "Sam Rivera" } });
    await waitFor(() => expect(document.body.textContent).toMatch(/Good morning, Sam\./));
    // First name in the greeting; the whole name on the document.
    expect(document.querySelector(".fhj-fr-letter-meta")!.textContent).toMatch(/Sam Rivera/);
    expect(screen.getByText("Hello, Sam.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Your age/i), { target: { value: "34" } });
    await waitFor(() =>
      expect(document.querySelector(".fhj-fr-letter-meta")!.textContent).toMatch(/34 years old/));
  });

  it("stores the year somebody was born, not the age they happened to be", async () => {
    await mountFresh();
    await toYou();
    fireEvent.change(screen.getByLabelText(/Your age/i), { target: { value: "34" } });
    // Said out loud on the dial, because it is what actually gets written down.
    await waitFor(() =>
      expect(document.querySelector(".fhj-fr-age")!.textContent)
        .toMatch(new RegExp(`born around ${new Date().getFullYear() - 34}`)));
  });

  it("carries the name and the age into the journal, and into the greeting", async () => {
    await mountFresh();
    await toEntry({ name: "Sam", age: 34 });
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 5 out of 10/ }));
    tap(/Save my first entry/);
    expect(await screen.findByText("Your journal has begun, Sam.")).toBeTruthy();
    tap(/Open my journal/);

    // The payoff is every morning, not just the setup screen.
    expect(await screen.findByText(/, Sam$/, {}, { timeout: 10000 })).toBeTruthy();
    await waitFor(() => {
      const db = saved();
      expect(db.profile.name).toBe("Sam");
      expect(db.profile.birthYear).toBe(new Date().getFullYear() - 34);
    });
  });

  it("takes no for an answer, and never mentions it again", async () => {
    await mountFresh();
    await toEntry();
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 5 out of 10/ }));
    tap(/Save my first entry/);
    // No name, no comma, no "complete your profile" nag.
    expect(await screen.findByText("Your journal has begun.")).toBeTruthy();
    tap(/Open my journal/);
    await waitFor(() => {
      const db = saved();
      expect(db.profile.name).toBe("");
      expect(db.profile.birthYear).toBeUndefined();
    }, { timeout: 10000 });
    expect(document.body.textContent).not.toMatch(/Good morning,/);
  });
});

/* ---------- act five: the photographs, one subject at a time ----------

   Eight things a camera can be pointed at is more than anybody weighs in a
   glance, and the cost of getting it wrong is asymmetric: a subject nobody
   picks is a photograph never taken, and there is no going back in six weeks
   to take it. So there is no list here either.

   What is protected: that every subject is genuinely held up, that a no is
   recorded as an answer rather than as an absence, that the two subjects
   needing one more fact ask for it *inside* the pass rather than on a screen
   the pass hands back to, and that wanting no photographs at all is a finished
   answer rather than an unfilled form. */
describe("choosing the photographs, one subject at a time", () => {
  const sheet = () => document.querySelector(".fhj-fr-sheet")!.textContent || "";

  it("holds up one subject, says what it is worth, and offers a yes beside a no", async () => {
    await mountFresh();
    await toPhotos();
    expect(stepText()).toMatch(/Step 4 of 6.*\b1 of \d/i);

    // What this one is for six weeks from now — not just what it is.
    expect(document.querySelector(".fhj-fr-pw-why")!.textContent!.length).toBeGreaterThan(20);
    // The same shot twice, weeks apart, which is the whole argument for it.
    expect(document.querySelectorAll(".fhj-fr-pw-shot .fhj-fr-frame").length).toBe(2);
    expect(exact("Not this one")).toBeTruthy();

    // A no is an answer, and it moves on like one.
    tap(/Not this one/);
    await waitFor(() => expect(stepText()).toMatch(/2 of \d/i));
  });

  it("asks what the photos are of, rather than whether to have photos", async () => {
    await mountFresh();
    await toPhotos();
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      const yes = exact("Yes — I'll photograph this");
      if (!yes) break;
      seen.push(cardTitle());
      const before = stepText();
      fireEvent.click(exact("Not this one")!);
      if (stepText() === before) break;
    }
    const all = seen.join(" | ");
    for (const re of [/Meals/, /Products & labels/, /Progress shots/, /Specific body areas/]) {
      expect(all).toMatch(re);
    }
  });

  it("picks nothing for anybody: the suggestion is said out loud, never acted on", async () => {
    await mountFresh();
    await toPhotos();
    // Eczema suggests body areas — and says so rather than ticking it.
    let saidSo = false;
    for (let i = 0; i < 20; i++) {
      if (/Specific body areas/.test(cardTitle())) {
        saidSo = /usually keep this one/i.test(document.body.textContent || "");
        break;
      }
      const before = stepText();
      const no = exact("Not this one");
      if (!no) break;
      fireEvent.click(no);
      if (stepText() === before) break;
    }
    expect(saidSo).toBe(true);
    // And with nothing answered yes, the camera is genuinely empty.
    expect(sheet()).toMatch(/nothing yet/i);
  });

  it("lands every yes on the contact sheet as it is given, and every no nowhere", async () => {
    await mountFresh();
    await toPhotos();
    const first = cardTitle();
    tap(/Not this one/);
    await waitFor(() => expect(stepText()).toMatch(/2 of \d/i));
    expect(sheet()).not.toMatch(new RegExp(first.split(",")[0].slice(0, 8), "i"));

    const second = cardTitle();
    tap(/Yes — I'll photograph this/);
    await waitFor(() => expect(sheet()).toMatch(new RegExp(second.split(",")[0].slice(0, 8), "i")));
  });

  /* The one failure mode a guided pass can have that a list cannot: saying yes
     to the body map and then never being shown a body map. */
  it("asks for the areas inside the pass, not on a screen it hands back to", async () => {
    await mountFresh();
    await toPhotos();
    for (let i = 0; i < 20 && !/Specific body areas/.test(cardTitle()); i++) {
      const before = stepText();
      fireEvent.click(exact("Not this one")!);
      if (stepText() === before) break;
    }
    expect(cardTitle()).toMatch(/Specific body areas/);
    fireEvent.click(exact("Yes — I'll photograph this")!);

    // Everything else answered, and the map is waiting at the end of the deck.
    for (let i = 0; i < 20; i++) {
      const yes = exact("Yes — I'll photograph this");
      if (!yes) break;
      const before = stepText();
      fireEvent.click(exact("Not this one")!);
      if (stepText() === before) break;
    }
    await waitFor(() => expect(cardTitle()).toMatch(/Which areas\?/i));
    const map = document.querySelector('[aria-label^="Tap body areas"]')!;
    fireEvent.click(map.querySelectorAll('[role="button"]')[0]);
    await waitFor(() => expect(document.querySelector(".fhj-fr-spot-chips")).toBeTruthy());
    expect(sheet()).toMatch(/scalp|face|neck|chest|abdomen|arm|leg|hand/i);
  });

  it("turns every subject into its own photo question, with its own baseline", async () => {
    await mountFresh();
    await toExtras(undefined, [/Meals/, /Flare-ups/]);
    await throughExtras();
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 4 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);

    await waitFor(() => {
      const qs = saved().profile.customQuestions;
      const meal = qs.find((q: any) => q.k === "c_photo_meal");
      expect(meal.type).toBe("photo");
      // A plate of food does not want a severity rating; a flare does.
      expect(meal.rated).toBe(false);
      expect(qs.find((q: any) => q.k === "c_photo_flare").rated).toBe(true);
      // And the camera is on the dashboard, because there is something to point it at.
      expect(saved().profile.quickAdd).toContain("photo");
    }, { timeout: 10000 });
  });

  it("lets somebody want no photos at all, and does not hand them a camera", async () => {
    await mountFresh();
    await toExtras();
    // Nothing said yes to, so no camera in the row of buttons being assembled.
    expect(document.querySelector(".fhj-fr-preview-row")!.textContent).not.toMatch(/Photo/);
    await throughExtras();
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 4 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);

    await waitFor(() => {
      const db = saved();
      expect(db.profile.customQuestions.some((q: any) => q.type === "photo")).toBe(false);
      expect(db.profile.quickAdd).not.toContain("photo");
    }, { timeout: 10000 });
  });
});

describe("the moment the journal begins", () => {
  it("writes the entry the person actually made — number and note", async () => {
    await mountFresh();
    await toEntry();

    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 7 out of 10/ }));
    expect(screen.getByText("a hard day")).toBeTruthy();

    tap(/Add a note/);
    fireEvent.change(await screen.findByLabelText("Note for today"), {
      target: { value: "Flared after the gym." },
    });
    tap(/Save my first entry/);

    expect(await screen.findByText("Your journal has begun.")).toBeTruthy();
    tap(/Open my journal/);

    await waitFor(() => {
      const db = saved();
      const entry = db.entries.find((e: any) => e.date === today());
      expect(entry.answers.overall_skin_severity).toBe(7);
      expect(entry.notes).toBe("Flared after the gym.");
    }, { timeout: 10000 });
  });

  it("shows the entry as the first card on a timeline, with the days ahead behind it", async () => {
    await mountFresh();
    await toEntry();
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 4 out of 10/ }));
    tap(/Save my first entry/);

    await screen.findByText("Your journal has begun.");
    const card = document.querySelector(".fhj-fr-card.is-landed")!;
    expect(card.textContent).toMatch(/4\/10/);
    expect(card.textContent).toMatch(/Overall skin severity/);
    // The future, drawn as the faintest thing on the screen.
    expect(document.querySelectorAll("[data-tl-ghost]").length).toBe(3);
    expect(screen.getByText("day on the record")).toBeTruthy();
  });

  it("hands over a journal that is already set up and already has today in it", async () => {
    await mountFresh();
    await toEntry();
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 6 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);

    // Today, with the number already recorded and the card showing it back.
    // The tour opens over it, so the assertion is about the journal.
    await waitFor(() => {
      const db = saved();
      expect(db.onboarded).toBe(true);
      expect(db.ack).toBe(true);                       // the disclaimer was on the hero
      expect(db.profile.modules).toEqual(["eczema"]);
      expect(db.profile.keyMetric).toBe("overall_skin_severity");
      // Nothing was switched on for them, so the pack's questions are all off
      // but the daily number — the survey exists, and they chose none of it.
      expect(db.profile.disabledFields.length).toBeGreaterThan(0);
      expect(db.entries.find((e: any) => e.date === today()).answers.overall_skin_severity).toBe(6);
    }, { timeout: 10000 });
  });

  it("hands over the buttons and the reminder the person chose, not a default set", async () => {
    await mountFresh();
    await toExtras();
    // Bathroom is not suggested for eczema; saying yes to it has to reach the
    // journal, and so does a reminder chosen over the one that arrives set.
    await throughExtras([/Bathroom/]);
    // The nudge card was the last one the pass showed; go back and change it.
    fireEvent.click(exact("Back")!);
    await waitFor(() => expect(cardTitle()).toMatch(/A nudge to write it down/i));
    fireEvent.click(screen.getAllByRole("button").find((b) => /Morning/.test(b.textContent || ""))!);
    fireEvent.click(exact("Continue")!);
    await screen.findByText(/How is your skin today\?/i);
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 5 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);

    await waitFor(() => {
      const db = saved();
      expect(db.profile.quickAdd).toContain("bowel");
      expect(db.profile.quickAdd[0]).toBe("checkin");
      expect(db.profile.reminders[0].time).toBe("08:00");
    }, { timeout: 10000 });
  });

  it("carries a question somebody wrote themselves into their setup", async () => {
    await mountFresh();
    await toTune();
    for (let i = 0; i < 20 && !/of your own/i.test(stepText()); i++) {
      fireEvent.click((exact("Next group") || exact("Last one"))!);
    }
    tap(/Ask me something of my own/);
    fireEvent.change(await screen.findByLabelText(/Your question/i), {
      target: { value: "Hands today" },
    });
    fireEvent.click(exact("Add it")!);
    fireEvent.click(exact("Continue")!);
    await waitFor(() => expect(stepText()).toMatch(/Step 4 of 6/i));
    await throughPhotos();
    await throughExtras();
    await screen.findByText(/How is your skin today\?/i);
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 3 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);

    await waitFor(() => {
      const db = saved();
      const own = db.profile.customQuestions.find((q: any) => q.label === "Hands today");
      expect(own).toBeTruthy();
      expect(own.type).toBe("scale");
    }, { timeout: 10000 });
  });

  it("does not write a day when nobody rated one", async () => {
    await mountFresh();
    await toEntry();
    const cta = screen.getAllByRole("button").find((b) => /Pick a number to save it/.test(b.textContent || ""))!;
    expect((cta as HTMLButtonElement).disabled).toBe(true);
  });
});


/* ---------- the plan, and the notes somebody already has ----------

   The last screen used to end on "keep going and it answers what memory
   cannot", which is a lovely sentence and not an answer to the only question
   anybody actually has at the end of a setup: *when does this start being
   worth it?*

   So it ends on three dated rungs instead, computed from the cadence this
   person just chose against the same evidence ladder every finding in the app
   is graded on — and then, because almost nobody arrives having tracked
   nothing, on one offer to bring in what they have already written somewhere
   else. What is protected here is that the dates are real and move with the
   cadence, and that the offer is an offer: taking it goes somewhere useful,
   and declining it opens the journal exactly as before. */
describe("the plan at the end", () => {
  const born = async (opts: { aim?: RegExp; weekly?: boolean } = {}) => {
    await mountFresh();
    await toExtras(undefined, [], opts.aim);
    if (opts.weekly) {
      // Walk to the cadence card and slow the journal right down.
      for (let n = 0; n < 12; n++) {
        if (/How often should it ask/i.test(cardTitle())) break;
        const on = exact("Not this one") || exact("Continue");
        if (!on) break;
        fireEvent.click(on);
      }
      fireEvent.click(screen.getAllByRole("button").find((b) => /Once a week/.test(b.textContent || ""))!);
    }
    await throughExtras();
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 5 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
  };

  it("ends with three dated things this journal will be able to do", async () => {
    await born();
    const rows = [...document.querySelectorAll(".fhj-fr-plan li")];
    expect(rows).toHaveLength(3);
    // Each one carries a date and a distance, not an adjective.
    for (const row of rows) {
      expect(row.querySelector(".fhj-fr-plan-when")!.textContent).toMatch(/\w/);
    }
    // The rungs are the app's own, said in days on the record.
    const text = rows.map((r) => r.textContent).join(" ");
    expect(text).toMatch(/12 days on the record/);
    expect(text).toMatch(/30 days/);
    // …and what a day of it costs, before what the days buy.
    expect(document.querySelector(".fhj-fr-holds")!.textContent).toMatch(/a day/);
  });

  it("quotes back the question they said they came with", async () => {
    await born({ aim: /Find what sets it off/ });
    expect(document.body.textContent).toMatch(/What is setting this off\?/);
  });

  it("moves the dates when the journal was set to ask less often", async () => {
    await born({ weekly: true });
    const first = document.querySelector(".fhj-fr-plan li .fhj-fr-plan-when")!.textContent || "";
    // Four weekly check-ins is a month away, so the first rung is weeks out
    // rather than days — the promise follows the pace, not the other way round.
    expect(first).toMatch(/in about \d+ weeks/i);
    expect(document.body.textContent).toMatch(/once a week/i);
  });

  it("is honest that the dates assume the pace was kept", async () => {
    await born();
    expect(document.body.textContent).toMatch(/those dates assume/i);
    expect(document.body.textContent).toMatch(/nothing is lost and nothing is scolded/i);
  });

  it("offers to bring in what somebody has already written elsewhere", async () => {
    await born();
    tap(/tracking this somewhere else/i);
    expect(await screen.findByText(/You don't have to start from nothing/i)).toBeTruthy();
    // The claim is demonstrated rather than described: shorthand, and the rows
    // it becomes.
    const demo = document.querySelector(".fhj-fr-import")!;
    expect(demo.textContent).toMatch(/2acv premeal/);
    expect(demo.textContent).toMatch(/ACV ×2, pepsin ×2/);
    // And it is honest about the one thing that makes this different from
    // everything else in the app.
    expect(document.body.textContent).toMatch(/one that sends your writing/i);
    expect(document.body.textContent).toMatch(/approve every single row/i);
  });

  it("opens the journal anyway for somebody who says not now", async () => {
    await born();
    tap(/tracking this somewhere else/i);
    await screen.findByText(/You don't have to start from nothing/i);
    tap(/Not now — open my journal/);
    await waitFor(() => expect(saved().onboarded).toBe(true), { timeout: 10000 });
    // The journal they built, exactly as it would have been.
    expect(saved().profile.modules).toEqual(["eczema"]);
    expect(saved().entries.find((e: any) => e.date === today()).answers.overall_skin_severity).toBe(5);
  });

  it("asks for the connection it needs rather than pretending it does not need one", async () => {
    await born();
    tap(/tracking this somewhere else/i);
    await screen.findByText(/You don't have to start from nothing/i);
    tap(/Set it up and bring them in/);
    // The same connection sheet the rest of the flow uses, on its own terms:
    // an offer that quietly turned into a settings screen would be a bait.
    expect(await screen.findByText(/Turn what you already wrote into days on the record/i)).toBeTruthy();
  });
});

/* The pure end of it: the answers, turned into a journal.

   Driving the whole flow proves the screens; this proves the translation,
   which is where a setup quietly loses somebody's answer. Both of these are
   facts the flow cannot assert about itself without a connected AI and a real
   import behind it. */
describe("what the answers become", () => {
  const answers = (over: Record<string, unknown> = {}) => ({
    name: "", age: null, modules: ["eczema"], keyMetric: "overall_skin_severity",
    score: 5, note: "", enabledKeys: ["overall_skin_severity"], customQuestions: [],
    extras: [], photoSubjects: [], progressAngles: [], spots: [],
    reminder: null, cadence: "daily", ai: false, aim: null, startWith: "dashboard",
    ...over,
  });

  it("keeps the question somebody said they came with", async () => {
    const { __internals: I } = await import("../src/App");
    const built = (over?: Record<string, unknown>) => I.firstRunProfile(answers(over))[0] as any;
    expect(built({ aim: "triggers" }).aim).toBe("triggers");
    // …and leaves it off entirely when nobody named one, rather than storing
    // a default nobody chose.
    expect(built().aim).toBeUndefined();
  });

  it("opens the import screen for somebody who has notes elsewhere", async () => {
    const { __internals: I } = await import("../src/App");
    expect(I.firstRunProfile(answers({ startWith: "import" }))[1]).toBe("import");
    // Everybody else lands on the journal they just built.
    expect(I.firstRunProfile(answers())[1]).toBe("dashboard");
    // Either way the first entry is written — the day they rated is theirs
    // whichever screen opens over it.
    expect(I.firstRunProfile(answers({ startWith: "import" }))[2]).toEqual({
      key: "overall_skin_severity", value: 5, note: "",
    });
  });
});

/* ---------- being shown around, once ----------

   First run ends with a home screen full of controls the person chose and has
   never seen working. The tour is the one pass over it: it points at the real
   controls rather than at pictures of them, it spends a stop on each of the
   gestures nothing else explains, it lists what is actually behind the gear,
   and then it is over for good.

   What is pinned here is the shape and the exit, not the wording: that it
   arrives on the dashboard the journal was just born onto, that it reaches the
   two things a first-time user cannot discover (holding the +, and what
   Settings contains), that leaving works from the first card, and that it
   never comes back. */
describe("being shown around, once", () => {
  const tourText = () => document.querySelector(".fhj-tour-card")?.textContent || "";

  async function begin() {
    await mountFresh();
    await toEntry();
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 5 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);
    await waitFor(() => expect(document.querySelector(".fhj-tour-card")).toBeTruthy(), { timeout: 10000 });
  }

  it("arrives on the journal it just built, and says how long it is", async () => {
    await begin();
    expect(tourText()).toMatch(/Your journal is ready/i);
    // Told what this costs before it asks for any of somebody's morning.
    expect(tourText()).toMatch(/short\s+stops/i);
    expect(exact("I'll explore myself")).toBeTruthy();
  });

  it("points at the real controls, in the order a thumb meets them", async () => {
    await begin();
    // Every stop it is about to show is a control that is genuinely on screen.
    for (const sel of [".fhj-pulse-card", ".fhj-thumb-add", '[data-tour="history"]', '[data-tour="settings"]']) {
      expect(document.querySelector(sel)).toBeTruthy();
    }
    tap(/Show me around/);
    await waitFor(() => expect(tourText()).toMatch(/One question at a time, in one place/i));
    // And it teaches the thing the card itself cannot say: what a tap does next.
    expect(tourText()).toMatch(/turns over to the next question/i);
  });

  it("spends a whole stop on holding the +, which nothing else explains", async () => {
    await begin();
    tap(/Show me around/);
    let found = false;
    for (let i = 0; i < 12 && !found; i++) {
      if (/Hold \+ to go anywhere/i.test(tourText())) { found = true; break; }
      const on = exact("Next") || exact("Nearly done");
      if (!on) break;
      fireEvent.click(on);
    }
    expect(found).toBe(true);
    expect(tourText()).toMatch(/keep holding and\s+slide/i);
    // The keyboard route to the same place, said on the same card.
    expect(tourText()).toMatch(/keyboard/i);
  });

  it("lists what is behind the gear rather than leaving it to be discovered", async () => {
    await begin();
    tap(/Show me around/);
    let found = false;
    for (let i = 0; i < 14 && !found; i++) {
      if (/What is behind the gear/i.test(tourText())) { found = true; break; }
      const on = exact("Next") || exact("Nearly done");
      if (!on) break;
      fireEvent.click(on);
    }
    expect(found).toBe(true);
    for (const re of [/Your survey/i, /Reminders/i, /App lock/i, /Export/i, /Appearance/i]) {
      expect(tourText()).toMatch(re);
    }
    // And a way straight there, for somebody who wants it now.
    expect(exact("Open Settings now")).toBeTruthy();
  });

  it("can be asked for again, because it only ever runs itself once", async () => {
    await begin();
    fireEvent.click(exact("I'll explore myself")!);
    await waitFor(() => expect(document.querySelector(".fhj-tour-card")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "settings" }));
    fireEvent.click(await screen.findByRole("button", { name: /Show me around again/i }));
    await waitFor(() => expect(document.querySelector(".fhj-tour-card")).toBeTruthy());
    expect(document.querySelector(".fhj-tour-card")!.textContent).toMatch(/Your journal is ready/i);
  });

  it("leaves for good — and the journal underneath it works", async () => {
    await begin();
    fireEvent.click(exact("I'll explore myself")!);
    await waitFor(() => expect(document.querySelector(".fhj-tour-card")).toBeNull());

    // The day is on the record and the card is answering, not explaining.
    expect(document.querySelector(".fhj-pulse-q")!.textContent).toMatch(/Overall skin severity/);
    // A tour that can be re-triggered is a tour somebody dismisses twice.
    expect(localStorage.getItem("fhj_tour_seen_v1")).toBe("1");
  });
});
