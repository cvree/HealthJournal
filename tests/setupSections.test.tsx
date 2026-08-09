/* Two navigation problems, both about long lists.

   The question editor showed every question from every enabled pack in one
   flat run — routinely sixty rows, with the one you came to change somewhere
   in the middle. And reminders were a single time, which cannot express "log
   meals when you eat them, check in at night".

   These pin the fixes: sections that collapse, a filter that cuts across them,
   and a reminder list that can hold more than one row. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";

beforeEach(() => cleanup());

beforeAll(() => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: q.includes("reduce"), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  } as any));
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.confirm = () => true;
  // jsdom has no URL.createObjectURL, which the .ics download path uses.
  (URL as any).createObjectURL = vi.fn(() => "blob:mock");
  (URL as any).revokeObjectURL = vi.fn();
});

function mockStorage(initial: Record<string, string>) {
  const kv = new Map(Object.entries(initial));
  (window as any).storage = {
    async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
    async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
    async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
    async list(prefix?: string) { return { keys: [...kv.keys()].filter((k) => !prefix || k.startsWith(prefix)) }; },
  };
  return kv;
}

async function mountApp(patch: (db: any) => void = () => {}) {
  const { __internals: I, default: App } = await import("../src/App");
  const db = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  patch(db);
  const kv = mockStorage({ fhj_v1: JSON.stringify(db) });
  const utils = render(<App />);
  await screen.findByText(/Quick Add/);
  return { ...utils, kv };
}

const openSetup = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "edit survey setup" }));
  await screen.findByText("Questions");
};

/** Section headers are the buttons carrying an "N of M on" count. */
const sectionHeaders = () =>
  [...document.querySelectorAll("button[aria-expanded]")]
    .filter((b) => /\d+ of \d+ on/.test(b.textContent || "")) as HTMLElement[];

