import type { DaylogItem, DateStr } from "@lifeline/core";
import { memoryHref, type Memory } from "./types";

export const APP_ID = "memories";

/** The Memories App's Daylog facts for one day: each Memory dated that day, untimed, linking to it. */
export function daylogMemories(memories: readonly Memory[], day: DateStr): DaylogItem[] {
  return memories
    .filter((m) => m.date === day)
    .map((m) => ({
      key: `${APP_ID}/${m.id}`,
      appId: APP_ID,
      itemId: m.id,
      kind: "Memory",
      title: m.title,
      time: null,
      href: memoryHref(m.id),
      tags: m.tags ?? [],
    }));
}
