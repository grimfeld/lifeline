import { lazy } from "react";
import type { AppManifest } from "@lifeline/core";
import { Smile } from "lucide-react";
import { TodayMoodCard } from "./cards/TodayMoodCard";
import { MoodGridCard } from "./cards/MoodGridCard";
import { moodCommands } from "./commands";
import { moodTypeDefs } from "./types";
import { moodDaylog } from "./daylog";

// Screens load on first visit (ADR 0099); the rest of the manifest stays eager.
const MoodScreen = lazy(() => import("./screens/MoodScreen").then((m) => ({ default: m.MoodScreen })));

/** Mood App (ADR 0044): how each day felt, one Mood per day, drawn as a grid. */
export const moodApp: AppManifest = {
  id: "mood",
  module: "progress",
  title: "Mood",
  icon: Smile,
  color: "var(--chart-magenta)",
  types: moodTypeDefs,
  screens: [{ id: "mood.main", title: "Mood", path: "mood", icon: Smile, component: MoodScreen }],
  cards: [
    {
      id: "mood.today",
      title: "Today's mood",
      description: "Five buttons — how today felt, in one tap",
      component: TodayMoodCard,
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
    },
    {
      id: "mood.grid",
      title: "Mood grid",
      description: "One cell per day, coloured by mood — this month or the whole year",
      component: MoodGridCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      settings: {
        layout: { kind: "select", label: "Window", default: "month", options: [{ value: "month", label: "This month" }, { value: "year", label: "This year" }] },
      },
      instanceTitle: (s) => (s.layout === "year" ? "Mood · year" : "Mood · month"),
    },
  ],
  commands: moodCommands,
  daylog: moodDaylog,
};

export { MOOD, MOOD_STEPS, moodLabel, type Mood, type MoodLevel } from "./domain/types";
export { readLevel } from "./domain/grid";
export { useMoodsByDate, useMoodOn } from "./data/repo";
