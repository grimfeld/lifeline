import { addDays, diffDays, type DateStr, type Moment } from "@lifeline/core";
import { compareEvents, lastDayOf, spanOf } from "./events";
import type { Event } from "./types";

/** The moment an Event ends: a timed Event's end day and time (its start when it has no end), an all-day Event's last day out. */
function endOf(ev: Event): Moment {
  const span = spanOf(ev);
  return span ? { date: span.endDate, time: span.end } : { date: lastDayOf(ev), time: "24:00" };
}

/** True once an Event has ended: it counts as running until its end moment, not the end of its first day. */
export function isOver(ev: Event, now: Moment): boolean {
  const end = endOf(ev);
  return `${end.date}T${end.time}` <= `${now.date}T${now.time}`;
}

/**
 * Whole days from `today` until the event: 0 on its day (or anywhere inside
 * a multi-day event still in progress), positive before, negative once its
 * last day has passed.
 */
export function daysUntil(ev: Event, today: DateStr): number {
  if (ev.date <= today && today <= lastDayOf(ev)) return 0;
  return ev.date > today ? diffDays(today, ev.date) : diffDays(today, lastDayOf(ev));
}

/** Events not yet over at `now` (running ones included), sorted by date then start time. */
export function futureEvents(events: Event[], now: Moment): Event[] {
  return events.filter((e) => !isOver(e, now)).sort(compareEvents);
}

/** The next `n` Events not yet over (one still running counts). */
export function nextEvents(events: Event[], now: Moment, n: number): Event[] {
  return futureEvents(events, now).slice(0, Math.max(0, n));
}

/**
 * The Events screen's sections at `now`: Today (started, not yet over —
 * an overnight Event stays here on its second day until it ends), Upcoming
 * (starting a later day) and the past 30 days (over, newest first).
 */
export function groupEvents(events: Event[], now: Moment): { today: Event[]; upcoming: Event[]; past: Event[] } {
  const sorted = [...events].sort(compareEvents);
  const monthAgo = addDays(now.date, -30);
  return {
    today: sorted.filter((e) => e.date <= now.date && !isOver(e, now)),
    upcoming: sorted.filter((e) => e.date > now.date),
    past: sorted.filter((e) => isOver(e, now) && lastDayOf(e) >= monthAgo).reverse(),
  };
}

/** "Today" / "Tomorrow" / null (caller renders the number). */
export function countdownWord(days: number): string | null {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return null;
}
