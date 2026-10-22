import type { AppManifest, DocumentTypeDef } from "@lifeline/core";
import { lazyChunk } from "@lifeline/ui";
import { Dumbbell, History, Timer } from "lucide-react";
import { RecentSessionsCard, StartWorkoutCard } from "./cards/WorkoutCards";
import { workoutCommands } from "./commands";
import { SessionPeek } from "./components/SessionPeek";
import { workoutTimed } from "./timed";
import { workoutDaylog } from "./daylog";
import { workoutTallying } from "./tallying";
import { describeWorkout } from "./domain/intervals";
import { APP_ID, CATEGORIES, EXERCISE, MEASURE_LABEL, MEASURES, SESSION, WORKOUT, WORKOUT_HREF, type Exercise, type Session, type Workout } from "./domain/types";

// Screens load on first visit (ADR 0099); the rest of the manifest stays eager.
const WorkoutScreen = lazyChunk(() => import("./screens/WorkoutScreen").then((m) => ({ default: m.WorkoutScreen })));
const TimerScreen = lazyChunk(() => import("./screens/TimerScreen").then((m) => ({ default: m.TimerScreen })));

/** The `workout` Document type (ADR 0030): a plan of Blocks. Blocks and Tallies are the App's — guarded structured fields. */
const workoutType: DocumentTypeDef = {
  id: WORKOUT,
  label: "Workouts",
  icon: Timer,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "blocks", label: "Blocks", kind: "json", guarded: true },
    { key: "tallies", label: "Tallies", kind: "json", guarded: true },
    { key: "notes", label: "Notes", kind: "longtext" },
  ],
  linkable: { subtitle: (d) => describeWorkout(d as Workout) },
  href: () => WORKOUT_HREF,
  order: 50,
  builtIn: true,
};

/** The `exercise` Document type (ADR 0030): the hand-curated library. */
const exerciseType: DocumentTypeDef = {
  id: EXERCISE,
  label: "Exercises",
  icon: Dumbbell,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "category", label: "Category", kind: "select", options: CATEGORIES.map((c) => ({ value: c, label: c })), required: true, column: true },
    { key: "measure", label: "Measure", kind: "select", options: MEASURES.map((m) => ({ value: m, label: MEASURE_LABEL[m] })), required: true, column: true },
    { key: "equipment", label: "Equipment", kind: "text", column: true },
    { key: "notes", label: "Notes", kind: "longtext" },
  ],
  linkable: { subtitle: (d) => `${(d as Exercise).category} · ${(d as Exercise).measure}` },
  href: () => `${WORKOUT_HREF}?tab=exercises`,
  order: 51,
  builtIn: true,
};

/** The `workout_session` Document type (ADR 0030): one run, what happened. Made by the timer; results are guarded. */
const sessionType: DocumentTypeDef = {
  id: SESSION,
  label: "Workout sessions",
  icon: History,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "workoutId", label: "Workout", kind: "link", linkType: WORKOUT, guarded: true, required: true, column: true },
    { key: "date", label: "Day", kind: "date", guarded: true, column: true },
    { key: "start", label: "Start", kind: "text", guarded: true, column: true },
    { key: "end", label: "End", kind: "text", guarded: true },
    { key: "durationMin", label: "Minutes", kind: "number", guarded: true, column: true },
    { key: "startedAt", label: "Started", kind: "datetime", guarded: true, hidden: true },
    { key: "endedAt", label: "Ended", kind: "datetime", guarded: true, hidden: true },
    { key: "results", label: "Results", kind: "json", guarded: true },
    { key: "notes", label: "Notes", kind: "longtext" },
  ],
  indexes: ["workoutId", "date"],
  linkable: { subtitle: (d) => `${(d as Session).date} · ${(d as Session).durationMin} min` },
  href: () => `${WORKOUT_HREF}?tab=sessions`,
  peekEdit: SessionPeek,
  order: 52,
  builtIn: true,
};

/** Workout App (ADR 0030/0031): the timer, the library, the record. */
export const workoutApp: AppManifest = {
  id: APP_ID,
  module: "progress",
  title: "Workout",
  icon: Dumbbell,
  color: "var(--chart-green)",
  types: [workoutType, exerciseType, sessionType],
  screens: [
    { id: "workout.main", title: "Workout", path: "workout", icon: Dumbbell, component: WorkoutScreen },
    { id: "workout.run", title: "Timer", path: "workout/run/:id", component: TimerScreen, hidden: true },
  ],
  cards: [
    {
      id: "workout.start",
      title: "Start workout",
      description: "Every workout one tap from the timer",
      component: StartWorkoutCard,
      tagFilterable: true,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
    },
    {
      id: "workout.recent",
      title: "Recent sessions",
      description: "The last few workout sessions",
      component: RecentSessionsCard,
      tagFilterable: true,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: { count: { kind: "number", label: "How many", default: 5, min: 1, max: 20 } },
    },
  ],
  commands: workoutCommands,
  timed: workoutTimed,
  daylog: workoutDaylog,
  tallying: workoutTallying,
};

export { WORKOUT, EXERCISE, SESSION };
export type { Workout, Exercise, Session, Block, Movement } from "./domain/types";
