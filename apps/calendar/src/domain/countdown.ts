import { diffDays, type DateStr } from "@lifeline/core";
import { compareEvents, isMultiDay } from "./events";
import type { Event } from "./types";

/** Last day an event occupies (endDate for multi-day all-day events, else date). */
export function lastDayOf(ev: Event): DateStr {
  return isMultiDay(ev) ? ev.endDate! : ev.date;
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

/** Events not yet over (last day >= today), sorted by date then start time. */
export function futureEvents(events: Event[], today: DateStr): Event[] {
  return events.filter((e) => lastDayOf(e) >= today).sort(compareEvents);
}

/** The next `n` events that are today or later (in-progress multi-day counts as today). */
export function nextEvents(events: Event[], today: DateStr, n: number): Event[] {
  return futureEvents(events, today).slice(0, Math.max(0, n));
}

/** "Today" / "Tomorrow" / null (caller renders the number). */
export function countdownWord(days: number): string | null {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return null;
}
