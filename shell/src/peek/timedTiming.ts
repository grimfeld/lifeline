import { addDays, diffDays, NEW_TIMED_MIN, nudgeClock, spanLasting, spanMovedTo, spanWithEnd, type DateStr, type TimedItem, type TimedWhen, type WholeWhen } from "@lifeline/core";

/** The same item from another start, keeping its length (an end-less one stays end-less; an all-day one gets an hour). */
export function timedStartingAt(w: WholeWhen, start: string): WholeWhen {
  if (!w.start) return spanLasting(w.date, start, NEW_TIMED_MIN);
  return spanMovedTo({ date: w.date, start: w.start, end: w.end, span: { ...w, start: w.start, end: w.end ?? w.start } }, w.date, start);
}

/** The start moved by `min` minutes inside its start day, the length kept. */
export function timedNudged(w: WholeWhen, min: number): WholeWhen {
  const start = w.start && nudgeClock(w.start, min);
  return start ? timedStartingAt(w, start) : w;
}

/** A new End (ADR 0090): an End earlier than the Start rolls to the next day; an end day rolling would not give is kept. */
export function timedEndingAt(w: WholeWhen, end: string): WholeWhen {
  if (!w.start) return w;
  return spanWithEnd({ ...w, start: w.start, end: w.end ?? w.start }, end);
}

/** The same item on another day, its end day moved with it. */
export function timedOnDay(w: WholeWhen, d: DateStr): WholeWhen {
  return { ...w, date: d, endDate: addDays(w.endDate, diffDays(w.date, d)) };
}

/** All day on its start day. */
export function timedAllDay(w: WholeWhen): WholeWhen {
  return { date: w.date, start: null, endDate: w.date, end: null };
}

/** What the Timed hooks take: an all-day when has no end day of its own. */
export function contractWhen(w: WholeWhen): TimedWhen {
  return w.start ? w : { date: w.date, start: null, end: null };
}

/**
 * What a Timed item's timing section lets the user do, as its App allows
 * (ADR 0124, ADR 0056): `retime` — day and hours, where the App reschedules;
 * `day` — another day only, where it only moves (a Deadline); `none` —
 * read-only, and always for a weekly blocker, which is a rule.
 */
export type TimedControls = "retime" | "day" | "none";
export function timedControls(item: Pick<TimedItem, "fixed">, can: { reschedule: boolean; move: boolean }): TimedControls {
  if (item.fixed) return "none";
  return can.reschedule ? "retime" : can.move ? "day" : "none";
}
