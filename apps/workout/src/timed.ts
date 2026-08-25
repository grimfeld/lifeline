import type { TimedItem, TimedProvider } from "@lifeline/core";
import { useSessions, useWorkouts } from "./data/repo";
import { APP_ID } from "./domain/types";

/** Sessions on the time Surfaces (ADR 0030): what happened, at its hour. Never moved — a Session is a record. */
export const workoutTimed: TimedProvider = {
  appId: APP_ID,
  useItems(range) {
    const sessions = useSessions();
    const workouts = useWorkouts();
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
        end: s.end,
        tags: s.tags ?? [],
      });
    }
    return items;
  },
};
