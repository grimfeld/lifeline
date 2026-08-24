import { getDocument, type TimedItem, type TimedProvider, type TimedTemplate } from "@lifeline/core";
import { daysOf, describeTime } from "./domain/events";
import { bandsIn, describeBlocker, isOneOff } from "./domain/blockers";
import { describeTemplate, durationOf, formatDuration } from "./domain/templates";
import { addEvent, moveEvent, rescheduleEvent, useEvents } from "./data/repo";
import { rescheduleTimeBlocker, useTimeBlockers } from "./data/blockers";
import { addEventFromTemplate, useEventTemplates } from "./data/templates";
import { addBlockerFromTemplate, useBlockerTemplates } from "./data/blockerTemplates";
import { BLOCKER_TEMPLATE_TYPE, TIME_BLOCKER_TYPE } from "./domain/types";

export const APP_ID = "calendar";

/** Events on time surfaces: one item per day the event occupies. */
export const calendarTimed: TimedProvider = {
  appId: APP_ID,
  useItems(range) {
    const events = useEvents();
    const blockers = useTimeBlockers();
    const items: TimedItem[] = [];
    // Time blockers (ADR 0027) are painted per day: a weekly rule's bands are fixed, a one-off's (ADR 0029) may be dragged.
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
        fixed: !isOneOff(band.blocker),
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
    if (await isBlocker(itemId)) await rescheduleTimeBlocker(itemId, to, null, null);
    else await moveEvent(itemId, to);
  },
  async reschedule(itemId, date, start, end) {
    if (await isBlocker(itemId)) await rescheduleTimeBlocker(itemId, date, start, end);
    else await rescheduleEvent(itemId, date, start, end);
  },
  async create({ title, date, start, end }) {
    await addEvent({ title, date, start, end });
  },
  useTemplates(): TimedTemplate[] {
    const events = useEventTemplates().map(
      (t): TimedTemplate => ({
        key: `${APP_ID}/${t.id}`,
        appId: APP_ID,
        id: t.id,
        title: t.title,
        subtitle: describeTemplate(t),
        durationMin: t.allDay ? null : durationOf(t),
        defaultStart: t.allDay ? null : t.defaultStart,
        tags: t.tags ?? [],
      }),
    );
    // Blocker templates (ADR 0029) make bands, not things: hatched in the palette, and they need a slot.
    const blockers = useBlockerTemplates().map(
      (t): TimedTemplate => ({
        key: `${APP_ID}/${t.id}`,
        appId: APP_ID,
        id: t.id,
        title: t.title,
        subtitle: formatDuration(durationOf(t)),
        durationMin: durationOf(t),
        defaultStart: null,
        tags: t.tags ?? [],
        color: t.color ?? undefined,
        background: true,
      }),
    );
    return [...events, ...blockers];
  },
  async createFromTemplate(templateId, date, start) {
    const row = await getDocument(templateId);
    if (row?.type === BLOCKER_TEMPLATE_TYPE) await addBlockerFromTemplate(templateId, date, start);
    else await addEventFromTemplate(templateId, date, start);
  },
};

/** The Timed hooks get an item id that is an Event's or a one-off blocker's (ADR 0029): the Document type tells. */
async function isBlocker(itemId: string): Promise<boolean> {
  return (await getDocument(itemId))?.type === TIME_BLOCKER_TYPE;
}
