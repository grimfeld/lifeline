import { diffDays, formatTime, type DateStr } from "@lifeline/core";
import { dayPieces } from "./span";
import type { Event } from "./types";

/** Every day an event occupies, clamped to [start, end]: a timed one its own day, an all-day one each day of its span. */
export function daysOf(ev: Event, range: { start: DateStr; end: DateStr }): DateStr[] {
  if (ev.start !== null) return ev.date >= range.start && ev.date <= range.end ? [ev.date] : [];
  const last = ev.endDate && ev.endDate > ev.date ? ev.endDate : ev.date;
  return dayPieces({ date: ev.date, start: null, endDate: last, end: null }, range).map((p) => p.date);
}

export function isMultiDay(ev: Event): boolean {
  return ev.start === null && !!ev.endDate && ev.endDate > ev.date;
}

export function describeTime(ev: Event): string {
  if (ev.start === null) return isMultiDay(ev) ? `All day · ${diffDays(ev.date, ev.endDate!) + 1} days` : "All day";
  return ev.end ? `${formatTime(ev.start)} – ${formatTime(ev.end)}` : formatTime(ev.start);
}

/** Sort key: all-day first, then by start time, then title. */
export function compareEvents(a: Event, b: Event): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.start ?? "").localeCompare(b.start ?? "") ||
    a.title.localeCompare(b.title)
  );
}

/** True when the event happens on `date` (its day, or inside its all-day span). */
export function occursOn(ev: Event, date: DateStr): boolean {
  return daysOf(ev, { start: date, end: date }).length > 0;
}

/** Events happening on one day, in display order (all-day first, then by start). */
export function eventsOn(events: Event[], date: DateStr): Event[] {
  return events.filter((ev) => occursOn(ev, date)).sort(compareEvents);
}
