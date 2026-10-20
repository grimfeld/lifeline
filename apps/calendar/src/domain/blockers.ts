import { addDays, diffDays, formatHuman, formatTime, spanLasting, spanLength, weekdayOf, WEEKDAY_NAMES, type DateStr, type TimedSpan, type TimedWhen, type TimeStr, type Weekday } from "@lifeline/core";
import type { TimeBlocker } from "./types";
import { dayPieces } from "./span";

/** Monday-first display order; values are Core weekdays (0 = Sunday). */
export const WEEKDAYS: { value: Weekday; label: string }[] = ([1, 2, 3, 4, 5, 6, 0] as Weekday[]).map((value) => ({ value, label: WEEKDAY_NAMES[value] }));

/** One painted band on one day: always inside [00:00, 24:00]. */
export interface BlockerBand {
  date: DateStr;
  start: TimeStr;
  end: TimeStr;
}

/** A one-off blocker (ADR 0029) sits on its own days; a weekly one covers its weekdays (none = every day). */
export function isOneOff(b: Pick<TimeBlocker, "date">): boolean {
  return !!b.date;
}

function covers(b: Pick<TimeBlocker, "weekdays">, date: DateStr): boolean {
  const days = b.weekdays ?? [];
  return days.length === 0 || days.includes(weekdayOf(date));
}

/** True when a weekly blocker's band runs past midnight (23:00 → 07:00). */
export function isOvernight(b: Pick<TimeBlocker, "start" | "end">): boolean {
  return b.end <= b.start;
}

/** The span a blocker's band covers when it starts on `day`: past midnight into the next day when overnight. */
function spanFrom(b: Pick<TimeBlocker, "start" | "end">, day: DateStr): TimedSpan {
  return { date: day, start: b.start, endDate: isOvernight(b) ? addDays(day, 1) : day, end: b.end };
}

/**
 * A one-off blocker's whole span (ADR 0090): from its day and start to its
 * end day and end. One stored before it had an end day reads the old way —
 * the next morning when its end is at or before its start. null for a weekly
 * blocker, a rule with no one span.
 */
export function blockerSpan(b: Pick<TimeBlocker, "date" | "endDate" | "start" | "end">): TimedSpan | null {
  if (!b.date) return null;
  return b.endDate ? { date: b.date, start: b.start, endDate: b.endDate, end: b.end } : spanFrom(b, b.date);
}

/**
 * Where a one-off blocker lands when rescheduled from the Schedule or its
 * Hours editor (ADR 0090): the whole new span, ending on its start day when
 * given no end day. Given a start but no end it keeps its length; given no
 * start (dropped on a day, not an hour) it moves by whole days, keeping its
 * hours and how many days it covers.
 */
export function rescheduledBlocker(b: Pick<TimeBlocker, "date" | "endDate" | "start" | "end">, when: TimedWhen): Pick<TimeBlocker, "date" | "start" | "endDate" | "end"> {
  const span = blockerSpan(b) ?? spanFrom(b, when.date);
  if (!when.start) return { date: when.date, start: span.start, endDate: addDays(span.endDate, diffDays(span.date, when.date)), end: span.end };
  if (!when.end) {
    const kept = spanLasting(when.date, when.start, spanLength(span) ?? 0);
    return { date: kept.date, start: kept.start, endDate: kept.endDate, end: kept.end };
  }
  return { date: when.date, start: when.start, endDate: when.endDate ?? when.date, end: when.end };
}

/**
 * The bands one blocker paints on one day. A one-off blocker paints its
 * span's piece of the day (first day from its start, middle days whole, the
 * last until its end). A weekly one paints the day's own band when the
 * weekday is covered, plus the tail of the previous day's band when it runs
 * past midnight; an end of "00:00" simply reaches midnight and leaves no tail.
 */
export function bandsOn(b: TimeBlocker, date: DateStr): BlockerBand[] {
  if (b.active === false) return [];
  const day = { start: date, end: date };
  const span = blockerSpan(b);
  if (span) return dayPieces(span, day);
  const out: BlockerBand[] = [];
  for (const d of [addDays(date, -1), date]) {
    if (covers(b, d)) out.push(...dayPieces(spanFrom(b, d), day));
  }
  return out.sort((x, y) => x.start.localeCompare(y.start));
}

/** Every band every active blocker paints across [range.start, range.end]. */
export function bandsIn(blockers: TimeBlocker[], range: { start: DateStr; end: DateStr }): (BlockerBand & { blocker: TimeBlocker })[] {
  const out: (BlockerBand & { blocker: TimeBlocker })[] = [];
  const n = diffDays(range.start, range.end);
  for (let i = 0; i <= n; i++) {
    const date = addDays(range.start, i);
    for (const b of blockers) for (const band of bandsOn(b, date)) out.push({ ...band, blocker: b });
  }
  return out;
}

/** "Mon–Fri · 9:00 AM – 5:00 PM", "Every day · 11:00 PM – 7:00 AM (next day)", "Tue 25 Aug · 8:00 AM – 8:30 AM", "Mon 24 Aug · 6:00 PM – Wed 26 Aug 9:00 AM". */
export function describeBlocker(b: TimeBlocker): string {
  const span = blockerSpan(b);
  if (!span) return `${describeWeekdays(b.weekdays ?? [])} · ${formatTime(b.start)} – ${formatTime(b.end)}${isOvernight(b) ? " (next day)" : ""}`;
  const endDay = span.endDate === span.date ? "" : `${formatHuman(span.endDate)} `;
  return `${formatHuman(span.date)} · ${formatTime(span.start)} – ${endDay}${formatTime(span.end)}`;
}

/** "Every day", "Weekdays", "Weekends", else the day names in Monday-first order. */
export function describeWeekdays(days: Weekday[]): string {
  const set = new Set(days);
  if (set.size === 0 || set.size === 7) return "Every day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d as Weekday))) return "Weekdays";
  if (set.size === 2 && set.has(6) && set.has(0)) return "Weekends";
  return WEEKDAYS.filter((w) => set.has(w.value)).map((w) => w.label).join(", ");
}

/** Sort key: weekly rules first by start, then one-offs by day and start, then title. */
export function compareBlockers(a: TimeBlocker, b: TimeBlocker): number {
  return (a.date ?? "").localeCompare(b.date ?? "") || a.start.localeCompare(b.start) || a.title.localeCompare(b.title);
}
