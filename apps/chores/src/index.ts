import type { AppManifest } from "@lifeline/core";
import { ClipboardList } from "lucide-react";
import { ChoresScreen } from "./screens/ChoresScreen";
import { DueTodayCard } from "./cards/DueTodayCard";
import { HeatmapCard, useHeatmapInstanceTitle, useHeatmapChoreOptions } from "./cards/HeatmapCard";
import { choreCommands } from "./commands";
import { choresSchedulable, APP_ID } from "./schedulable";
import { choresLinkable } from "./linkable";
import { choresDaylog } from "./daylog";
import { choresTaggable } from "./taggable";
import { CHORES, COMPLETIONS } from "./domain/types";

export const choresApp: AppManifest = {
  id: APP_ID,
  title: "Chores",
  icon: ClipboardList,
  color: "var(--chart-aqua)",
  collections: [
    { name: CHORES, indexes: ["*tags"] },
    { name: COMPLETIONS, indexes: ["choreId"] },
  ],
  screens: [
    {
      id: "chores.main",
      title: "Chores",
      path: "chores",
      icon: ClipboardList,
      component: ChoresScreen,
    },
  ],
  cards: [
    {
      id: "chores.due-today",
      title: "Chores due today",
      description: "Tick off what needs doing today",
      component: DueTodayCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      tagFilterable: true,
    },
    {
      id: "chores.heatmap",
      title: "Chore heatmap",
      description: "Completions per day over the last weeks — how consistent you've been",
      component: HeatmapCard,
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      tagFilterable: true,
      settings: {
        weeks: { kind: "number", label: "Weeks", default: 12, min: 4, max: 52 },
        chore: {
          kind: "entity",
          label: "Chore",
          useOptions: useHeatmapChoreOptions,
          anyLabel: "All chores",
        },
      },
      instanceTitle: useHeatmapInstanceTitle,
    },
  ],
  commands: choreCommands,
  schedulable: choresSchedulable,
  linkable: choresLinkable,
  daylog: choresDaylog,
  taggable: choresTaggable,
};

export { CHORES, COMPLETIONS };
