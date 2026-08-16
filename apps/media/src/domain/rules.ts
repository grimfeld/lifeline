import { diffDays, todayStr, type DateStr } from "@lifeline/core";
import { mediaType, type MediaTypeId } from "./mediaTypes";
import type { Acquisition, MediaItem } from "./types";

/** A partial change to an item. Transitions return patches, never whole records. */
export type Patch = Partial<Omit<MediaItem, "id" | "updatedAt" | "deleted">>;

export const onNightstand = (m: MediaItem) => m.slot > 0;

/** The Nightstand of one medium, in slot order. */
export function nightstand(items: MediaItem[], type: MediaTypeId): MediaItem[] {
  return items.filter((m) => m.type === type && onNightstand(m)).sort((a, b) => a.slot - b.slot);
}

/** Everything not on a Nightstand — an unranked pool (includes done/gone). */
export const backlog = (items: MediaItem[]) => items.filter((m) => !onNightstand(m));

export function freeSlots(items: MediaItem[], type: MediaTypeId): number[] {
  const taken = new Set(nightstand(items, type).map((m) => m.slot));
  const free: number[] = [];
  for (let s = 1; s <= mediaType(type).slotCount; s++) if (!taken.has(s)) free.push(s);
  return free;
}
export const isFull = (items: MediaItem[], type: MediaTypeId) => freeSlots(items, type).length === 0;

export function daysSince(d: DateStr, today = todayStr()): number | null {
  if (!d) return null;
  return Math.max(0, diffDays(d, today));
}

/** Days it has held its slot (measured from start if started). The anti-stall signal. */
export function slotAge(m: MediaItem, today = todayStr()): number | null {
  if (!onNightstand(m)) return null;
  return daysSince(m.startedOn || m.slottedOn, today);
}
export const STALE_AFTER_DAYS = 60;
export const isStale = (m: MediaItem, today = todayStr()) => (slotAge(m, today) ?? -1) >= STALE_AFTER_DAYS;

/** A Wanted item holding a slot is the instruction to buy it. */
export const isBuySignal = (m: MediaItem) => onNightstand(m) && m.acquisition === "WANTED";

// --- transitions (pure, patch-returning) ---------------------------------

export const promote = (slot: number, today = todayStr()): Patch => ({ slot, slottedOn: today });
export const evict = (): Patch => ({ slot: 0, slottedOn: "" });
export const start = (today = todayStr()): Patch => ({ engagement: "IN_PROGRESS", startedOn: today });
export const finish = (today = todayStr()): Patch => ({ engagement: "DONE", finishedOn: today, slot: 0, slottedOn: "" });
export const abandon = (): Patch => ({ engagement: "ABANDONED", slot: 0, slottedOn: "" });
export const acquire = (how: Extract<Acquisition, "OWNED" | "BORROWED">, today = todayStr()): Patch => ({ acquisition: how, acquiredOn: today });
export const release = (): Patch => ({ acquisition: "GONE" });
export const setStudied = (studied: boolean): Patch => ({ studied });

// --- derived views ---------------------------------------------------------

export const shelfOfShame = (items: MediaItem[]) =>
  items
    .filter((m) => m.acquisition === "OWNED" && m.engagement === "UNSTARTED")
    .sort((a, b) => (a.acquiredOn || "9999").localeCompare(b.acquiredOn || "9999"));
export const finishedIn = (items: MediaItem[], year: number) =>
  items.filter((m) => m.finishedOn.startsWith(String(year)));
export const shoppingList = (items: MediaItem[]) => items.filter(isBuySignal);
