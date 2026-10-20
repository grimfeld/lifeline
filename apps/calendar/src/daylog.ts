import type { DaylogItem, DaylogProvider } from "@lifeline/core";
import { describeUntil, eventsOn } from "./domain/events";
import { useEvents } from "./data/repo";
import { EVENTS_HREF } from "./domain/types";
import { APP_ID } from "./timed";

/** What happened on a day: the Events taking place that day. */
export const calendarDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date): DaylogItem[] {
    const events = useEvents();
    return eventsOn(events, date).map((ev) => ({
      key: `${APP_ID}/${ev.id}@${date}`,
      appId: APP_ID,
      itemId: ev.id,
      kind: "Event",
      title: ev.title,
      subtitle: describeUntil(ev, date),
      time: ev.start,
      href: EVENTS_HREF,
      tags: ev.tags ?? [],
    }));
  },
};
