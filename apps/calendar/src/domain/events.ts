import { describeSpan, diffDays, formatTime, type DateStr, type TimedSpan } from "@lifeline/core";
import { dayPieces, type DayPiece, type DayRange } from "./span";
import type { Event } from "./types";

const isDay = (d: string | null): d is DateStr => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

/**
 * A timed Event's whole span (ADR 0090): from its start to its end, on its
 * end day when it has one. An Event with no end is a moment at its start.
 * null for an all-day Event.
 */
export function spanOf(ev: Event): TimedSpan | null {
  if (ev.start === null) return null;
  const endDate = isDay(ev.endDate) && ev.endDate > ev.date ? ev.endDate : ev.date;
  return { date: ev.date, start: ev.start, endDate, end: ev.end ?? ev.start };
}

/** A timed Event's pieces in range, one per day it covers (#215's split). */
export function piecesOf(ev: Event, range: DayRange): DayPiece[] {
  const span = spanOf(ev);
  return span ? dayPieces(span, range) : [];
}

/** Every day an event occupies, clamped to [start, end]: each day of its span, timed or all day. */
export function daysOf(ev: Event, range: { start: DateStr; end: DateStr }): DateStr[] {
  if (ev.start !== null) return piecesOf(ev, range).map((p) => p.date);
  const last = ev.endDate && ev.endDate > ev.date ? ev.endDate : ev.date;
  return dayPieces({ date: ev.date, start: null, endDate: last, end: null }, range).map((p) => p.date);
}

export function isMultiDay(ev: Event): boolean {
  return ev.start === null && !!ev.endDate && ev.endDate > ev.date;
}

export function describeTime(ev: Event): string {
  if (ev.start === null) return isMultiDay(ev) ? `All day · ${diffDays(ev.date, ev.endDate!) + 1} days` : "All day";
  return ev.end ? describeSpan(spanOf(ev)!) : formatTime(ev.start);
}

/** Sort key: all-day first, then by start time, then title. */
export function compareEvents(a: Event, b: Event): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.start ?? "").localeCompare(b.start ?? "") ||
    a.title.localeCompare(b.title)
  );
}

/** True when the event happens on `date` (its day, or inside its span). */
export function occursOn(ev: Event, date: DateStr): boolean {
  return daysOf(ev, { start: date, end: date }).length > 0;
}

/** Events happening on one day, in display order (all-day first, then by start). */
export function eventsOn(events: Event[], date: DateStr): Event[] {
  return events.filter((ev) => occursOn(ev, date)).sort(compareEvents);
}
