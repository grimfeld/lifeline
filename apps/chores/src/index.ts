import type { AppManifest } from "@lifeline/core";
import { ClipboardList } from "lucide-react";
import { ChoresScreen } from "./screens/ChoresScreen";
import { DueTodayCard } from "./cards/DueTodayCard";
import { choreCommands } from "./commands";
import { choresSchedulable, APP_ID } from "./schedulable";
import { CHORES, COMPLETIONS } from "./domain/types";

export const choresApp: AppManifest = {
  id: APP_ID,
  title: "Chores",
  icon: ClipboardList,
  color: "var(--chart-2)",
  collections: [{ name: CHORES }, { name: COMPLETIONS, indexes: ["choreId"] }],
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
    },
  ],
  commands: choreCommands,
  schedulable: choresSchedulable,
};

export { CHORES, COMPLETIONS };
