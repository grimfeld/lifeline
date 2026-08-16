import { addDays, db, diffDays, put, remove, newId, todayStr, useLiveQuery, type DateStr } from "@lifeline/core";
import { EVENTS, type Event } from "../domain/types";

/** PocketBase returns absent text fields as ""; re-establish null on read. */
function normalize(e: Event): Event {
  return {
    ...e,
    notes: e.notes ?? "",
    endDate: e.endDate || null,
    start: e.start || null,
    end: e.end || null,
  };
}

export function useEvents(): Event[] {
  return useLiveQuery(
    async () => (await db().collection<Event>(EVENTS).where("deleted").equals(0).toArray()).map(normalize),
    [],
    [] as Event[],
  );
}

export async function addEvent(input: {
  title: string;
  notes?: string;
  date: DateStr;
  endDate?: DateStr | null;
  start?: string | null;
  end?: string | null;
}): Promise<string> {
  const id = newId();
  const start = input.start || null;
  await put<Event>(EVENTS, {
    id,
    title: input.title,
    notes: input.notes ?? "",
    date: input.date,
    endDate: start ? null : (input.endDate ?? null),
    start,
    end: start ? (input.end || null) : null,
    createdAt: todayStr(),
  });
  return id;
}

export async function updateEvent(ev: Event): Promise<void> {
  await put<Event>(EVENTS, ev);
}

export async function deleteEvent(id: string): Promise<void> {
  await remove(EVENTS, id);
}

/** Move an event's first day to `to`, keeping its length. */
export async function moveEvent(id: string, to: DateStr): Promise<void> {
  const ev = await db().collection<Event>(EVENTS).get(id);
  if (!ev || ev.deleted) return;
  const e = normalize(ev);
  const len = e.endDate && e.endDate > e.date ? diffDays(e.date, e.endDate) : 0;
  await put<Event>(EVENTS, { ...e, date: to, endDate: len > 0 ? addDays(to, len) : null });
}
