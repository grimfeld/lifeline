/**
 * A Screen's grid, read as the phone reads it (ADR 0021): one column, top to
 * bottom. There is one layout and it is the grid — the phone flattens it and
 * keeps no order of its own, so editing on the phone edits the same coordinates
 * the desktop drags around.
 */

import type { ScreenLayoutItem } from "./data/db";

/** The one-column reading of a layout: rows top to bottom, left to right within a row. */
export function stackOrder<T extends ScreenLayoutItem>(items: T[]): T[] {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Move one card one place up (`-1`) or down (`1`) in that stacked order, by
 * exchanging grid slots with the neighbour it passes: the phone has no drag,
 * and swapping two cards is what a re-order means on the grid the desktop keeps.
 * Sizes stay with their cards, so a swap of unequal ones can leave the desktop
 * grid overlapping — react-grid-layout compacts that away on render, in the new
 * order. Returns the items untouched at either end of the stack.
 */
export function moveStacked<T extends ScreenLayoutItem>(items: T[], instanceId: string, dir: -1 | 1): T[] {
  const order = stackOrder(items);
  const from = order.findIndex((l) => l.instanceId === instanceId);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= order.length) return items;
  const swapped = [...order];
  swapped[from] = order[to];
  swapped[to] = order[from];
  // Slots stay where they are and the cards move between them — which also
  // settles the case coordinates alone cannot (two cards on the same slot).
  return swapped.map((l, i) => ({ ...l, x: order[i].x, y: order[i].y }));
}
