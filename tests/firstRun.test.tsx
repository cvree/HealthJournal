/* The first two minutes.

   Eight screens: a promise, a doorway that asks who this is for, five numbered
   acts, and a birth. What these tests protect is the shape of that flow — that
   it is one path with no "set everything up in detail" door beside it, that
   every screen after the first arrives already answered so Continue is never
   blocked on work, that the two personal questions are genuinely refusable and
   genuinely used when they are answered, that somebody can see and shape the
   survey they are signing up for (including which questions are yes/no ones),
   that "photos" is a question about *what* rather than a switch, that all of
   it reaches the journal they end up with, and that the last act still turns
   their own first entry into the first card on a timeline.

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
const stepText = () => document.querySelector(".fhj-fr-step")?.textContent || "";
/** The card's own heading — the group, the subject, or the thing being kept. */
const cardTitle = () => document.querySelector(".fhj-fr-display")?.textContent || "";

/** …pick a pack → the first card of the questions pass. There is no list to
    land on any more: the act *is* the pass, from its first screen. */
async function toTune(who?: Who) {
  await toFocus(who);
  tap(/Eczema/);
  fireEvent.click(exact("Continue")!);
  await waitFor(() => expect(stepText()).toMatch(/Step 2 of 5 · group 1 of/i));
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
  await waitFor(() => expect(stepText()).toMatch(/Step 3 of 5/i));
}

async function toPhotos(who?: Who) {
  await toTune(who);
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
    if (!/Step 3 of 5/.test(stepText())) break;
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
  await waitFor(() => expect(stepText()).toMatch(/Step 4 of 5/i));
}

/** …and on to what else the journal should keep. */
async function toExtras(who?: Who, photos: RegExp[] = []) {
  await toPhotos(who);
  await throughPhotos(photos);
}

/** Through the extras, the cadence and the nudge, to the first entry. */
async function throughExtras(wanted: RegExp[] = []) {
  for (let n = 0; n < 40; n++) {
    if (!/Step 4 of 5/.test(stepText())) break;
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
async function toEntry(who?: Who, photos: RegExp[] = [], extras: RegExp[] = []) {
  await toExtras(who, photos);
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

describe("one path, and no door beside it", () => {
  it("never offers a longer setup somewhere else", async () => {
    await mountFresh();
    await toFocus();
    // The escape hatch is gone on purpose: a link to a "detailed" setup is an
    // admission that the main path does not do the job.
    expect(document.body.textContent).not.toMatch(/in detail instead/i);
    tap(/Eczema/);
    fireEvent.click(exact("Continue")!);
    await waitFor(() => expect(stepText()).toMatch(/group 1 of/i));
    expect(document.body.textContent).not.toMatch(/in detail instead/i);
  });

  it("asks what somebody is tracking first, and will not continue without it", async () => {
    await mountFresh();
    await toFocus();
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
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

/* ---------- act three: the questions, one group at a time ----------

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

    // All of them, then none of them — one tap each, and the running total
    // under the thumb answers back both times.
    const start = countOnScreen();
    tap(/^Ask me all/);
    await waitFor(() => expect(countOnScreen()).toBeGreaterThan(start));
    const all = countOnScreen();
    fireEvent.click(exact("None of these")!);
    await waitFor(() => expect(countOnScreen()).toBeLessThan(all));
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
    await waitFor(() => expect(stepText()).toMatch(/Step 3 of 5/i));
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
    await waitFor(() => expect(stepText()).toMatch(/Step 3 of 5/i));
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

/* ---------- act five: what else it should keep ----------

   The same change, for the same reason. These used to be five rows with the
   app's suggestions already ticked, and the row of buttons under somebody's
   thumb for the next year was therefore assembled by a default. */
describe("what else the journal keeps", () => {
  it("holds up one thing a day can hold at a time, with a yes beside a no", async () => {
    await mountFresh();
    await toExtras();
    expect(stepText()).toMatch(/Step 4 of 5 · 1 of \d/i);
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

/* ---------- act four: the photographs, one subject at a time ----------

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
    expect(stepText()).toMatch(/Step 3 of 5 · 1 of \d/i);

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
    await waitFor(() => expect(stepText()).toMatch(/Step 3 of 5/i));
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
