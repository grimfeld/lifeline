import { addDays, todayStr, type DateStr, type TimeStr } from "@lifeline/core";

/** What the Event dialog holds while it is being filled in. */
export interface EventForm {
  title: string;
  date: string;
  endDate: string;
  allDay: boolean;
  start: string;
  end: string;
}

/** The message under each field that is missing or wrong; empty when the event can be saved. */
export type EventFormErrors = Partial<Record<keyof Omit<EventForm, "allDay">, string>>;

export function eventFormErrors(f: EventForm): EventFormErrors {
  const errors: EventFormErrors = {};
  if (!f.title.trim()) errors.title = "Title required";
  if (!f.date) errors.date = "Day required";
  if (f.allDay) {
    if (f.date && f.endDate && f.endDate < f.date) errors.endDate = "End day must be after the first day";
  } else if (!f.start) errors.start = "Start time required";
  else if (f.end && f.end < f.start) errors.end = "End must be after start";
  return errors;
}

/** When an Event happens, its guarded Fields (ADR 0019). */
export interface EventWhen {
  date: string;
  endDate: string | null;
  start: string | null;
  end: string | null;
}

/** The form's day and times as the Event stores them: an all-day event has no times, a timed one a single day. */
export function whenOf(f: Omit<EventForm, "title">): EventWhen {
  return {
    date: f.date,
    endDate: f.allDay && f.endDate && f.endDate > f.date ? f.endDate : null,
    start: f.allDay ? null : f.start,
    end: f.allDay ? null : f.end || null,
  };
}

const DAY_MIN = 24 * 60;
const pad = (n: number) => String(n).padStart(2, "0");
const clock = (min: number): TimeStr => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** Minutes past midnight of an `HH:MM` time; null when empty or no time. */
export function minutesOf(t: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const [h, min] = [Number(m[1]), Number(m[2])];
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** A new timed Event lasts an hour. */
const NEW_EVENT_MIN = 60;

/**
 * When a new Event starts and ends, given the day asked for: on today at the
 * next quarter hour (tomorrow's first when today has none left), on any other
 * day at 09:00 — lasting an hour, cut at midnight while an Event keeps to one day.
 */
export function newEventWhen(day: DateStr, now: Date = new Date()): { date: DateStr; start: TimeStr; end: TimeStr } {
  let date = day;
  let start = 9 * 60;
  if (day === todayStr(now)) {
    start = Math.ceil((now.getHours() * 60 + now.getMinutes() + (now.getSeconds() || now.getMilliseconds() ? 1 : 0)) / 15) * 15;
    if (start >= DAY_MIN) [date, start] = [addDays(day, 1), 0];
  }
  return { date, start: clock(start), end: clock(Math.min(start + NEW_EVENT_MIN, DAY_MIN - 1)) };
}

/** Minutes from a timed Event's start to its end, on its one day; null while either is missing or the end is before the start. */
export function lengthOf(f: Pick<EventForm, "start" | "end">): number | null {
  const [s, e] = [minutesOf(f.start), minutesOf(f.end)];
  return s === null || e === null || e < s ? null : e - s;
}

/**
 * The form with a new start, its end moved by as much so the length is kept.
 * An end carried past midnight comes round the clock — before the start, so
 * refused while an Event keeps to one day, and the next day's once it may run on.
 */
export function withStart<F extends Pick<EventForm, "start" | "end">>(f: F, start: string): F {
  const length = lengthOf(f);
  const s = minutesOf(start);
  if (length === null || s === null) return { ...f, start };
  return { ...f, start, end: clock((s + length) % DAY_MIN) };
}
