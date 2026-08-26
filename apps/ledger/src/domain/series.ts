import { addDays, clampedDate, diffDays, parts, type DateStr } from "@lifeline/core";
import type { Cadence, Series, SeriesOverride, Transaction } from "./types";
import { normalizePayee } from "./suggest";

/**
 * Recurring series derive (ADR 0034): rent, salary and Netflix are already
 * in the ledger — a payee whose Transactions keep coming at one cadence for
 * near enough one amount. Nothing is typed in and nothing is stored; the
 * series are read off the facts on every render, and a bill that stops
 * simply stops being one.
 */

/** Two gaps before a cadence is believed — one repeat is a coincidence. */
export const MIN_OCCURRENCES = 3;

/**
 * The cadences read for, with how far a gap may sit from the nominal period
 * — and, once a run has started, from the run's own first gap. Windows
 * never overlap, so one gap names at most one cadence.
 */
export const CADENCES: { cadence: Cadence; period: number; tolerance: number }[] = [
  { cadence: "weekly", period: 7, tolerance: 2 },
  { cadence: "fortnightly", period: 14, tolerance: 3 },
  { cadence: "monthly", period: 30, tolerance: 5 },
  { cadence: "yearly", period: 365, tolerance: 20 },
];

/**
 * A bill's amount barely moves; the weekly supermarket run's swings. The
 * widest deviation from the median a series tolerates — this, more than the
 * calendar, is what keeps habits out of the Dues list.
 */
export const MAX_SPREAD = 0.25;

/** Series identity: the kind and the payee with the bank's noise normalized away. */
export function seriesKey(payee: string, kind: "expense" | "income"): string {
  return `${kind}/${normalizePayee(payee)}`;
}

function median(ns: number[]): number {
  const s = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** The cadence a gap of this many days reads as, or null when it reads as none. */
function cadenceOfGap(days: number): (typeof CADENCES)[number] | null {
  return CADENCES.find((c) => Math.abs(days - c.period) <= c.tolerance) ?? null;
}

/** The day of month the series lands on: the commonest, ties to the later day (a bill on the 31st clamps down in February, never up). */
function anchorDayOf(dates: DateStr[]): number {
  const count = new Map<number, number>();
  for (const d of dates) {
    const day = parts(d).day;
    count.set(day, (count.get(day) ?? 0) + 1);
  }
  let best = parts(dates[0]).day;
  for (const [day, n] of count) {
    const bestN = count.get(best) ?? 0;
    if (n > bestN || (n === bestN && day > best)) best = day;
  }
  return best;
}

/**
 * One payee's run, newest first, read as a series — or null. The run must
 * *end at the newest Transaction*: a series describes what is still
 * happening, so a cadence that only held years ago is not one. It stretches
 * back only as far as the gaps hold, which lets a bill that changed day or
 * price start a fresh, shorter run instead of vanishing.
 */
function readSeries(rows: Transaction[], today: DateStr, override: SeriesOverride | undefined): Series | null {
  if (rows.length < MIN_OCCURRENCES) return null;
  const gap = diffDays(rows[1].date, rows[0].date);
  const c = cadenceOfGap(gap);
  if (!c) return null;
  const run = [rows[0], rows[1]];
  for (let i = 2; i < rows.length; i++) {
    // Against the run's own rhythm, not just the nominal period: eleven days
    // then sixteen is nobody's fortnight, though both land in the window.
    if (Math.abs(diffDays(rows[i].date, rows[i - 1].date) - gap) > c.tolerance) break;
    run.push(rows[i]);
  }
  if (run.length < MIN_OCCURRENCES) return null;

  const amounts = run.map((t) => t.amount);
  const amount = median(amounts);
  if (amount <= 0) return null;
  const spread = Math.max(...amounts.map((a) => Math.abs(a - amount))) / amount;
  if (spread > MAX_SPREAD) return null;

  const newest = run[0];
  const dates = run.map((t) => t.date);
  const kind = newest.kind as "expense" | "income";
  return {
    key: seriesKey(newest.payee, kind),
    payee: newest.payee.trim(),
    kind,
    cadence: c.cadence,
    period: c.period,
    amount,
    spread,
    accountId: newest.accountId,
    categoryId: newest.categoryId,
    occurrences: run,
    firstDate: dates[dates.length - 1],
    lastDate: dates[0],
    anchorDay: anchorDayOf(dates),
    anchorMonth: parts(newest.date).m,
    dormant: diffDays(dates[0], today) > 2 * c.period,
    overrideId: override?.id ?? "",
    muted: !!override?.muted,
    skipped: override?.skipped ?? [],
  };
}

/**
 * Every Recurring series the ledger shows, active ones first then by payee.
 * Expenses and income both: a salary is as recurring as rent.
 */
export function detectSeries(transactions: Transaction[], overrides: SeriesOverride[], today: DateStr): Series[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.kind !== "expense" && t.kind !== "income") continue;
    if (!normalizePayee(t.payee)) continue;
    const key = seriesKey(t.payee, t.kind);
    const group = groups.get(key);
    if (group) group.push(t);
    else groups.set(key, [t]);
  }
  const byKey = new Map(overrides.map((o) => [o.key, o]));
  const out: Series[] = [];
  for (const [key, rows] of groups) {
    // Newest first; a payee twice on one day is not a bill, so the zero gap
    // ends the run on its own — no special case.
    const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
    const series = readSeries(sorted, today, byKey.get(key));
    if (series) out.push(series);
  }
  return out.sort((a, b) => Number(a.muted) - Number(b.muted) || Number(a.dormant) - Number(b.dormant) || a.payee.localeCompare(b.payee));
}

/** The day the series comes round again after `after`, clamped like every other month rule (the 31st in February → the 28th/29th). */
export function nextOccurrence(series: Series, after: DateStr): DateStr {
  switch (series.cadence) {
    case "weekly":
      return addDays(after, 7);
    case "fortnightly":
      return addDays(after, 14);
    case "monthly": {
      const { y, m } = parts(after);
      return clampedDate(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, series.anchorDay);
    }
    case "yearly":
      return clampedDate(parts(after).y + 1, series.anchorMonth, series.anchorDay);
  }
}

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "monthly on the 1st", "weekly on Tuesday", "yearly on 1 July" — the cadence in words. */
export function describeCadence(series: Series): string {
  const { y, m, day } = parts(series.lastDate);
  switch (series.cadence) {
    case "weekly":
      return `weekly on ${new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" })}`;
    case "fortnightly":
      return "every two weeks";
    case "monthly":
      return `monthly on the ${ordinal(series.anchorDay)}`;
    case "yearly":
      return `yearly on ${new Date(Date.UTC(2000, series.anchorMonth - 1, series.anchorDay)).toLocaleDateString(undefined, { month: "long", day: "numeric", timeZone: "UTC" })}`;
  }
}
