import { useNavigate } from "react-router";
import { Button } from "@lifeline/ui";
import { formatHuman, settingsTags, matchesTagFilter, type CardProps } from "@lifeline/core";
import { Play } from "lucide-react";
import { describeWorkout } from "../domain/intervals";
import { useSessions, useWorkouts } from "../data/repo";
import { runHref } from "../screens/WorkoutScreen";

/** "Start workout": every Workout one tap from the timer — the phone home's way in (ADR 0021 amendment). */
export function StartWorkoutCard({ settings }: CardProps) {
  const navigate = useNavigate();
  const tags = settingsTags(settings);
  const workouts = useWorkouts().filter((w) => tags.length === 0 || matchesTagFilter(w.tags, [tags]));
  if (workouts.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center p-3 text-sm">No workouts yet.</div>;
  return (
    <ul className="grid content-start gap-1 overflow-y-auto p-2">
      {workouts.map((w) => (
        <li key={w.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{w.title}</div>
            <div className="text-muted-foreground truncate text-xs">{describeWorkout(w)}</div>
          </div>
          <Button size="sm" onClick={() => navigate(runHref(w.id))}>
            <Play /> Start
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** The last few Sessions. */
export function RecentSessionsCard({ settings }: CardProps) {
  const tags = settingsTags(settings);
  const workouts = useWorkouts();
  const byId = new Map(workouts.map((w) => [w.id, w]));
  const sessions = useSessions()
    .filter((s) => tags.length === 0 || matchesTagFilter(s.tags, [tags]))
    .slice(0, Number(settings.count ?? 5));
  if (sessions.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center p-3 text-sm">No sessions yet.</div>;
  return (
    <ul className="grid content-start gap-1 overflow-y-auto p-2">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground w-24 shrink-0 text-xs">{formatHuman(s.date)}</span>
          <span className="min-w-0 flex-1 truncate">{byId.get(s.workoutId)?.title ?? s.title}</span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{s.durationMin} min</span>
        </li>
      ))}
    </ul>
  );
}
