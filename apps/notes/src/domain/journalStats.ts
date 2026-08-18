/**
 * Pure journal statistics for the Notes cards: on-this-day lookups, writing
 * streaks, mood series and word counts. Everything derives from daily notes'
 * text (`type === "daily"`, `title === YYYY-MM-DD`); nothing is stored.
 */

import { addDays, clampedDate, parts, type DateStr } from "@lifeline/core";
import { splitFrontmatter } from "./markdown";
import type { Note } from "./types";

type DailyLike = Pick<Note, "type" | "title" | "body">;

const isDaily = (n: DailyLike) => n.type === "daily" && /^\d{4}-\d{2}-\d{2}$/.test(n.title);

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

/**
 * Body text minus frontmatter, template headings ("###"), rules ("---"),
 * code-fence markers and blank lines — what the user actually typed.
 */
export function writtenContent(body: string): string {
  const { content } = splitFrontmatter(body);
  return content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("###") && !l.startsWith("---") && !l.startsWith("```"))
    .join("\n");
}

/** A daily note counts as "written" when ≥ 20 chars remain beyond the template. */
export function isWritten(body: string): boolean {
  return writtenContent(body).length >= 20;
}

/** Set of dates (YYYY-MM-DD) with a written daily note. */
export function writtenDays(notes: DailyLike[]): Set<string> {
  const out = new Set<string>();
  for (const n of notes) if (isDaily(n) && isWritten(n.body)) out.add(n.title);
  return out;
}

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

// --- mood ---------------------------------------------------------------

export interface MoodPoint {
  date: DateStr;
  /** 1..5, or null when the day has no (valid) mood. */
  mood: number | null;
}

/** Read the `mood` frontmatter property as 1..5 (null otherwise). */
export function readMood(body: string): number | null {
  const v = splitFrontmatter(body).properties.mood;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** One point per day for the last `days` days (oldest first). */
export function moodSeries(notes: DailyLike[], days: number, today: DateStr): MoodPoint[] {
  const byDate = new Map<string, number>();
  for (const n of notes) {
    if (!isDaily(n)) continue;
    const m = readMood(n.body);
    if (m !== null) byDate.set(n.title, m);
  }
  return lastDays(today, days).map((date) => ({ date, mood: byDate.get(date) ?? null }));
}

/** Mean of the numbers (null when empty). */
export function avg(values: (number | null)[]): number | null {
  const xs = values.filter((v): v is number => v !== null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
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
export function wordsBetween(notes: DailyLike[], from: DateStr, to: DateStr): number {
  let total = 0;
  for (const n of notes) if (isDaily(n) && n.title >= from && n.title <= to) total += wordCount(n.body);
  return total;
}

export interface MonthCount {
  /** YYYY-MM */
  month: string;
  count: number;
}

/** Written daily notes per calendar month, for the last `months` months ending in today's month (oldest first). */
export function entriesPerMonth(notes: DailyLike[], months: number, today: DateStr): MonthCount[] {
  const written = writtenDays(notes);
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
    if (i !== undefined) out[i].count++;
  }
  return out;
}
