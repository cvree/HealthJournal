/* The 1.21 systems, driven through the real app rather than mounted alone.

   That distinction is the whole point of this suite. The release's claim is
   that sun, weather, experiments, labs and the journal are one connected
   memory — so a test that renders `SunScreen` in isolation would pass happily
   while the thing that actually matters (a session reaching the journal, a
   finding lighting days up on another screen) was broken.

   Everything here therefore starts at the dashboard of a real journal and
   navigates the way a person would. */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import App, { __internals as I } from "../src/App";
import { newExperiment } from "../src/lib/experiments";
import { newLabResult } from "../src/lib/labs";
import { manualSession } from "../src/lib/sun";

beforeAll(() => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = ((q: string) => ({
    matches: q.includes("reduce"), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  } as any)) as any;
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.confirm = () => true;
});

let kv: Map<string, string>;
const pad = (n: number) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const HERE = { lat: 51.51, lon: -0.13 };

/** A day of weather, shaped like what lib/context stores. */
const ctxDay = (date: string, over: Record<string, unknown> = {}) => ({
  date,
  coords: HERE,
  capturedAt: new Date().toISOString(),
  tempMax: 22,
  tempMin: 12,
  humidityMean: 55,
  pressureMean: 1012,
  weatherCode: 1,
  uvMax: 5.5,
  daylightMinutes: 800,
  source: "test",
  ...over,
});

async function mount(mutate?: (db: any) => void) {
  const db: any = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
  mutate?.(db);
  kv = new Map([["fhj_v1", JSON.stringify(db)]]);
  (window as any).storage = {
    async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
    async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
    async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
    async list() { return { keys: [...kv.keys()] }; },
  };
  render(<App />);
  /* The pulse scale is ten buttons, so this is deliberately findAll — waiting
     on a single one would be ambiguous by construction. */
  await screen.findAllByRole("button", { name: /out of 10/ }, { timeout: 10000 });
  return db;
}

const saved = () => JSON.parse(kv.get("fhj_v1")!);

/** Get to History, which is where the three new doors live. The nav is a row
    of buttons, not links — the app has no router. */
async function goHistory() {
  fireEvent.click(screen.getByRole("button", { name: "History" }));
  await screen.findByText(/on the record/);
}

beforeEach(() => cleanup());
afterEach(() => { vi.restoreAllMocks(); });

/* ---------- storage contract ---------- */

describe("the new collections survive a load", () => {
  it("repairs and keeps sun, labs, experiments and context on every migrate", () => {
    const db = I.migrateDb({
      profile: I.blankProfile(),
      entries: [],
      sun: "not an array",
      labs: [{ test: "vitamin_d", value: 31, unit: "ng/mL", date: "2026-03-01" }],
      experiments: [{ factor: "a", outcome: "b", lag: 99 }],
      context: [ctxDay("2026-03-01")],
    });
    expect(db.sun).toEqual([]);
    expect(db.labs.length).toBe(1);
    expect(db.experiments[0].lag).toBe(3);
    expect(db.context.length).toBe(1);
    expect(db.profile.context.enabled).toBe(false); // off until switched on
    expect(db.schemaVersion).toBe(I.SCHEMA_VERSION);
  });

  it("carries them into a full backup, but never the daily-context switch as a device decision", async () => {
    const db = I.migrateDb({
      profile: { ...I.blankProfile(), context: { enabled: true, location: "manual", place: HERE } },
      entries: [],
      sun: [manualSession({
        date: "2026-06-21", startISO: "2026-06-21T11:00:00Z", minutes: 30,
        coords: HERE, exposure: "arms", shade: "open", skin: 2,
      })],
      labs: [newLabResult({ test: "vitamin_d", value: 31, date: "2026-06-01" })],
      context: [ctxDay("2026-06-21")],
    });
    const backup = await I.buildFullBackup(db);
    expect(backup.sun.length).toBe(1);
    expect(backup.labs.length).toBe(1);
    expect(backup.context.length).toBe(1);
    /* The consent rides inside `profile` — it says what this journal may
       contain, which is a property of the journal and not of a device. */
    expect(backup.profile.context.enabled).toBe(true);
    const check = I.validateBackup(backup);
    expect(check.ok).toBe(true);
    expect(check.summary.sun).toBe(1);
    expect(check.summary.labs).toBe(1);
  });
});

