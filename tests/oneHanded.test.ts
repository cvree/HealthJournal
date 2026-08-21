/* The arithmetic behind the thumb layer.

   Every number in here describes something a hand does, so the tests are
   written as claims about hands rather than as assertions about functions:
   back goes where you came from, the fan reaches the corner, a tremor is not
   a swipe. */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ARC_FROM, ARC_ITEM_PX, ARC_MAX_RINGS, ARC_TO, BACK_COMPLETE, DESTINATIONS, HAND_STORAGE_KEY,
  ROOT, arcLayout, backProgress, canGoBack, destinationsFor, edgeDirection, edgeStart,
  fanLayout, fanRadii, fanSeen, isHand, markFanSeen, navBack, navGo, navParent, navTop,
  onSystemBack, otherHand, pickArcTarget, readHand, reachDrop, ringCapacity, ringPlan,
  ringsNeeded, screenLabel, setHand, shouldCompleteBack,
} from "../src/lib/oneHanded";

describe("the stack knows where you came from", () => {
  it("starts at Today and stays there", () => {
    expect(navTop([])).toBe(ROOT);
    expect(canGoBack([ROOT])).toBe(false);
    expect(navParent([ROOT])).toBeNull();
    expect(navBack([ROOT])).toEqual([ROOT]);
  });

  it("returns you to the screen you opened a thing from, not to Today", () => {
    // The bug this replaced: History → Sun → back landed on Today.
    let s = navGo([ROOT], "history");
    s = navGo(s, "sun");
    expect(navParent(s)).toBe("history");
    expect(navTop(navBack(s))).toBe("history");
  });

  it("keeps Today underneath the other root, so back is never a dead end", () => {
    const s = navGo([ROOT], "history");
    expect(s).toEqual([ROOT, "history"]);
    expect(navBack(s)).toEqual([ROOT]);
  });

  it("resets to one deep at Today, however far in you were", () => {
    const s = navGo(navGo(navGo([ROOT], "history"), "export"), "pack");
    expect(s.length).toBe(4);
    expect(navGo(s, ROOT)).toEqual([ROOT]);
  });

  it("returns to a screen already on the stack instead of stacking it twice", () => {
    // Export → Pack → Export is a walk back out, not a third screen.
    let s = navGo([ROOT], "export");
    s = navGo(s, "pack");
    s = navGo(s, "export");
    expect(s).toEqual([ROOT, "export"]);
  });

  it("ignores a tap on the screen already showing", () => {
    const s = navGo([ROOT], "labs");
    expect(navGo(s, "labs")).toBe(s);
  });

  it("cannot grow without bound, and never loses the floor", () => {
    let s = [ROOT];
    for (let i = 0; i < 40; i++) s = navGo(s, `screen${i}`);
    expect(s.length).toBeLessThanOrEqual(12);
    expect(s[0]).toBe(ROOT);
    expect(navTop(s)).toBe("screen39");
  });

  it("names where back goes", () => {
    expect(screenLabel("history")).toBe("History");
    expect(screenLabel("pack")).toBe("Appointment pack");
    expect(screenLabel("nothing-like-this")).toBe("Back");
  });
});

describe("the fan reaches everything", () => {
  it("offers every screen somebody might navigate to", () => {
    const ids = DESTINATIONS.map((d) => d.id);
    for (const must of ["dashboard", "history", "insights", "food", "sun", "labs",
      "experiments", "gallery", "export", "settings", "log", "routine"]) {
      expect(ids).toContain(must);
    }
  });

  it("drops everything that writes when the journal is somebody else's", () => {
    const ids = destinationsFor({ viewer: true }).map((d) => d.id);
    // The read-only viewer bounces these back to the dashboard, so offering
    // them would be offering a door that closes in your face.
    expect(ids).not.toContain("log");
    expect(ids).not.toContain("settings");
    expect(ids).not.toContain("routine");
    expect(ids).toContain("insights");
  });

  it("can leave a destination out without disturbing the order", () => {
    const ids = destinationsFor({ exclude: ["labs"] }).map((d) => d.id);
    expect(ids).not.toContain("labs");
    expect(ids.length).toBe(DESTINATIONS.length - 1);
  });

  it("gives every item a line to say what it is", () => {
    for (const d of DESTINATIONS) {
      expect(d.hint.length).toBeGreaterThan(4);
      expect(d.label.length).toBeGreaterThan(2);
    }
  });
});

