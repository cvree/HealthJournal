/* The appearance surface: the backdrop, and the controls that drive it.

   Two things are being protected here.

   The first is that the backdrop *renders at all*. The version this replaced
   was a WebGL scene that stood itself down on any device reporting fewer than
   four cores or less than 4GB of RAM, and did nothing at all without a working
   GL context — so on a normal phone the feature was simply absent, silently,
   and no test noticed because no test asserted anything appeared. These do.

   The second is that the first-run screen and the Settings screen offer the
   same controls. They are the same component, and the test below is what keeps
   them that way rather than trusting that nobody will fork it later.
*/
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import {
  DEFAULT_HUE, getBackdrop, getHue, getNightLight, initTheme, setBackdrop, setHue, setNightLight,
} from "../src/lib/theme";

beforeEach(() => {
  cleanup();
  localStorage.clear();
  initTheme();
});

beforeAll(() => {
  (globalThis as any).ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  };
  // `matches: false` everywhere — in particular reduced-motion is *off*, so the
  // backdrop is expected to animate. The still variant is asserted separately.
  window.matchMedia = ((q: string) =>
    ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as any));
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const backdropEl = () => document.querySelector(".fhj-backdrop");

describe("the backdrop renders", () => {
  it("puts a fog backdrop behind the app by default", async () => {
    const { default: AmbientBackdrop } = await import("../src/components/AmbientBackdrop");
    render(React.createElement(AmbientBackdrop));
    const el = backdropEl()!;
    expect(el).toBeTruthy();
    expect(el.className).toContain("fhj-backdrop-fog");
    // Three layers is what makes it read as depth rather than as one wash.
    expect(el.children.length).toBe(3);
  });

  it("needs no WebGL, no canvas and no device to be fast enough", async () => {
    /* The whole point of the rewrite. There is no GL context to lose, nothing
       to feature-detect, and nothing that can decide this phone is too small. */
    const { default: AmbientBackdrop } = await import("../src/components/AmbientBackdrop");
    render(React.createElement(AmbientBackdrop));
    expect(document.querySelector("canvas")).toBeNull();
    expect(backdropEl()).toBeTruthy();
  });

  it("switches to aurora, and to nothing at all", async () => {
    const { default: AmbientBackdrop } = await import("../src/components/AmbientBackdrop");
    setBackdrop("aurora");
    render(React.createElement(AmbientBackdrop));
    await waitFor(() => expect(backdropEl()!.className).toContain("fhj-backdrop-aurora"));

    setBackdrop("off");
    await waitFor(() => expect(backdropEl()).toBeNull());

    setBackdrop("fog");
    await waitFor(() => expect(backdropEl()!.className).toContain("fhj-backdrop-fog"));
  });

  it("draws each of the added styles from the same three-layer skeleton", async () => {
    /* The styles differ only in paint. If one of them ever needs a different
       number of layers, the chooser preview and AmbientBackdrop both have to
       learn about it — so this is the test that says they don't. */
    const { default: AmbientBackdrop } = await import("../src/components/AmbientBackdrop");
    render(React.createElement(AmbientBackdrop));
    for (const style of ["dawn", "drift", "linen"] as const) {
      setBackdrop(style);
      await waitFor(() => expect(backdropEl()!.className).toContain(`fhj-backdrop-${style}`));
      expect(backdropEl()!.children.length, style).toBe(3);
    }
    setBackdrop("fog");
  });

  it("is invisible to assistive tech and to the pointer", async () => {
    const { default: AmbientBackdrop } = await import("../src/components/AmbientBackdrop");
    render(React.createElement(AmbientBackdrop));
    expect(backdropEl()!.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the atmosphere but stops moving under reduced motion", async () => {
    /* No vi.resetModules() here on purpose: the preference is read at mount,
       not at import, so swapping matchMedia is enough — and resetting the
       registry would hand this file a *second* copy of lib/theme, leaving the
       tests below asserting against a module the components no longer write
       to. (That is exactly what happened on the first run of this suite.) */
    const real = window.matchMedia;
    window.matchMedia = ((q: string) =>
      ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as any));
    const { default: AmbientBackdrop } = await import("../src/components/AmbientBackdrop");
    render(React.createElement(AmbientBackdrop));
    const el = backdropEl()!;
    // Still present — a still gradient is the atmosphere without the motion,
    // which is what the preference asks for. Vanishing entirely was not.
    expect(el).toBeTruthy();
    expect(el.className).toContain("fhj-backdrop-still");
    window.matchMedia = real;
  });
});

