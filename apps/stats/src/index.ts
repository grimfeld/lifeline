import type { AppManifest, Document, DocumentTypeDef } from "@lifeline/core";
import { BarChart3, ListPlus } from "lucide-react";
import { StatsScreen } from "./screens/StatsScreen";
import { StatDetailScreen } from "./screens/StatDetailScreen";
import { StatsOverviewCard } from "./cards/StatsOverviewCard";
import { HabitsCard } from "./cards/HabitsCard";
import { PERIOD_OPTIONS, SingleStatCard, useSingleStatTitle, useSingleStatOptions } from "./cards/SingleStatCard";
import { StreaksCard, streaksInstanceTitle } from "./cards/StreaksCard";
import { CollectionsCard } from "./cards/CollectionsCard";
import { statCommands } from "./commands";
import { statsDaylog } from "./daylog";
import { ENTRIES, STATS, STAT, STAT_ENTRY, STAT_KINDS, COLOR_SLOTS, type Entry } from "./domain/types";
import { statHref } from "./domain/daylog";
import { formatValue } from "./domain/aggregate";

/** The `stat` Document type (ADR 0019): a named series; `kind` is fixed after creation. */
const statType: DocumentTypeDef = {
  id: STAT,
  label: "Stats",
  icon: BarChart3,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "kind", label: "Kind", kind: "select", options: STAT_KINDS.map((k) => ({ value: k, label: k })), guarded: true, required: true, column: true },
    { key: "unit", label: "Unit", kind: "text", column: true },
    { key: "color", label: "Colour", kind: "select", options: COLOR_SLOTS.map((c) => ({ value: c, label: c })) },
    { key: "defaultIncrement", label: "Quick-log amount", kind: "number" },
    { key: "universeSize", label: "Universe size", kind: "number" },
  ],
  linkable: { subtitle: (d) => String(d.kind ?? "") },
  href: (d) => statHref(d.id),
  order: 40,
  builtIn: true,
};

/** The `stat_entry` Document type: one logged event of a Stat. Title is derived; no body. */
const entryType: DocumentTypeDef = {
  id: STAT_ENTRY,
  label: "Entries",
  singular: "Entry",
  icon: ListPlus,
  titleRule: "derived",
  titleOf: (d: Document) => {
    const e = d as Entry;
    return e.item ? e.item : formatValue(Number(e.value) || 0);
  },
  body: "none",
  fields: [
    { key: "statId", label: "Stat", kind: "link", linkType: STAT, guarded: true, required: true, column: true },
    { key: "value", label: "Value", kind: "number", column: true },
    { key: "item", label: "Item", kind: "text", column: true },
    { key: "ts", label: "When", kind: "datetime", column: true },
  ],
  indexes: ["statId"],
  href: (d) => statHref(String((d as Entry).statId)),
  order: 41,
  builtIn: true,
};

/** Stats App (notch port): stats are definitions, entries are an event log, totals are derived. */
export const statsApp: AppManifest = {
  id: "stats",
  title: "Stats",
  icon: BarChart3,
  color: "var(--chart-orange)",
  types: [statType, entryType],
  screens: [
    { id: "stats.main", title: "Stats", path: "stats", icon: BarChart3, component: StatsScreen },
    { id: "stats.detail", title: "Stat", path: "stats/:id", component: StatDetailScreen, hidden: true },
  ],
  cards: [
    { id: "stats.overview", title: "Stats", description: "Every stat's headline with one-tap logging", component: StatsOverviewCard, tagFilterable: true, defaultSize: { w: 3, h: 6 }, minSize: { w: 2, h: 3 } },
    { id: "stats.habits", title: "Habits", description: "Boolean stats: last two weeks and streaks, mark today inline", component: HabitsCard, tagFilterable: true, defaultSize: { w: 3, h: 6 }, minSize: { w: 2, h: 3 } },
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
      tagFilterable: true,
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
      tagFilterable: true,
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
  daylog: statsDaylog,
};

export { STATS, ENTRIES, STAT, STAT_ENTRY };
export type { Stat, Entry, StatKind } from "./domain/types";
