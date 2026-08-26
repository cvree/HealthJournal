/* Indoor/outdoor inference: the four properties that make it safe to end
   somebody's afternoon with it.

   1. It does not act on one bad fix.
   2. When it does act, it names the moment they went in, not the moment it
      worked it out.
   3. Silence is never evidence of a roof.
   4. Nothing in it can reconstruct where anybody was. */
import { describe, it, expect } from "vitest";
import {
  ACCURACY_INDOOR, ACCURACY_OUTDOOR, INDOOR_SETTLE_MS, STALE_MS,
  elapse, emptyPresence, indoorCall, isFresh, observe, outdoorCall,
  presenceLine, sanitizePresence, scoreFix,
} from "../src/lib/presence";

const T0 = new Date(2026, 5, 21, 13, 0, 0).getTime();
const at = (mins: number) => T0 + mins * 60_000;

/** Walk a state through a run of fixes, one a minute, all the same accuracy. */
function walk(state = emptyPresence(), from: number, mins: number, accuracy: number, lux?: number) {
  let s = state;
  for (let i = 0; i <= mins; i += 1) {
    s = observe(s, { t: at(from + i), accuracy, lux: lux ?? null });
  }
  return s;
}

describe("scoreFix", () => {
  it("reads a satellite fix as open sky and a network fix as a roof", () => {
    expect(scoreFix({ t: T0, accuracy: 8 })).toBe(1);
    expect(scoreFix({ t: T0, accuracy: ACCURACY_OUTDOOR })).toBe(1);
    expect(scoreFix({ t: T0, accuracy: ACCURACY_INDOOR })).toBe(-1);
    expect(scoreFix({ t: T0, accuracy: 140 })).toBe(-1);
  });

  it("leaves the middle band undecided rather than picking a side", () => {
    const mid = scoreFix({ t: T0, accuracy: (ACCURACY_OUTDOOR + ACCURACY_INDOOR) / 2 });
    expect(Math.abs(mid)).toBeLessThan(0.2);
  });

  it("treats a missing accuracy as no evidence, not as bad evidence", () => {
    expect(scoreFix({ t: T0, accuracy: 0 })).toBe(0);
    expect(scoreFix({ t: T0, accuracy: Number.NaN })).toBe(0);
  });

  it("lets daylight overrule a bad fix, but never lets darkness end a walk", () => {
    /* A wide fix under 40,000 lux is somebody standing next to a building, not
       inside one. */
    expect(scoreFix({ t: T0, accuracy: 90, lux: 40000 })).toBe(1);
    /* Dusk outdoors reads dark, and must not be counted as a ceiling. */
    expect(scoreFix({ t: T0, accuracy: 9, lux: 12 })).toBe(1);
  });
});

describe("observe", () => {
  it("does not go indoors on one bad fix", () => {
    let s = walk(emptyPresence(), 0, 10, 9);
    expect(s.sky).toBe("outdoor");
    s = observe(s, { t: at(11), accuracy: 120 });
    expect(s.sky).toBe("outdoor");
  });

  it("goes indoors once the run has held for the settle period", () => {
    let s = walk(emptyPresence(), 0, 10, 9);
    s = walk(s, 11, INDOOR_SETTLE_MS / 60_000 + 1, 110);
    expect(s.sky).toBe("indoor");
  });

  it("dates the change to the first bad fix, not the moment it became sure", () => {
    let s = walk(emptyPresence(), 0, 10, 9);
    s = walk(s, 11, 8, 110);
    expect(s.sky).toBe("indoor");
    /* The first indoor-looking fix was at minute 11. The app only became sure
       at minute 17, and reporting 17 would silently steal six minutes off a
       session every single time. */
    expect(s.since).toBe(at(11));
  });

  it("re-opens when somebody steps back out", () => {
    let s = walk(emptyPresence(), 0, 5, 9);
    s = walk(s, 6, 8, 110);
    expect(s.sky).toBe("indoor");
    s = walk(s, 15, 4, 7);
    expect(s.sky).toBe("outdoor");
    expect(s.since).toBe(at(15));
  });

  it("lets an ambiguous fix pass without breaking the run it lands in", () => {
    let s = walk(emptyPresence(), 0, 4, 110);
    const before = s.pendingSince;
    s = observe(s, { t: at(5), accuracy: (ACCURACY_OUTDOOR + ACCURACY_INDOOR) / 2 });
    expect(s.pendingSince).toBe(before);
    expect(s.pending).toBe("indoor");
  });

  it("ignores a fix that arrives out of order", () => {
    let s = walk(emptyPresence(), 0, 5, 9);
    const snapshot = s;
    s = observe(s, { t: at(1), accuracy: 200 });
    expect(s).toBe(snapshot);
  });
});

