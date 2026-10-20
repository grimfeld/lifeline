import { addDays, diffDays, type DateStr, type TimedSpan, type TimeStr } from "@lifeline/core";

/** A timed span: from a start (day + time) to an end (day + time) — the Timed contract's (ADR 0090). */
export type { TimedSpan };

/** An all-day span: from a first day (`date`) to a last day (`endDate`), inclusive. */
export interface AllDaySpan {
  date: DateStr;
  start: null;
  endDate: DateStr;
  end: null;
}

/** One day's piece of a timed span; "24:00" is the end of the day. */
export interface DayPiece {
  date: DateStr;
  start: TimeStr;
  end: TimeStr;
}

/** One day of an all-day span. */
export interface AllDayPiece {
  date: DateStr;
  start: null;
  end: null;
}

/** Days, inclusive. */
export interface DayRange {
  start: DateStr;
  end: DateStr;
}

/**
 * Splits a span into one piece per day it covers: the first day from its
 * start to the end of the day, middle days whole, the last day from the start
 * of the day to its end. A timed span ending at 00:00 leaves no piece on its
 * end day. Agrees with how Calendar subscriptions split a timed event. With a
 * `range`, only the pieces on its days.
 */
export function dayPieces(span: TimedSpan, range?: DayRange): DayPiece[];
export function dayPieces(span: AllDaySpan, range?: DayRange): AllDayPiece[];
export function dayPieces(span: TimedSpan | AllDaySpan, range?: DayRange): (DayPiece | AllDayPiece)[] {
  const last = diffDays(span.date, span.endDate);
  // Ending at 00:00 reaches midnight: the end day itself is not covered (unless that is all there is).
  const lastCovered = span.start !== null && span.end === "00:00" && last > 0 ? last - 1 : last;
  const from = range && range.start > span.date ? diffDays(span.date, range.start) : 0;
  const to = range && range.end < span.endDate ? Math.min(lastCovered, diffDays(span.date, range.end)) : lastCovered;
  const out: (DayPiece | AllDayPiece)[] = [];
  for (let i = from; i <= to; i++) {
    const date = addDays(span.date, i);
    if (span.start === null) out.push({ date, start: null, end: null });
    else if (last === 0) out.push({ date, start: span.start, end: span.end });
    else out.push({ date, start: i === 0 ? span.start : "00:00", end: i === last ? span.end : "24:00" });
  }
  return out;
}
