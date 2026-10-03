import type { DateStr, TimedItem, TimedProvider } from "@lifeline/core";
import { allSessions, allWorkouts, useSessions, useWorkouts } from "./data/repo";
import { APP_ID, type Session, type Workout } from "./domain/types";

/** Sessions in range as Timed items — what `useItems` and `itemsIn` both report. */
export function sessionItems(sessions: Session[], workouts: Workout[], range: { start: DateStr; end: DateStr }): TimedItem[] {
  const byId = new Map(workouts.map((w) => [w.id, w]));
  const items: TimedItem[] = [];
  for (const s of sessions) {
    if (s.date < range.start || s.date > range.end) continue;
    items.push({
      key: `${APP_ID}/${s.id}`,
      appId: APP_ID,
      itemId: s.id,
      title: byId.get(s.workoutId)?.title ?? s.title,
      subtitle: `${s.durationMin} min`,
      date: s.date,
      start: s.start,
      // A Session saved before sessionClock may end past midnight: hold it to its start day.
      end: s.end < s.start ? "24:00" : s.end,
      tags: s.tags ?? [],
    });
  }
  return items;
}

/** Sessions on the time Surfaces (ADR 0030): what happened, at its hour. Never moved — a Session is a record. */
export const workoutTimed: TimedProvider = {
  appId: APP_ID,
  useItems(range) {
    return sessionItems(useSessions(), useWorkouts(), range);
  },
  async itemsIn(range) {
    return sessionItems(await allSessions(), await allWorkouts(), range);
  },
};
