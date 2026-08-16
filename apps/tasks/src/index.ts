import type { AppManifest } from "@lifeline/core";
import { ListTodo } from "lucide-react";
import { TasksScreen } from "./screens/TasksScreen";
import { TodayTasksCard } from "./cards/TodayTasksCard";
import { UnassignedCard } from "./cards/UnassignedCard";
import { taskCommands } from "./commands";
import { tasksSchedulable, APP_ID } from "./schedulable";
import { OCCURRENCES, TASKS } from "./domain/types";

export const tasksApp: AppManifest = {
  id: APP_ID,
  title: "Tasks",
  icon: ListTodo,
  color: "var(--chart-3)",
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
  ],
  commands: taskCommands,
  schedulable: tasksSchedulable,
};

export { TASKS, OCCURRENCES };
export type { Task, OccurrenceOverride, Recurrence } from "./domain/types";