describe("staleness", () => {
  it("becomes unknown when the fixes dry up, rather than assuming a roof", () => {
    let s = walk(emptyPresence(), 0, 10, 9);
    expect(s.sky).toBe("outdoor");
    s = elapse(s, at(10) + STALE_MS + 60_000);
    expect(s.sky).toBe("unknown");
    expect(isFresh(s, at(10) + STALE_MS + 60_000)).toBe(false);
  });

  it("refuses to call somebody indoors on stale evidence", () => {
    let s = walk(emptyPresence(), 0, 10, 9);
    s = walk(s, 11, 8, 110);
    expect(indoorCall(s, at(19))).not.toBeNull();
    /* Same state, an hour later, with nothing new heard from the phone. */
    expect(indoorCall(s, at(19) + STALE_MS + 60_000)).toBeNull();
  });
});

describe("indoorCall", () => {
  it("says nothing until the run has actually matured", () => {
    let s = walk(emptyPresence(), 0, 5, 9);
    s = walk(s, 6, 2, 110);
    expect(indoorCall(s, at(8))).toBeNull();
  });

  it("reports the moment, the confidence and how long it took to be sure", () => {
    let s = walk(emptyPresence(), 0, 5, 9);
    s = walk(s, 6, 8, 130);
    const call = indoorCall(s, at(14))!;
    expect(call).not.toBeNull();
    expect(call.at).toBe(at(6));
    expect(call.confidence).toBeGreaterThan(0.5);
    expect(call.settledAfterMinutes).toBe(8);
  });

  it("holds back while a run the other way is contesting it", () => {
    let s = walk(emptyPresence(), 0, 5, 9);
    s = walk(s, 6, 8, 130);
    const settled = indoorCall(s, at(14))!.confidence;
    /* One good fix starts an outdoor run. The indoor answer has not lost yet,
       but the app should be visibly less sure while the two disagree. */
    s = observe(s, { t: at(15), accuracy: 7 });
    const contested = s.confidence;
    expect(contested).toBeLessThan(settled);
  });

  it("has a mirror for going out, and it is just as cautious", () => {
    const s = walk(emptyPresence(), 0, 4, 8);
    const call = outdoorCall(s, at(4));
    expect(call?.at).toBe(at(0));
    expect(outdoorCall(walk(emptyPresence(), 0, 0, 8), at(0))).toBeNull();
  });
});

describe("presenceLine", () => {
  it("has a sentence for every state it can be in", () => {
    expect(presenceLine(emptyPresence(), T0)).toMatch(/watching/i);
    const out = walk(emptyPresence(), 0, 5, 9);
    expect(presenceLine(out, at(5))).toMatch(/still out/i);
    const inside = walk(out, 6, 8, 130);
    expect(presenceLine(inside, at(14))).toMatch(/headed in/i);
    expect(presenceLine(out, at(5) + STALE_MS + 60_000)).toMatch(/finish this one yourself/i);
  });
});

describe("what it keeps", () => {
  it("holds no coordinate of any kind, at any point in a session", () => {
    let s = walk(emptyPresence(), 0, 30, 9);
    s = walk(s, 31, 20, 140);
    const dumped = JSON.stringify(s);
    /* The model is handed accuracy and time and nothing else, so there is
       nothing in here that could place anybody. This test is the enforcement
       of the promise in the module header — if a latitude ever gets threaded
       through for convenience, it fails. */
    expect(dumped).not.toMatch(/lat|lon|coord/i);
    expect(Object.keys(s).sort()).toEqual(
      ["confidence", "fixes", "lastFixAt", "pending", "pendingSince", "recent", "since", "sky"]
    );
  });

  it("bounds what it stores, so a long session cannot grow unboundedly", () => {
    const s = walk(emptyPresence(), 0, 400, 9);
    expect(s.recent.length).toBeLessThanOrEqual(60);
  });
});

describe("sanitizePresence", () => {
  it("round-trips a real state", () => {
    let s = walk(emptyPresence(), 0, 5, 9);
    s = walk(s, 6, 8, 130);
    expect(sanitizePresence(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it("repairs anything a hand-edited store could contain", () => {
    const s = sanitizePresence({
      sky: "underwater", since: -4, pending: null, pendingSince: "soon",
      lastFixAt: 1e12, confidence: 99, recent: ["x", 4, -9, 0.5], fixes: -3,
    });
    expect(s.sky).toBe("unknown");
    expect(s.since).toBeNull();
    expect(s.confidence).toBe(1);
    expect(s.recent).toEqual([1, -1, 0.5]);
    expect(s.fixes).toBe(0);
  });

  it("returns an empty state for junk rather than throwing", () => {
    expect(sanitizePresence(null)).toEqual(emptyPresence());
    expect(sanitizePresence("nope")).toEqual(emptyPresence());
  });
});