describe("the arc is where a thumb is", () => {
  const radii = [160, 240];
  const PHONE = { width: 390, height: 844 };

  it("puts every item above the pivot and inboard of it", () => {
    for (const p of fanLayout(9, { hand: "right", ...PHONE })) {
      expect(p.y).toBeLessThan(0);        // above the corner
      expect(p.x).toBeLessThanOrEqual(0); // and towards the middle of the phone
    }
  });

  it("mirrors exactly for a left hand", () => {
    const r = fanLayout(9, { hand: "right", ...PHONE });
    const l = fanLayout(9, { hand: "left", ...PHONE });
    r.forEach((p, i) => {
      expect(l[i].x).toBeCloseTo(-p.x, 6);
      expect(l[i].y).toBeCloseTo(p.y, 6);
    });
  });

  it("keeps the sweep inside the arc a thumb actually makes", () => {
    for (const p of fanLayout(12, { hand: "right", ...PHONE })) {
      expect(p.angle).toBeGreaterThanOrEqual(ARC_FROM);
      expect(p.angle).toBeLessThanOrEqual(ARC_TO);
    }
  });

  it("keeps the whole fan on the screen it was measured for", () => {
    for (const size of [{ width: 320, height: 568 }, PHONE, { width: 1024, height: 1366 }]) {
      for (const p of fanLayout(12, { hand: "right", ...size })) {
        // The pivot sits ~42px in from the held edge and ~50px up from the
        // bottom; an item is ~52px across. Nothing may fall off either side.
        expect(Math.abs(p.x)).toBeLessThan(size.width - 84);
        expect(Math.abs(p.y)).toBeLessThan(size.height - 100);
      }
    }
  });

  it("asks each ring how much it can hold rather than assuming a number", () => {
    expect(ringCapacity(240, ARC_ITEM_PX)).toBeGreaterThan(ringCapacity(120, ARC_ITEM_PX));
    // A ring too small for two items is still allowed two: the plan will have
    // reached for a bigger radius long before that matters.
    expect(ringCapacity(10, ARC_ITEM_PX)).toBe(2);
  });

  it("uses one ring when one will do, and never more than three", () => {
    expect(ringsNeeded(3, 390, 844)).toBe(1);
    expect(ringsNeeded(12, 390, 844)).toBeGreaterThan(1);
    expect(ringsNeeded(400, 390, 844)).toBe(ARC_MAX_RINGS);
  });

  it("shares the items out in proportion, so the spacing matches across rings", () => {
    const plan = ringPlan(12, radii);
    expect(plan.reduce((a, b) => a + b, 0)).toBe(12);
    // The outer ring is longer, so it takes more of them — not two strays.
    expect(plan[1]).toBeGreaterThan(plan[0]);
    expect(Math.min(...plan)).toBeGreaterThan(1);
  });

  it("places every item it was given, even on a screen too small for them", () => {
    const tiny = fanLayout(12, { hand: "right", width: 280, height: 480 });
    expect(tiny.length).toBe(12);
    expect(new Set(tiny.map((p) => p.index)).size).toBe(12);
  });

  it("centres a single item rather than pinning it to one end", () => {
    const [only] = arcLayout([1], { hand: "right", radii: [160] });
    expect(only.angle).toBeCloseTo((ARC_FROM + ARC_TO) / 2, 5);
  });

  it("keeps a tablet's fan within a thumb's reach of the corner", () => {
    const big = fanRadii(1024, 1366, 2);
    expect(Math.max(...big)).toBeLessThanOrEqual(340);
  });

  it("picks what the thumb is nearest, and nothing when it is nowhere near", () => {
    const pts = fanLayout(6, { hand: "right", ...PHONE });
    expect(pickArcTarget(pts, pts[3].x + 6, pts[3].y - 5)).toBe(3);
    expect(pickArcTarget(pts, 0, 0)).toBe(-1);      // still on the pivot
    expect(pickArcTarget(pts, 900, -900)).toBe(-1); // off in the corner
  });

  it("never leaves two items fighting over the same patch of screen", () => {
    // Every item has to be far enough from every other that a thumb landing on
    // one is unambiguously on it. Under twice the disc radius they would
    // overlap on screen, whatever the hit-testing said.
    for (const size of [{ width: 320, height: 568 }, PHONE]) {
      const pts = fanLayout(12, { hand: "right", ...size });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)).toBeGreaterThan(46);
        }
      }
    }
  });

  it("answers with one item, never a tie, wherever the thumb lands", () => {
    const pts = fanLayout(12, { hand: "right", ...PHONE });
    for (const p of pts) {
      // Twenty pixels adrift in any direction still resolves to that item.
      for (const [dx, dy] of [[18, 0], [-18, 0], [0, 18], [0, -18]]) {
        expect(pickArcTarget(pts, p.x + dx, p.y + dy)).toBe(p.index);
      }
    }
  });
});

