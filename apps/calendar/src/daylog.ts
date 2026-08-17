import type { DaylogItem, DaylogProvider } from "@lifeline/core";
import { eventsOn } from "./domain/events";
import { useEvents } from "./data/repo";
import { EVENTS_HREF } from "./linkable";
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
      subtitle: ev.end ? `until ${ev.end}` : ev.start === null ? "all day" : undefined,
      time: ev.start,
      href: EVENTS_HREF,
    }));
  },
};
