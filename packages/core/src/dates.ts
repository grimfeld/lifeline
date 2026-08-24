/** Local calendar date, "YYYY-MM-DD". Day granularity. */
export type DateStr = string;

/** 0 = Sunday … 6 = Saturday (matches JS Date#getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * All date math runs on "YYYY-MM-DD" strings interpreted as plain calendar
 * days. Arithmetic goes through Date.UTC so local-timezone DST shifts can
 * never skew a day boundary.
 */

export function parts(d: DateStr): { y: number; m: number; day: number } {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day };
}

export function fromParts(y: number, m: number, day: number): DateStr {
  // Normalise out-of-range month/day via Date.UTC rollover
  const dt = new Date(Date.UTC(y, m - 1, day));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function todayStr(now: Date = new Date()): DateStr {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local wall clock as "HH:MM" — the clock Time blocks are compared against ("still ahead"). */
export function nowClock(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function addDays(d: DateStr, n: number): DateStr {
  const { y, m, day } = parts(d);
  return fromParts(y, m, day + n);
}

/** Whole days from a to b (positive when b is later). */
export function diffDays(a: DateStr, b: DateStr): number {
  const pa = parts(a);
  const pb = parts(b);
  const ua = Date.UTC(pa.y, pa.m - 1, pa.day);
  const ub = Date.UTC(pb.y, pb.m - 1, pb.day);
  return Math.round((ub - ua) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(d: DateStr): Weekday {
  const { y, m, day } = parts(d);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay() as Weekday;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Day-of-month clamped to the month's length (31st in Feb → Feb 28/29). */
export function clampedDate(y: number, m: number, day: number): DateStr {
  return fromParts(y, m, Math.min(day, daysInMonth(y, m)));
}

/** First day (Monday) of the week containing d. */
export function startOfWeek(d: DateStr): DateStr {
  const wd = weekdayOf(d); // 0=Sun..6=Sat
  const sinceMonday = (wd + 6) % 7;
  return addDays(d, -sinceMonday);
}

export function formatHuman(d: DateStr): string {
  const { y, m, day } = parts(d);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: y === new Date().getFullYear() ? undefined : "numeric",
    timeZone: "UTC",
  });
}
