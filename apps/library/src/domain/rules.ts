import { diffDays, todayStr, type DateStr } from "@lifeline/core";
import { workType, type WorkTypeId } from "./workTypes";
import type { Acquisition, Work } from "./types";

/** A partial change to an item. Transitions return patches, never whole records. */
export type Patch = Partial<Omit<Work, "id" | "updatedAt" | "deleted">>;

export const onNightstand = (m: Work) => m.slot > 0;

/** The Nightstand of one medium, in slot order. */
export function nightstand(items: Work[], type: WorkTypeId): Work[] {
  return items.filter((m) => m.type === type && onNightstand(m)).sort((a, b) => a.slot - b.slot);
}

/** Everything not on a Nightstand — an unranked pool (includes done/gone). */
export const backlog = (items: Work[]) => items.filter((m) => !onNightstand(m));

export function freeSlots(items: Work[], type: WorkTypeId): number[] {
  const taken = new Set(nightstand(items, type).map((m) => m.slot));
  const free: number[] = [];
  for (let s = 1; s <= workType(type).slotCount; s++) if (!taken.has(s)) free.push(s);
  return free;
}
export const isFull = (items: Work[], type: WorkTypeId) => freeSlots(items, type).length === 0;

export function daysSince(d: DateStr, today = todayStr()): number | null {
  if (!d) return null;
  return Math.max(0, diffDays(d, today));
}

/** Days it has held its slot (measured from start if started). The anti-stall signal. */
export function slotAge(m: Work, today = todayStr()): number | null {
  if (!onNightstand(m)) return null;
  return daysSince(m.startedOn || m.slottedOn, today);
}
export const STALE_AFTER_DAYS = 60;
export const isStale = (m: Work, today = todayStr()) => (slotAge(m, today) ?? -1) >= STALE_AFTER_DAYS;

/** A Wanted item holding a slot: buy it *now* (it is next up). Highlighted on the Nightstand. */
export const isBuySignal = (m: Work) => onNightstand(m) && m.acquisition === "WANTED";

// --- transitions (pure, patch-returning) ---------------------------------

export const promote = (slot: number, today = todayStr()): Patch => ({ slot, slottedOn: today });
export const evict = (): Patch => ({ slot: 0, slottedOn: "" });
export const start = (today = todayStr()): Patch => ({ engagement: "IN_PROGRESS", startedOn: today });
export const finish = (today = todayStr()): Patch => ({ engagement: "DONE", finishedOn: today, slot: 0, slottedOn: "" });
export const abandon = (): Patch => ({ engagement: "ABANDONED", slot: 0, slottedOn: "" });
export const acquire = (how: Extract<Acquisition, "OWNED" | "BORROWED">, today = todayStr()): Patch => ({ acquisition: how, acquiredOn: today });
export const release = (): Patch => ({ acquisition: "GONE" });

/** Undo a mis-clicked buy: back to Wanted, the acquired day cleared. */
export const unacquire = (): Patch => ({ acquisition: "WANTED", acquiredOn: "" });

/** Bought as one click (CONTEXT.md, Wanted list): Wanted ⇄ Owned. Borrowed and Gone stay deliberate menu moves. */
export const toggleOwned = (item: Work, today = todayStr()): Patch =>
  item.acquisition === "OWNED" ? unacquire() : acquire("OWNED", today);

/**
 * Undo Done (CONTEXT.md, Shelf): back to Reading when it had been started,
 * else to the To read shelf. Only the finished day is cleared — the slot the
 * finish freed is never taken back; re-slotting is deliberate.
 */
export const unfinish = (): Patch => ({ engagement: "UNSTARTED", finishedOn: "" });
export const toggleDone = (item: Work, today = todayStr()): Patch =>
  item.engagement === "DONE" ? (item.startedOn ? { engagement: "IN_PROGRESS", finishedOn: "" } : unfinish()) : finish(today);

// --- derived views ---------------------------------------------------------

export const shelfOfShame = (items: Work[]) =>
  items
    .filter((m) => m.acquisition === "OWNED" && m.engagement === "UNSTARTED")
    .sort((a, b) => (a.acquiredOn || "9999").localeCompare(b.acquiredOn || "9999"));
export const finishedIn = (items: Work[], year: number) =>
  items.filter((m) => m.finishedOn.startsWith(String(year)));
/** Every Wanted item, wherever it lives — slotted ones (buy now) first, then oldest wish first. */
export const wantedList = (items: Work[]) =>
  items
    .filter((m) => m.acquisition === "WANTED")
    .sort((a, b) => Number(isBuySignal(b)) - Number(isBuySignal(a)) || (a.addedOn || "9999").localeCompare(b.addedOn || "9999"));
