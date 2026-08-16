import type { DateStr, SyncedRecord, TimeStr } from "@lifeline/core";

/**
 * A thing that happens at a fixed time (CONTEXT.md): not work, not
 * completable. Timed on one day (start/end "HH:MM"), or all-day spanning
 * [date, endDate] when start is null.
 */
export interface Event extends SyncedRecord {
  title: string;
  notes: string;
  /** First (or only) day. */
  date: DateStr;
  /** All-day events only: last day, inclusive. null = single day. */
  endDate: DateStr | null;
  /** null = all day. */
  start: TimeStr | null;
  end: TimeStr | null;
  createdAt: DateStr;
}

export const EVENTS = "events";
