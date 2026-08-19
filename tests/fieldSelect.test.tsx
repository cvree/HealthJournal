/* The app's own dropdown, which replaced two native <select> elements under
   "Possible relationships".

   A native select could not be styled, could not group, could not say what a
   metric is measured in, and could not be filtered — and with two dozen
   metrics in it, all four of those mattered. These tests pin the parts of the
   replacement that are behaviour rather than paint: it opens, it groups, it
   filters, it is fully operable from the keyboard, and it hands focus back
   where it found it. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React, { useState } from "react";
import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";
import FieldSelect, { type SelectOption } from "../src/components/FieldSelect";

beforeEach(() => cleanup());

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: q.includes("reduce"), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  } as any));
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const OPTIONS: SelectOption[] = [
  { k: "sev", label: "Overall skin severity", type: "scale" },
  { k: "itch", label: "Itch", type: "scale" },
  { k: "sleepq", label: "Sleep quality", type: "scale" },
  { k: "stress", label: "Stress", type: "scale" },
  { k: "weight", label: "Weight", type: "number", unit: "lb" },
  { k: "sleep", label: "Sleep", type: "number", unit: "h" },
  { k: "doses", label: "Doses taken", type: "number" },
  { k: "moist", label: "Moisturized today", type: "toggle" },
  { k: "shower", label: "Showered", type: "toggle" },
  { k: "newprod", label: "New product today", type: "toggle" },
];

function Harness({ onPick }: { onPick?: (k: string) => void }) {
  const [value, setValue] = useState("sev");
  return (
    <FieldSelect label="I want to look at" value={value} options={OPTIONS}
      onChange={(k) => { setValue(k); onPick?.(k); }} />
  );
}

const trigger = () => screen.getByRole("combobox", { name: "I want to look at" });
const open = () => { fireEvent.click(trigger()); return screen.getByRole("listbox"); };
const chosen = () => trigger().querySelector(".fhj-select-value")!.textContent!.trim();

describe("the trigger", () => {
  it("shows the current choice, and says it is closed until it isn't", () => {
    render(<Harness />);
    expect(chosen()).toBe("Overall skin severity");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("listbox")).toBeNull();
    open();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });
});

describe("the list", () => {
  it("offers every option, grouped by whether it is a 1–10 rating", () => {
    render(<Harness />);
    const list = open();
    expect(within(list).getAllByRole("option")).toHaveLength(OPTIONS.length);
    const titles = [...list.querySelectorAll(".fhj-sel-group-title")].map((n) => n.textContent);
    expect(titles).toEqual(["Rated 1–10", "Measured its own way"]);
  });

  it("marks exactly one option as the current answer", () => {
    render(<Harness />);
    const list = open();
    const selected = within(list).getAllByRole("option")
      .filter((o) => o.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain("Overall skin severity");
  });

  /* Ratings say nothing: the group above them already said 1–10, and printing
     it on every row is noise. Anything else carries its own unit. */
  it("prints a unit only where there is one worth printing", () => {
    render(<Harness />);
    const list = open();
    const unitOf = (label: string) =>
      within(list).getByText(label).parentElement!.querySelector(".fhj-opt-unit")?.textContent;
    expect(unitOf("Itch")).toBeUndefined();
    expect(unitOf("Weight")).toBe("lb");
    expect(unitOf("Showered")).toBe("yes / no");
  });

  it("chooses on a tap, closes, and reports the choice once", async () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    const list = open();
    fireEvent.click(within(list).getByText("Weight"));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("weight");
    expect(chosen()).toBe("Weight");
  });
});

describe("the filter", () => {
  it("appears once the list stops being scannable, and narrows it", () => {
    render(<Harness />);
    const list = open();
    const field = within(list).getByLabelText("Filter I want to look at");
    fireEvent.change(field, { target: { value: "sleep" } });
    expect(within(list).getAllByRole("option").map((o) => o.textContent))
      .toEqual(["Sleep quality", "Sleeph"]);
  });

  it("says so rather than showing an empty sheet", () => {
    render(<Harness />);
    const list = open();
    fireEvent.change(within(list).getByLabelText("Filter I want to look at"),
      { target: { value: "zzz" } });
    expect(within(list).queryAllByRole("option")).toHaveLength(0);
    expect(list.textContent).toContain("Nothing here matches");
  });

  it("starts clean every time it opens", async () => {
    render(<Harness />);
    let list = open();
    fireEvent.change(within(list).getByLabelText("Filter I want to look at"),
      { target: { value: "weig" } });
    fireEvent.keyDown(list, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    list = open();
    expect(within(list).getAllByRole("option")).toHaveLength(OPTIONS.length);
  });
});

describe("the keyboard", () => {
  it("moves through the options and chooses with Enter", async () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    const list = open();
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(onPick).toHaveBeenCalledWith("sleepq");
  });

  it("jumps to the ends, and closes on Escape without choosing", async () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    const list = open();
    fireEvent.keyDown(list, { key: "End" });
    fireEvent.keyDown(list, { key: "Home" });
    fireEvent.keyDown(list, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(onPick).not.toHaveBeenCalled();
    // Focus goes back to what opened the sheet, not to the top of the page.
    expect(document.activeElement).toBe(trigger());
  });
});
