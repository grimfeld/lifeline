import { addDays, diffDays, NEW_TIMED_MIN, spanLasting, spanMovedTo, spanWithEnd, toHours, type DateStr, type TimedItem, type TimedWhen } from "@lifeline/core";
import { SNAP_MIN, toClock } from "../surfaces/hours";

/** A Timed item's when as the Peek's timing section holds it (#538): always an end day, the end null where the item has none. */
export type WhenTime = Required<TimedWhen>;

/** The whole of what was tapped (ADR 0090): a piece of an item across days times the item, from its start. */
export function timedWhenOf(t: Pick<TimedItem, "date" | "start" | "end" | "span">): WhenTime {
  if (t.span) return { ...t.span, end: t.end === null ? null : t.span.end };
  return { date: t.date, start: t.start, endDate: t.date, end: t.start ? t.end : null };
}

/** The same item from another start, keeping its length (an end-less one stays end-less; an all-day one gets an hour). */
export function timedStartingAt(w: WhenTime, start: string): WhenTime {
  if (!w.start) return spanLasting(w.date, start, NEW_TIMED_MIN);
  return spanMovedTo({ date: w.date, start: w.start, end: w.end, span: { ...w, start: w.start, end: w.end ?? w.start } }, w.date, start);
}

/** The start moved by `min` minutes inside its start day, the length kept. */
export function timedNudged(w: WhenTime, min: number): WhenTime {
  if (!w.start) return w;
  const h = Math.max(0, Math.min(24 - SNAP_MIN / 60, toHours(w.start) + min / 60));
  return timedStartingAt(w, toClock(h));
}

/** A new End (ADR 0090): an End earlier than the Start rolls to the next day; an end day rolling would not give is kept. */
export function timedEndingAt(w: WhenTime, end: string): WhenTime {
  if (!w.start) return w;
  return spanWithEnd({ ...w, start: w.start, end: w.end ?? w.start }, end);
}

/** The same item on another day, its end day moved with it. */
export function timedOnDay(w: WhenTime, d: DateStr): WhenTime {
  return { ...w, date: d, endDate: addDays(w.endDate, diffDays(w.date, d)) };
}

/** All day on its start day. */
export function timedAllDay(w: WhenTime): WhenTime {
  return { date: w.date, start: null, endDate: w.date, end: null };
}

/** What the Timed hooks take: an all-day when has no end day of its own. */
export function contractWhen(w: WhenTime): TimedWhen {
  return w.start ? w : { date: w.date, start: null, end: null };
}