describe("the gestures", () => {
  it("treats the held edge and the far edge as edges, and the middle as not", () => {
    expect(edgeStart(390, 390, "right")).toBe(true);
    expect(edgeStart(2, 390, "right")).toBe(true);
    expect(edgeStart(195, 390, "right")).toBe(false);
    expect(edgeStart(195, 390, "left")).toBe(false);
  });

  it("peels the screen away from the edge the drag started on", () => {
    expect(edgeDirection(388, 390)).toBe(-1); // from the right, travelling left
    expect(edgeDirection(4, 390)).toBe(1);
  });

  it("reports progress the drag can be drawn from, clamped at both ends", () => {
    expect(backProgress(0, 390)).toBe(0);
    expect(backProgress(1000, 390)).toBe(1);
    expect(backProgress(390 * 0.31, 390)).toBeGreaterThan(0);
    expect(backProgress(390 * 0.31, 390)).toBeLessThan(1);
  });

  it("completes on distance, completes on a flick, and ignores a tremor", () => {
    const w = 390;
    expect(shouldCompleteBack(w * BACK_COMPLETE + 1, w, 400)).toBe(true);
    expect(shouldCompleteBack(60, w, 60)).toBe(true);   // short but fast
    expect(shouldCompleteBack(60, w, 900)).toBe(false); // short and slow
    expect(shouldCompleteBack(6, w, 8)).toBe(false);    // fast, but it never went anywhere
    expect(shouldCompleteBack(0, w, 0)).toBe(false);
  });

  it("brings a phone's header into reach without sliding a tablet in half", () => {
    expect(reachDrop(844)).toBeGreaterThan(240);
    expect(reachDrop(844)).toBeLessThanOrEqual(320);
    expect(reachDrop(1366)).toBe(320);
    expect(reachDrop(300)).toBe(120);
  });
});

describe("which hand, remembered", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-hand");
  });

  it("is right until somebody says otherwise", () => {
    expect(readHand()).toBe("right");
    expect(isHand("sideways")).toBe(false);
    expect(otherHand("right")).toBe("left");
  });

  it("remembers the choice and tells the stylesheet about it", () => {
    setHand("left");
    expect(readHand()).toBe("left");
    expect(localStorage.getItem(HAND_STORAGE_KEY)).toBe("left");
    expect(document.documentElement.getAttribute("data-hand")).toBe("left");
  });

  it("falls back rather than throwing when storage is off", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    expect(readHand()).toBe("right");
    expect(() => setHand("left")).not.toThrow();
    expect(document.documentElement.getAttribute("data-hand")).toBe("left");
    get.mockRestore();
    set.mockRestore();
  });

  it("says the fan hint once", () => {
    expect(fanSeen()).toBe(false);
    markFanSeen();
    expect(fanSeen()).toBe(true);
  });
});

describe("the phone's own back button", () => {
  it("is consumed while there is somewhere to go, and released when there is not", () => {
    let depth = 2;
    const stop = onSystemBack(() => { if (depth <= 1) return false; depth--; return true; });
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(depth).toBe(1);
    // At the floor it declines, which is what lets the phone leave the app.
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(depth).toBe(1);
    stop();
  });

  it("stops listening when it is taken down", () => {
    let hits = 0;
    const stop = onSystemBack(() => { hits++; return true; });
    stop();
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(hits).toBe(0);
  });
});