/* ---------- daily context ---------- */

describe("daily context asks before it fetches", () => {
  it("makes no network request at all while it is off", async () => {
    const fetchSpy = vi.fn();
    (globalThis as any).fetch = fetchSpy;
    await mount();
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never asks the browser for a location while it is off", async () => {
    const getPos = vi.fn();
    (navigator as any).geolocation = { getCurrentPosition: getPos };
    await mount();
    await new Promise((r) => setTimeout(r, 50));
    expect(getPos).not.toHaveBeenCalled();
  });

  it("rounds a precise fix to about a kilometre before it is ever used", async () => {
    (navigator as any).geolocation = {
      getCurrentPosition: (ok: any) => ok({ coords: { latitude: 51.5073219, longitude: -0.1276474 } }),
    };
    const c = await I.currentCoords();
    expect(c).toEqual({ lat: 51.51, lon: -0.13 });
  });

  it("asks for a coarse fix rather than a high-accuracy one", async () => {
    let opts: any = null;
    (navigator as any).geolocation = {
      getCurrentPosition: (ok: any, _err: any, o: any) => { opts = o; ok({ coords: { latitude: 1, longitude: 2 } }); },
    };
    await I.currentCoords();
    expect(opts.enableHighAccuracy).toBe(false);
  });

  it("answers null rather than throwing when the browser has no geolocation", async () => {
    delete (navigator as any).geolocation;
    expect(await I.currentCoords()).toBeNull();
  });
});

/* ---------- the weather behind the days ---------- */

describe("context on the surfaces that draw days", () => {
  it("puts the weather behind Today once there is a record for today", async () => {
    await mount((db) => {
      db.profile.context = { enabled: true, location: "manual", place: HERE, units: "metric" };
      db.context = [ctxDay(today(), { tempMax: 29, humidityMean: 41 })];
    });
    expect(await screen.findByText("Around today")).toBeTruthy();
    expect(screen.getByText("29°C / 12°C")).toBeTruthy();
    expect(screen.getByText("41%")).toBeTruthy();
  });

  it("shows nothing at all when there is no context and nothing was logged outside", async () => {
    await mount();
    expect(screen.queryByText("Around today")).toBeNull();
  });

  it("prints temperatures in the units somebody chose", async () => {
    await mount((db) => {
      db.profile.context = { enabled: true, location: "manual", place: HERE, units: "imperial" };
      db.context = [ctxDay(today(), { tempMax: 30, tempMin: 20 })];
    });
    expect(await screen.findByText("86°F / 68°F")).toBeTruthy();
  });
});

/* ---------- sun ---------- */

