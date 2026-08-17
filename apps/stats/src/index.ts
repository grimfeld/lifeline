import type { AppManifest } from "@lifeline/core";
import { BarChart3 } from "lucide-react";
import { StatsScreen } from "./screens/StatsScreen";
import { StatDetailScreen } from "./screens/StatDetailScreen";
import { StatsOverviewCard } from "./cards/StatsOverviewCard";
import { HabitsCard } from "./cards/HabitsCard";
import { PERIOD_OPTIONS, SingleStatCard, useSingleStatTitle, useSingleStatOptions } from "./cards/SingleStatCard";
import { StreaksCard, streaksInstanceTitle } from "./cards/StreaksCard";
import { CollectionsCard } from "./cards/CollectionsCard";
import { statCommands } from "./commands";
import { statsLinkable } from "./linkable";
import { statsDaylog } from "./daylog";
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
    {
      id: "stats.single",
      title: "Single stat",
      description: "One stat as a dashboard tile: headline, trend and one-tap logging",
      component: SingleStatCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: {
        stat: { kind: "entity", label: "Stat", required: true, useOptions: useSingleStatOptions },
        period: { kind: "select", label: "Period", default: "month", options: PERIOD_OPTIONS },
      },
      instanceTitle: useSingleStatTitle,
    },
    {
      id: "stats.streaks",
      title: "Streak leaderboard",
      description: "Boolean stats ranked by current streak",
      component: StreaksCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      settings: {
        show: {
          kind: "select",
          label: "Show",
          default: "all",
          options: [
            { value: "all", label: "All habits" },
            { value: "active", label: "Active streaks only" },
          ],
        },
      },
      instanceTitle: streaksInstanceTitle,
    },
    {
      id: "stats.collections",
      title: "Collections",
      description: "Every collection's progress toward its universe",
      component: CollectionsCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      settings: {
        sort: {
          kind: "select",
          label: "Sort by",
          default: "progress",
          options: [
            { value: "progress", label: "Completion %" },
            { value: "name", label: "Name" },
          ],
        },
      },
      instanceTitle: () => "Collections",
    },
  ],
  commands: statCommands,
  linkable: statsLinkable,
  daylog: statsDaylog,
};

export { STATS, ENTRIES };
export type { Stat, Entry, StatKind } from "./domain/types";
