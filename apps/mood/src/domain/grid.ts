import { addDays, daysInMonth, fromParts, parts, weekdayOf, type DateStr } from "@lifeline/core";
import type { Mood, MoodLevel } from "./types";

/**
 * The pure shape of the Mood grid (ADR 0044): one cell per day, in a month
 * layout (weekday-aligned, weeks starting Monday) or a year layout (twelve
 * month-columns of up to 31 rows). A `null` cell is padding — a day that
 * belongs to no month, never a day without a Mood.
 */

/** Read a stored `level` as 1..5; anything else is "no mood recorded". */
export function readLevel(v: unknown): MoodLevel | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? (n as MoodLevel) : null;
}

/** Date → level, from Mood Documents (title is the date). Later rows win; invalid ones are ignored. */
export function moodByDate(moods: Mood[]): Map<DateStr, MoodLevel> {
  const out = new Map<DateStr, MoodLevel>();
  for (const m of moods) {
    if (!isDate(m.title)) continue;
    const level = readLevel(m.level);
    if (level !== null) out.set(m.title, level);
  }
  return out;
}

export const isDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** The Mood of one day, or null. */
export const moodOn = (byDate: Map<DateStr, MoodLevel>, date: DateStr): MoodLevel | null => byDate.get(date) ?? null;

/**
 * One month as weeks of seven cells, Monday first: leading and trailing
 * `null`s pad the first and last weeks so every column is one weekday.
 */
export function monthWeeks(y: number, m: number): (DateStr | null)[][] {
  const first = fromParts(y, m, 1);
  const lead = (weekdayOf(first) + 6) % 7; // Monday = 0
  const total = daysInMonth(y, m);
  const cells: (DateStr | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(fromParts(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (DateStr | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * One year as twelve columns of 31 cells — the year-in-pixels layout. Short
 * months simply end early (`null` from day 29/30/31 on), so the rows stay
 * day-of-month and the columns stay months.
 */
export function yearColumns(y: number): (DateStr | null)[][] {
  const cols: (DateStr | null)[][] = [];
  for (let m = 1; m <= 12; m++) {
    const total = daysInMonth(y, m);
    const col: (DateStr | null)[] = [];
    for (let d = 1; d <= 31; d++) col.push(d <= total ? fromParts(y, m, d) : null);
    cols.push(col);
  }
  return cols;
}

/** The last `n` dates ending at `today`, oldest first. */
export function lastDays(today: DateStr, n: number): DateStr[] {
  const out: DateStr[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

/** Mean of the recorded levels, or null when nothing is recorded. */
export function average(levels: (MoodLevel | null)[]): number | null {
  const xs = levels.filter((v): v is MoodLevel => v !== null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export interface Trend {
  /** Average of the last 7 days ending today. */
  thisWeek: number | null;
  /** Average of the 7 days before those. */
  lastWeek: number | null;
  direction: "up" | "down" | "flat" | "unknown";
}

/** Week-over-week movement — the one number worth carrying in a card header. */
export function weekOverWeek(byDate: Map<DateStr, MoodLevel>, today: DateStr): Trend {
  const days = lastDays(today, 14).map((d) => moodOn(byDate, d));
  const lastWeek = average(days.slice(0, 7));
  const thisWeek = average(days.slice(7));
  if (thisWeek === null || lastWeek === null) return { thisWeek, lastWeek, direction: "unknown" };
  const delta = thisWeek - lastWeek;
  return { thisWeek, lastWeek, direction: delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat" };
}

/** How many of the days in `dates` carry a Mood. */
export function recordedCount(byDate: Map<DateStr, MoodLevel>, dates: DateStr[]): number {
  return dates.filter((d) => byDate.has(d)).length;
}

/** Every real day of a month layout or year layout, padding dropped. */
export const datesOf = (cells: (DateStr | null)[][]): DateStr[] => cells.flat().filter((d): d is DateStr => d !== null);

/** Months of a year, for the year layout's column labels. */
export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "September 2026" — the month layout's heading. */
export function monthTitle(y: number, m: number): string {
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Step one month back or forward from a {y, m} cursor. */
export function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const p = parts(fromParts(y, m + delta, 1));
  return { y: p.y, m: p.m };
}
