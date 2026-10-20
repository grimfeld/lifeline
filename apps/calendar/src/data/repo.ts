import { useMemo } from "react";
import { addDays, diffDays, documentsOf, getDocument, normalizeTags, patchDocument, putDocument, removeDocument, useDocuments, type DateStr, type TimedWhen } from "@lifeline/core";
import { EVENT_TYPE, type Event } from "../domain/types";
import type { EventWhen } from "../domain/eventForm";
import { rescheduled } from "../domain/events";
import { midnightNextDay } from "../domain/span";

/** PocketBase returns absent text fields as ""; re-establish null on read, and an old "24:00" end as 00:00 the next day (ADR 0090). */
function normalize(e: Event): Event {
  return midnightNextDay({
    ...e,
    notes: e.notes ?? "",
    endDate: e.endDate || null,
    start: e.start || null,
    end: e.end || null,
    tags: e.tags ?? [],
  });
}

export function useEvents(): Event[] {
  const rows = useDocuments<Event>(EVENT_TYPE);
  return useMemo(() => rows.map(normalize), [rows]);
}

export async function allEvents(): Promise<Event[]> {
  return (await documentsOf<Event>(EVENT_TYPE)).map(normalize);
}

export async function addEvent(input: {
  title: string;
  notes?: string;
  date: DateStr;
  endDate?: DateStr | null;
  start?: string | null;
  end?: string | null;
  tags?: string[];
}): Promise<string> {
  const start = input.start || null;
  const row = await putDocument<Event>(midnightNextDay({
    type: EVENT_TYPE,
    title: input.title,
    notes: input.notes ?? "",
    date: input.date,
    // A timed Event keeps the day its end is on (ADR 0090); an all-day one its last day.
    endDate: input.endDate && input.endDate > input.date && (!start || input.end) ? input.endDate : null,
    start,
    end: start ? (input.end || null) : null,
    tags: normalizeTags(input.tags ?? []),
  }));
  return row.id;
}

export async function updateEvent(ev: Event): Promise<void> {
  await putDocument<Event>(midnightNextDay({ ...ev, type: EVENT_TYPE, tags: normalizeTags(ev.tags ?? []) }));
}

/** Edit an Event's own words — its notes and Tags — from wherever it is shown (its Peek, ADR 0085). */
export async function editEvent(id: string, edit: { notes?: string; tags?: string[] }): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (edit.notes !== undefined) patch.notes = edit.notes;
  if (edit.tags !== undefined) patch.tags = normalizeTags(edit.tags);
  if (Object.keys(patch).length > 0) await patchDocument(id, patch);
}

/** Set when an Event happens (its guarded Fields), as the Event dialog does — `whenOf` its form. */
export async function setEventWhen(id: string, when: EventWhen): Promise<void> {
  const ev = await getDocument<Event>(id);
  if (!ev || ev.type !== EVENT_TYPE) return;
  await patchDocument(id, midnightNextDay({ date: when.date, endDate: when.endDate, start: when.start, end: when.end }));
}

export async function deleteEvent(id: string): Promise<void> {
  await removeDocument(id);
}

/** Move an event's first day to `to`, its end day with it, keeping its length. */
export async function moveEvent(id: string, to: DateStr): Promise<void> {
  const ev = await getDocument<Event>(id);
  // Time blockers reach the Timed contract through this App too (ADR 0027); they have no day to move.
  if (!ev || ev.type !== EVENT_TYPE) return;
  const e = normalize(ev);
  const len = e.endDate && e.endDate > e.date ? diffDays(e.date, e.endDate) : 0;
  await putDocument<Event>({ ...e, date: to, endDate: len > 0 ? addDays(to, len) : null });
}

/** Reschedule an event to when it now happens, whole (ADR 0090) — `rescheduled` says what is kept. */
export async function rescheduleEvent(id: string, when: TimedWhen): Promise<void> {
  const ev = await getDocument<Event>(id);
  if (!ev || ev.type !== EVENT_TYPE) return;
  await putDocument<Event>(midnightNextDay(rescheduled(normalize(ev), when)));
}
