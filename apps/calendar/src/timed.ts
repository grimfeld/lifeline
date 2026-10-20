import { getDocument, patchDocument, putDocument, removeDocument, vaultDocPath, type DateStr, type DocumentInput, type TimedItem, type TimedProvider, type TimedTemplate } from "@lifeline/core";
import { daysOf, describeTime, piecesOf, spanOf } from "./domain/events";
import { bandsIn, describeBlocker, isOneOff } from "./domain/blockers";
import { describeTemplate, durationOf, formatDuration } from "./domain/templates";
import { addEvent, allEvents, moveEvent, rescheduleEvent, useEvents } from "./data/repo";
import { allTimeBlockers, rescheduleTimeBlocker, useTimeBlockers } from "./data/blockers";
import { addEventFromTemplate, useEventTemplates } from "./data/templates";
import { addBlockerFromTemplate, useBlockerTemplates } from "./data/blockerTemplates";
import { BLOCKER_TEMPLATE_TYPE, EVENT_TYPE, TIME_BLOCKER_TYPE, type Event, type TimeBlocker } from "./domain/types";

export const APP_ID = "calendar";

/**
 * Events and Time blocker bands in range, as Timed items — one per day each
 * occupies. A timed Event's pieces have their own day's hours and carry its
 * whole span (ADR 0090).
 */
export function timedItemsOf(events: Event[], blockers: TimeBlocker[], range: { start: DateStr; end: DateStr }): TimedItem[] {
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
    const item = (date: DateStr, start: string | null, end: string | null): TimedItem => ({
      key: `${APP_ID}/${ev.id}@${date}`,
      appId: APP_ID,
      itemId: ev.id,
      title: ev.title,
      subtitle: describeTime(ev),
      date,
      start,
      end,
      tags: ev.tags ?? [],
    });
    const span = spanOf(ev);
    if (!span) {
      for (const date of daysOf(ev, range)) items.push(item(date, null, null));
      continue;
    }
    // On one day an Event keeps its own end (none is none); across days each piece has that day's hours.
    const oneDay = span.endDate === span.date;
    for (const p of piecesOf(ev, range)) items.push({ ...item(p.date, oneDay ? ev.start : p.start, oneDay ? ev.end : p.end), span });
  }
  return items;
}

/** Events on time surfaces: one item per day the event occupies. */
export const calendarTimed: TimedProvider = {
  appId: APP_ID,
  useItems(range) {
    return timedItemsOf(useEvents(), useTimeBlockers(), range);
  },
  async itemsIn(range) {
    return timedItemsOf(await allEvents(), await allTimeBlockers(), range);
  },
  async move(itemId, to) {
    if (await isBlocker(itemId)) await rescheduleTimeBlocker(itemId, to, null, null);
    else await moveEvent(itemId, to);
  },
  async reschedule(itemId, date, start, end) {
    if (await isBlocker(itemId)) await rescheduleTimeBlocker(itemId, date, start, end);
    else await rescheduleEvent(itemId, date, start, end);
  },
  async create({ title, date, start, endDate, end }) {
    await addEvent({ title, date, start, endDate, end });
  },
  createIntake: `${APP_ID}/event`,
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
  // Removed from the Schedule (ADR 0056): the Undo puts back the same Document, notes and Tags and id.
  async remove(itemId) {
    const row = await getDocument(itemId);
    if (!row || (row.type !== EVENT_TYPE && row.type !== TIME_BLOCKER_TYPE)) throw new Error("That item is gone");
    if (row.type === TIME_BLOCKER_TYPE && !(row as TimeBlocker).date) throw new Error("A weekly blocker is a rule — edit it on the Events screen's Blockers tab");
    await removeDocument(itemId);
    return async () => {
      await putDocument(row as DocumentInput);
    };
  },
  async rename(itemId, title) {
    const row = await getDocument(itemId);
    if (row?.type !== EVENT_TYPE) throw new Error("That event is gone");
    await patchDocument(itemId, { title });
  },
  href(itemId) {
    return vaultDocPath(itemId);
  },
};

/** The Timed hooks get an item id that is an Event's or a one-off blocker's (ADR 0029): the Document type tells. */
async function isBlocker(itemId: string): Promise<boolean> {
  return (await getDocument(itemId))?.type === TIME_BLOCKER_TYPE;
}
