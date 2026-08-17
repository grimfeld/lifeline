import type { AppManifest } from "@lifeline/core";
import { ListTodo } from "lucide-react";
import { TasksScreen } from "./screens/TasksScreen";
import { TodayTasksCard } from "./cards/TodayTasksCard";
import { UnassignedCard } from "./cards/UnassignedCard";
import { CompletedCard } from "./cards/CompletedCard";
import { QuickAddCard } from "./cards/QuickAddCard";
import { taskCommands } from "./commands";
import { tasksSchedulable, APP_ID } from "./schedulable";
import { tasksLinkable } from "./linkable";
import { tasksDaylog } from "./daylog";
import { OCCURRENCES, TASKS } from "./domain/types";

export const tasksApp: AppManifest = {
  id: APP_ID,
  title: "Tasks",
  icon: ListTodo,
  color: "var(--chart-blue)",
  collections: [
    { name: TASKS, indexes: ["date", "status"] },
    { name: OCCURRENCES, indexes: ["taskId", "[taskId+sourceDate]", "movedTo"] },
  ],
  screens: [
    {
      id: "tasks.main",
      title: "Tasks",
      path: "tasks",
      icon: ListTodo,
      component: TasksScreen,
    },
  ],
  cards: [
    {
      id: "tasks.today",
      title: "Tasks today",
      description: "Today's tasks and anything overdue, tick-off inline",
      component: TodayTasksCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
    },
    {
      id: "tasks.unassigned",
      title: "Unassigned tasks",
      description: "The pool of tasks not yet on a day, with quick add",
      component: UnassignedCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
    },
    {
      id: "tasks.completed",
      title: "Completed recently",
      description: "What you got done in the last days, grouped by day — untick to undo",
      component: CompletedCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: {
        days: { kind: "number", label: "Days back", default: 7, min: 1, max: 90 },
      },
      instanceTitle: (s) => (Number(s.days) === 1 ? "Completed today" : `Completed · last ${s.days} days`),
    },
    {
      id: "tasks.quick-add",
      title: "Quick add",
      description: "One input: type a task, hit Enter",
      component: QuickAddCard,
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      settings: {
        target: {
          kind: "select",
          label: "Adds to",
          default: "unassigned",
          options: [
            { value: "unassigned", label: "Unassigned pool" },
            { value: "today", label: "Today" },
          ],
        },
      },
      instanceTitle: (s) => (s.target === "today" ? "Quick add · Today" : "Quick add"),
    },
  ],
  commands: taskCommands,
  schedulable: tasksSchedulable,
  linkable: tasksLinkable,
  daylog: tasksDaylog,
};

export { TASKS, OCCURRENCES };
export type { Task, OccurrenceOverride, Recurrence } from "./domain/types";
