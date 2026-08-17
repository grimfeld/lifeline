import type { DaylogItem, DaylogProvider } from "@lifeline/core";
import { completionsOn } from "./domain/heatmap";
import { useChores, useCompletions } from "./data/repo";
import { CHORES_HREF } from "./linkable";
import { APP_ID } from "./schedulable";

/**
 * What happened in Chores on a day (ADR 0009): one "Done" fact per completion
 * recorded for that date. Completions of a since-deleted chore are skipped —
 * there is no name to show.
 */
export const choresDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const chores = useChores();
    const completions = useCompletions();
    const byId = new Map(chores.map((c) => [c.id, c]));
    const items: DaylogItem[] = [];
    for (const c of completionsOn(completions, date)) {
      const chore = byId.get(c.choreId);
      if (!chore) continue;
      items.push({
        key: `${APP_ID}/${c.id}`,
        appId: APP_ID,
        itemId: chore.id,
        kind: "Done",
        title: chore.name,
        tags: chore.tags ?? [],
        time: null,
        href: CHORES_HREF,
      });
    }
    return items;
  },
};