describe("the appearance controls", () => {
  const renderPanel = async () => {
    const { default: AppearancePanel } = await import("../src/components/AppearancePanel");
    return render(React.createElement(AppearancePanel));
  };

  it("offers every backdrop, the hue, the theme and night light", async () => {
    await renderPanel();
    const text = document.body.textContent || "";
    for (const name of [
      "Fog", "Aurora", "Dawn", "Drift", "Linen", "None",
      "Dark", "Light", "System", "Night Light",
    ]) {
      expect(text, name).toContain(name);
    }
    expect(screen.getByLabelText(/hue/i)).toBeTruthy();
  });

  it("changes the hue from the slider, and remembers it", async () => {
    await renderPanel();
    const slider = screen.getByLabelText(/hue/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "140" } });
    expect(getHue()).toBe(140);
    expect(document.documentElement.style.getPropertyValue("--fhj-hue")).toBe("140");
  });

  it("is a real range input, so it works from the keyboard", async () => {
    // The hue control is the one thing here that could plausibly have been
    // rebuilt from divs. A range input keeps arrows, Home/End and the
    // screen-reader announcement for free.
    await renderPanel();
    const slider = screen.getByLabelText(/hue/i) as HTMLInputElement;
    expect(slider.tagName).toBe("INPUT");
    expect(slider.type).toBe("range");
    expect(slider.min).toBe("0");
    expect(slider.max).toBe("359");
  });

  it("turns night light on, which warms the page and clamps the accent", async () => {
    await renderPanel();
    setHue(220); // firmly blue
    const before = document.documentElement.style.getPropertyValue("--fhj-bg");
    fireEvent.click(screen.getByText(/night light/i).closest("button")!);
    expect(getNightLight()).toBe(true);
    expect(document.documentElement.dataset.night).toBe("on");
    const after = document.documentElement.style.getPropertyValue("--fhj-bg");
    expect(after).not.toBe(before);
    // The accent can no longer be blue, whatever the slider still reads.
    expect(Number(document.documentElement.style.getPropertyValue("--fhj-hue"))).toBeLessThan(60);
  });

  it("picks a backdrop by name", async () => {
    await renderPanel();
    fireEvent.click(screen.getByText("Aurora").closest("button")!);
    expect(getBackdrop()).toBe("aurora");
    fireEvent.click(screen.getByText("None").closest("button")!);
    expect(getBackdrop()).toBe("off");
  });

  it("offers a way back to the original look once anything is changed", async () => {
    setHue(12);
    setNightLight(true);
    setBackdrop("aurora");
    await renderPanel();
    fireEvent.click(screen.getByText(/reset to the original look/i));
    expect(getHue()).toBe(DEFAULT_HUE);
    expect(getNightLight()).toBe(false);
    expect(getBackdrop()).toBe("fog");
  });
});

describe("first launch", () => {
  it("asks how the app should look, before asking anything else", async () => {
    const { default: App } = await import("../src/App");
    render(React.createElement(App));
    const start = await waitFor(() =>
      screen.getAllByRole("button").find((b) => /set me up/i.test(b.textContent || ""))!
    );
    expect(start).toBeTruthy();
    fireEvent.click(start);

    await waitFor(() => expect(document.body.textContent).toMatch(/make it yours/i));
    // Everything from the Settings panel is here too — same component, so
    // there is no second copy to drift.
    const text = document.body.textContent || "";
    for (const name of ["Fog", "Aurora", "Dawn", "Drift", "Linen", "None", "Night Light"]) {
      expect(text, name).toContain(name);
    }
    expect(screen.getByLabelText(/hue/i)).toBeTruthy();
  });

  it("shows the choice on the setup screens themselves, not just in a swatch", async () => {
    const { default: App } = await import("../src/App");
    render(React.createElement(App));
    const start = await waitFor(() =>
      screen.getAllByRole("button").find((b) => /set me up/i.test(b.textContent || ""))!
    );
    fireEvent.click(start);
    await waitFor(() => expect(document.body.textContent).toMatch(/make it yours/i));
    // The real backdrop is running behind the wizard, so picking one is a
    // preview of the app rather than a description of it.
    expect(backdropEl()).toBeTruthy();
  });

  it("still reaches the pack picker afterwards", async () => {
    // The appearance step was inserted ahead of five existing ones, all of
    // which had hard-coded indices. This is the test that the renumbering held.
    const { default: App } = await import("../src/App");
    render(React.createElement(App));
    const start = await waitFor(() =>
      screen.getAllByRole("button").find((b) => /set me up/i.test(b.textContent || ""))!
    );
    fireEvent.click(start);
    const cont = await waitFor(() =>
      screen.getAllByRole("button").find((b) => /^continue$/i.test((b.textContent || "").trim()))!
    );
    fireEvent.click(cont);
    await waitFor(() => expect(document.body.textContent).toMatch(/what do you want to track/i));
  });
});
