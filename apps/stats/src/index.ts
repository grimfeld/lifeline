import type { AppManifest } from "@lifeline/core";
import { BarChart3 } from "lucide-react";
import { StatsScreen } from "./screens/StatsScreen";
import { StatDetailScreen } from "./screens/StatDetailScreen";
import { StatsOverviewCard } from "./cards/StatsOverviewCard";
import { HabitsCard } from "./cards/HabitsCard";
import { statCommands } from "./commands";
import { ENTRIES, STATS } from "./domain/types";

/** Stats App (notch port): stats are definitions, entries are an event log, totals are derived. */
export const statsApp: AppManifest = {
  id: "stats",
  title: "Stats",
  icon: BarChart3,
  color: "var(--chart-orange)",
  collections: [
    { name: STATS },
    { name: ENTRIES, indexes: ["statId", "ts"] },
  ],
  screens: [
    { id: "stats.main", title: "Stats", path: "stats", icon: BarChart3, component: StatsScreen },
    { id: "stats.detail", title: "Stat", path: "stats/:id", component: StatDetailScreen, hidden: true },
  ],
  cards: [
    { id: "stats.overview", title: "Stats", description: "Every stat's headline with one-tap logging", component: StatsOverviewCard, defaultSize: { w: 3, h: 6 }, minSize: { w: 2, h: 3 } },
    { id: "stats.habits", title: "Habits", description: "Boolean stats: last two weeks and streaks, mark today inline", component: HabitsCard, defaultSize: { w: 3, h: 6 }, minSize: { w: 2, h: 3 } },
  ],
  commands: statCommands,
};

export { STATS, ENTRIES };
export type { Stat, Entry, StatKind } from "./domain/types";
