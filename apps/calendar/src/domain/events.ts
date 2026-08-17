import { addDays, diffDays, formatTime, type DateStr } from "@lifeline/core";
import type { Event } from "./types";

/** Every day an event occupies, clamped to [start, end]. */
export function daysOf(ev: Event, range: { start: DateStr; end: DateStr }): DateStr[] {
  const last = ev.start === null && ev.endDate && ev.endDate > ev.date ? ev.endDate : ev.date;
  const from = ev.date > range.start ? ev.date : range.start;
  const to = last < range.end ? last : range.end;
  if (from > to) return [];
  const out: DateStr[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
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
