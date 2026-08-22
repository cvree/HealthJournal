/* The arithmetic behind holding a button and putting it somewhere else.

   The gesture itself is DOM work and is tested through the dashboard; what is
   pinned here is everything that decides *where a button ends up*, because
   those are the failures a person would have to undo by hand: a tile that
   lands one slot off, a row that jitters between two arrangements under a
   stationary thumb, and — the only unforgivable one — a rearrangement that
   loses a button nobody could see. */
import { describe, it, expect } from "vitest";
import {
  moveItem, slotAt, shiftOffsets, applyVisibleOrder, describeMove,
} from "../src/lib/dragOrder";

/** A two-across grid of 150×88 tiles with a 10px gutter — the phone case. */
const grid = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    left: (i % 2) * 160, top: Math.floor(i / 2) * 98, width: 150, height: 88,
  }));
const centre = (i: number) => ({ x: (i % 2) * 160 + 75, y: Math.floor(i / 2) * 98 + 44 });

describe("moving one item", () => {
  it("takes it out and puts it back where it was dropped", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
  });

  it("never loses an item to an impossible drop", () => {
    // A drag that ends somewhere out of range is a no-op, not a deletion —
    // this is the one failure here that would cost somebody a button.
    expect(moveItem(["a", "b", "c"], 0, 9)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], -1, 1)).toEqual(["a", "b", "c"]);
    expect(moveItem([], 0, 0)).toEqual([]);
  });
});

describe("which slot a thumb is over", () => {
  const rects = grid(6);

  it("is the one it is nearest, across rows as well as columns", () => {
    const c = centre(3);
    expect(slotAt(rects, c.x, c.y, 0)).toBe(3);
    const d = centre(4);
    expect(slotAt(rects, d.x, d.y, 0)).toBe(4);
  });

  it("holds its answer when a thumb sits on the boundary", () => {
    // Exactly between slot 0 and slot 1: whichever one is held stays held,
    // rather than the row flickering between two arrangements.
    const x = 155, y = 44;
    expect(slotAt(rects, x, y, 0)).toBe(0);
    expect(slotAt(rects, x, y, 1)).toBe(1);
  });

  it("still moves once the thumb is properly over the next one", () => {
    const c = centre(1);
    expect(slotAt(rects, c.x, c.y, 0)).toBe(1);
  });

  it("has nowhere to go with nothing measured", () => {
    expect(slotAt([], 10, 10, 2)).toBe(2);
  });
});

describe("where the other tiles go", () => {
  const rects = grid(6);

  it("shifts each one by exactly one slot, and the wrap is a real diagonal", () => {
    const out = shiftOffsets(rects, 0, 2);
    // The lifted tile is following a finger and is not offset by this.
    expect(out[0]).toEqual({ dx: 0, dy: 0 });
    // The tile beside it slides into the vacated corner...
    expect(out[1]).toEqual({ dx: -160, dy: 0 });
    // ...and the one below wraps up to the end of the row above: left-to-right
    // and a row up, travelled as one diagonal rather than as two jumps.
    expect(out[2]).toEqual({ dx: 160, dy: -98 });
    // Nothing past the drop point moves at all.
    expect(out[3]).toEqual({ dx: 0, dy: 0 });
    expect(out[5]).toEqual({ dx: 0, dy: 0 });
  });

  it("moves the ones in between the other way when a tile travels up", () => {
    const out = shiftOffsets(rects, 4, 1);
    expect(out[4]).toEqual({ dx: 0, dy: 0 });
    expect(out[1]).toEqual({ dx: -160, dy: 98 });
    expect(out[3]).toEqual({ dx: -160, dy: 98 });
    expect(out[2]).toEqual({ dx: 160, dy: 0 });
    expect(out[0]).toEqual({ dx: 0, dy: 0 });
  });

  it("leaves everything alone when a tile is dropped where it started", () => {
    expect(shiftOffsets(rects, 2, 2).every((o) => !o.dx && !o.dy)).toBe(true);
  });
});

describe("folding a rearranged screen back into the saved list", () => {
  it("writes the visible buttons into the slots the visible buttons had", () => {
    // "drink" is in the list but has no question behind it on this device, so
    // it was never on screen and was never dragged.
    const stored = ["checkin", "drink", "food", "photo"];
    const visible = ["food", "photo", "checkin"]; // dragged into this order
    expect(applyVisibleOrder(stored, visible)).toEqual(["food", "drink", "photo", "checkin"]);
  });

  it("keeps a hidden button rather than deleting it by rearrangement", () => {
    const out = applyVisibleOrder(["a", "hidden", "b"], ["b", "a"]);
    expect(out).toContain("hidden");
    expect(out.length).toBe(3);
  });

  it("takes the screen's word for it when there is no list yet", () => {
    expect(applyVisibleOrder(undefined, ["a", "b"])).toEqual(["a", "b"]);
    expect(applyVisibleOrder([], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("appends anything the list had never heard of", () => {
    expect(applyVisibleOrder(["a"], ["a", "new"])).toEqual(["a", "new"]);
  });
});

describe("what a screen reader hears", () => {
  it("says the position, counting from one", () => {
    expect(describeMove("Food", 0, 6)).toBe("Food moved to position 1 of 6");
    expect(describeMove("Photo", 5, 6)).toBe("Photo moved to position 6 of 6");
  });
});
