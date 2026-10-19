import { addDays, daysInMonth, fromParts, parts, startOfWeek, type DateStr } from "@lifeline/core";
import type { Allowance, Bucket, PeriodKind } from "./types";

/**
 * Period math (ADR 0081). A period is a kind plus its first day; the last
 * day derives for week / month / year and is stored only for a custom span.
 * Everything here is pure — the screen, the Card and the repo all read the
 * same rules.
 */

/** Snap a day onto the first day of the period of that kind that contains it (custom: as is). */
export function normalizeFrom(kind: PeriodKind, day: DateStr): DateStr {
  const { y, m } = parts(day);
  switch (kind) {
    case "week":
      return startOfWeek(day);
    case "month":
      return fromParts(y, m, 1);
    case "year":
      return fromParts(y, 1, 1);
    case "custom":
      return day;
  }
}

/** Last day (inclusive) of the period starting on `from`; a custom span answers with its stored `to`. */
export function endOf(kind: PeriodKind, from: DateStr, to?: DateStr): DateStr {
  const { y, m } = parts(from);
  switch (kind) {
    case "week":
      return addDays(from, 6);
    case "month":
      return fromParts(y, m, daysInMonth(y, m));
    case "year":
      return fromParts(y, 12, 31);
    case "custom":
      return to && to >= from ? to : from;
  }
}

/** First day of the period after the one starting on `from`. A custom span does not recur → null. */
export function nextFrom(kind: PeriodKind, from: DateStr): DateStr | null {
  const { y, m } = parts(from);
  switch (kind) {
    case "week":
      return addDays(from, 7);
    case "month":
      return fromParts(y, m + 1, 1);
    case "year":
      return fromParts(y + 1, 1, 1);
    case "custom":
      return null;
  }
}

/** The inclusive span of an Allowance. */
export function spanOf(a: Pick<Allowance, "period" | "from" | "to">): { from: DateStr; to: DateStr } {
  return { from: a.from, to: endOf(a.period, a.from, a.to) };
}

/** ISO 8601 week number of a day (weeks start Monday; week 1 holds January 4th). */
export function isoWeek(d: DateStr): { year: number; week: number } {
  const { y, m, day } = parts(d);
  const dt = new Date(Date.UTC(y, m - 1, day));
  const weekday = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(dt.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((dt.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return { year: dt.getUTCFullYear(), week };
}

function monthName(y: number, m: number, style: "long" | "short"): string {
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: style, timeZone: "UTC" });
}

/**
 * The period's label — "W36 2026", "September 2026", "2026", "12–20 Sept 2026",
 * "28 Sept – 3 Oct 2026". Always carries the year: it is part of the derived
 * title, which is a wikilink target and must stay stable.
 */
export function periodLabel(a: Pick<Allowance, "period" | "from" | "to">): string {
  const { from, to } = spanOf(a);
  const f = parts(from);
  switch (a.period) {
    case "week": {
      const { year, week } = isoWeek(from);
      return `W${String(week).padStart(2, "0")} ${year}`;
    }
    case "month":
      return `${monthName(f.y, f.m, "long")} ${f.y}`;
    case "year":
      return String(f.y);
    case "custom": {
      const t = parts(to);
      if (from === to) return `${f.day} ${monthName(f.y, f.m, "short")} ${f.y}`;
      if (f.y === t.y && f.m === t.m) return `${f.day}–${t.day} ${monthName(f.y, f.m, "short")} ${f.y}`;
      if (f.y === t.y) return `${f.day} ${monthName(f.y, f.m, "short")} – ${t.day} ${monthName(t.y, t.m, "short")} ${f.y}`;
      return `${f.day} ${monthName(f.y, f.m, "short")} ${f.y} – ${t.day} ${monthName(t.y, t.m, "short")} ${t.y}`;
    }
  }
}

/** The derived title: "Eating out · September 2026". */
export function allowanceTitle(a: Pick<Allowance, "name" | "period" | "from" | "to">): string {
  return `${a.name || "Allowance"} · ${periodLabel(a)}`;
}

/** Current holds today, upcoming starts later, past has ended. */
export function bucketOf(a: Pick<Allowance, "period" | "from" | "to">, today: DateStr): Bucket {
  const { from, to } = spanOf(a);
  if (today < from) return "upcoming";
  if (today > to) return "past";
  return "current";
}

/** Days still to come in the period, counting today; 0 once it has ended. */
export function daysLeft(a: Pick<Allowance, "period" | "from" | "to">, today: DateStr): number {
  const { from, to } = spanOf(a);
  if (today > to) return 0;
  const start = today < from ? from : today;
  const s = parts(start);
  const e = parts(to);
  return Math.round((Date.UTC(e.y, e.m - 1, e.day) - Date.UTC(s.y, s.m - 1, s.day)) / 86_400_000) + 1;
}
