import { addDays, type DateStr } from "../dates";
import type { Document } from "./types";

/** The Day's type: its Documents are titled by their date. */
export const DAY_TYPE = "daily";

/**
 * The Event's type id. Core may not import Apps, so — like `DAY_TYPE` — the one
 * type the Seen family reads is named here. Seen reads only what any dated
 * Document has: a `date` and an optional `endDate` (ADR 0112).
 */
export const EVENT_TYPE = "event";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whether a value is a YYYY-MM-DD string: the one "is this a date" check. */
export const isDateStr = (v: unknown): v is DateStr => typeof v === "string" && DATE.test(v);

/** A Day's date (its title), when it is a Day titled by one; nothing for any other Document. */
export const dayOf = (src: Document | undefined): DateStr | undefined =>
  src?.type === DAY_TYPE && isDateStr(src.title) ? src.title : undefined;

/** An Event spanning more days than this is not counted past it (a typo's endDate must not spin). */
export const MAX_SPAN = 3660;

/** A field read as a date, when it is one. */
const dateIn = (v: unknown): DateStr | undefined => (isDateStr(v) ? v : undefined);

/** The days an Event is on, first to last (an `endDate` before its `date` is ignored); nothing for any other Document or an undated Event. */
export function eventSpan(src: Document | undefined): { from: DateStr; to: DateStr } | undefined {
  if (src?.type !== EVENT_TYPE) return undefined;
  const from = dateIn(src.date);
  if (!from) return undefined;
  const end = dateIn(src.endDate);
  return { from, to: end && end > from ? end : from };
}

/**
 * A linking Document's own days (ADR 0117): a Day's date, every day of an
 * Event (up to `MAX_SPAN`); undefined for a Document with no date of its own.
 */
export function sourceDays(src: Document | undefined): DateStr[] | undefined {
  if (src?.type === DAY_TYPE) {
    const day = dayOf(src);
    return day ? [day] : undefined;
  }
  const span = eventSpan(src);
  if (!span) return undefined;
  const days: DateStr[] = [];
  for (let d = span.from, i = 0; d <= span.to && i < MAX_SPAN; d = addDays(d, 1), i++) days.push(d);
  return days;
}
