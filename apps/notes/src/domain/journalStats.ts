/**
 * Pure journal statistics for the Notes cards: on-this-day lookups, writing
 * streaks and word counts. Everything derives from daily notes
 * (`type === "daily"`, `title === YYYY-MM-DD`); nothing is stored.
 * Mood left for the Mood App (ADR 0044).
 */

import { addDays, clampedDate, parts, splitFrontmatter, type DateStr } from "@lifeline/core";
import { isCalendarDay } from "./periods";
import { writtenDates, type DayLike } from "./written";

const bodyOf = (n: DayLike) => (typeof n.body === "string" ? n.body : "");

const isDaily = (n: DayLike) => n.type === "daily" && isCalendarDay(n.title);

// --- on this day ---------------------------------------------------------

export interface OnThisDayOpts {
  /** "all" = every previous year with a note; "last" = only one year ago. */
  years?: "all" | "last";
  /** Also look at the same weekday 1 and 4 weeks ago. */
  alsoWeeks?: boolean;
}

export interface OnThisDayHit {
  date: DateStr;
  label: string;
}

/** The same month/day in year `y`; Feb 29 falls back to Feb 28 in non-leap years. */
export function sameDayInYear(today: DateStr, y: number): DateStr {
  const { m, day } = parts(today);
  return clampedDate(y, m, day);
}

/**
 * Daily notes on the same calendar day in earlier years (plus the optional
 * 1-week / 4-week lookbacks), most recent first. `dates` are daily-note titles.
 */
export function onThisDay(dates: string[], today: DateStr, opts: OnThisDayOpts = {}): OnThisDayHit[] {
  const have = new Set(dates);
  const out: OnThisDayHit[] = [];
  if (opts.alsoWeeks) {
    for (const w of [1, 4]) {
      const d = addDays(today, -7 * w);
      if (have.has(d)) out.push({ date: d, label: w === 1 ? "1 week ago" : `${w} weeks ago` });
    }
  }
  const { y } = parts(today);
  const years = new Set(dates.map((d) => parts(d).y).filter((yy) => yy < y));
  const candidates = opts.years === "last" ? [y - 1] : [...years].sort((a, b) => b - a);
  for (const yy of candidates) {
    const d = sameDayInYear(today, yy);
    if (!have.has(d)) continue;
    const n = y - yy;
    out.push({ date: d, label: n === 1 ? "1 year ago" : `${n} years ago` });
  }
  return out;
}

// --- written days & streaks -----------------------------------------------

/** Consecutive written days ending today or yesterday — an unwritten today doesn't break the run. */
export function currentStreak(days: Set<string>, today: DateStr): number {
  let cursor = days.has(today) ? today : addDays(today, -1);
  let run = 0;
  while (days.has(cursor)) {
    run++;
    cursor = addDays(cursor, -1);
  }
  return run;
}

/** Best run of consecutive written days ever. */
export function longestStreak(days: Set<string>): number {
  let best = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue;
    let run = 1;
    let cursor = addDays(day, 1);
    while (days.has(cursor)) {
      run++;
      cursor = addDays(cursor, 1);
    }
    best = Math.max(best, run);
  }
  return best;
}

/** The last `n` dates ending today, oldest first. */
export function lastDays(today: DateStr, n: number): DateStr[] {
  const out: DateStr[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

// --- writing stats -------------------------------------------------------

/** Words in the note's content (frontmatter and fenced code excluded). */
export function wordCount(body: string): number {
  const { content } = splitFrontmatter(body);
  const plain = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^-{3,}\s*$/gm, " ")
    .replace(/[*_>`#\[\]]/g, " ");
  const words = plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  return words.length;
}

/** Sum of words in daily notes dated within [from, to]. */
export function wordsBetween(notes: DayLike[], from: DateStr, to: DateStr): number {
  let total = 0;
  for (const n of notes) if (isDaily(n) && n.title >= from && n.title <= to) total += wordCount(bodyOf(n));
  return total;
}

export interface MonthCount {
  /** YYYY-MM */
  month: string;
  count: number;
}

/** Written daily notes per calendar month, for the last `months` months ending in today's month (oldest first). */
export function entriesPerMonth(notes: DayLike[], months: number, today: DateStr): MonthCount[] {
  const written = writtenDates(notes);
  const { y, m } = parts(today);
  const out: MonthCount[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({ month: key, count: 0 });
  }
  const idx = new Map(out.map((mc, i) => [mc.month, i]));
  for (const d of written) {
    const i = idx.get(d.slice(0, 7));
    if (i !== undefined) out[i]!.count++;
  }
  return out;
}
