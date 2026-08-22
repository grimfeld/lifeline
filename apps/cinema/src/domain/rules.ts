import { todayStr } from "@lifeline/core";
import type { Work } from "./types";

/** A partial change to an item. Transitions return patches, never whole records. */
export type Patch = Partial<Omit<Work, "id" | "updatedAt" | "deleted">>;

// --- transitions (pure, patch-returning) ---------------------------------

export const start = (today = todayStr()): Patch => ({ engagement: "IN_PROGRESS", startedOn: today });
export const finish = (today = todayStr()): Patch => ({ engagement: "DONE", finishedOn: today });
export const abandon = (): Patch => ({ engagement: "ABANDONED" });

// --- derived views ---------------------------------------------------------

export const finishedIn = (items: Work[], year: number) => items.filter((m) => m.finishedOn.startsWith(String(year)));
