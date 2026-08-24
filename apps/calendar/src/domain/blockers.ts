import { addDays, diffDays, formatTime, weekdayOf, type DateStr, type TimeStr, type Weekday } from "@lifeline/core";
import type { TimeBlocker } from "./types";

/** Monday-first display order; values are Core weekdays (0 = Sunday). */
export const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

/** One painted band on one day: always inside [00:00, 24:00]. */
export interface BlockerBand {
  date: DateStr;
  start: TimeStr;
  end: TimeStr;
}

function covers(b: Pick<TimeBlocker, "weekdays">, date: DateStr): boolean {
  const days = b.weekdays ?? [];
  return days.length === 0 || days.includes(weekdayOf(date));
}

/** True when the blocker's band runs past midnight (23:00 → 07:00). */
export function isOvernight(b: Pick<TimeBlocker, "start" | "end">): boolean {
  return b.end <= b.start;
}

/**
 * The bands one blocker paints on one day: the day's own band when the
 * weekday is covered, plus the tail of the previous day's band when the
 * blocker runs past midnight. An overnight blocker whose end is "00:00"
 * simply reaches midnight and leaves no tail.
 */
export function bandsOn(b: TimeBlocker, date: DateStr): BlockerBand[] {
  if (b.active === false) return [];
  const out: BlockerBand[] = [];
  const overnight = isOvernight(b);
  if (covers(b, date)) out.push({ date, start: b.start, end: overnight ? "24:00" : b.end });
  if (overnight && b.end !== "00:00" && covers(b, addDays(date, -1))) out.push({ date, start: "00:00", end: b.end });
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

/** "Mon–Fri · 9:00 AM – 5:00 PM", "Every day · 11:00 PM – 7:00 AM (next day)". */
export function describeBlocker(b: TimeBlocker): string {
  return `${describeWeekdays(b.weekdays ?? [])} · ${formatTime(b.start)} – ${formatTime(b.end)}${isOvernight(b) ? " (next day)" : ""}`;
}

/** "Every day", "Weekdays", "Weekends", else the day names in Monday-first order. */
export function describeWeekdays(days: Weekday[]): string {
  const set = new Set(days);
  if (set.size === 0 || set.size === 7) return "Every day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d as Weekday))) return "Weekdays";
  if (set.size === 2 && set.has(6) && set.has(0)) return "Weekends";
  return WEEKDAYS.filter((w) => set.has(w.value)).map((w) => w.label).join(", ");
}

/** Sort key: earliest start first, then title. */
export function compareBlockers(a: TimeBlocker, b: TimeBlocker): number {
  return a.start.localeCompare(b.start) || a.title.localeCompare(b.title);
}
