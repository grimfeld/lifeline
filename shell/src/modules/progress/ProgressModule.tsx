import { BarChart3, Dumbbell, PiggyBank, Smile, Sun, Trophy } from "lucide-react";
import { ModuleCard } from "../ModuleCard";
import { handModule, ModuleHomeHeader } from "../handModule";

/**
 * Progress's home: everything logged today, on one page — the mood, the daily
 * marks, the workout to start, the jar. Each is its App's own Card; the page
 * is what no one of them could be, the day's logging in one place.
 */
function ProgressToday() {
  const day = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <ModuleHomeHeader title="Today" subtitle={day} />
      <div className="grid gap-4 md:grid-cols-2">
        <ModuleCard cardId="mood.today" />
        <ModuleCard cardId="stats.habits" />
        <ModuleCard cardId="workout.start" />
        <ModuleCard cardId="swearjar.jar" />
      </div>
    </div>
  );
}

/**
 * Progress (ADR 0057): Today first — what gets logged — then each App's own
 * long view. Stats, Life Level, Workout, Mood and the Swear Jar keep their
 * screens and their ownership; Progress decides the arrangement.
 */
export const progressShell = handModule({
  id: "progress",
  title: "Progress",
  places: [
    { key: "today", title: "Today", icon: Sun, page: "" },
    { key: "stats", title: "Stats", icon: BarChart3, screen: "stats.main" },
    { key: "lifelevel", title: "Life Level", icon: Trophy, screen: "lifelevel.main" },
    { key: "workout", title: "Workout", icon: Dumbbell, screen: "workout.main" },
    { key: "mood", title: "Mood", icon: Smile, screen: "mood.main" },
    { key: "swearjar", title: "Swear Jar", icon: PiggyBank, screen: "swearjar.home" },
  ],
  pages: [{ path: "", component: ProgressToday }],
});
