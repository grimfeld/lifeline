import { useMemo } from "react";
import { getDocument, patchDocument, removeDocumentsWhere, type DocumentInput } from "@lifeline/core";
import { attachmentOf, flushSpan, followedSpan } from "../domain/attached";
import { blockerSpan } from "../domain/blockers";
import { spanOf } from "../domain/events";
import { durationOf } from "../domain/templates";
import { BLOCKER_TEMPLATE_TYPE, EVENT_TYPE, TIME_BLOCKER_TYPE, type BlockerSide, type BlockerTemplate, type Event, type TimeBlocker } from "../domain/types";
import { addTimeBlocker, allTimeBlockers, useTimeBlockers } from "./blockers";

/**
 * Attach a blocker to a timed Event (CONTEXT.md "Attached blocker"): a
 * one-off blocker made from a Blocker template, flush against the Event's
 * start (`before`) or its end (`after`), linked to it. The only way a blocker
 * becomes attached — dropping a template beside an Event never does. An
 * all-day Event takes none.
 */
export async function attachBlocker(eventId: string, templateId: string, side: BlockerSide): Promise<string> {
  const ev = await getDocument<Event>(eventId);
  if (!ev || ev.type !== EVENT_TYPE) throw new Error("That event is gone");
  const span = spanOf({ ...ev, start: ev.start || null, end: ev.end || null, endDate: ev.endDate || null });
  if (!span) throw new Error("An all-day event takes no attached blockers");
  const t = await getDocument<BlockerTemplate>(templateId);
  if (!t || t.type !== BLOCKER_TEMPLATE_TYPE) throw new Error("That blocker template is gone");
  const at = flushSpan(span, durationOf(t), side);
  return addTimeBlocker({ title: t.title, date: at.date, endDate: at.endDate, weekdays: [], start: at.start, end: at.end, color: t.color || null, tags: t.tags ?? [], attachedTo: eventId, side });
}

/** The one-off blockers attached to an Event, wherever they stand. */
export async function attachedBlockersOf(eventId: string): Promise<TimeBlocker[]> {
  return (await allTimeBlockers()).filter((b) => attachmentOf(b)?.eventId === eventId);
}

/**
 * The attached blockers of an Event that moves from `was` to `now`, each
 * rewritten where it now stands (`followedSpan`), ready to write in the same
 * batch as the Event. None when either is all day: a blocker follows only a
 * timed Event (made all day, it is detached instead — #519).
 */
export async function blockersFollowing(was: Event, now: Event): Promise<DocumentInput[]> {
  const [old, next] = [spanOf(was), spanOf(now)];
  if (!old || !next) return [];
  const out: DocumentInput[] = [];
  for (const b of await attachedBlockersOf(was.id)) {
    const span = blockerSpan(b);
    const side = attachmentOf(b)?.side;
    if (!span || !side) continue;
    const to = followedSpan(old, next, span, side);
    if (to.date === span.date && to.start === span.start && to.endDate === span.endDate && to.end === span.end) continue;
    out.push({ ...b, type: TIME_BLOCKER_TYPE, date: to.date, endDate: to.endDate, start: to.start, end: to.end } as DocumentInput);
  }
  return out;
}

/**
 * Where a blocker is attached, as everything that reads it should see it: its
 * `attachmentOf`, unless the Event is missing or deleted — then it reads as
 * detached (null) and is kept, never deleted for that reason (#519).
 */
export async function liveAttachment(b: TimeBlocker): Promise<{ eventId: string; side: BlockerSide } | null> {
  const at = attachmentOf(b);
  if (!at) return null;
  const ev = await getDocument<Event>(at.eventId);
  return ev && ev.type === EVENT_TYPE ? at : null;
}

/** The ids a Workspace move of the Event takes along (ADR 0048): its attached blockers. */
export async function attachedBlockerIds(eventId: string): Promise<string[]> {
  return (await attachedBlockersOf(eventId)).map((b) => b.id);
}

/** An Event's deletion takes its attached blockers with it (ADR 0045), from every place a Document can be deleted. */
export async function removeAttachedBlockers(eventId: string): Promise<void> {
  await removeDocumentsWhere(TIME_BLOCKER_TYPE, (d) => attachmentOf(d as TimeBlocker)?.eventId === eventId);
}

/**
 * The Event's attached blockers, cleared of their link and side (they keep
 * their times): what making it all day writes beside it. Empty when nothing
 * is attached.
 */
export async function detachedFrom(eventId: string): Promise<DocumentInput[]> {
  return (await attachedBlockersOf(eventId)).map((b) => ({ ...b, type: TIME_BLOCKER_TYPE, attachedTo: null, side: null }) as DocumentInput);
}

/** The one-off blockers attached to an Event, live (its Peek lists them). */
export function useAttachedBlockers(eventId: string): TimeBlocker[] {
  const all = useTimeBlockers();
  return useMemo(() => all.filter((b) => attachmentOf(b)?.eventId === eventId), [all, eventId]);
}

/**
 * Let an attached blocker stand on its own: the link and side are cleared and
 * the band stays exactly where it is. Returns the undo, which attaches it
 * again on the same side.
 */
export async function detachBlocker(id: string): Promise<() => Promise<void>> {
  const b = (await allTimeBlockers()).find((x) => x.id === id);
  if (!b) throw new Error("That blocker is gone");
  const was = await liveAttachment(b);
  if (!was) return async () => {};
  await patchDocument(id, { attachedTo: null, side: null });
  return async () => {
    await patchDocument(id, { attachedTo: was.eventId, side: was.side });
  };
}
