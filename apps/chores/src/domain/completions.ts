import type { DateStr } from "@lifeline/core";
import type { Completion } from "./types";

/**
 * A chore is done once per day, whatever the UI recorded. Completion facts
 * are keyed by chore and day; a second tick on the same day is the same
 * fact told twice, not a second event — it would otherwise show twice in
 * the daylog and count twice in the heatmap. The write path refuses the
 * duplicate; this collapses any that already exist (or arrive from another
 * device) so every reader sees one completion per chore per day.
 */
export function uniqueCompletions(completions: Completion[]): Completion[] {
  const seen = new Map<string, Completion>();
  for (const c of completions) {
    const key = `${c.choreId}/${c.doneOn}`;
    const cur = seen.get(key);
    // Keep the earliest record — the one that was actually the tick.
    if (!cur || c.recordedAt < cur.recordedAt || (c.recordedAt === cur.recordedAt && c.id < cur.id)) seen.set(key, c);
  }
  return completions.filter((c) => seen.get(`${c.choreId}/${c.doneOn}`) === c);
}

/** Has this chore been completed on this day? */
export function isDoneOn(completions: Completion[], choreId: string, day: DateStr): boolean {
  return completions.some((c) => c.choreId === choreId && c.doneOn === day);
}
