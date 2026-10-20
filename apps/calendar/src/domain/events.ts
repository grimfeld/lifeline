import { addDays, describeSpan, diffDays, formatTime, weekdayOf, type DateStr, type TimedSpan, type TimedWhen } from "@lifeline/core";
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * When an Event ends, as read on one of its days: "until 06:00", or
 * "until Tue 06:00" on a day it doesn't end on. "all day" for an all-day
 * Event; undefined for one with no end.
 */
export function describeUntil(ev: Event, date: DateStr): string | undefined {
  if (ev.start === null) return "all day";
  const span = ev.end ? spanOf(ev) : null;
  if (!span) return undefined;
  const day = span.endDate !== date ? `${WEEKDAYS[weekdayOf(span.endDate)]} ` : "";
  return `until ${day}${formatTime(span.end)}`;
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

/** The last day an Event covers: an all-day one's last day, a timed one's end day (the day before, when it ends at 00:00). */
function lastDayOf(ev: Event): DateStr {
  const span = spanOf(ev);
  if (!span) return isDay(ev.endDate) && ev.endDate > ev.date ? ev.endDate : ev.date;
  return span.end === "00:00" && span.endDate > span.date ? addDays(span.endDate, -1) : span.endDate;
}

/**
 * An Event rescheduled through the Timed contract (ADR 0090): a timed one
 * takes the end day it is given (none stored when it ends on its start day);
 * an all-day one its last day, or keeps how many days it covered.
 */
export function rescheduled(ev: Event, when: TimedWhen): Event {
  const { date, start } = when;
  if (start) {
    const endDate = when.endDate && when.endDate > date ? when.endDate : null;
    return { ...ev, date, start, endDate, end: when.end };
  }
  const last = when.endDate ?? addDays(date, diffDays(ev.date, lastDayOf(ev)));
  return { ...ev, date, start: null, end: null, endDate: last > date ? last : null };
}