describe("questions are grouped, not one long run", () => {
  it("files questions under subject categories, not one flat list", async () => {
    await mountApp();
    await openSetup();
    const headers = sectionHeaders();
    expect(headers.length).toBeGreaterThan(1);
    const text = headers.map((h) => h.textContent);
    // Subject is the default grouping: a pack's questions get split across the
    // categories they actually belong to.
    for (const cat of ["Symptoms", "Sleep", "Food", "Photos"]) {
      expect(text).toEqual(expect.arrayContaining([expect.stringContaining(cat)]));
    }
    // Categories with nothing in them are not rendered at all.
    expect(text.some((t) => /Pain/.test(t || ""))).toBe(false);
  });

  it("still groups by pack for anyone who thinks that way", async () => {
    await mountApp();
    await openSetup();
    fireEvent.click(screen.getByRole("button", { name: "Pack" }));
    await waitFor(() =>
      expect(sectionHeaders().map((h) => h.textContent)).toEqual(
        expect.arrayContaining([expect.stringContaining("Eczema / Skin")])
      )
    );
  });

  it("shuts every drawer when the grouping changes", async () => {
    await mountApp();
    await openSetup();
    fireEvent.click(sectionHeaders()[0]);
    expect(sectionHeaders()[0].getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Pack" }));
    await waitFor(() => {
      for (const h of sectionHeaders()) expect(h.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("counts the questions in a category on its header", async () => {
    await mountApp();
    await openSetup();
    expect(sectionHeaders()[0].textContent).toMatch(/\d+ questions? · \d+ of \d+ on/);
  });

  it("starts collapsed, so the screen opens short", async () => {
    await mountApp();
    await openSetup();
    for (const h of sectionHeaders()) expect(h.getAttribute("aria-expanded")).toBe("false");
    // No per-question visibility pills are on screen while everything is shut.
    expect(screen.queryByRole("button", { name: /shown in dashboard/ })).toBeNull();
  });

  it("counts how many questions in a section are on", async () => {
    await mountApp();
    await openSetup();
    expect(sectionHeaders()[0].textContent).toMatch(/\d+ of \d+ on/);
  });

  it("opens one section without opening the rest", async () => {
    await mountApp();
    await openSetup();
    const [first, second] = sectionHeaders();
    fireEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(second.getAttribute("aria-expanded")).toBe("false");
  });

  it("expands and collapses everything at once", async () => {
    await mountApp();
    await openSetup();
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    for (const h of sectionHeaders()) expect(h.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    for (const h of sectionHeaders()) expect(h.getAttribute("aria-expanded")).toBe("false");
  });
});

/* The actual complaint was length, so this is the measurement of the fix: turn
   every pack on — about 120 questions, the worst configuration the app allows —
   and count what the screen is actually asked to render. */
describe("a maximal setup still opens short", () => {
  const allPacks = async () => {
    const { __internals: I } = await import("../src/App");
    await mountApp((db) => {
      db.profile.modules = Object.keys(I.TEMPLATES);
      db.profile.disabledFields = [];
    });
    await openSetup();
  };
  /* Question rows are the tall things; the switch inside each one is the
     cheapest way to count them without matching on the pack switches above. */
  const questionRows = () =>
    [...document.querySelectorAll('button[role="switch"][aria-checked]')]
      .filter((b) => b.querySelector("span > span"));

  it("renders no question rows at all until a category is opened", async () => {
    await allPacks();
    expect(sectionHeaders().length).toBeGreaterThan(8);
    expect(questionRows().length).toBe(0);
  });

  it("renders only the opened category, not the other hundred questions", async () => {
    await allPacks();
    const header = sectionHeaders()[0];
    const total = Number(/of (\d+) on/.exec(header.textContent || "")![1]);
    fireEvent.click(header);
    await waitFor(() => expect(questionRows().length).toBe(total));
    // The open drawer is a slice, not the list: even the largest category in
    // the largest possible setup is well under half of everything configured.
    const everything = Number(/(\d+) questions? ·/.exec(document.body.textContent || "")![1]);
    expect(total).toBeLessThan(everything / 2);
  });

  it("puts a searched question on screen without opening anything else", async () => {
    await allPacks();
    fireEvent.change(screen.getByLabelText("Filter questions"), { target: { value: "brain fog" } });
    await waitFor(() => expect(questionRows().length).toBe(1));
    expect(document.body.textContent).toContain("Brain fog");
  });

  it("lists a question shared by several packs exactly once", async () => {
    await allPacks();
    // Brain fog is in POTS, Fatigue, Thyroid and Autoimmune. The rest of the
    // app stores one answer for it, so the editor must offer one row.
    fireEvent.change(screen.getByLabelText("Filter questions"), { target: { value: "brain fog" } });
    await waitFor(() => expect(questionRows().length).toBe(1));
    // And it says so, because one row for four packs needs explaining.
    expect(document.body.textContent).toMatch(/shared by \d+ packs/);
  });
});

describe("finding one question among sixty", () => {
  it("filters to matching questions across every section", async () => {
    await mountApp();
    await openSetup();
    fireEvent.change(screen.getByLabelText("Filter questions"), { target: { value: "itch" } });
    await waitFor(() => expect(sectionHeaders().length).toBe(1));
    expect(document.body.textContent).toContain("Itch");
  });

  it("forces matching sections open, since a hit inside a shut drawer is useless", async () => {
    await mountApp();
    await openSetup();
    fireEvent.change(screen.getByLabelText("Filter questions"), { target: { value: "itch" } });
    await waitFor(() => expect(sectionHeaders()[0].getAttribute("aria-expanded")).toBe("true"));
  });

  it("says so when nothing matches, rather than showing an empty screen", async () => {
    await mountApp();
    await openSetup();
    fireEvent.change(screen.getByLabelText("Filter questions"), { target: { value: "zzzznope" } });
    expect(await screen.findByText(/No question matches/)).toBeTruthy();
  });

  it("restores every section when the filter is cleared", async () => {
    await mountApp();
    await openSetup();
    const before = sectionHeaders().length;
    const box = screen.getByLabelText("Filter questions");
    fireEvent.change(box, { target: { value: "itch" } });
    await waitFor(() => expect(sectionHeaders().length).toBe(1));
    fireEvent.change(box, { target: { value: "" } });
    await waitFor(() => expect(sectionHeaders().length).toBe(before));
  });
});

describe("per-question controls still work inside a section", () => {
  it("turns a question off and updates its section's count", async () => {
    await mountApp();
    await openSetup();
    const header = sectionHeaders()[0];
    const countBefore = Number(/(\d+) of/.exec(header.textContent || "")![1]);
    fireEvent.click(header);

    // Scoped to the section: the question-pack checkboxes higher up the screen
    // are role="switch" too, and an unscoped query turns off a whole pack.
    const section = header.parentElement as HTMLElement;
    const toggle = within(section).getAllByRole("switch", { checked: true })[0];
    fireEvent.click(toggle);
    await waitFor(() => {
      const after = Number(/(\d+) of/.exec(sectionHeaders()[0].textContent || "")![1]);
      expect(after).toBe(countBefore - 1);
    });
  });

  it("keeps the reorder arrows operating inside the open category", async () => {
    await mountApp();
    await openSetup();
    fireEvent.click(sectionHeaders()[0]);
    // The first question in the category can't move up; the last can't move down.
    const ups = screen.getAllByRole("button", { name: /move .* up/ });
    const downs = screen.getAllByRole("button", { name: /move .* down/ });
    expect(ups[0]).toHaveProperty("disabled", true);
    expect(downs[0]).toHaveProperty("disabled", false);
    expect(downs[downs.length - 1]).toHaveProperty("disabled", true);
  });

  it("reorders within a category rather than flinging a question out of it", async () => {
    await mountApp();
    await openSetup();
    const header = sectionHeaders()[0];
    fireEvent.click(header);
    const labels = () =>
      [...document.querySelectorAll('button[role="switch"][aria-checked]')]
        .map((b) => b.querySelector("span > span")?.textContent)
        .filter(Boolean);
    const before = labels();
    const second = before[1];
    fireEvent.click(screen.getAllByRole("button", { name: /move .* up/ })[1]);
    await waitFor(() => expect(labels()[0]).toBe(second));
    // Same category, same population — only the order moved.
    expect(new Set(labels())).toEqual(new Set(before));
  });
});

describe("more than one reminder", () => {
  const openSettings = async () => {
    fireEvent.click(await screen.findByRole("button", { name: "settings" }));
    await screen.findByText("Reminders");
  };

  it("starts with none rather than a default nobody asked for", async () => {
    await mountApp();
    await openSettings();
    expect(screen.getByText("No reminders yet.")).toBeTruthy();
  });

  it("adds several, and keeps them in clock order", async () => {
    await mountApp();
    await openSettings();
    for (const preset of ["Dinner", "Breakfast"]) {
      fireEvent.click(screen.getByRole("button", { name: /Add a reminder/ }));
      fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${preset}`) }));
    }
    await waitFor(() => {
      const labels = [...document.querySelectorAll('input[aria-label^="name for the"]')]
        .map((i) => (i as HTMLInputElement).value);
      expect(labels).toEqual(["Breakfast", "Dinner"]);
    });
  });

  it("renames and re-times a reminder in place", async () => {
    await mountApp();
    await openSettings();
    fireEvent.click(screen.getByRole("button", { name: /Add a reminder/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^Breakfast/ }));

    const name = await screen.findByLabelText(/name for the/);
    fireEvent.change(name, { target: { value: "First thing" } });
    await waitFor(() => expect(screen.getByLabelText(/^time for First thing$/)).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/^time for First thing$/), { target: { value: "07:15" } });
    await waitFor(() => expect((screen.getByLabelText(/^time for First thing$/) as HTMLInputElement).value).toBe("07:15"));
  });

  it("switches one off without deleting it", async () => {
    await mountApp();
    await openSettings();
    fireEvent.click(screen.getByRole("button", { name: /Add a reminder/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^Lunch/ }));

    const sw = await screen.findByRole("switch", { name: /Lunch reminder/ });
    expect(sw.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(sw);
    await waitFor(() => expect(screen.getByRole("switch", { name: /Lunch reminder/ }).getAttribute("aria-checked")).toBe("false"));
    // Still listed — off is not gone.
    expect(screen.getByLabelText(/name for the/)).toBeTruthy();
  });

  it("deletes one", async () => {
    await mountApp();
    await openSettings();
    fireEvent.click(screen.getByRole("button", { name: /Add a reminder/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^Lunch/ }));
    fireEvent.click(await screen.findByRole("button", { name: /delete Lunch reminder/ }));
    await waitFor(() => expect(screen.getByText("No reminders yet.")).toBeTruthy());
  });

  it("offers one calendar file covering all of them", async () => {
    await mountApp();
    await openSettings();
    for (const preset of ["Breakfast", "Dinner"]) {
      fireEvent.click(screen.getByRole("button", { name: /Add a reminder/ }));
      fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${preset}`) }));
    }
    expect(await screen.findByRole("button", { name: /Add 2 reminders to my calendar/ })).toBeTruthy();
  });

  it("survives a reload", async () => {
    const { kv, unmount } = await mountApp();
    await openSettings();
    fireEvent.click(screen.getByRole("button", { name: /Add a reminder/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^Breakfast/ }));
    await waitFor(() => expect(kv.get("fhj_v1")).toContain("Breakfast"));

    unmount();
    cleanup();
    const { default: App } = await import("../src/App");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "settings" }));
    await waitFor(() => expect(screen.getByLabelText(/name for the/)).toHaveProperty("value", "Breakfast"));
  });

  it("carries a pre-list install's single time into the list", async () => {
    await mountApp((db) => {
      db.profile.reminders = undefined;
      db.profile.reminder = { enabled: true, time: "21:45", notify: true };
    });
    await openSettings();
    await waitFor(() => expect((screen.getByLabelText(/^time for/) as HTMLInputElement).value).toBe("21:45"));
  });
});

describe("daily nutrition targets", () => {
  it("are blank until someone sets one", async () => {
    await mountApp();
    fireEvent.click(await screen.findByRole("button", { name: "settings" }));
    await screen.findByText("Daily nutrition targets");
    expect((screen.getByLabelText(/daily Calories target/) as HTMLInputElement).value).toBe("");
  });

  it("show up on the food diary once set", async () => {
    await mountApp();
    fireEvent.click(await screen.findByRole("button", { name: "settings" }));
    await screen.findByText("Daily nutrition targets");
    fireEvent.change(screen.getByLabelText(/daily Calories target/), { target: { value: "2000" } });

    fireEvent.click(within(document.querySelector("nav")!).getByRole("button", { name: "Food" }));
    await screen.findByRole("button", { name: "previous day" });
    expect(document.body.textContent).toContain("kcal left");
    expect(screen.queryByText("Set daily targets")).toBeNull();
  });
});
