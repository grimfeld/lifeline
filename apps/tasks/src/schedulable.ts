import {
  todayStr,
  vaultDocPath,
  type SchedulableItem,
  type SchedulableProvider,
  type Urgency,
} from "@lifeline/core";
import { deriveItems, describeRecurrence, parseItemId } from "./domain/occurrences";
import { moveItem, setCompleted, setEstimate, useOverrides, useTasks } from "./data/repo";

export const APP_ID = "tasks";

/**
 * Tasks on time surfaces. A one-time task sits on its day (or in the pool
 * when unassigned); a recurring task contributes one item per Occurrence.
 * Missing a day does not roll a task forward: it stays where it was and
 * reads as overdue (CONTEXT.md — "a simple task's placement just passes").
 * A recurring task is overdue at most once, though: an Occurrence the rule
 * has moved past has lapsed and reads as plain history (ADR 0036).
 * Moves are owned by the App: they change the task's day / the Occurrence's
 * override, never a Core Placement pin.
 */
export const tasksSchedulable: SchedulableProvider = {
  appId: APP_ID,
  overduePolicy: "stay",

  useItems(range) {
    const tasks = useTasks();
    const overrides = useOverrides();
    const today = todayStr();
    return deriveItems(tasks, overrides, range, today).map((it): SchedulableItem => {
      let urgency: Urgency = "none";
      if (!it.completedOn && !it.lapsed && it.date !== null) {
        urgency = it.date < today ? "overdue" : it.date === today ? "due-today" : "upcoming";
      }
      return {
        key: `${APP_ID}/${it.itemId}`,
        appId: APP_ID,
        itemId: it.itemId,
        title: it.task.title,
        subtitle: it.task.recurrence
          ? describeRecurrence(it.task.recurrence)
          : it.task.notes || undefined,
        date: it.date,
        urgency,
        completedOn: it.completedOn,
        tags: it.task.tags ?? [],
        estimateMin: it.task.estimate,
      };
    });
  },

  async complete(itemId, on) {
    await setCompleted(itemId, on);
  },

  async move(itemId, to) {
    await moveItem(itemId, to);
  },

  async setEstimate(itemId, minutes) {
    await setEstimate(itemId, minutes);
  },

  // An Occurrence opens its Task: the rule is what gets edited.
  href(itemId) {
    return vaultDocPath(parseItemId(itemId).taskId);
  },
};
