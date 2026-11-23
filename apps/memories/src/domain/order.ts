import type { Memory } from "./types";

/** The Memories grid's order: the newest date first, the one kept later first on a shared date. A new array. */
export function newestFirst(memories: readonly Memory[]): Memory[] {
  return [...memories].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}
