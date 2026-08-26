import { todayStr } from "@lifeline/core";
import { RATING_MAX, type Work } from "./types";

/** A partial change to an item. Transitions return patches, never whole records. */
export type Patch = Partial<Omit<Work, "id" | "updatedAt" | "deleted">>;

// --- transitions (pure, patch-returning) ---------------------------------

export const start = (today = todayStr()): Patch => ({ engagement: "IN_PROGRESS", startedOn: today });
export const finish = (today = todayStr()): Patch => ({ engagement: "DONE", finishedOn: today });
export const abandon = (): Patch => ({ engagement: "ABANDONED" });

/**
 * Undo Done (ADR 0035): back to Listening when it had been started, else to
 * the To… shelf. Only the finished day is cleared — Marks and Review stay.
 */
export const unfinish = (): Patch => ({ engagement: "UNSTARTED", finishedOn: "" });
export const toggleDone = (item: Work, today = todayStr()): Patch =>
  item.engagement === "DONE" ? (item.startedOn ? { engagement: "IN_PROGRESS", finishedOn: "" } : unfinish()) : finish(today);

// --- marks (ADR 0035) ------------------------------------------------------

export const toggleLiked = (item: Work): Patch => ({ liked: !item.liked });

/** Whole stars; the current star again clears; anything out of range is unrated. */
export const rate = (item: Work, stars: number): Patch => {
  const n = Math.round(stars);
  return { rating: n === item.rating || n < 1 || n > RATING_MAX ? 0 : n };
};

export const setReview = (body: string): Patch => ({ body: body.trim() });

/** The star row is offered once the work is not merely To listen — or as soon as it carries a rating. */
export const showsRating = (item: Work): boolean => item.rating > 0 || item.engagement !== "UNSTARTED";

// --- derived views ---------------------------------------------------------

export const finishedIn = (items: Work[], year: number) => items.filter((m) => m.finishedOn.startsWith(String(year)));
