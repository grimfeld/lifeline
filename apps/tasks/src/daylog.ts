import type { DaylogItem, DaylogProvider } from "@lifeline/core";
import { completedInRange } from "./domain/completed";
import { useOverrides, useTasks } from "./data/repo";
import { TASKS_HREF } from "./domain/types";
import { APP_ID } from "./schedulable";

/**
 * The Daylog Contract for Tasks: what got done on a day — one-time Tasks
 * completed that day and completed Occurrences of recurring ones. Reuses the
 * same helper as the "Completed recently" card so both agree on what counts.
 */
export const tasksDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const tasks = useTasks();
    const overrides = useOverrides();
    return completedInRange(tasks, overrides, date, date).map(
      (e): DaylogItem => ({
        key: `${APP_ID}/${e.key}`,
        appId: APP_ID,
        itemId: e.taskId,
        kind: "Completed",
        title: e.title,
        subtitle: e.recurring ? "recurring" : undefined,
        time: null,
        href: TASKS_HREF,
        tags: e.tags,
      }),
    );
  },
};
