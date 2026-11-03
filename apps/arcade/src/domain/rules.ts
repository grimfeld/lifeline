import { todayStr } from "@lifeline/core";
import type { Acquisition, Work } from "./types";

/** A partial change to an item. Transitions return patches, never whole records. */
export type Patch = Partial<Omit<Work, "id" | "updatedAt" | "deleted">>;

// --- transitions (pure, patch-returning) ---------------------------------

export const start = (today = todayStr()): Patch => ({ engagement: "IN_PROGRESS", startedOn: today });
export const finish = (today = todayStr()): Patch => ({ engagement: "DONE", finishedOn: today });
export const abandon = (): Patch => ({ engagement: "ABANDONED" });
export const acquire = (how: Extract<Acquisition, "OWNED" | "BORROWED">, today = todayStr()): Patch => ({ acquisition: how, acquiredOn: today });
export const release = (): Patch => ({ acquisition: "GONE" });
/** Back to Wanted, the acquired day cleared. */
export const unacquire = (): Patch => ({ acquisition: "WANTED", acquiredOn: "" });
/** Back to unstarted: every playing day cleared. */
export const reshelve = (): Patch => ({ engagement: "UNSTARTED", startedOn: "", finishedOn: "" });

/** Owned moves through the Arcade's own transitions (ADR 0019): acquiring stamps the day, Wanted clears it. */
export function acquisitionPatch(to: Acquisition, today = todayStr()): Patch {
  if (to === "OWNED" || to === "BORROWED") return acquire(to, today);
  if (to === "GONE") return release();
  return unacquire();
}

// --- derived views ---------------------------------------------------------

/** Owned but unstarted, oldest purchase first. */
export const shelfOfShame = (items: Work[]) =>
  items
    .filter((m) => m.acquisition === "OWNED" && m.engagement === "UNSTARTED")
    .sort((a, b) => (a.acquiredOn || "9999").localeCompare(b.acquiredOn || "9999"));

/** Every Wanted item, oldest wish first — the Wanted list (ADR 0024: Arcade keeps Acquisition). */
export const wantedList = (items: Work[]) =>
  items.filter((m) => m.acquisition === "WANTED").sort((a, b) => (a.addedOn || "9999").localeCompare(b.addedOn || "9999"));
