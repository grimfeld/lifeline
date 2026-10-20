import { addDays, clockMinutes, clockOf, DAY_MIN, diffDays, lastDayCovered, NEW_TIMED_MIN, spanLasting, spanLength, spanProblem, todayStr, whenProblem, type DateStr, type TimeStr } from "@lifeline/core";

/** What the Event dialog holds while it is being filled in. */
export interface EventForm {
  title: string;
  date: string;
  /** All day: the last day ("" = the first). Timed: the day the End is on ("" = the Start's day). */
  endDate: string;
  allDay: boolean;
  start: string;
  end: string;
}

/** When something happens, as a form holds it: an Event's, or a one-off Time blocker's (which is never all day). */
export type WhenForm = Omit<EventForm, "title">;

/** The message under each of a when's fields that is missing or wrong. */
export type WhenFormErrors = Partial<Record<keyof Omit<WhenForm, "allDay">, string>>;

/** The message under each field that is missing or wrong; empty when the event can be saved. */
export type EventFormErrors = WhenFormErrors & { title?: string };

/** What is missing or wrong in a when — an Event's or a one-off Time blocker's; empty when it can be saved. */
export function whenFormErrors(f: WhenForm): WhenFormErrors {
  const errors: WhenFormErrors = {};
  if (!f.date) errors.date = "Day required";
  if (f.allDay) {
    if (f.date && f.endDate && f.endDate < f.date) errors.endDate = "End day must be after the first day";
  } else if (!f.start) errors.start = "Start time required";
  // The one rule (ADR 0090): the end moment strictly after the start moment.
  else if (f.date && f.end) {
    const problem = spanProblem({ date: f.date, start: f.start, endDate: f.endDate || f.date, end: f.end });
    if (problem) errors.end = problem;
  }
  return errors;
}

export function eventFormErrors(f: EventForm): EventFormErrors {
  return { ...(f.title.trim() ? {} : { title: "Title required" }), ...whenFormErrors(f) };
}

/**
 * Why an Event can't be added with these (the add-event Command, and MCP's
 * `calendar_add_event` through it); null when it can. Core's `whenProblem`,
 * as a reschedule is checked, and an end day needs an end time.
 */
export function eventArgsError(a: { date: DateStr; start?: string | null; end?: string | null; endDate?: DateStr | null }): string | null {
  if (a.start && !a.end && a.endDate && a.endDate !== a.date) return "An end day needs an end time";
  return whenProblem({ date: a.date, start: a.start ?? null, endDate: a.endDate || undefined, end: a.end ?? null });
}

/** When an Event happens, its guarded Fields (ADR 0019). */
export interface EventWhen {
  date: string;
  endDate: string | null;
  start: string | null;
  end: string | null;
}

/**
 * The form's day and times as the Event stores them: an all-day event has no
 * times and a last day when it runs past the first; a timed one an end day
 * when its End is on another day (ADR 0090).
 */
export function whenOf(f: Omit<EventForm, "title">): EventWhen {
  const runsOn = f.endDate && f.endDate > f.date && (f.allDay || !!f.end);
  return {
    date: f.date,
    endDate: runsOn ? f.endDate : null,
    start: f.allDay ? null : f.start,
    end: f.allDay ? null : f.end || null,
  };
}

/** The end of a form's span from `start` lasting `minutes`, as the form holds an end: "" for the day when still on `date`. */
function endAt(date: string, start: TimeStr, minutes: number): { endDate: string; end: TimeStr } {
  const span = spanLasting(date || "2000-01-01", start, minutes);
  return { endDate: date && span.endDate !== span.date ? span.endDate : "", end: span.end };
}

/**
 * When a new Event starts and ends, given the day asked for: on today at the
 * next quarter hour (tomorrow's first when today has none left), on any other
 * day at 09:00 — lasting an hour, into the next day when it starts late.
 */
export function newEventWhen(day: DateStr, now: Date = new Date()): { date: DateStr; start: TimeStr; endDate: string; end: TimeStr } {
  let date = day;
  let start = 9 * 60;
  if (day === todayStr(now)) {
    start = Math.ceil((now.getHours() * 60 + now.getMinutes() + (now.getSeconds() || now.getMilliseconds() ? 1 : 0)) / 15) * 15;
    if (start >= DAY_MIN) [date, start] = [addDays(day, 1), 0];
  }
  return { date, start: clockOf(start), ...endAt(date, clockOf(start), NEW_TIMED_MIN) };
}

type Times = Pick<EventForm, "start" | "end"> & Partial<Pick<EventForm, "date" | "endDate">>;

/** Minutes from a timed Event's start to its end, across the days between; null while either is missing or the end is before the start. */
export function lengthOf(f: Times): number | null {
  // A form with no day yet, or an unreadable end day, counts its times on one day.
  const day = f.date || "2000-01-01";
  const endDay = f.date && f.endDate && Number.isFinite(diffDays(f.date, f.endDate)) ? f.endDate : day;
  const length = spanLength({ date: day, start: f.start, endDate: endDay, end: f.end });
  return length === null || length < 0 ? null : length;
}

/** The day an End rolls to (ADR 0090): the Start's own day, or the next when the End is earlier than the Start. */
function rolledEndDate(f: Times): string {
  const [s, e] = [clockMinutes(f.start), clockMinutes(f.end)];
  return s !== null && e !== null && e < s && f.date ? addDays(f.date, 1) : "";
}

/** The end day as the form compares it: "" for the Start's own day. */
const endDayOf = (f: Times) => (f.endDate && f.endDate !== f.date ? f.endDate : "");

/**
 * The form with a new start, its end moved by as much so the length is kept —
 * across midnight onto the next day, and back onto one day when it fits.
 */
export function withStart<F extends Times>(f: F, start: string): F {
  const length = lengthOf(f);
  if (length === null || clockMinutes(start) === null) return { ...f, start };
  return { ...f, start, ...endAt(f.date ?? "", start, length) };
}

/** Whether the End's day was picked by hand — not the one rolling gives — so the form shows its Date picker. */
export function endDayPicked(f: Times): boolean {
  return endDayOf(f) !== rolledEndDate(f);
}

/**
 * The form with a new End (ADR 0090). An End earlier than the Start rolls to
 * the next day, and back when it is moved after the Start again. An end day
 * picked by hand (one that rolling would not give) is kept.
 */
export function withEnd<F extends Times>(f: F, end: string): F {
  const rolled = endDayOf(f) === rolledEndDate(f);
  return { ...f, end, endDate: rolled ? rolledEndDate({ ...f, end }) : f.endDate };
}

/** The form on another day: a timed Event's end day moves with it, keeping its length; an all-day one's last day stays put. */
export function withDate<F extends Times & Pick<EventForm, "allDay">>(f: F, date: string): F {
  const endDate = endDayOf(f);
  if (f.allDay || !endDate || !f.date || !date) return { ...f, date };
  return { ...f, date, endDate: addDays(date, diffDays(f.date, endDate)) };
}

/**
 * The form made all day or timed. All day, an Event runs to the last day its
 * time touched; timed again, it is on its one day (the usual times return).
 */
export function withAllDay<F extends Times & Pick<EventForm, "allDay">>(f: F, allDay: boolean): F {
  if (allDay === f.allDay) return f;
  if (!allDay) return { ...f, allDay, endDate: "" };
  const endDate = endDayOf(f);
  // An end at 00:00 reaches midnight: the day before is the last one it touches.
  const last = endDate && f.date ? lastDayCovered({ date: f.date, endDate, end: f.end }) : endDate;
  return { ...f, allDay, endDate: last && last !== f.date ? last : "" };
}
