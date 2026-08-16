import type { TimedItem, TimedProvider } from "@lifeline/core";
import { daysOf, describeTime } from "./domain/events";
import { moveEvent, useEvents } from "./data/repo";

export const APP_ID = "calendar";

/** Events on time surfaces: one item per day the event occupies. */
export const calendarTimed: TimedProvider = {
  appId: APP_ID,
  useItems(range) {
    const events = useEvents();
    const items: TimedItem[] = [];
    for (const ev of events) {
      for (const date of daysOf(ev, range)) {
        items.push({
          key: `${APP_ID}/${ev.id}@${date}`,
          appId: APP_ID,
          itemId: ev.id,
          title: ev.title,
          subtitle: describeTime(ev),
          date,
          start: ev.start,
          end: ev.end,
        });
      }
    }
    return items;
  },
  async move(itemId, to) {
    await moveEvent(itemId, to);
  },
};
