import {
  todayStr,
  type SchedulableItem,
  type SchedulableProvider,
  type Urgency,
} from "@lifeline/core";
import { dueState } from "./domain/schedule";
import { describeSchedule } from "./domain/schedule";
import { completeChore, lastDoneMap, useChores, useCompletions } from "./data/repo";

export const APP_ID = "chores";

/**
 * Chores on time surfaces: each active chore appears on its due date, and
 * rolls forward to today while overdue (a chore is a state, not a backlog —
 * CONTEXT.md). Completions in range appear as done items for history.
 */
export const choresSchedulable: SchedulableProvider = {
  appId: APP_ID,
  overduePolicy: "roll-forward",

  useItems(range) {
    const chores = useChores();
    const completions = useCompletions();
    const today = todayStr();
    const last = lastDoneMap(completions);
    const byId = new Map(chores.map((c) => [c.id, c]));

    const items: SchedulableItem[] = [];
    for (const chore of chores) {
      if (chore.status !== "active") continue;
      const ds = dueState(chore, last.get(chore.id) ?? null, today);
      if (ds.state === "not-scheduled") continue;
      const urgency: Urgency =
        ds.state === "overdue" ? "overdue" : ds.state === "due-today" ? "due-today" : "upcoming";
      items.push({
        key: `${APP_ID}/${chore.id}`,
        appId: APP_ID,
        itemId: chore.id,
        title: chore.name,
        subtitle: describeSchedule(chore.schedule),
        date: ds.dueOn,
        urgency,
      });
    }
    // Done history inside the queried range.
    for (const c of completions) {
      if (c.doneOn < range.start || c.doneOn > range.end) continue;
      const chore = byId.get(c.choreId);
      if (!chore) continue;
      items.push({
        key: `${APP_ID}/${chore.id}@${c.doneOn}`,
        appId: APP_ID,
        itemId: chore.id,
        title: chore.name,
        date: c.doneOn,
        urgency: "none",
        completedOn: c.doneOn,
      });
    }
    return items;
  },

  async complete(itemId, on) {
    await completeChore(itemId, on);
  },
};
