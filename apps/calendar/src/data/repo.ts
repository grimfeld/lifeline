import { useMemo } from "react";
import { addDays, diffDays, documentsOf, getDocument, normalizeTags, putDocument, removeDocument, useDocuments, type DateStr } from "@lifeline/core";
import { EVENT_TYPE, type Event } from "../domain/types";

/** PocketBase returns absent text fields as ""; re-establish null on read. */
function normalize(e: Event): Event {
  return {
    ...e,
    notes: e.notes ?? "",
    endDate: e.endDate || null,
    start: e.start || null,
    end: e.end || null,
    tags: e.tags ?? [],
  };
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
  const row = await putDocument<Event>({
    type: EVENT_TYPE,
    title: input.title,
    notes: input.notes ?? "",
    date: input.date,
    endDate: start ? null : (input.endDate ?? null),
    start,
    end: start ? (input.end || null) : null,
    tags: normalizeTags(input.tags ?? []),
  });
  return row.id;
}

export async function updateEvent(ev: Event): Promise<void> {
  await putDocument<Event>({ ...ev, type: EVENT_TYPE, tags: normalizeTags(ev.tags ?? []) });
}

export async function deleteEvent(id: string): Promise<void> {
  await removeDocument(id);
}

/** Move an event's first day to `to`, keeping its length. */
export async function moveEvent(id: string, to: DateStr): Promise<void> {
  const ev = await getDocument<Event>(id);
  // Time blockers reach the Timed contract through this App too (ADR 0027); they have no day to move.
  if (!ev || ev.type !== EVENT_TYPE) return;
  const e = normalize(ev);
  const len = e.endDate && e.endDate > e.date ? diffDays(e.date, e.endDate) : 0;
  await putDocument<Event>({ ...e, date: to, endDate: len > 0 ? addDays(to, len) : null });
}

/** Reschedule an event onto a day and time (null start = all day). Multi-day events keep their length. */
export async function rescheduleEvent(id: string, date: DateStr, start: string | null, end: string | null): Promise<void> {
  const ev = await getDocument<Event>(id);
  if (!ev || ev.type !== EVENT_TYPE) return;
  const e = normalize(ev);
  const len = e.endDate && e.endDate > e.date ? diffDays(e.date, e.endDate) : 0;
  await putDocument<Event>({ ...e, date, endDate: len > 0 ? addDays(date, len) : null, start, end: start ? end : null });
}
