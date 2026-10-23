import { useMemo } from "react";
import type { DateStr, TimedItem, TimedProvider } from "@lifeline/core";
import { allCalendarSubs, useCalendarSubs } from "./data/repo";
import { cachedEntries, useSourceCaches } from "./data/cache";
import { expandIcal } from "./domain/ical";
import { colorVar, type CalendarSub, type SourceCacheEntry } from "./domain/types";
import { APP_ID } from "./hrefs";

/** Every cached subscription's occurrences in range, as Timed items. */
function timedItemsOf(subs: CalendarSub[], caches: Map<string, SourceCacheEntry>, range: { start: DateStr; end: DateStr }): TimedItem[] {
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
        subtitle: o.location ?? sub.title,
        date: o.date,
        start: o.start,
        end: o.end,
        tags: sub.tags ?? [],
        color: colorVar(sub.color),
      });
    }
  }
  return out;
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on each subscription's id, fetch time and colour (`key`) and the range's dates: subs, caches and range are new objects on every read
    return useMemo(() => timedItemsOf(subs, caches, range), [key, range.start, range.end]);
  },
  async itemsIn(range) {
    const subs = await allCalendarSubs();
    return timedItemsOf(subs, await cachedEntries(subs.map((s) => s.id)), range);
  },
};
