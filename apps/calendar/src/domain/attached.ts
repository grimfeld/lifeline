import { endReadOn, formatTime, momentAfter, spanLasting, spanLength, WEEKDAY_NAMES, weekdayOf, type DateStr, type TimedSpan, type TimeStr } from "@lifeline/core";
import { EVENT_TYPE, type Attachment, type BlockerSide, type TimeBlocker } from "./types";

/** Each side as a person reads it: "Before Dentist", the Before… menu, a Base's Side. */
export const SIDE_LABELS: Record<BlockerSide, string> = { before: "Before", after: "After" };

/** Both sides, in the order they are offered. */
export const BLOCKER_SIDES = Object.keys(SIDE_LABELS) as BlockerSide[];

/** Minutes from one moment to another (negative when the second is earlier). */
function minutesBetween(from: { date: DateStr; time: TimeStr }, to: { date: DateStr; time: TimeStr }): number {
  return spanLength({ date: from.date, start: from.time, endDate: to.date, end: to.time }) ?? 0;
}

/**
 * Where an attached blocker lands when its Event moves from `old` to `now`
 * (CONTEXT.md "Attached blocker"): a `before` band moves as the Event's start
 * moved, an `after` band as its end moved — so each keeps its gap to that edge
 * and its own length, whatever its gap or length was set to by hand. Moments,
 * not times: across midnight and across days alike (ADR 0090).
 */
export function followedSpan(old: TimedSpan, now: TimedSpan, band: TimedSpan, side: BlockerSide): TimedSpan {
  const shift =
    side === "before"
      ? minutesBetween({ date: old.date, time: old.start }, { date: now.date, time: now.start })
      : minutesBetween({ date: old.endDate, time: old.end }, { date: now.endDate, time: now.end });
  if (shift === 0) return band;
  const s = momentAfter(band.date, band.start, shift);
  const e = momentAfter(band.endDate, band.end, shift);
  return { date: s.date, start: s.time, endDate: e.date, end: e.time };
}

/** The span a band of `minutes` takes flush against one edge of an Event: ending at its start, or starting at its end. */
export function flushSpan(event: TimedSpan, minutes: number, side: BlockerSide): TimedSpan {
  if (side === "after") return spanLasting(event.endDate, event.end, minutes);
  const s = momentAfter(event.date, event.start, -minutes);
  return { date: s.date, start: s.time, endDate: event.date, end: event.start };
}

/**
 * The Event a blocker is attached to, and on which side; null for a plain
 * one: a weekly blocker, one with no link, or one whose side is not one of
 * the two. Whether that Event still exists is the reader's question — one
 * whose Event is gone reads as detached (#519).
 */
export function attachmentOf(b: Pick<TimeBlocker, "date" | "attachedTo" | "side">): Attachment | null {
  if (!b.date || !b.attachedTo || (b.side !== "before" && b.side !== "after")) return null;
  return { eventId: b.attachedTo, side: b.side };
}

/**
 * The one rule for a band whose Event is gone: `attachment` stands only while
 * `event` (what its id reads now) is still an Event, else the band reads as
 * plain (#519). The data layer and the blocker's Peek both ask this.
 */
export function liveAttachmentTo(attachment: Attachment | null, event: { type: string } | null | undefined): Attachment | null {
  return attachment && event?.type === EVENT_TYPE ? attachment : null;
}

/** Whether a blocker is attached to the Event `eventId` (`attachmentOf`'s rule). */
export const isAttachedTo = (b: Pick<TimeBlocker, "date" | "attachedTo" | "side">, eventId: string): boolean => attachmentOf(b)?.eventId === eventId;

/**
 * An attached band's times as its Event's Peek lists them: "08:30 – 09:00",
 * with the weekday in front when the band starts on another day than the
 * Event (a trip the night before), and on its end when that is another day.
 */
export function describeBeside(band: TimedSpan, eventDay: DateStr): string {
  const day = band.date !== eventDay ? `${WEEKDAY_NAMES[weekdayOf(band.date)]} ` : "";
  return `${day}${formatTime(band.start)} – ${endReadOn(band, band.date)}`;
}
