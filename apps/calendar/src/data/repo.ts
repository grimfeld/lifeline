import { useMemo } from "react";
import { addDays, diffDays, documentsOf, getDocument, newId, normalizeTags, patchDocument, putDocuments, removeDocument, useDocuments, type DateStr, type DocumentInput, type TimedWhen } from "@lifeline/core";
import { EVENT_TYPE, type Event } from "../domain/types";
import type { EventWhen } from "../domain/eventForm";
import { normalizeEvent, rescheduled, spanOf } from "../domain/events";
import { midnightNextDay } from "../domain/span";
import { attachedBlockerRows, blockersDetachedFrom, blockersFollowing, type AttachPick } from "./attached";

export function useEvents(): Event[] {
  const rows = useDocuments<Event>(EVENT_TYPE);
  return useMemo(() => rows.map(normalizeEvent), [rows]);
}

export async function allEvents(): Promise<Event[]> {
  return (await documentsOf<Event>(EVENT_TYPE)).map(normalizeEvent);
}

export async function addEvent(input: {
  title: string;
  notes?: string;
  date: DateStr;
  endDate?: DateStr | null;
  start?: string | null;
  end?: string | null;
  tags?: string[];
  with?: string[];
  /** Blockers to attach as it is made (its dialog's Before…/After…), written with it; ignored when it is all day. */
  attach?: readonly AttachPick[];
}): Promise<string> {
  const start = input.start || null;
  const ev = midnightNextDay({
    id: newId(),
    type: EVENT_TYPE,
    title: input.title,
    notes: input.notes ?? "",
    date: input.date,
    endDate: endDayOf(input, start),
    start,
    end: start ? (input.end || null) : null,
    tags: normalizeTags(input.tags),
    with: [...new Set(input.with)],
  });
  // The Event and the blockers attached to it land together, or not at all.
  await putDocuments([ev, ...(await attachedBlockerRows(ev, input.attach ?? []))]);
  return ev.id;
}

/** A timed Event keeps the day its end is on (ADR 0090), an all-day one its last day: a day after the first, and a timed one only with an end time. */
function endDayOf(input: { date: DateStr; endDate?: DateStr | null; end?: string | null }, start: string | null): DateStr | null {
  return input.endDate && input.endDate > input.date && (!start || input.end) ? input.endDate : null;
}

/**
 * The one way an existing Event is written when it may move (#497): the Event
 * and its attached blockers, each rewritten against where it now is, in one
 * all-or-none write — so they never land half-moved, whichever Surface, dialog
 * or tool moved it.
 */
async function writeMoved(was: Event, now: Event, added: readonly DocumentInput[] = []): Promise<void> {
  // Made all day, its blockers are detached in the same write and stay where they stand (#519).
  // Only the bands' moved Fields are written, onto each band as it is when the write lands.
  const blockers = !spanOf(now) && spanOf(was) ? await blockersDetachedFrom(was.id) : await blockersFollowing(was, now);
  await putDocuments([now, ...added], blockers);
}

/**
 * The Event dialog's save: everything at once, its attached blockers
 * following a new time, and those picked in the dialog (`attach`) attached
 * against it in the same write.
 */
export async function updateEvent(ev: Event, attach: readonly AttachPick[] = []): Promise<void> {
  const next = midnightNextDay({ ...ev, type: EVENT_TYPE, tags: normalizeTags(ev.tags ?? []) });
  const was = await getDocument<Event>(ev.id);
  const now = normalizeEvent(next);
  // Its row gone, the save puts the Event back with the dialog's picks in the same write.
  if (!was || was.type !== EVENT_TYPE) return void (await putDocuments([next, ...(await attachedBlockerRows(now, attach))]));
  await writeMoved(normalizeEvent(was), now, await attachedBlockerRows(now, attach));
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
  const was = normalizeEvent(ev);
  await writeMoved(was, normalizeEvent({ ...ev, ...midnightNextDay({ date: when.date, endDate: when.endDate, start: when.start, end: when.end }) }));
}

export async function deleteEvent(id: string): Promise<void> {
  await removeDocument(id);
}

/** Move an event's first day to `to`, its end day with it, keeping its length. */
export async function moveEvent(id: string, to: DateStr): Promise<void> {
  const ev = await getDocument<Event>(id);
  // Time blockers reach the Timed contract through this App too (ADR 0027); they have no day to move.
  if (!ev || ev.type !== EVENT_TYPE) return;
  const e = normalizeEvent(ev);
  const len = e.endDate && e.endDate > e.date ? diffDays(e.date, e.endDate) : 0;
  await writeMoved(e, { ...e, date: to, endDate: len > 0 ? addDays(to, len) : null });
}

/** Reschedule an event to when it now happens, whole (ADR 0090) — `rescheduled` says what is kept. */
export async function rescheduleEvent(id: string, when: TimedWhen): Promise<void> {
  const ev = await getDocument<Event>(id);
  if (!ev || ev.type !== EVENT_TYPE) return;
  const was = normalizeEvent(ev);
  await writeMoved(was, midnightNextDay(rescheduled(was, when)));
}
