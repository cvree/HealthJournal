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

/** …pick a pack → the question-shaping screen. */
async function toTune(who?: Who) {
  await toFocus(who);
  tap(/Eczema/);
  fireEvent.click(exact("Continue")!);
  await screen.findByText(/What should it ask you\?/i);
}

/** …and on to what is worth photographing. */
async function toPhotos(who?: Who) {
  await toTune(who);
  fireEvent.click(exact("Continue")!);
  await screen.findByText(/What's worth a photo\?/i);
}

/** A photo subject on the act-four list, by name. Nothing on that screen
    arrives ticked any more, so every test that wants a camera has to ask for
    one — which is the whole point of the change. */
const subjectBtn = (re: RegExp) =>
  screen.getAllByRole("button").find((b) => b.className.includes("fhj-fr-subject") && re.test(b.textContent || ""))!;

/** …and on to what else the journal should keep, photographing whatever this
    particular test wanted photographed (nothing, by default). */
async function toExtras(who?: Who, photos: RegExp[] = []) {
  await toPhotos(who);
  for (const re of photos) fireEvent.click(subjectBtn(re));
  tap(/^Continue/);
  await screen.findByText(/What else should it keep\?/i);
}

/** …and on to the entry itself. */
async function toEntry(who?: Who, photos: RegExp[] = []) {
  await toExtras(who, photos);
  fireEvent.click(exact("Continue")!);
  await screen.findByText(/How is your skin today\?/i);
}

const countOnScreen = () =>
  Number((document.querySelector(".fhj-fr-cost-num")?.textContent || "0").trim());

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
    await screen.findByText(/What should it ask you\?/i);
    expect(document.body.textContent).not.toMatch(/in detail instead/i);
  });

  it("asks what somebody is tracking first, and will not continue without it", async () => {
    await mountFresh();
    await toFocus();
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
    const cta = screen.getAllByRole("button").find((b) => /Pick what you're tracking/.test(b.textContent || ""))!;
    expect((cta as HTMLButtonElement).disabled).toBe(true);
  });

  it("never blocks a later step: every screen arrives already answered", async () => {
    await mountFresh();
    await toTune();
    // Something is already on, and Continue is live without a single tap.
    expect(countOnScreen()).toBeGreaterThan(0);
    expect((exact("Continue") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(exact("Continue")!);
    await screen.findByText(/What's worth a photo\?/i);
    tap(/^Continue/);
    await screen.findByText(/What else should it keep\?/i);
    expect((exact("Continue") as HTMLButtonElement).disabled).toBe(false);
  });

  it("walks back to any earlier answer, all the way to the doorway", async () => {
    await mountFresh();
    await toExtras();
    fireEvent.click(exact("Back")!);
    await screen.findByText(/What's worth a photo\?/i);
    fireEvent.click(exact("Back")!);
    await screen.findByText(/What should it ask you\?/i);
    fireEvent.click(exact("Back")!);
    await screen.findByText(/What are you tracking\?/i);
    fireEvent.click(exact("Back")!);
    await screen.findByText(/Who is this journal for\?/i);
  });
});

describe("shaping the check-in", () => {
  it("shows what the day will cost, and changes it when a question goes off", async () => {
    await mountFresh();
    await toTune();
    const before = countOnScreen();
    expect(before).toBeGreaterThan(0);
    expect(document.body.textContent).toMatch(/a day/i);

    // "Itch" is one of the eczema pack's everyday questions.
    fireEvent.click(screen.getAllByRole("switch").find((b) => /^Itch/.test((b.textContent || "").trim()))!);
    await waitFor(() => expect(countOnScreen()).toBe(before - 1));
  });

  /* The default everybody meets. Balanced is the better journal and Quick is
     the better first week, and the app has to pick one for somebody who has
     no way yet of knowing which they want. It picks the one nobody quits. */
  it("starts everybody on the short version, and says what that means", async () => {
    await mountFresh();
    await toTune();
    expect(exact("Quick")!.getAttribute("aria-pressed")).toBe("true");
    expect(exact("Balanced")!.getAttribute("aria-pressed")).toBe("false");
    // A preset nobody can read is a slider with no units.
    expect(document.querySelector(".fhj-fr-depth-note")!.textContent)
      .toMatch(/worst morning|start here/i);
    // Short enough to be a genuinely different offer from Balanced.
    expect(countOnScreen()).toBeLessThanOrEqual(5);
  });

  /* Four severity ratings would all move together, and the question this app
     exists to answer needs something that does not. */
  it("puts something other than a 1–10 in the short version", async () => {
    await mountFresh();
    await toTune();
    tap(/See it as it'll look/);
    const pv = await waitFor(() => document.querySelector(".fhj-fr-pv")!);
    expect(pv.querySelectorAll(".fhj-fr-pv-scale").length).toBeGreaterThan(0);
    expect(pv.querySelectorAll(".fhj-fr-pv-field").length)
      .toBeGreaterThan(pv.querySelectorAll(".fhj-fr-pv-scale").length);
  });

  it("offers a longer version, without hiding the middle", async () => {
    await mountFresh();
    await toTune();
    const quick = countOnScreen();
    fireEvent.click(exact("Balanced")!);
    await waitFor(() => expect(countOnScreen()).toBeGreaterThan(quick));
    const balanced = countOnScreen();
    fireEvent.click(exact("Thorough")!);
    await waitFor(() => expect(countOnScreen()).toBeGreaterThan(balanced));
    fireEvent.click(exact("Quick")!);
    await waitFor(() => expect(countOnScreen()).toBe(quick));
  });

  it("keeps the daily number switched on, because a journal without one is not one", async () => {
    await mountFresh();
    await toTune();
    const metric = screen.getAllByRole("switch")
      .find((b) => /Overall skin severity/.test(b.textContent || ""))!;
    expect(metric.getAttribute("aria-checked")).toBe("true");
    expect((metric as HTMLButtonElement).disabled).toBe(true);
    expect(metric.textContent).toMatch(/your daily number/i);
  });

  it("takes a question of somebody's own, in their own words", async () => {
    await mountFresh();
    await toTune();
    const before = countOnScreen();
    tap(/Ask me something of my own/);
    fireEvent.change(await screen.findByLabelText(/Your question/i), {
      target: { value: "Hands · how bad today?" },
    });
    fireEvent.click(exact("Add it")!);
    await waitFor(() => expect(countOnScreen()).toBe(before + 1));
    expect(screen.getByText("Hands · how bad today?")).toBeTruthy();
  });
});

describe("what else the journal keeps", () => {
  it("draws the one-tap buttons being chosen, rather than filing the choice away", async () => {
    await mountFresh();
    await toExtras(undefined, [/Flare-ups/]);
    const row = () => document.querySelector(".fhj-fr-preview-row")!.textContent || "";
    // Check-in always leads it; the camera follows because the act before this
    // one was told there was something worth photographing.
    expect(row()).toMatch(/Check-in/);
    expect(row()).toMatch(/Photo/);

    fireEvent.click(screen.getAllByRole("button").find((b) => /Bathroom/.test(b.textContent || ""))!);
    await waitFor(() => expect(row()).toMatch(/Bowel/));
  });

  it("offers a nudge without demanding one", async () => {
    await mountFresh();
    await toExtras();
    expect(document.body.textContent).toMatch(/A nudge to write it down/i);
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

describe("understanding the survey you are designing", () => {
  const switches = () => screen.getAllByRole("switch");
  const rowFor = (re: RegExp) => switches().find((b) => re.test((b.textContent || "").trim()))!;

  it("draws the answer beside every question, so a yes/no needs no explaining", async () => {
    await mountFresh();
    await toTune();
    // The lens is the reliable way to reach the yes/no questions wherever
    // their pack happens to have filed them.
    tap(/Yes \/ no/);
    const row = await waitFor(() => rowFor(/^Moisturized today/));
    const drawn = row.querySelector(".fhj-fr-mini-ctl.is-toggle")!;
    expect(drawn.textContent).toBe("YesNo");

    // ...and the daily number is drawn as ten rungs, not described as one.
    tap(/1–10/);
    await waitFor(() =>
      expect(rowFor(/^Overall skin severity/).querySelectorAll(".fhj-fr-mini-ctl.is-scale > span").length).toBe(10));
  });

  it("sorts the survey by how it is answered, and counts each kind", async () => {
    await mountFresh();
    await toTune();
    const yn = screen.getAllByRole("button").find((b) => /Yes \/ no/.test(b.textContent || ""))!;
    expect(yn.textContent).toMatch(/\d+ on/);

    fireEvent.click(yn);
    await waitFor(() => expect(switches().length).toBeGreaterThan(0));
    // Only yes/no questions are listed — the 1–10s are out of view, not off.
    expect(switches().every((b) => !!b.querySelector(".fhj-fr-mini-ctl.is-toggle"))).toBe(true);
    const before = countOnScreen();

    // A lens narrows what is shown and never what is kept.
    tap(/Everything/);
    await waitFor(() => expect(rowFor(/^Itch/)).toBeTruthy());
    expect(countOnScreen()).toBe(before);
  });

  it("shows the check-in exactly as it will be asked tomorrow", async () => {
    await mountFresh();
    await toTune();
    expect(document.querySelector(".fhj-fr-pv")).toBeNull();
    tap(/See it as it'll look/);

    const pv = await waitFor(() => document.querySelector(".fhj-fr-pv")!);
    expect(pv).toBeTruthy();
    expect(pv.textContent).toMatch(/Overall skin severity/);
    // The controls themselves, at the size they are answered at.
    expect(pv.querySelectorAll(".fhj-fr-pv-scale").length).toBeGreaterThan(0);
    expect(pv.querySelectorAll(".fhj-fr-pv-yn").length).toBeGreaterThan(0);
    expect(pv.textContent).toMatch(/a day|seconds|minute/);
    // Every question that survived, and only those.
    expect(pv.querySelectorAll(".fhj-fr-pv-field").length).toBe(countOnScreen());
  });

  it("takes a yes/no question of somebody's own, and files it as one", async () => {
    await mountFresh();
    await toTune();
    tap(/Ask me something of my own/);
    fireEvent.change(await screen.findByLabelText(/Your question/i), {
      target: { value: "Slept through the night" },
    });
    // Scoped: the lens row upstairs offers a "Yes / no" of its own.
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
    await screen.findByText(/What's worth a photo\?/i);
    tap(/^Continue/);
    await screen.findByText(/What else should it keep\?/i);
    fireEvent.click(exact("Continue")!);
    await screen.findByText(/How is your skin today\?/i);
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 3 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);

    await waitFor(() => {
      const own = saved().profile.customQuestions.find((q: any) => q.label === "Slept through the night");
      expect(own.type).toBe("toggle");
    }, { timeout: 10000 });
  });
});

/* ---------- the guided passes ----------

   The two screens with more options than anybody weighs in one glance now
   deal them out a card at a time. What is protected here is not the animation
   or the wording: it is that the pass is optional, that leaving it half-way
   keeps every answer already given, that what somebody says inside it is the
   same state the list outside it edits, and that it ends on the thing they
   built rather than on a "done". */

describe("choosing the questions, one group at a time", () => {
  const step = () => document.querySelector(".fhj-fr-step")!.textContent || "";
  const tally = () => Number(document.querySelector(".fhj-fr-walk-tally-num")!.textContent);
  const groupCount = () => document.querySelectorAll(".fhj-fr-walkbar-seg").length - 1;

  it("offers the pass beside the list, rather than instead of it", async () => {
    await mountFresh();
    await toTune();
    // Both ways through are on the same screen: the invitation, and the list.
    expect(document.querySelector(".fhj-fr-invite")!.textContent).toMatch(/one group at a time/i);
    expect(document.querySelectorAll(".fhj-fr-qsec").length).toBeGreaterThan(0);
    expect((exact("Continue") as HTMLButtonElement).disabled).toBe(false);
  });

  it("puts one group on the screen, says what it costs, and takes an answer", async () => {
    await mountFresh();
    await toTune();
    tap(/Walk me through them/);
    await waitFor(() => expect(step()).toMatch(/group 1 of \d/i));

    // The shape of the group, in the words an answer is given in.
    expect(document.querySelector(".fhj-fr-sub")!.textContent).toMatch(/question(s)? here/i);
    const rows = document.querySelectorAll(".fhj-fr-wq");
    expect(rows.length).toBeGreaterThan(0);

    // All of them, then none of them — one tap each, and the running total
    // under the thumb answers back both times.
    const start = tally();
    tap(/^Ask me all/);
    await waitFor(() => expect(tally()).toBeGreaterThan(start));
    const all = tally();
    fireEvent.click(exact("None of these")!);
    await waitFor(() => expect(tally()).toBeLessThan(all));
  });

  it("ends on the check-in the person built, and hands it back to the list", async () => {
    await mountFresh();
    await toTune();
    tap(/Walk me through them/);
    await waitFor(() => expect(step()).toMatch(/group 1 of/i));

    for (let i = 0; i < groupCount(); i++) tap(/Next group|See my check-in/);
    await screen.findByText(/This is your check-in\./i);
    // Tomorrow morning, drawn — not a "setup complete" tick.
    expect(document.querySelector(".fhj-fr-pv")).toBeTruthy();
    expect(document.querySelector(".fhj-fr-pv-body")!.children.length).toBeGreaterThan(0);

    tap(/That's my check-in/);
    await screen.findByText(/What should it ask you\?/i);
    // And the screen knows it has been walked.
    expect(document.querySelector(".fhj-fr-invite")!.textContent).toMatch(/again/i);
  });

  it("keeps every answer when somebody leaves it half-way", async () => {
    await mountFresh();
    await toTune();
    const before = countOnScreen();
    tap(/Walk me through them/);
    await waitFor(() => expect(step()).toMatch(/group 1 of/i));
    tap(/^Ask me all/);
    const walked = tally();
    expect(walked).toBeGreaterThan(before);

    fireEvent.click(exact("Show me the whole list")!);
    await screen.findByText(/What should it ask you\?/i);
    expect(countOnScreen()).toBe(walked);
  });

  it("lets somebody out from the middle of it, not only from the first card", async () => {
    await mountFresh();
    await toTune();
    tap(/Walk me through them/);
    await waitFor(() => expect(step()).toMatch(/group 1 of/i));
    tap(/Next group/);
    await waitFor(() => expect(step()).toMatch(/group 2 of/i));
    // Back is there, and so is the door — walking out the way you came in is
    // what makes a guided anything feel like a trap.
    expect(exact("Back")).toBeTruthy();
    fireEvent.click(exact("Show me the whole list")!);
    await screen.findByText(/What should it ask you\?/i);
  });

  /* The whole point of the pass: a question somebody turned down inside it is
     a question their journal does not ask. */
  it("writes what was chosen in the pass into the journal itself", async () => {
    await mountFresh();
    await toTune();
    tap(/Walk me through them/);
    await waitFor(() => expect(step()).toMatch(/group 1 of/i));
    const itch = screen.getAllByRole("switch")
      .find((b) => /^Itch/.test((b.textContent || "").trim()))!;
    const wasOn = itch.getAttribute("aria-checked") === "true";
    fireEvent.click(itch);
    await waitFor(() =>
      expect(screen.getAllByRole("switch")
        .find((b) => /^Itch/.test((b.textContent || "").trim()))!
        .getAttribute("aria-checked")).toBe(String(!wasOn)));

    fireEvent.click(exact("Show me the whole list")!);
    await screen.findByText(/What should it ask you\?/i);
    fireEvent.click(exact("Continue")!);
    await screen.findByText(/What's worth a photo\?/i);
    tap(/^Continue/);
    await screen.findByText(/What else should it keep\?/i);
    fireEvent.click(exact("Continue")!);
    await screen.findByText(/How is your skin today\?/i);
    fireEvent.click(screen.getByRole("button", { name: /Overall skin severity 4 out of 10/ }));
    tap(/Save my first entry/);
    await screen.findByText("Your journal has begun.");
    tap(/Open my journal/);

    await waitFor(() => {
      const off = saved().profile.disabledFields || [];
      expect(off.includes("itch")).toBe(wasOn);
    }, { timeout: 10000 });
  });
});

describe("choosing the photographs, one subject at a time", () => {
  const step = () => document.querySelector(".fhj-fr-step")!.textContent || "";

  it("holds up one subject, says what it is worth, and offers a yes beside a no", async () => {
    await mountFresh();
    await toPhotos();
    tap(/Walk me through them/);
    await waitFor(() => expect(step()).toMatch(/Step 3 of 5 · 1 of \d/i));

    // What this one is for six weeks from now — not just what it is.
    expect(document.querySelector(".fhj-fr-pw-why")!.textContent!.length).toBeGreaterThan(20);
    // The same shot twice, weeks apart, which is the whole argument for it.
    expect(document.querySelectorAll(".fhj-fr-pw-shot .fhj-fr-frame").length).toBe(2);
    expect(screen.getAllByRole("button").some((b) => /Not this one/.test(b.textContent || ""))).toBe(true);

    // A no is an answer, and it moves on like one.
    tap(/Not this one/);
    await waitFor(() => expect(step()).toMatch(/2 of \d/i));
  });

  it("lands every yes on the contact sheet, and every no nowhere", async () => {
    await mountFresh();
    await toPhotos();
    tap(/Walk me through them/);
    await waitFor(() => expect(step()).toMatch(/1 of \d/i));

    const first = document.querySelector(".fhj-fr-display")!.textContent!;
    tap(/Not this one/);
    await waitFor(() => expect(step()).toMatch(/2 of \d/i));
    const second = document.querySelector(".fhj-fr-display")!.textContent!;
    tap(/Yes — I'll photograph this/);
    await waitFor(() => expect(step()).toMatch(/3 of \d/i));

    fireEvent.click(exact("Show me the whole list")!);
    await screen.findByText(/What's worth a photo\?/i);
    const sheet = document.querySelector(".fhj-fr-sheet")!.textContent || "";
    expect(sheet).toMatch(new RegExp(second.split(",")[0].slice(0, 8), "i"));
    expect(subjectBtn(new RegExp(first)).getAttribute("aria-pressed")).toBe("false");
    expect(subjectBtn(new RegExp(second)).getAttribute("aria-pressed")).toBe("true");
  });

  it("ends on the camera it built, whether or not anything is in it", async () => {
    await mountFresh();
    await toPhotos();
    tap(/Walk me through them/);
    await waitFor(() => expect(step()).toMatch(/1 of (\d+)/i));
    const total = Number(step().match(/1 of (\d+)/)![1]);
    for (let i = 0; i < total; i++) tap(/Not this one/);

    await screen.findByText(/No photographs, then\./i);
    tap(/Continue without photos/);
    await screen.findByText(/What's worth a photo\?/i);
    expect(document.querySelector(".fhj-fr-invite")!.textContent).toMatch(/again/i);
  });
});

describe("what is worth a photograph", () => {
  const subject = subjectBtn;
  const sheet = () => document.querySelector(".fhj-fr-sheet")!.textContent || "";

  it("asks what the photos are of, rather than whether to have photos", async () => {
    await mountFresh();
    await toPhotos();
    expect(screen.getByText("Step 3 of 5")).toBeTruthy();
    // Not one switch: a catalogue of things a camera is actually pointed at.
    expect(subject(/Meals/)).toBeTruthy();
    expect(subject(/Products & labels/)).toBeTruthy();
    expect(subject(/Progress shots/)).toBeTruthy();
    expect(subject(/Specific body areas/)).toBeTruthy();
  });

  /* The one screen in this flow that arrives genuinely blank, and on purpose.
     Every answer here ends with a camera pointed at somebody's own skin or
     plate, and an app that had already decided which of those it would be
     asking for has taken a decision that was never on offer. It is still
     allowed an opinion — it just has to say it out loud and then wait. */
  it("picks nothing for anybody: the suggestions are marked, not ticked", async () => {
    await mountFresh();
    await toPhotos();
    for (const re of [/Specific body areas/, /Flare-ups/, /Products & labels/, /Meals/]) {
      expect(subject(re).getAttribute("aria-pressed")).toBe("false");
    }
    // Eczema suggests body areas — and says so rather than acting on it.
    expect(subject(/Specific body areas/).textContent).toMatch(/suggested for what you track/i);
    expect(sheet()).toMatch(/nothing picked yet/i);
    // Continuing on an empty sheet is a finished answer, not an unfilled form.
    expect(screen.getAllByRole("button").some((b) => /Continue without photos/.test(b.textContent || "")))
      .toBe(true);
  });

  it("assembles a contact sheet as the subjects are picked", async () => {
    await mountFresh();
    await toPhotos();
    expect(sheet()).not.toMatch(/Meals/);
    fireEvent.click(subject(/Meals/));
    await waitFor(() => expect(sheet()).toMatch(/Meals/));

    // A body area is a shot of its own, named by where it is.
    fireEvent.click(subject(/Specific body areas/));
    const map = await waitFor(() => document.querySelector('[aria-label^="Tap body areas"]')!);
    fireEvent.click(map.querySelectorAll('[role="button"]')[0]);
    await waitFor(() => expect(document.querySelector(".fhj-fr-spot-chips")).toBeTruthy());
    expect(sheet()).toMatch(/scalp|face|neck|chest|abdomen|arm|leg|hand/i);
  });

  it("turns every subject into its own photo question, with its own baseline", async () => {
    await mountFresh();
    await toPhotos();
    fireEvent.click(subject(/Meals/));
    fireEvent.click(subject(/Flare-ups/));
    tap(/^Continue/);
    await screen.findByText(/What else should it keep\?/i);
    fireEvent.click(exact("Continue")!);
    await screen.findByText(/How is your skin today\?/i);
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
    await toPhotos();
    // Turning one on and off again lands back where the screen started.
    fireEvent.click(subject(/Meals/));
    fireEvent.click(subject(/Meals/));
    await waitFor(() =>
      expect(screen.getAllByRole("button").some((b) => /Continue without photos/.test(b.textContent || ""))).toBe(true));
    expect(sheet()).toMatch(/is a real answer/i);

    tap(/^Continue/);
    await screen.findByText(/What else should it keep\?/i);
    // No camera in the row of one-tap buttons it is assembling.
    expect(document.querySelector(".fhj-fr-preview-row")!.textContent).not.toMatch(/Photo/);
    fireEvent.click(exact("Continue")!);
    await screen.findByText(/How is your skin today\?/i);
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

    // Today, with the number already recorded and the pulse showing it back.
    expect(await screen.findByText(/saved for today/, {}, { timeout: 10000 })).toBeTruthy();
    await waitFor(() => {
      const db = saved();
      expect(db.onboarded).toBe(true);
      expect(db.ack).toBe(true);                       // the disclaimer was on the hero
      expect(db.profile.modules).toEqual(["eczema"]);
      expect(db.profile.keyMetric).toBe("overall_skin_severity");
      // The pack's quick questions came with it — the survey exists, it just
      // wasn't the price of entry.
      expect(db.profile.disabledFields.length).toBeGreaterThan(0);
    });
  });

  it("hands over the buttons and the reminder the person chose, not a default set", async () => {
    await mountFresh();
    await toExtras();
    // Bathroom is not suggested for eczema; ticking it has to reach the journal.
    fireEvent.click(screen.getAllByRole("button").find((b) => /Bathroom/.test(b.textContent || ""))!);
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
    tap(/Ask me something of my own/);
    fireEvent.change(await screen.findByLabelText(/Your question/i), {
      target: { value: "Hands today" },
    });
    fireEvent.click(exact("Add it")!);
    fireEvent.click(exact("Continue")!);
    await screen.findByText(/What's worth a photo\?/i);
    tap(/^Continue/);
    await screen.findByText(/What else should it keep\?/i);
    fireEvent.click(exact("Continue")!);
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
