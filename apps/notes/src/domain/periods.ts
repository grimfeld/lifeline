import { addDays, type DateStr } from "@lifeline/core";

/**
 * The Journal's review stretches (CONTEXT.md "Week, Month, Quarter, Year"):
 * one Document each, titled by its stretch — `2026-W42` (ISO week), `2026-10`,
 * `2026-Q4`, `2026`. Pure date arithmetic over "YYYY-MM-DD", in local days.
 */
export type PeriodKind = "week" | "month" | "quarter" | "year";

export const PERIOD_KINDS: PeriodKind[] = ["week", "month", "quarter", "year"];

export const PERIOD_LABELS: Record<PeriodKind, { one: string; many: string; this: string }> = {
  week: { one: "Week", many: "Weeks", this: "This week" },
  month: { one: "Month", many: "Months", this: "This month" },
  quarter: { one: "Quarter", many: "Quarters", this: "This quarter" },
  year: { one: "Year", many: "Years", this: "This year" },
};

const pad = (n: number) => String(n).padStart(2, "0");

function parts(date: DateStr): { y: number; m: number; d: number } {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return { y, m, d };
}

/** Monday = 0 … Sunday = 6. */
function weekdayMon0(date: DateStr): number {
  const { y, m, d } = parts(date);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Days since the epoch, for differences between two local days. */
function dayNumber(date: DateStr): number {
  const { y, m, d } = parts(date);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/** ISO 8601 week of a day: the week belongs to the year that holds its Thursday. */
export function isoWeek(date: DateStr): { year: number; week: number } {
  const thursday = addDays(date, 3 - weekdayMon0(date));
  const year = parts(thursday).y;
  const jan4 = `${year}-01-04`;
  const week1Monday = addDays(jan4, -weekdayMon0(jan4));
  return { year, week: Math.floor((dayNumber(thursday) - dayNumber(week1Monday)) / 7) + 1 };
}

/** The title of the stretch of `kind` that holds `date`. */
export function periodKey(kind: PeriodKind, date: DateStr): string {
  const { y, m } = parts(date);
  switch (kind) {
    case "week": {
      const w = isoWeek(date);
      return `${w.year}-W${pad(w.week)}`;
    }
    case "month":
      return `${y}-${pad(m)}`;
    case "quarter":
      return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    case "year":
      return String(y);
  }
}

/** Which kind a title is, or undefined when it is no stretch's. */
export function kindOfKey(key: string): PeriodKind | undefined {
  if (/^\d{4}-W\d{2}$/.test(key)) return "week";
  if (/^\d{4}-\d{2}$/.test(key)) return "month";
  if (/^\d{4}-Q[1-4]$/.test(key)) return "quarter";
  if (/^\d{4}$/.test(key)) return "year";
  return undefined;
}

/** First and last day of a stretch, inclusive. */
export function periodRange(key: string): { from: DateStr; to: DateStr } | undefined {
  const kind = kindOfKey(key);
  if (!kind) return undefined;
  if (kind === "year") return { from: `${key}-01-01`, to: `${key}-12-31` };
  if (kind === "month") {
    const [y = 0, m = 1] = key.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${key}-01`, to: `${key}-${pad(last)}` };
  }
  if (kind === "quarter") {
    const y = Number(key.slice(0, 4));
    const q = Number(key.slice(-1));
    const first = periodRange(`${y}-${pad((q - 1) * 3 + 1)}`)!;
    const last = periodRange(`${y}-${pad(q * 3)}`)!;
    return { from: first.from, to: last.to };
  }
  const y = Number(key.slice(0, 4));
  const w = Number(key.slice(-2));
  const jan4 = `${y}-01-04`;
  const from = addDays(addDays(jan4, -weekdayMon0(jan4)), (w - 1) * 7);
  return { from, to: addDays(from, 6) };
}

/** Every day of a stretch, first to last. */
export function daysOf(key: string): DateStr[] {
  const r = periodRange(key);
  if (!r) return [];
  const out: DateStr[] = [];
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The stretches one step finer inside a stretch: a Year's Quarters, a Quarter's Months, a Month's Weeks (by the weeks its days fall in). */
export function partsOf(key: string): string[] {
  const kind = kindOfKey(key);
  if (kind === "year") return [1, 2, 3, 4].map((q) => `${key}-Q${q}`);
  if (kind === "quarter") {
    const y = key.slice(0, 4);
    const q = Number(key.slice(-1));
    return [1, 2, 3].map((i) => `${y}-${pad((q - 1) * 3 + i)}`);
  }
  if (kind === "month") return [...new Set(daysOf(key).map((d) => periodKey("week", d)))];
  return [];
}

/** The stretch before or after, of the same kind. */
export function shiftPeriod(key: string, by: number): string {
  const kind = kindOfKey(key);
  const r = periodRange(key);
  if (!kind || !r) return key;
  if (kind === "week") return periodKey("week", addDays(r.from, 7 * by));
  if (kind === "year") return String(Number(key) + by);
  const monthsPer = kind === "month" ? 1 : 3;
  const { y, m } = parts(r.from);
  const idx = y * 12 + (m - 1) + by * monthsPer;
  return periodKey(kind, `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}-01`);
}

/** Human label: "Week 42, 2026", "October 2026", "Q4 2026", "2026". */
export function periodLabel(key: string, locale?: string): string {
  const kind = kindOfKey(key);
  if (kind === "week") return `Week ${Number(key.slice(-2))}, ${key.slice(0, 4)}`;
  if (kind === "month") {
    const [y = 0, m = 1] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  }
  if (kind === "quarter") return `Q${key.slice(-1)} ${key.slice(0, 4)}`;
  return key;
}

/** Where a stretch's Document lives: beside its days, under `Journal/YYYY`. */
export function periodFolder(key: string): string {
  return `Journal/${key.slice(0, 4)}`;
}

/** A page of the Journal: a Day (by its date) or a review stretch (by its key). */
export type JournalPage = { kind: "day" | PeriodKind; key: string; label: string };

/** Whether `date` is "YYYY-MM-DD" naming a day the calendar has. */
export function isCalendarDay(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const { y, m, d } = parts(date);
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}

/** Whether a well-formed key names a stretch the calendar has: no year 0, month 13, week 0 or a 53rd week in a 52-week year. */
function isCalendarPeriod(kind: PeriodKind, key: string): boolean {
  const y = Number(key.slice(0, 4));
  if (y < 1) return false;
  if (kind === "month") return Number(key.slice(5)) >= 1 && Number(key.slice(5)) <= 12;
  // Quarters 1–4 are all kindOfKey reads.
  if (kind === "week") {
    const w = Number(key.slice(-2));
    // 28 December is always in its year's last ISO week.
    return w >= 1 && w <= isoWeek(`${key.slice(0, 4)}-12-28`).week;
  }
  return true;
}

/** "Tuesday 14 March 2023": the weekday, then the date in the locale's order. */
function dayLabel(date: DateStr, locale?: string): string {
  const { y, m, d } = parts(date);
  const at = new Date(Date.UTC(y, m - 1, d));
  // Weekday and date apart: joined, en-GB puts a comma after the weekday.
  const weekday = at.toLocaleDateString(locale, { weekday: "long", timeZone: "UTC" });
  return `${weekday} ${at.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`;
}

/**
 * Typed text read as a Journal page (ADR 0088): an ISO date opens its Day, and
 * the keys the Journal titles its stretches with — `2023-W11`, `2023-03`,
 * `2023-Q1`, `2023` — open that review. Checked against the calendar; no
 * natural language. Undefined when the text names no page.
 */
export function journalPageOf(text: string, locale?: string): JournalPage | undefined {
  const t = text.trim().toUpperCase();
  if (isCalendarDay(t)) return { kind: "day", key: t, label: dayLabel(t, locale) };
  const kind = kindOfKey(t);
  if (!kind || !isCalendarPeriod(kind, t)) return undefined;
  return { kind, key: t, label: periodLabel(t, locale) };
}
