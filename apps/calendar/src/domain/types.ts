import type { DateStr, Document, TimeStr } from "@lifeline/core";

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