describe("sun sessions", () => {
  const withSun = (db: any) => {
    db.profile.context = { enabled: true, location: "manual", place: HERE, units: "metric" };
    db.profile.sun = { skin: 2, exposure: "arms" };
    db.sun = [
      manualSession({
        date: today(), startISO: new Date().toISOString(), minutes: 35,
        coords: HERE, exposure: "arms", shade: "open", skin: 2,
      }),
    ];
  };

  it("shows today's time outside on Today, with the estimate labelled as one", async () => {
    await mount(withSun);
    expect(await screen.findByText("Around today")).toBeTruthy();
    expect(screen.getByText("35 min")).toBeTruthy();
    /* The line that must never be dropped: wherever an IU figure appears, so
       does the sentence saying it is not a measurement. */
    const iu = screen.queryAllByText(/not a measurement/);
    const totals = saved().sun.reduce((a: number, s: any) => a + s.iuHigh, 0);
    if (totals >= 100) expect(iu.length).toBeGreaterThan(0);
  });

  it("opens the sun screen and draws the day's own arc", async () => {
    await mount(withSun);
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /^Sun/ }));
    expect(await screen.findByText("Today's sun")).toBeTruthy();
    expect(screen.getByText("Vitamin D window")).toBeTruthy();
    /* The arc is drawn from real astronomy, so it carries a real description. */
    expect(
      screen.getByRole("img", { name: /The sun's path today|The sun does not/ })
    ).toBeTruthy();
  });

  it("runs a session and writes it to the journal, with its conditions snapshotted", async () => {
    await mount((db) => {
      db.profile.context = { enabled: true, location: "manual", place: HERE };
      db.profile.sun = { skin: 2, exposure: "arms" };
    });
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /^Sun/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Start sun session/ }));

    /* The live screen: a stopwatch, a dose, and the estimate as a range. */
    expect(await screen.findByRole("timer")).toBeTruthy();
    expect(screen.getByText("Estimated vitamin D")).toBeTruthy();
    expect(screen.getByText("Research-model estimate · not a measurement")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Finish$/ }));
    const sheet = await screen.findByRole("dialog", { name: /Finish sun session/ });
    fireEvent.click(within(sheet).getByRole("button", { name: /Arms & legs/ }));
    fireEvent.click(within(sheet).getByRole("button", { name: /Save session/ }));

    await waitFor(() => expect(saved().sun.length).toBe(1));
    const session = saved().sun[0];
    expect(session.date).toBe(today());
    expect(session.exposure).toBe("shorts"); // the correction made on the way out
    expect(session.skin).toBe(2); // snapshotted from the profile, not a reference
    expect(session.source).toBe("live");
  });

  it("lets a session be discarded without writing anything", async () => {
    await mount((db) => {
      db.profile.context = { enabled: true, location: "manual", place: HERE };
    });
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /^Sun/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Start sun session/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^Discard$/ }));
    await screen.findByText("Today's sun");
    expect(saved().sun || []).toEqual([]);
  });

  it("still records time outside with no location, and claims no UV for it", async () => {
    await mount();
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /^Sun/ }));
    /* The arc says it and the note under it says it — both are correct, and
       matching all of them is the honest assertion. */
    expect((await screen.findAllByText(/Turn on daily context/)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Start sun session/ }));
    expect(await screen.findByRole("timer")).toBeTruthy();
    expect(screen.getByText("No location")).toBeTruthy();
  });
});

/* ---------- labs ---------- */

