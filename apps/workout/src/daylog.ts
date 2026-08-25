import type { DaylogProvider } from "@lifeline/core";
import { useSessions, useWorkouts } from "./data/repo";
import { APP_ID, WORKOUT_HREF } from "./domain/types";

/** The Daylog Contract for Workout: "Worked out" for every Session that day. */
export const workoutDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const sessions = useSessions();
    const workouts = useWorkouts();
    const byId = new Map(workouts.map((w) => [w.id, w]));
    return sessions
      .filter((s) => s.date === date)
      .map((s) => ({
        key: `${APP_ID}/${s.id}`,
        appId: APP_ID,
        itemId: s.id,
        kind: "Worked out",
        title: byId.get(s.workoutId)?.title ?? s.title,
        subtitle: `${s.durationMin} min`,
        time: s.start,
        href: `${WORKOUT_HREF}?tab=sessions`,
        tags: s.tags ?? [],
      }));
  },
};
