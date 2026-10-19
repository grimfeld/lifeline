import type { Entry, Stat } from "./types";
import { collectedItems, collectionUniverse, currentStreak, longestStreak, markedDays } from "./aggregate";

export interface StreakRow {
  stat: Stat;
  entries: Entry[];
  current: number;
  longest: number;
}

/**
 * Boolean stats ranked by current streak (desc), ties by name. `activeOnly`
 * drops stats whose current streak is 0.
 */
export function rankByStreak(stats: Stat[], byStat: Map<string, Entry[]>, activeOnly = false, now = new Date()): StreakRow[] {
  return stats
    .filter((s) => s.kind === "boolean")
    .map((stat) => {
      const entries = byStat.get(stat.id) ?? [];
      const days = markedDays(entries);
      return { stat, entries, current: currentStreak(days, now), longest: longestStreak(days) };
    })
    .filter((r) => !activeOnly || r.current > 0)
    .sort((a, b) => b.current - a.current || a.stat.title.localeCompare(b.stat.title));
}

export interface CollectionRow {
  stat: Stat;
  entries: Entry[];
  count: number;
  /** 0 when the universe is unknown. */
  universe: number;
  /** 0–100, null when the universe is unknown. */
  percent: number | null;
}

export type CollectionSort = "progress" | "name";

/**
 * Collection stats with their distinct-item count and completion. Sorted by
 * completion % (desc) or name; stats without a universe always sort last
 * (by count desc, then name, under `progress`).
 */
export function sortCollections(stats: Stat[], byStat: Map<string, Entry[]>, sort: CollectionSort = "progress"): CollectionRow[] {
  const rows: CollectionRow[] = stats
    .filter((s) => s.kind === "collection")
    .map((stat) => {
      const entries = byStat.get(stat.id) ?? [];
      const count = collectedItems(entries).length;
      const universe = collectionUniverse(stat);
      const percent = universe > 0 ? Math.min(100, (count / universe) * 100) : null;
      return { stat, entries, count, universe, percent };
    });
  const byName = (a: CollectionRow, b: CollectionRow) => a.stat.title.localeCompare(b.stat.title);
  if (sort === "name") return rows.sort(byName);
  return rows.sort((a, b) => {
    if (a.percent === null && b.percent === null) return b.count - a.count || byName(a, b);
    if (a.percent === null) return 1;
    if (b.percent === null) return -1;
    return b.percent - a.percent || byName(a, b);
  });
}