describe("labs", () => {
  const withLabs = (db: any) => {
    db.labs = [
      newLabResult({ test: "vitamin_d", value: 24, date: daysAgo(180), unit: "ng/mL", refLow: 30, refHigh: 100 }),
      newLabResult({ test: "vitamin_d", value: 31, date: daysAgo(90), unit: "ng/mL", refLow: 30, refHigh: 100 }),
      newLabResult({ test: "vitamin_d", value: 38, date: daysAgo(7), unit: "ng/mL", refLow: 30, refHigh: 100 }),
    ];
  };

  it("lists what the journal holds, with the whole story in one line", async () => {
    await mount(withLabs);
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /Labs\s*1 tracked/ }));
    expect(await screen.findByText("24 → 31 → 38 ng/mL")).toBeTruthy();
  });

  it("opens a test and connects the latest value to the one before it", async () => {
    await mount(withLabs);
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /Labs\s*1 tracked/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Vitamin D/ }));
    expect(await screen.findByText("38 ng/mL")).toBeTruthy();
    expect(screen.getByText(/over 83 days/)).toBeTruthy();
    expect(screen.getByText(/Inside the range your lab printed/)).toBeTruthy();
  });

  it("judges only against the range the lab printed, never one of its own", async () => {
    await mount((db) => {
      db.labs = [newLabResult({ test: "vitamin_d", value: 12, date: daysAgo(7) })]; // no range given
    });
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /Labs/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Vitamin D/ }));
    expect(await screen.findByText("No reference range recorded")).toBeTruthy();
    expect(screen.queryByText(/Below the range/)).toBeNull();
  });

  it("adds a result and says what changed", async () => {
    await mount(withLabs);
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /Labs\s*1 tracked/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Add a result/ }));

    const sheet = await screen.findByRole("dialog", { name: /Add a measurement/ });
    fireEvent.click(within(sheet).getByRole("button", { name: "Ferritin" }));
    fireEvent.change(within(sheet).getByLabelText("Value"), { target: { value: "48" } });
    fireEvent.click(within(sheet).getByRole("button", { name: /Save result/ }));

    await waitFor(() => expect(saved().labs.length).toBe(4));
    const added = saved().labs.find((r: any) => r.test === "ferritin");
    expect(added.value).toBe(48);
    expect(added.kind).toBe("measurement");
    /* The prefilled range is the catalog's, and it is only saved because it
       was left there — the sheet says whose it is. */
    expect(added.refLow).toBe(15);
  });

  it("puts a measured vitamin D beside estimated sunlight without merging them", async () => {
    await mount((db) => {
      withLabs(db);
      db.sun = Array.from({ length: 12 }, (_, i) =>
        manualSession({
          date: daysAgo(10 + i), startISO: new Date().toISOString(), minutes: 40,
          coords: HERE, exposure: "shorts", shade: "open", skin: 2,
        })
      );
    });
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /Labs/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Vitamin D/ }));
    expect(await screen.findByText("Beside your sunlight")).toBeTruthy();
    expect(screen.getByText("Measured — blood level")).toBeTruthy();
    expect(screen.getByText("Estimated — sunlight production")).toBeTruthy();
    expect(screen.getByText(/never drawn on one axis/)).toBeTruthy();
  });

  it("shows what else was in the journal between two readings, without claiming it did anything", async () => {
    await mount((db) => {
      withLabs(db);
      db.routineItems = [{
        id: "r1", name: "Vitamin D3", kind: "supplement", dose: "2000 IU", times: [], daily: true,
        useCount: 1, createdAt: new Date(Date.now() - 60 * 86400000).toISOString(), updatedAt: "",
      }];
    });
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /Labs/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Vitamin D/ }));
    expect(await screen.findByText("What else was in your journal during this period")).toBeTruthy();
    expect(screen.getByText("Vitamin D3 started")).toBeTruthy();
    expect(screen.getByText(/memory aid, not an explanation/)).toBeTruthy();
  });
});

/* ---------- experiments ---------- */

describe("experiments", () => {
  /* A journal where water and the key metric move together, spread across
     months so the ladder can actually climb. */
  const paired = (db: any) => {
    const key = I.getProfileTemplate(db.profile).keyMetric;
    db.entries = Array.from({ length: 80 }, (_, i) => ({
      id: `e${i}`,
      date: daysAgo(i * 3),
      answers: { water: i % 2 === 0 ? 9 : 2, [key]: i % 2 === 0 ? 3 : 7 },
      quickLogCompleted: true,
      createdAt: "", updatedAt: "",
    }));
    db.profile.customQuestions = [
      ...(db.profile.customQuestions || []),
      { k: "water", label: "Water", type: "number", dir: "neutral", custom: true, unit: "glasses" },
    ];
    db.experiments = [newExperiment({ factor: "water", outcome: key, lag: 0, title: "Water × severity" })];
  };

  it("reaches a result and states it as an average of the person's own days", async () => {
    await mount(paired);
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /Experiments/ }));
    expect(await screen.findByText("Water × severity")).toBeTruthy();
    expect(screen.getByText(/has averaged/)).toBeTruthy();
    expect(screen.getByText(/points lower/)).toBeTruthy();
  });

  it("shows its working on request, with the standing limitations attached", async () => {
    await mount(paired);
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /Experiments/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Show the working/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Why am I seeing this\?/ }));
    expect(await screen.findByText("Usable observations")).toBeTruthy();
    expect(screen.getByText("Lag used")).toBeTruthy();
    expect(screen.getByText(/no control group and nothing is randomised/)).toBeTruthy();
  });

  it("says nothing while it is still collecting", async () => {
    await mount((db) => {
      const key = I.getProfileTemplate(db.profile).keyMetric;
      db.entries = db.entries.slice(0, 4);
      db.experiments = [newExperiment({ factor: key, outcome: key === "mood" ? "energy" : "mood", title: "Too early" })];
    });
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /Experiments/ }));
    expect(await screen.findByText("Too early")).toBeTruthy();
    expect(screen.queryByText(/has averaged/)).toBeNull();
  });

  it("builds one by hand and starts it collecting", async () => {
    await mount(paired);
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /Experiments/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Ask a question/ }));

    const sheet = await screen.findByRole("dialog", { name: /Build an experiment/ });
    fireEvent.click(within(sheet).getByRole("button", { name: /Start collecting/ }));
    await waitFor(() => expect(saved().experiments.length).toBe(2));
    expect(saved().experiments[1].source).toBe("user");
  });

  it("pins an experiment to Today, where it appears as a status", async () => {
    await mount((db) => {
      paired(db);
      db.experiments[0].pinned = true;
    });
    expect(await screen.findByText("Running")).toBeTruthy();
    expect(screen.getByText("Water × severity")).toBeTruthy();
  });
});

