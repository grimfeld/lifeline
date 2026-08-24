import type { TimedItem, TimedProvider, TimedTemplate } from "@lifeline/core";
import { daysOf, describeTime } from "./domain/events";
import { bandsIn, describeBlocker } from "./domain/blockers";
import { describeTemplate, durationOf } from "./domain/templates";
import { addEvent, moveEvent, rescheduleEvent, useEvents } from "./data/repo";
import { useTimeBlockers } from "./data/blockers";
import { addEventFromTemplate, useEventTemplates } from "./data/templates";

export const APP_ID = "calendar";

/** Events on time surfaces: one item per day the event occupies. */
export const calendarTimed: TimedProvider = {
  appId: APP_ID,
  useItems(range) {
    const events = useEvents();
    const blockers = useTimeBlockers();
    const items: TimedItem[] = [];
    // Time blockers (ADR 0027) are painted per day from their weekly rule; they are never Documents on a day.
    for (const band of bandsIn(blockers, range)) {
      items.push({
        key: `${APP_ID}/blocker:${band.blocker.id}@${band.date}+${band.start}`,
        appId: APP_ID,
        itemId: band.blocker.id,
        title: band.blocker.title,
        subtitle: describeBlocker(band.blocker),
        date: band.date,
        start: band.start,
        end: band.end,
        tags: band.blocker.tags ?? [],
        color: band.blocker.color ?? undefined,
        background: true,
      });
    }
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
          tags: ev.tags ?? [],
        });
      }
    }
    return items;
  },
  async move(itemId, to) {
    await moveEvent(itemId, to);
  },
  async reschedule(itemId, date, start, end) {
    await rescheduleEvent(itemId, date, start, end);
  },
  async create({ title, date, start, end }) {
    await addEvent({ title, date, start, end });
  },
  useTemplates(): TimedTemplate[] {
    return useEventTemplates().map((t) => ({
      key: `${APP_ID}/${t.id}`,
      appId: APP_ID,
      id: t.id,
      title: t.title,
      subtitle: describeTemplate(t),
      durationMin: t.allDay ? null : durationOf(t),
      defaultStart: t.allDay ? null : t.defaultStart,
      tags: t.tags ?? [],
    }));
  },
  async createFromTemplate(templateId, date, start) {
    await addEventFromTemplate(templateId, date, start);
  },
};
