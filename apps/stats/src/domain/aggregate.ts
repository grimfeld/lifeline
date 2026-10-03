import { weekdayOf } from "@lifeline/core";
import type { Entry, Period } from "./types";

/** Local-timezone YYYY-MM-DD key for an ISO timestamp. */
export function dayKey(iso: string | Date): string {
  const d = new Date(iso);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Period is a display-time filter: trailing 7 / trailing 30 days, calendar YTD, or everything. */
export function periodStart(period: Period, now = new Date()): Date | null {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  switch (period) {
    case "week":
      d.setDate(d.getDate() - 6);
      return d;
    case "month":
      d.setDate(d.getDate() - 29);
      return d;
    case "year":
      return new Date(d.getFullYear(), 0, 1);
    case "all":
      return null;
  }
}

export function inPeriod(iso: string, period: Period, now = new Date()): boolean {
  const start = periodStart(period, now);
  return start === null || new Date(iso) >= start;
}

export interface DayPoint {
  day: string;
  label: string;
  sum: number;
  cumulative: number;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Additive: zero-filled daily sums plus a running cumulative over the period. */
export function dailySeries(entries: Entry[], period: Period, now = new Date()): DayPoint[] {
  const inRange = entries.filter((e) => inPeriod(e.ts, period, now));
  const sums = new Map<string, number>();
  for (const e of inRange) {
    const k = dayKey(e.ts);
    sums.set(k, (sums.get(k) ?? 0) + e.value);
  }
  let start = periodStart(period, now);
  if (start === null) {
    if (inRange.length === 0) return [];
    const earliest = inRange.reduce((a, b) => (a.ts < b.ts ? a : b));
    start = new Date(earliest.ts);
    start.setHours(0, 0, 0, 0);
  }
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const points: DayPoint[] = [];
  let cumulative = 0;
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d);
    const sum = sums.get(k) ?? 0;
    cumulative += sum;
    points.push({ day: k, label: dayLabel(d), sum, cumulative });
  }
  return points;
}

export interface ReadingPoint {
  /** epoch ms */
  ts: number;
  label: string;
  value: number;
}

/** Measurement: the readings in the period, in time order. */
export function readingSeries(entries: Entry[], period: Period, now = new Date()): ReadingPoint[] {
  return entries
    .filter((e) => inPeriod(e.ts, period, now))
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .map((e) => ({ ts: new Date(e.ts).getTime(), label: dayLabel(new Date(e.ts)), value: e.value }));
}

/** Additive: sum in period. Measurement: latest reading in period (null when none). */
export function headline(kind: "additive" | "measurement", entries: Entry[], period: Period, now = new Date()): number | null {
  const inRange = entries.filter((e) => inPeriod(e.ts, period, now));
  if (kind === "additive") return inRange.reduce((acc, e) => acc + e.value, 0);
  if (inRange.length === 0) return null;
  return inRange.reduce((a, b) => (a.ts > b.ts ? a : b)).value;
}

/**
 * Additive: the sum over the window immediately preceding the period —
 * previous 7 days for week, previous 30 for month, previous calendar year for
 * year. `all` has no predecessor and yields null.
 */
export function previousPeriodHeadline(entries: Entry[], period: Period, now = new Date()): number | null {
  const start = periodStart(period, now);
  if (start === null) return null;
  const prevStart = new Date(start);
  if (period === "year") prevStart.setFullYear(start.getFullYear() - 1);
  else prevStart.setDate(start.getDate() - (period === "week" ? 7 : 30));
  return entries
    .filter((e) => {
      const t = new Date(e.ts);
      return t >= prevStart && t < start;
    })
    .reduce((acc, e) => acc + e.value, 0);
}

/** Measurement: mean of readings in period (null when none). */
export function average(entries: Entry[], period: Period, now = new Date()): number | null {
  const inRange = entries.filter((e) => inPeriod(e.ts, period, now));
  if (inRange.length === 0) return null;
  return inRange.reduce((acc, e) => acc + e.value, 0) / inRange.length;
}

// --- boolean ------------------------------------------------------------

/** Distinct local days with ≥1 entry — duplicate marks collapse here. */
export function markedDays(entries: { ts: string }[]): Set<string> {
  return new Set(entries.map((e) => dayKey(e.ts)));
}

export function booleanHeadline(days: Set<string>, period: Period, now = new Date()): { count: number; denominator: number | null } {
  const start = periodStart(period, now);
  const count = start === null ? days.size : [...days].filter((d) => d >= dayKey(start)).length;
  const denominator = period === "week" ? 7 : period === "month" ? 30 : null;
  return { count, denominator };
}

export function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

export type DotCell = { day: string; state: "marked" | "empty" | "pad" };

/**
 * The DotGrid's columns: one per week (Monday first) from `first`'s week to
 * today's, days outside [first, today] padded.
 */
export function dotGridWeeks(days: Set<string>, first: string, today: string): DotCell[][] {
  // weekdayOf, not new Date(first): that parses as UTC midnight, the day before west of UTC.
  const pad = (weekdayOf(first) + 6) % 7;
  let cursor = shiftDay(first, -pad);
  const weeks: DotCell[][] = [];
  while (cursor <= today) {
    const col: DotCell[] = [];
    for (let i = 0; i < 7; i++) {
      const state = cursor < first || cursor > today ? "pad" : days.has(cursor) ? "marked" : "empty";
      col.push({ day: cursor, state });
      cursor = shiftDay(cursor, 1);
    }
    weeks.push(col);
  }
  return weeks;
}

/** Consecutive marked days ending today or yesterday — an unmarked today doesn't break the run. */
export function currentStreak(days: Set<string>, now = new Date()): number {
  const today = dayKey(now);
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  let run = 0;
  while (days.has(cursor)) {
    run++;
    cursor = shiftDay(cursor, -1);
  }
  return run;
}

/** Best run of consecutive marked days ever. */
export function longestStreak(days: Set<string>): number {
  let best = 0;
  for (const day of days) {
    if (days.has(shiftDay(day, -1))) continue;
    let run = 1;
    let cursor = shiftDay(day, 1);
    while (days.has(cursor)) {
      run++;
      cursor = shiftDay(cursor, 1);
    }
    best = Math.max(best, run);
  }
  return best;
}

/** Boolean marks are pinned to noon local so DST edges can't shift them to a neighbouring day. */
export function noonOf(day: string): string {
  return new Date(`${day}T12:00`).toISOString();
}

// --- collection ---------------------------------------------------------

export function normalizeItem(name: string): string {
  return name.trim().toLowerCase();
}

export interface CollectedItem {
  /** First-logged spelling, trimmed. */
  name: string;
  firstTs: string;
}

/** Distinct items by normalised name; first logging wins. Period-independent. */
export function collectedItems(entries: { ts: string; item?: string }[]): CollectedItem[] {
  const byKey = new Map<string, CollectedItem>();
  const sorted = [...entries].filter((e) => e.item && e.item.trim() !== "").sort((a, b) => a.ts.localeCompare(b.ts));
  for (const e of sorted) {
    const key = normalizeItem(e.item!);
    if (!byKey.has(key)) byKey.set(key, { name: e.item!.trim(), firstTs: e.ts });
  }
  return [...byKey.values()];
}

/** All-time cumulative distinct-item count, one step per new item. */
export function collectionSeries(items: CollectedItem[]): ReadingPoint[] {
  return items.map((it, i) => ({
    ts: new Date(it.firstTs).getTime(),
    label: new Date(it.firstTs).toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
    value: i + 1,
  }));
}

export function formatValue(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
