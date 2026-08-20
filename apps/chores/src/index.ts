import type { AppManifest, DocumentTypeDef } from "@lifeline/core";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { ChoresScreen } from "./screens/ChoresScreen";
import { DueTodayCard } from "./cards/DueTodayCard";
import { HeatmapCard, useHeatmapInstanceTitle, useHeatmapChoreOptions } from "./cards/HeatmapCard";
import { choreCommands } from "./commands";
import { choresSchedulable, APP_ID, CHORES_HREF } from "./schedulable";
import { choresDaylog } from "./daylog";
import { describeSchedule } from "./domain/schedule";
import { CHORE, COMPLETION, type Chore, type Completion } from "./domain/types";

/**
 * Built-in Document types owned by the Chores App (ADR 0019). `schedule`,
 * `status` and `anchorDate` are guarded: only the App's operations (edit
 * dialog, pause/resume) may write them — a Base shows them read-only.
 */
const choreType: DocumentTypeDef = {
  id: CHORE,
  label: "Chores",
  icon: ClipboardList,
  titleRule: "name",
  body: "none",
  linkable: true,
  href: () => CHORES_HREF,
  order: 20,
  builtIn: true,
  fields: [
    { key: "status", label: "Status", kind: "select", guarded: true, column: true, options: [
      { value: "active", label: "Active" }, { value: "paused", label: "Paused" }, { value: "archived", label: "Archived" },
    ] },
    { key: "schedule", label: "Schedule", kind: "text", guarded: true, column: true },
    { key: "anchorDate", label: "Anchor date", kind: "date", guarded: true },
  ],
};

const completionType: DocumentTypeDef = {
  id: COMPLETION,
  label: "Chore completions",
  icon: CheckCircle2,
  internal: true,
  titleRule: "derived",
  titleOf: (d) => `Done ${(d as Completion).doneOn}`,
  body: "none",
  indexes: ["choreId"],
  href: () => CHORES_HREF,
  order: 21,
  builtIn: true,
  fields: [
    { key: "choreId", label: "Chore", kind: "link", linkType: CHORE, guarded: true, column: true },
    { key: "doneOn", label: "Done on", kind: "date", guarded: true, column: true },
    { key: "recordedAt", label: "Recorded at", kind: "datetime", guarded: true },
  ],
};

/** Human text of a chore's schedule, for Bases that render the guarded `schedule` field. */
export function choreScheduleLabel(chore: Chore): string {
  return describeSchedule(chore.schedule);
}

export const choresApp: AppManifest = {
  id: APP_ID,
  title: "Chores",
  icon: ClipboardList,
  color: "var(--chart-aqua)",
  types: [choreType, completionType],
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
  daylog: choresDaylog,
};

export { CHORE, COMPLETION };
