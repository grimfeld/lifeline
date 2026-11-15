import { getDocument, type DocumentInput } from "@lifeline/core";
import { attachmentOf, flushSpan, followedSpan } from "../domain/attached";
import { blockerSpan } from "../domain/blockers";
import { spanOf } from "../domain/events";
import { durationOf } from "../domain/templates";
import { BLOCKER_TEMPLATE_TYPE, EVENT_TYPE, TIME_BLOCKER_TYPE, type BlockerSide, type BlockerTemplate, type Event, type TimeBlocker } from "../domain/types";
import { addTimeBlocker, allTimeBlockers } from "./blockers";

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
