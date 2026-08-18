import { useMemo } from "react";
import type { TimedItem, TimedProvider } from "@lifeline/core";
import { useCalendarSubs } from "./data/repo";
import { useSourceCaches } from "./data/cache";
import { expandIcal } from "./domain/ical";
import { colorVar } from "./domain/types";
import { APP_ID, sourceHref } from "./hrefs";

/**
 * Calendar subscriptions as read-only Timed items (ADR 0017): no move,
 * reschedule or create — nothing is ever written back or copied.
 */
export const sourcesTimed: TimedProvider = {
  appId: APP_ID,
  useItems(range): TimedItem[] {
    const subs = useCalendarSubs();
    const caches = useSourceCaches(subs);
    const key = subs.map((s) => `${s.id}:${caches.get(s.id)?.fetchedAt ?? ""}:${s.color}`).join("|");
    return useMemo(() => {
      const out: TimedItem[] = [];
      for (const sub of subs) {
        const body = caches.get(sub.id)?.body;
        if (!body) continue;
        let occ;
        try {
          occ = expandIcal(body, range.start, range.end);
        } catch {
          continue;
        }
        for (const o of occ) {
          const itemId = `${sub.id}/${o.uid}/${o.date}`;
          out.push({
            key: `${APP_ID}/${itemId}`,
            appId: APP_ID,
            itemId,
            title: o.title,
            subtitle: o.location ?? sub.name,
            date: o.date,
            start: o.start,
            end: o.end,
            tags: sub.tags ?? [],
            color: colorVar(sub.color),
          });
        }
      }
      return out;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, range.start, range.end]);
  },
};

export { sourceHref };
