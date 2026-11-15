import { useMemo } from "react";
import { PERSON_TYPE, PLACE_TYPE, documentsOf, getDocument, patchDocument, putDocument, removeDocument, useDocuments, vaultDocPath, type DateStr, type DocumentInput, type TimedItem, type TimedProvider, type TimedTemplate } from "@lifeline/core";
import { daysOf, describeTime, piecesOf, spanOf } from "./domain/events";
import { bandsIn, blockerSpan, describeBlocker, isOneOff } from "./domain/blockers";
import { describeTemplate, durationOf, formatDuration } from "./domain/templates";
import { addEvent, allEvents, moveEvent, rescheduleEvent, useEvents } from "./data/repo";
import { allTimeBlockers, rescheduleTimeBlocker, useTimeBlockers } from "./data/blockers";
import { addEventFromTemplate, useEventTemplates } from "./data/templates";
import { addBlockerFromTemplate, useBlockerTemplates } from "./data/blockerTemplates";
import { BLOCKER_TEMPLATE_TYPE, EVENT_TYPE, TIME_BLOCKER_TYPE, type Event, type TimeBlocker } from "./domain/types";

export const APP_ID = "calendar";

/** The title of an Event's At by id (ADR 0119): a Place's or a Person's, nothing for one gone. */
export type AtTitles = ReadonlyMap<string, string>;

/** The titles an Event's At may name: every Place and Person, through Core's types (ADR 0100). */
export const atTitlesOf = (docs: readonly { id: string; title: string }[]): AtTitles => new Map(docs.map((d) => [d.id, d.title]));

/** An Event's At as a Timed item carries it: the id and title only, or nothing. */
export function atOf(ev: Pick<Event, "at">, titles: AtTitles): TimedItem["at"] {
  const title = ev.at ? titles.get(ev.at) : undefined;
  return ev.at && title !== undefined ? { docId: ev.at, title } : undefined;
}

/**
 * Events and Time blocker bands in range, as Timed items — one per day each
 * occupies. A timed Event's pieces have their own day's hours and carry its
 * whole span (ADR 0090), and its At (ADR 0119) when `titles` knows it.
 */
export function timedItemsOf(events: Event[], blockers: TimeBlocker[], range: { start: DateStr; end: DateStr }, titles: AtTitles = new Map()): TimedItem[] {
  const items: TimedItem[] = [];
  // Time blockers (ADR 0027) are painted per day: a weekly rule's bands are fixed, a one-off's (ADR 0029) may be
  // dragged, and each of its bands carries its whole span (ADR 0090) so a drag or resize acts on the whole blocker.
  for (const band of bandsIn(blockers, range)) {
    const span = blockerSpan(band.blocker);
    items.push({
      ...(span && { span }),
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
    const at = atOf(ev, titles);
    const item = (date: DateStr, start: string | null, end: string | null): TimedItem => ({
      ...(at && { at }),
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
    const events = useEvents();
    const blockers = useTimeBlockers();
    const places = useDocuments(PLACE_TYPE);
    const people = useDocuments(PERSON_TYPE);
    const titles = useMemo(() => atTitlesOf([...places, ...people]), [places, people]);
    const { start, end } = range;
    // Surfaces call this on every render: expand the Events and blockers again only when one moves.
    return useMemo(() => timedItemsOf(events, blockers, { start, end }, titles), [events, blockers, start, end, titles]);
  },
  async itemsIn(range) {
    const titles = atTitlesOf([...(await documentsOf(PLACE_TYPE)), ...(await documentsOf(PERSON_TYPE))]);
    return timedItemsOf(await allEvents(), await allTimeBlockers(), range, titles);
  },
  async move(itemId, to) {
    if (await isBlocker(itemId)) await rescheduleTimeBlocker(itemId, { date: to, start: null, end: null });
    else await moveEvent(itemId, to);
  },
  async reschedule(itemId, when) {
    if (await isBlocker(itemId)) await rescheduleTimeBlocker(itemId, when);
    else await rescheduleEvent(itemId, when);
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
