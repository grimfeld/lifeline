import { useMemo } from "react";
import { getDocument, patchDocument, removeDocumentsWhere, type DocumentInput } from "@lifeline/core";
import { attachmentOf, flushSpan, followedSpan, isAttachedTo, liveAttachmentTo } from "../domain/attached";
import { blockerSpan } from "../domain/blockers";
import { normalizeEvent, spanOf } from "../domain/events";
import { durationOf } from "../domain/templates";
import { BLOCKER_TEMPLATE_TYPE, EVENT_TYPE, TIME_BLOCKER_TYPE, type Attachment, type BlockerSide, type BlockerTemplate, type Event, type TimeBlocker } from "../domain/types";
import { addTimeBlocker, allTimeBlockers, timeBlockerRow, useTimeBlockers, type TimeBlockerInput } from "./blockers";

/** A Before…/After… pick: which Blocker template to attach, on which side of the Event. */
export interface AttachPick {
  templateId: string;
  side: BlockerSide;
}

/** What attaching reads of an Event: its id and when it happens. */
type AttachableEvent = Pick<Event, "id" | "date" | "endDate" | "start" | "end">;

/**
 * The blocker a pick makes for a timed Event (CONTEXT.md "Attached blocker"):
 * one-off, from the Blocker template, flush against the Event's start
 * (`before`) or its end (`after`), attached to it. null for an all-day Event.
 */
async function attachedBlockerInput(ev: AttachableEvent, pick: AttachPick): Promise<TimeBlockerInput | null> {
  const span = spanOf(ev);
  if (!span) return null;
  const t = await getDocument<BlockerTemplate>(pick.templateId);
  if (!t || t.type !== BLOCKER_TEMPLATE_TYPE) throw new Error("That blocker template is gone");
  const at = flushSpan(span, durationOf(t), pick.side);
  return { title: t.title, date: at.date, endDate: at.endDate, weekdays: [], start: at.start, end: at.end, color: t.color || null, tags: t.tags ?? [], attachment: { eventId: ev.id, side: pick.side } };
}

/**
 * Attach a blocker to a timed Event: the only way a blocker becomes attached —
 * dropping a template beside an Event never does. An all-day Event takes none.
 */
export async function attachBlocker(eventId: string, templateId: string, side: BlockerSide): Promise<string> {
  const ev = await getDocument<Event>(eventId);
  if (!ev || ev.type !== EVENT_TYPE) throw new Error("That event is gone");
  const input = await attachedBlockerInput(normalizeEvent(ev), { templateId, side });
  if (!input) throw new Error("An all-day event takes no attached blockers");
  return addTimeBlocker(input);
}

/**
 * The rows of the blockers `picks` attach to an Event, to write in the same
 * batch as the Event itself (its dialog's Before…/After…). None for an all-day
 * Event: the dialog offers no picks there.
 */
export async function attachedBlockerRows(ev: AttachableEvent, picks: readonly AttachPick[]): Promise<DocumentInput<TimeBlocker>[]> {
  const rows: DocumentInput<TimeBlocker>[] = [];
  for (const pick of picks) {
    const input = await attachedBlockerInput(ev, pick);
    if (input) rows.push(timeBlockerRow(input));
  }
  return rows;
}

/** The one-off blockers attached to an Event, wherever they stand. */
export async function attachedBlockersOf(eventId: string): Promise<TimeBlocker[]> {
  return (await allTimeBlockers()).filter((b) => isAttachedTo(b, eventId));
}

/**
 * The attached blockers of an Event that moves from `was` to `now`, each
 * rewritten where it now stands (`followedSpan`), ready to write in the same
 * batch as the Event. None when either is all day: a blocker follows only a
 * timed Event (made all day, it is detached instead — #519).
 */
export async function blockersFollowing(was: Event, now: Event): Promise<TimeBlocker[]> {
  const [old, next] = [spanOf(was), spanOf(now)];
  if (!old || !next) return [];
  const out: TimeBlocker[] = [];
  for (const b of await attachedBlockersOf(was.id)) {
    const span = blockerSpan(b);
    const side = attachmentOf(b)?.side;
    if (!span || !side) continue;
    const to = followedSpan(old, next, span, side);
    if (to.date === span.date && to.start === span.start && to.endDate === span.endDate && to.end === span.end) continue;
    out.push({ ...b, date: to.date, endDate: to.endDate, start: to.start, end: to.end });
  }
  return out;
}

/** Whether `eventId` names an Event that is still there. */
async function eventExists(eventId: string): Promise<boolean> {
  return (await getDocument(eventId))?.type === EVENT_TYPE;
}

/**
 * Where a blocker is attached, as everything that reads it should see it: its
 * `attachmentOf`, unless the Event is missing or deleted — then it reads as
 * detached (null) and is kept, never deleted for that reason (#519).
 */
export async function liveAttachment(b: TimeBlocker): Promise<Attachment | null> {
  const at = attachmentOf(b);
  return liveAttachmentTo(at, at && (await getDocument(at.eventId)));
}

/** An Event's deletion takes its attached blockers with it (ADR 0045), from every place a Document can be deleted. */
export async function removeAttachedBlockers(eventId: string): Promise<void> {
  const ids = new Set((await attachedBlockersOf(eventId)).map((b) => b.id));
  await removeDocumentsWhere(TIME_BLOCKER_TYPE, (d) => ids.has(d.id));
}

/**
 * The Event's attached blockers, cleared of their link and side (they keep
 * their times): what making it all day writes beside it. Empty when nothing
 * is attached.
 */
export async function blockersDetachedFrom(eventId: string): Promise<TimeBlocker[]> {
  return (await attachedBlockersOf(eventId)).map((b) => ({ ...b, attachedTo: null, side: null }));
}

/** The one-off blockers attached to an Event, live (its Peek lists them). */
export function useAttachedBlockers(eventId: string): TimeBlocker[] {
  const all = useTimeBlockers();
  return useMemo(() => all.filter((b) => isAttachedTo(b, eventId)), [all, eventId]);
}

/**
 * Let an attached blocker stand on its own: the link and side are cleared and
 * the band stays exactly where it is. Returns the undo, which attaches it
 * again on the same side — unless its Event is gone by then, when the band
 * stays plain.
 */
export async function detachBlocker(id: string): Promise<() => Promise<void>> {
  const b = (await allTimeBlockers()).find((x) => x.id === id);
  if (!b) throw new Error("That blocker is gone");
  const was = await liveAttachment(b);
  if (!was) return async () => {};
  await patchDocument(id, { attachedTo: null, side: null });
  return async () => {
    if (await eventExists(was.eventId)) await patchDocument(id, { attachedTo: was.eventId, side: was.side });
  };
}
