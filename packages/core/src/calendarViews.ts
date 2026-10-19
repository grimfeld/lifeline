import { addDays, clampedDate, daysInMonth, fromParts, parts, startOfWeek, type DateStr } from "./dates";

/**
 * The Calendar's views (ADR 0063): one Surface for time, switched in place.
 * Day, 3 Day and Week are the Schedule (hour-scaled); Month and Upcoming are
 * day-granular.
 */
export type CalendarView = "upcoming" | "day" | "3day" | "week" | "month";

export const CALENDAR_VIEWS: { id: CalendarView; title: string }[] = [
  { id: "upcoming", title: "Upcoming" },
  { id: "day", title: "Day" },
  { id: "3day", title: "3 Day" },
  { id: "week", title: "Week" },
  { id: "month", title: "Month" },
];

export function isCalendarView(v: unknown): v is CalendarView {
  return CALENDAR_VIEWS.some((x) => x.id === v);
}

/** The views that lay a day out by the hour — together, the Schedule. */
export function isHourView(v: CalendarView): v is "day" | "3day" | "week" {
  return v === "day" || v === "3day" || v === "week";
}

/**
 * The days a view shows for the day in view. 3 Day starts on the day itself,
 * never on a week boundary; Week follows `startOfWeek`; Month is the six-week
 * grid around the day's month. Upcoming has no fixed span (it scrolls), so it
 * answers with the day alone.
 */
export function viewDays(view: CalendarView, anchor: DateStr): DateStr[] {
  switch (view) {
    case "day":
    case "upcoming":
      return [anchor];
    case "3day":
      return [0, 1, 2].map((i) => addDays(anchor, i));
    case "week": {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    case "month": {
      const { y, m } = parts(anchor);
      const start = startOfWeek(fromParts(y, m, 1));
      return Array.from({ length: 42 }, (_, i) => addDays(start, i));
    }
  }
}

/**
 * The day in view one page on (`dir` 1) or back (-1). Day by one, 3 Day by
 * three, Week and Upcoming by seven, Month by a month — keeping the day of the
 * month, clamped (31 Jan → 28 Feb), so paging there and back stays close.
 */
export function stepView(view: CalendarView, anchor: DateStr, dir: 1 | -1): DateStr {
  switch (view) {
    case "day":
      return addDays(anchor, dir);
    case "3day":
      return addDays(anchor, 3 * dir);
    case "week":
    case "upcoming":
      return addDays(anchor, 7 * dir);
    case "month": {
      const { y, m, day } = parts(anchor);
      const nm = m + dir;
      const ny = nm < 1 ? y - 1 : nm > 12 ? y + 1 : y;
      const mm = nm < 1 ? 12 : nm > 12 ? 1 : nm;
      return clampedDate(ny, mm, Math.min(day, daysInMonth(ny, mm)));
    }
  }
}

/** One run of Upcoming: a day with something on it, or a stretch of days with nothing. */
export type UpcomingRun = { kind: "day"; date: DateStr } | { kind: "empty"; from: DateStr; to: DateStr };

/**
 * Upcoming's days from `from` to `to`: each day with something on it, and each
 * run of empty days folded into one line so a free week is seen rather than
 * lost. A run ends at the month's end, so every month still gets its heading.
 * `keep` days are always shown in full, empty or not (today, the day in view).
 */
export function upcomingRuns(from: DateStr, to: DateStr, busy: (d: DateStr) => boolean, keep: DateStr[] = []): UpcomingRun[] {
  const out: UpcomingRun[] = [];
  let emptyFrom: DateStr | null = null;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (busy(d) || keep.includes(d)) {
      if (emptyFrom) out.push({ kind: "empty", from: emptyFrom, to: addDays(d, -1) });
      emptyFrom = null;
      out.push({ kind: "day", date: d });
    } else {
      if (emptyFrom && parts(emptyFrom).m !== parts(d).m) {
        out.push({ kind: "empty", from: emptyFrom, to: addDays(d, -1) });
        emptyFrom = null;
      }
      emptyFrom ??= d;
    }
  }
  if (emptyFrom) out.push({ kind: "empty", from: emptyFrom, to });
  return out;
}