/* ---------- the cross-feature promise ---------- */

describe("tapping a finding lights its days up everywhere", () => {
  const hotJournal = (db: any) => {
    const key = I.getProfileTemplate(db.profile).keyMetric;
    db.profile.context = { enabled: true, location: "manual", place: HERE, units: "metric" };
    db.entries = Array.from({ length: 60 }, (_, i) => ({
      id: `e${i}`,
      date: daysAgo(i * 2),
      answers: { [key]: i % 2 === 0 ? 9 : 2 },
      quickLogCompleted: true,
      createdAt: "", updatedAt: "",
    }));
    db.context = db.entries.map((e: any, i: number) =>
      ctxDay(e.date, { tempMax: i % 2 === 0 ? 31 : 15 })
    );
  };

  it("offers the coincidence on Insights as a count of the person's own days", async () => {
    await mount(hotJournal);
    fireEvent.click(await screen.findByRole("button", { name: /Insights|How have you been/i }));
    expect(await screen.findByText("What the weather was doing", {}, { timeout: 8000 })).toBeTruthy();
    /* Up to three coincidences are offered, so this is deliberately findAll. */
    expect((await screen.findAllByText(/of your \d+ hardest days/)).length).toBeGreaterThan(0);
  });

  it("lands on the days themselves when the coincidence is tapped", async () => {
    await mount(hotJournal);
    fireEvent.click(await screen.findByRole("button", { name: /Insights|How have you been/i }));
    const [headline] = await screen.findAllByText(/of your \d+ hardest days/, {}, { timeout: 8000 });
    fireEvent.click(headline.closest("button") as Element);

    /* History, showing exactly the lit days rather than the last fortnight. */
    expect(await screen.findByText("Lit days")).toBeTruthy();
    const bar = screen.getByRole("status", { name: "Illuminated days" });
    expect(within(bar).getByText(/days lit/)).toBeTruthy();

    fireEvent.click(within(bar).getByRole("button", { name: /Clear/ }));
    expect(await screen.findByText("Recent days")).toBeTruthy();
  });

  it("lights the same days up from an experiment's own result", async () => {
    await mount((db) => {
      const key = I.getProfileTemplate(db.profile).keyMetric;
      db.entries = Array.from({ length: 80 }, (_, i) => ({
        id: `e${i}`, date: daysAgo(i * 3),
        answers: { water: i % 2 === 0 ? 9 : 2, [key]: i % 2 === 0 ? 3 : 7 },
        quickLogCompleted: true, createdAt: "", updatedAt: "",
      }));
      db.profile.customQuestions = [
        ...(db.profile.customQuestions || []),
        { k: "water", label: "Water", type: "number", dir: "neutral", custom: true },
      ];
      db.experiments = [newExperiment({ factor: "water", outcome: key, title: "Water × severity" })];
    });
    await goHistory();
    fireEvent.click(await screen.findByRole("button", { name: /Experiments/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Light these days up/ }));
    expect(await screen.findByText("Lit days")).toBeTruthy();
  });
});

