/* Two promises about atmosphere.

   The first is that a new journal arrives with its sound and its moving
   background switched on — an off-by-default delight is one almost nobody
   sees. The second is that turning those on for *new* installs must not reach
   back and turn them on for someone who has been logging in silence for a
   year. Those pull in opposite directions, and this is where that seam is
   pinned down.

   The sound engine gets its own pass: it has no visible output, so the things
   worth asserting are that it never repeats itself and never throws — a save
   must survive a device with no audio. */

import { describe, it, expect, beforeEach, vi } from "vitest";

async function internals() {
  const { __internals } = await import("../src/App");
  return __internals as any;
}

describe("what a new journal arrives with", () => {
  it("has sound and the ambient backdrop already on", async () => {
    const I = await internals();
    const p = I.blankProfile();
    expect(p.prefs.sound).toBe(true);
    expect(p.prefs.backdrop).toBe(true);
    expect(p.prefs.haptics).toBe(true);
  });

  it("marks them as the new defaults, so a later change can tell them apart", async () => {
    const I = await internals();
    expect(I.blankProfile().prefs.prefsVersion).toBe(2);
  });

  it("keeps the demo journal consistent with a real new one", async () => {
    const I = await internals();
    expect(I.genSampleData().profile.prefs.sound).toBe(true);
    expect(I.genSampleData().profile.prefs.backdrop).toBe(true);
  });
});

describe("what an existing journal keeps", () => {
  const migrate = async (profile: any) => {
    const I = await internals();
    return I.migrateDb({ profile, entries: [], reports: [] }).profile.prefs;
  };

  it("leaves a journal that switched sound off switched off", async () => {
    const prefs = await migrate({ id: "p_self", prefs: { sound: false, haptics: true, backdrop: false, prefsVersion: 2 } });
    expect(prefs.sound).toBe(false);
    expect(prefs.backdrop).toBe(false);
  });

  it("leaves a journal that switched sound on alone too", async () => {
    const prefs = await migrate({ id: "p_self", prefs: { sound: true, haptics: false, backdrop: true, prefsVersion: 2 } });
    expect(prefs.sound).toBe(true);
    expect(prefs.haptics).toBe(false);
  });

  it("does not switch on an install that predates the prefs object", async () => {
    // This journal ran silent with a still background. That was the app's
    // behaviour, not an unset field, so it is what it keeps.
    const prefs = await migrate({ id: "p_self" });
    expect(prefs.sound).toBe(false);
    expect(prefs.backdrop).toBe(false);
    expect(prefs.haptics).toBe(true);
  });

  it("does not switch on a journal that predates the backdrop switch", async () => {
    const prefs = await migrate({ id: "p_self", prefs: { sound: false, haptics: true } });
    expect(prefs.backdrop).toBe(false);
    expect(prefs.sound).toBe(false);
  });

  it("fills in a missing key on a new-defaults journal from the new defaults", async () => {
    const prefs = await migrate({ id: "p_self", prefs: { sound: true, haptics: true, prefsVersion: 2 } });
    expect(prefs.backdrop).toBe(true);
  });

  it("is idempotent — migrating twice changes nothing", async () => {
    const I = await internals();
    const once = I.migrateDb({ profile: { id: "p_self" }, entries: [], reports: [] });
    const twice = I.migrateDb(once);
    expect(twice.profile.prefs).toEqual(once.profile.prefs);
  });
});

describe("every question has a drawer to live in", () => {
  it("files every question in every pack under a known category", async () => {
    const I = await internals();
    const unfiled: string[] = [];
    for (const tpl of Object.values<any>(I.TEMPLATES)) {
      for (const f of tpl.fields) {
        const cat = I.categoryOf(f);
        expect(I.CATEGORY_ORDER).toContain(cat);
        // "other" is the safety net, not a destination — nothing should need it.
        if (cat === "other") unfiled.push(`${tpl.label}: ${f.k}`);
      }
    }
    expect(unfiled).toEqual([]);
  });

  it("gives every category a label and an icon to render", async () => {
    const I = await internals();
    for (const id of I.CATEGORY_ORDER) {
      expect(I.CATEGORY_META[id]?.label).toBeTruthy();
      expect(I.CATEGORY_META[id]?.icon).toBeTruthy();
    }
  });

  it("sends photos and custom questions to their own drawers whatever they ask about", async () => {
    const I = await internals();
    // A photo of a hand is filed under Photos, not under Symptoms.
    expect(I.categoryOf({ k: "left_hand_severity", type: "photo", sec: "Body areas" })).toBe("photos");
    expect(I.categoryOf({ k: "c_x", type: "scale", custom: true, sec: "Custom" })).toBe("custom");
  });
});

describe("the sound engine", () => {
  beforeEach(() => vi.resetModules());

  it("stays silent, and stays quiet about it, with no audio available", async () => {
    const AC = (globalThis as any).AudioContext;
    delete (globalThis as any).AudioContext;
    delete (globalThis as any).webkitAudioContext;
    const { setSoundEnabled, playSound } = await import("../src/lib/sound");
    setSoundEnabled(true);
    expect(() => playSound("save")).not.toThrow();
    if (AC) (globalThis as any).AudioContext = AC;
  });

  it("does nothing at all while sound is off", async () => {
    const ctor = vi.fn();
    (globalThis as any).AudioContext = ctor;
    const { setSoundEnabled, playSound } = await import("../src/lib/sound");
    setSoundEnabled(false);
    playSound("save");
    // Not even an AudioContext: an off switch should cost nothing.
    expect(ctor).not.toHaveBeenCalled();
    delete (globalThis as any).AudioContext;
  });

  it("has a voice for every action the app reports", async () => {
    const { __soundInternals } = await import("../src/lib/sound");
    for (const name of ["tap", "select", "save", "quickadd", "complete", "milestone",
      "nav", "expand", "toggleOn", "toggleOff", "skip", "reorder", "delete", "batch", "include"]) {
      expect(typeof (__soundInternals.VOICES as any)[name]).toBe("function");
    }
  });

  it("walks its scale instead of repeating one note", async () => {
    const { __soundInternals } = await import("../src/lib/sound");
    const drawn = Array.from({ length: 5 }, () => __soundInternals.nextNote());
    // A shuffled bag: five draws, five distinct pitches, no immediate repeat.
    expect(new Set(drawn).size).toBe(5);
  });
});
