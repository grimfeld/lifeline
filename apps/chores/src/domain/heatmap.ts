import { addDays, startOfWeek, type DateStr } from "@lifeline/core";
import type { Completion } from "./types";

/**
 * Ordered days for a completion heatmap: from the Monday `weeksBack` weeks
 * before the current week's Monday through the Sunday of the current week.
 * Always a whole number of weeks (`weeksBack + 1` weeks) so columns align.
 */
export function heatmapDays(weeksBack: number, today: DateStr): DateStr[] {
  const weeks = Math.max(0, Math.floor(weeksBack));
  const first = addDays(startOfWeek(today), -7 * weeks);
  const count = 7 * (weeks + 1);
  const out: DateStr[] = [];
  for (let i = 0; i < count; i++) out.push(addDays(first, i));
  return out;
}

/** Completions bucketed by day (only days in `days`), optionally one chore. */
export function completionsPerDay(
  completions: Completion[],
  days: DateStr[],
  choreId?: string,
): Map<DateStr, Completion[]> {
  const m = new Map<DateStr, Completion[]>();
  for (const d of days) m.set(d, []);
  for (const c of completions) {
    if (choreId && c.choreId !== choreId) continue;
    m.get(c.doneOn)?.push(c);
  }
  return m;
}

/** Completions recorded for exactly one day, in a stable order (by chore, then id). */
export function completionsOn(completions: Completion[], day: DateStr): Completion[] {
  return completions
    .filter((c) => c.doneOn === day)
    .sort((a, b) => a.choreId.localeCompare(b.choreId) || a.id.localeCompare(b.id));
}
