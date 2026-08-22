import { todayStr, type DateStr } from "@lifeline/core";
import type { Acquisition, Work } from "./types";

/** A partial change to an item. Transitions return patches, never whole records. */
export type Patch = Partial<Omit<Work, "id" | "updatedAt" | "deleted">>;

export function daysSince(d: DateStr, today = todayStr()): number | null {
  if (!d) return null;
  const ms = new Date(today).getTime() - new Date(d).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

// --- transitions (pure, patch-returning) ---------------------------------

export const start = (today = todayStr()): Patch => ({ engagement: "IN_PROGRESS", startedOn: today });
export const finish = (today = todayStr()): Patch => ({ engagement: "DONE", finishedOn: today });
export const abandon = (): Patch => ({ engagement: "ABANDONED" });
export const acquire = (how: Extract<Acquisition, "OWNED" | "BORROWED">, today = todayStr()): Patch => ({ acquisition: how, acquiredOn: today });
export const release = (): Patch => ({ acquisition: "GONE" });

// --- derived views ---------------------------------------------------------

/** Owned but unstarted, oldest purchase first. */
export const shelfOfShame = (items: Work[]) =>
  items
    .filter((m) => m.acquisition === "OWNED" && m.engagement === "UNSTARTED")
    .sort((a, b) => (a.acquiredOn || "9999").localeCompare(b.acquiredOn || "9999"));

export const finishedIn = (items: Work[], year: number) => items.filter((m) => m.finishedOn.startsWith(String(year)));

/** Every Wanted item, oldest wish first — the Shopping list (ADR 0024: Arcade keeps Acquisition). */
export const shoppingList = (items: Work[]) =>
  items.filter((m) => m.acquisition === "WANTED").sort((a, b) => (a.addedOn || "9999").localeCompare(b.addedOn || "9999"));
