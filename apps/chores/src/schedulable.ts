import { useMemo } from "react";
import {
  todayStr,
  type DateStr,
  type SchedulableItem,
  type SchedulableProvider,
  type Urgency,
} from "@lifeline/core";
import { dueState } from "./domain/schedule";
import { describeSchedule } from "./domain/schedule";
import { allChores, allCompletions, completeChore, lastDoneMap, useChores, useCompletions } from "./data/repo";
import type { Chore, Completion } from "./domain/types";

export const APP_ID = "chores";
export const CHORES_HREF = "/app/chores";

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
    const { start, end } = range;
    // Surfaces call this on every render: derive again only when an input moves — today included.
    return useMemo(() => itemsOf(chores, completions, { start, end }, today), [chores, completions, start, end, today]);
  },

  async itemsIn(range) {
    return itemsOf(await allChores(), await allCompletions(), range, todayStr());
  },

  async complete(itemId, on) {
    await completeChore(itemId, on);
  },
};

/** Active chores on their due day, and completions in range as done history — what `useItems` and `itemsIn` both report. */
function itemsOf(chores: Chore[], completions: Completion[], range: { start: DateStr; end: DateStr }, today: DateStr): SchedulableItem[] {
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
      title: chore.title,
      subtitle: describeSchedule(chore.schedule),
      date: ds.dueOn,
      urgency,
      tags: chore.tags,
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
      title: chore.title,
      date: c.doneOn,
      urgency: "none",
      completedOn: c.doneOn,
      tags: chore.tags,
    });
  }
  return items;
}
