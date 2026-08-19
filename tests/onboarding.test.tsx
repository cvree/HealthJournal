/* First run.

   Seven screens stand between a stranger and their first logged day, and every
   one of them is a place the whole app can be abandoned. What is protected here
   is not the styling — it is the three things that make the flow finishable and
   make it feel like it is about the person filling it in:

   1. Picking a pack actually turns its questions on. This shipped broken: the
      effect that syncs the enabled set read a ref that its own effect body had
      already overwritten, so selecting "Eczema / Skin" enabled nothing, the
      estimate read "0 quick questions", and the only way past step 3 was to
      notice the disabled button and go hunting for "Track everything". A wizard
      that dead-ends on its middle screen is worse than no wizard.
   2. The name is asked at the start and used immediately afterwards. Asked at
      the end — where it used to be — it was a label on a profile nobody opens.
   3. The privacy promises are on the first screen, before anything is typed.

   Setup is health-first: there is no appearance step at all — the look lives
   in Settings — and the last screen is not a summary but the first number on
   the record.

   The disclaimer and the sample-data escape hatch are covered in render.test,
   and the appearance controls in appearance.test; this file does not restate
   them.
*/
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

beforeAll(() => {
  (globalThis as any).ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  };
  // Reduced motion on: the step stagger resolves instantly instead of leaving
  // freshly mounted blocks at opacity 0 while assertions run.
  window.matchMedia = ((q: string) =>
    ({
      matches: q.includes("reduce"), media: q,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, dispatchEvent: () => false,
    } as any)) as any;
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

/** Buttons whose trimmed label matches exactly — "Continue" must not also find
    "Continue to photos". */
const exact = (label: string) =>
  screen.getAllByRole("button").find((b) => (b.textContent || "").trim() === label);

async function mount() {
  const { default: App } = await import("../src/App");
  render(React.createElement(App));
  return waitFor(() => {
    const b = screen.getAllByRole("button").find((el) => /set me up/i.test(el.textContent || ""));
    expect(b).toBeTruthy();
    return b!;
  });
}

/** Welcome -> pack picker. One screen, because nothing decorative sits in
    between any more. */
async function toPacks() {
  const start = await mount();
  fireEvent.click(start);
  await waitFor(() => expect(document.body.textContent).toMatch(/what are you tracking/i));
}

/** Packs -> main number -> the question editor. */
async function toQuestions() {
  fireEvent.click(exact("Continue")!);
  await waitFor(() => expect(document.body.textContent).toMatch(/which number matters most/i));
  fireEvent.click(exact("Continue")!);
  await waitFor(() => expect(document.body.textContent).toMatch(/build your daily check-in/i));
}

describe("first-run setup", () => {
  it("turns a pack's questions on when the pack is picked", async () => {
    await toPacks();

    // Nothing chosen yet, so there is nothing to continue to.
    expect(document.body.textContent).toMatch(/pick at least one to continue/i);

    const pack = screen.getAllByRole("button").find((b) => /Eczema/i.test(b.textContent || ""))!;
    fireEvent.click(pack);

    // The estimate is the live read-out of the enabled set. A zero here is the
    // regression: the pack is selected but none of its questions came with it.
    await waitFor(() => {
      const est = document.body.textContent!.match(/(\d+) quick questions?/);
      expect(est, "estimate pill missing").toBeTruthy();
      expect(Number(est![1]), "picking a pack enabled no questions").toBeGreaterThan(0);
    });

    await toQuestions();

    // ...and the question step is passable without hunting for "Track everything".
    await waitFor(() => {
      const next = exact("Continue") as HTMLButtonElement | undefined;
      expect(next, "step 3 offers no enabled Continue").toBeTruthy();
      expect(next!.disabled).toBe(false);
    });
  });

  it("keeps a question the user switched off when another pack is added", async () => {
    await toPacks();
    fireEvent.click(screen.getAllByRole("button").find((b) => /Eczema/i.test(b.textContent || ""))!);
    await toQuestions();

    const before = Number(document.body.textContent!.match(/(\d+) quick questions?/)![1]);
    // "Itch" is a quick question in the eczema pack; switching it off has to
    // survive a later change to the pack selection.
    fireEvent.click(screen.getAllByRole("button").find((b) => (b.textContent || "").trim() === "Itch")!);
    await waitFor(() =>
      expect(Number(document.body.textContent!.match(/(\d+) quick questions?/)![1])).toBe(before - 1)
    );

    fireEvent.click(screen.getByLabelText("back"));
    await waitFor(() => expect(document.body.textContent).toMatch(/which number matters most/i));
    fireEvent.click(screen.getByLabelText("back"));
    await waitFor(() => expect(document.body.textContent).toMatch(/what are you tracking/i));
    fireEvent.click(screen.getAllByRole("button").find((b) => /Carnivore/i.test(b.textContent || ""))!);
    await toQuestions();

    // The new pack's questions arrived on; the one deliberately switched off
    // stayed off rather than being reset by the pack change.
    const itch = screen.getAllByRole("button").find((b) => (b.textContent || "").trim() === "Itch")!;
    expect(itch.textContent!.trim()).toBe("Itch"); // no check mark = still off
  });

  it("asks for a name up front and uses it on the next screen", async () => {
    const start = await mount();
    // Asked before anything else, and optional.
    const field = screen.getByLabelText(/what should this app call you/i);
    fireEvent.change(field, { target: { value: "Connor" } });
    fireEvent.click(start);

    await waitFor(() => expect(document.body.textContent).toMatch(/nice to meet you, connor/i));
  });

  it("says nothing personal when no name was given", async () => {
    const start = await mount();
    fireEvent.click(start);
    await waitFor(() => expect(document.body.textContent).toMatch(/what are you tracking/i));
    expect(document.body.textContent).not.toMatch(/nice to meet you/i);
  });

  it("asks about health before anything else — no look-and-feel step", async () => {
    const start = await mount();
    const rail = screen.getByRole("list", { name: /setup step/i });
    expect(rail.textContent).not.toMatch(/look/i);
    fireEvent.click(start);
    await waitFor(() => expect(document.body.textContent).toMatch(/what are you tracking/i));
    // The second screen is about the condition, not about a colour.
    expect(document.body.textContent).not.toMatch(/make it yours|pick a look|backdrop/i);
  });

  it("lets the main number be chosen, and defaults to the pack's own", async () => {
    await toPacks();
    fireEvent.click(screen.getAllByRole("button").find((b) => /Eczema/i.test(b.textContent || ""))!);
    fireEvent.click(exact("Continue")!);
    await waitFor(() => expect(document.body.textContent).toMatch(/which number matters most/i));

    // The pack's own key metric is offered as the suggestion, and it is one of
    // several — the app is not telling somebody what matters about their body.
    expect(document.body.textContent).toMatch(/suggested for this pack/i);
    const options = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") !== null);
    expect(options.length).toBeGreaterThan(2);
  });

  it("ends on the first entry rather than a summary, and it is optional", async () => {
    await toPacks();
    fireEvent.click(screen.getAllByRole("button").find((b) => /Eczema/i.test(b.textContent || ""))!);
    await toQuestions();
    fireEvent.click(exact("Continue")!);           // photo spots
    await waitFor(() => expect(document.body.textContent).toMatch(/problem spots/i));
    fireEvent.click(exact("Skip for now") || exact("Continue")!);
    await waitFor(() => expect(document.body.textContent).toMatch(/weight/i));
    fireEvent.click(exact("Continue")!);

    await waitFor(() => expect(document.body.textContent).toMatch(/one tap/i));
    expect(exact("Start using it")).toBeTruthy();   // skippable
    const rung = screen.getAllByRole("button").find((b) => /severity 6 out of 10/i.test(b.getAttribute("aria-label") || ""))!;
    fireEvent.click(rung);
    await waitFor(() => expect(document.body.textContent).toMatch(/6\/10/));
    expect(exact("Save it and start")).toBeTruthy();
  });

  it("states what the app does and doesn't do before anything is typed", async () => {
    await mount();
    const text = document.body.textContent || "";
    // The five promises are the trust surface of the whole first screen. Each
    // is a checkable fact about the build; if one stops being true, this test
    // is the thing that should have to change.
    expect(text).toMatch(/no account/i);
    expect(text).toMatch(/no server/i);
    expect(text).toMatch(/no analytics|no trackers/i);
    expect(text).toMatch(/export/i);
    expect(text).toMatch(/delete everything/i);
  });

  it("names the steps and only lets you jump back to ones you've seen", async () => {
    const start = await mount();
    const rail = () => screen.getByRole("list", { name: /setup step/i });
    // Every step is named, including the ones ahead.
    for (const label of ["Welcome", "Tracking", "Main number", "Questions", "Photos", "Body", "First entry"]) {
      expect(rail().textContent, label).toContain(label);
    }
    const stepBtn = (label: string) =>
      Array.from(rail().querySelectorAll("button")).find((b) => b.textContent?.includes(label)) as HTMLButtonElement;

    expect(stepBtn("Tracking").disabled, "a step ahead should not be reachable").toBe(true);
    fireEvent.click(start);
    await waitFor(() => expect(stepBtn("Tracking").disabled).toBe(false));

    // ...and a step already behind you is a way back to it.
    fireEvent.click(stepBtn("Welcome"));
    await waitFor(() => expect(document.body.textContent).toMatch(/your health, in your own words/i));
  });
});
