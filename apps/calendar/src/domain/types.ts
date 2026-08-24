import type { DateStr, Document, TimeStr, Weekday } from "@lifeline/core";

/**
 * A thing that happens at a fixed time (CONTEXT.md): not work, not
 * completable. Timed on one day (start/end "HH:MM"), or all-day spanning
 * [date, endDate] when start is null. A Document of type `event` (ADR 0018).
 */
export interface Event extends Document {
  notes: string;
  /** First (or only) day. */
  date: DateStr;
  /** All-day events only: last day, inclusive. null = single day. */
  endDate: DateStr | null;
  /** null = all day. */
  start: TimeStr | null;
  end: TimeStr | null;
}

/** Document type id. */
export const EVENT_TYPE = "event";
/** @deprecated old collection name; kept as the type id alias for callers. */
export const EVENTS = EVENT_TYPE;
export const EVENTS_HREF = "/app/events";

/**
 * A named shape for an Event the user adds again and again — "Standup",
 * "Gym", "Dentist" (ADR 0027). Not itself on any day: quick-adding one
 * creates a real Event with the template's title, notes, Tags and length.
 * A Document of type `event_template`.
 */
export interface EventTemplate extends Document {
  notes: string;
  /** Preferred start when quick-added without a slot ("HH:MM"); null = all day. */
  defaultStart: TimeStr | null;
  /** How long the created Event lasts, in minutes. Ignored when all-day. */
  durationMin: number;
  /** Created as an all-day Event; `defaultStart` and `durationMin` are then unused. */
  allDay: boolean;
}

/**
 * A recurring band of time the user keeps unavailable — sleep, work hours,
 * the school run (ADR 0027). Not an Event: it has no single day and creates
 * no Documents; it paints the Schedule behind everything else on every
 * weekday it covers. A Document of type `time_blocker`.
 */
export interface TimeBlocker extends Document {
  /** Core weekdays (0 = Sunday). Empty = every day. */
  weekdays: Weekday[];
  /** "HH:MM"; when `end` is at or before `start` the band runs past midnight into the next day. */
  start: TimeStr;
  end: TimeStr;
  /** CSS colour for the band; null = the Calendar App's colour. */
  color: string | null;
  /** Off keeps the definition but stops painting it. */
  active: boolean;
}

export const EVENT_TEMPLATE_TYPE = "event_template";
export const TIME_BLOCKER_TYPE = "time_blocker";
/** Both are managed on one Calendar screen. */
export const TEMPLATES_HREF = "/app/event-templates";