/* ---------- settings ---------- */

describe("the permission screens say what they do", () => {
  it("states what is sent, what is stored and what is not", async () => {
    await mount();
    fireEvent.click(await screen.findByRole("button", { name: /^settings$/i }));
    expect(await screen.findByText("Daily context")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /What is sent, and what is kept/ }));
    expect(await screen.findByText(/rounded to two/)).toBeTruthy();
    expect(screen.getByText(/not of where you were/)).toBeTruthy();
  });

  it("switches daily context on and off, and the switch is what the journal stores", async () => {
    await mount();
    fireEvent.click(await screen.findByRole("button", { name: /^settings$/i }));
    const row = await screen.findByText("Attach daily context");
    fireEvent.click(row.closest("button, [role='switch'], div")!.querySelector("button") || row.closest("button")!);
    await waitFor(() => expect(saved().profile.context.enabled).toBe(true));
  });

  it("asks about skin in the person's own words, not in roman numerals", async () => {
    await mount();
    fireEvent.click(await screen.findByRole("button", { name: /^settings$/i }));
    expect(await screen.findByText("Sun & skin")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Burns easily, tans a little/ })).toBeTruthy();
    expect(screen.queryByText(/Type II/)).toBeNull();
  });

  it("saves a skin type onto the profile, where a session will snapshot it", async () => {
    await mount();
    fireEvent.click(await screen.findByRole("button", { name: /^settings$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Rarely burns, tans easily/ }));
    await waitFor(() => expect(saved().profile.sun.skin).toBe(4));
  });
});

describe("a flare lights its own period up", () => {
  it("offers the whole stretch, and lands on it", async () => {
    await mount((db) => {
      const key = I.getProfileTemplate(db.profile).keyMetric;
      db.profile.context = { enabled: true, location: "manual", place: HERE, units: "metric" };
      db.episodes = [{
        id: "ep1", title: "Bad fortnight", metric: key,
        start: daysAgo(20), end: daysAgo(6),
        createdAt: "", updatedAt: "",
      }];
      db.entries = Array.from({ length: 40 }, (_, i) => ({
        id: `e${i}`, date: daysAgo(i), answers: { [key]: 5 },
        quickLogCompleted: true, createdAt: "", updatedAt: "",
      }));
      db.context = db.entries.map((e: any) => ctxDay(e.date));
    });

    fireEvent.click(await screen.findByRole("button", { name: /Insights|How have you been/i }));
    fireEvent.click(await screen.findByText("Bad fortnight", {}, { timeout: 8000 }));
    const light = await screen.findByRole("button", { name: /Light these 15 days up/ });
    fireEvent.click(light);

    expect(await screen.findByText("Lit days")).toBeTruthy();
    const bar = screen.getByRole("status", { name: "Illuminated days" });
    expect(within(bar).getByText(/15 days lit/)).toBeTruthy();
  });
});

describe("the privacy card tracks what is actually switched on", () => {
  it("promises no network at all while everything is off", async () => {
    await mount();
    fireEvent.click(await screen.findByRole("button", { name: /^settings$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Read the rest/ }));
    expect(await screen.findByText("No network")).toBeTruthy();
    expect(screen.queryByText("Weather, not whereabouts")).toBeNull();
  });

  it("rewrites its own promise once daily context is on, rather than leaving a stale one", async () => {
    await mount((db) => {
      db.profile.context = { enabled: true, location: "manual", place: HERE, units: "metric" };
    });
    fireEvent.click(await screen.findByRole("button", { name: /^settings$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Read the rest/ }));
    expect(await screen.findByText("Weather, not whereabouts")).toBeTruthy();
    expect(screen.getByText(/rounded to about a kilometre/)).toBeTruthy();
    expect(screen.queryByText("No network")).toBeNull();
  });
});
