/* Moving a button with a finger.

   Quick Add is the most-pressed control in this app, and where a button *is*
   matters more than what it is called: after a fortnight the hand knows that
   food is bottom-left and reaches for it without reading. That only works if
   the position holds still — which is why the learned ordering is now
   something somebody turns on rather than something that happens to them, and
   why arranging the row by hand had to stop being a trip to an editor.

   Hold a tile for a third of a second and it lifts. Drag it and the others
   move out of the way. Let go and it lands. All of the arithmetic that makes
   that feel like moving an object rather than editing a list lives here, pure
   and away from the DOM, because it is the part worth testing: the grid
   geometry, which slot a thumb is over, and how a rearranged row of six is
   folded back into a saved list that may hold buttons this device cannot show.

   Nothing in here touches React, the clock or the document. */

export interface SlotRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Offset {
  dx: number;
  dy: number;
}

/** The list with one item lifted out and put back down at `to`. Out-of-range
    indices return the list unchanged rather than dropping an item — a drag
    that ends somewhere impossible has to be a no-op, never a deletion. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (!Array.isArray(list)) return [];
  if (from === to) return [...list];
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const centerX = (r: SlotRect) => r.left + r.width / 2;
const centerY = (r: SlotRect) => r.top + r.height / 2;

/**
 * Which slot a thumb at (x, y) is over.
 *
 * Nearest centre, which is the one rule that works for a two-column grid, a
 * single column and a wrapped row alike — no assumption about how many tiles
 * sit per row, so the same code is right on a phone and on a wide window.
 *
 * The `stickiness` is the part that matters in the hand. Straight nearest-
 * centre flickers when a thumb sits exactly on a boundary, and a row of
 * buttons twitching between two arrangements is the opposite of the calm this
 * gesture is supposed to have. A slot has to be meaningfully closer than the
 * one already held before the arrangement changes — meaningfully being a
 * fraction of the tile itself, so it scales with the layout rather than being
 * a pixel count that is right on one device.
 */
export function slotAt(
  rects: SlotRect[], x: number, y: number, current: number, stickiness = 0.18
): number {
  if (!rects.length) return current;
  const d2 = rects.map((r) => {
    const ddx = x - centerX(r);
    const ddy = y - centerY(r);
    return Math.sqrt(ddx * ddx + ddy * ddy);
  });
  let best = 0;
  for (let i = 1; i < d2.length; i++) if (d2[i] < d2[best]) best = i;
  if (best === current) return current;
  const held = current >= 0 && current < d2.length ? d2[current] : Infinity;
  const r = rects[best];
  const margin = stickiness * Math.min(r.width, r.height);
  return d2[best] + margin < held ? best : current;
}

/**
 * Where every tile should be drawn while one of them is in the air.
 *
 * The slots stay where they are — a grid is a grid — and the tiles move
 * between them, so each one's offset is simply the gap between the slot it
 * started in and the slot it now occupies. Which is why this reads correctly
 * when a tile wraps from the end of one row to the start of the next: the
 * offset it gets is a real diagonal, and it travels along it.
 *
 * The lifted tile is following a thumb and gets no offset of its own.
 */
export function shiftOffsets(rects: SlotRect[], from: number, to: number): Offset[] {
  const zero = rects.map(() => ({ dx: 0, dy: 0 }));
  if (from === to || from < 0 || to < 0 || from >= rects.length || to >= rects.length) return zero;
  const arranged = moveItem(rects.map((_, i) => i), from, to);
  const out = zero;
  arranged.forEach((original, slot) => {
    if (original === from) return;
    out[original] = {
      dx: rects[slot].left - rects[original].left,
      dy: rects[slot].top - rects[original].top,
    };
  });
  return out;
}

/**
 * Fold a rearranged screen back into the saved list.
 *
 * What somebody drags is what their setup can actually show. What is stored
 * may hold more than that — a camera button in a journal whose photo question
 * is switched off is kept, not deleted, because switching the question back on
 * should bring the button back where it was. So the shown buttons are written
 * into the slots the shown buttons already occupied, and everything hidden
 * stays exactly where it sits in the list. Rearranging six visible tiles can
 * never lose a seventh nobody could see.
 */
export function applyVisibleOrder(stored: string[] | undefined, visible: string[]): string[] {
  if (!Array.isArray(stored) || !stored.length) return [...visible];
  const shown = new Set(visible);
  let i = 0;
  const out = stored.map((id) => (shown.has(id) ? visible[i++] : id));
  for (; i < visible.length; i++) out.push(visible[i]);
  return out;
}

/** What a screen reader says when a tile lands. Position rather than gesture:
    "third of six" is the fact somebody needs, and it is the same sentence
    whether the move came from a thumb or from a keyboard. */
export function describeMove(label: string, to: number, total: number): string {
  return `${label} moved to position ${to + 1} of ${total}`;
}
