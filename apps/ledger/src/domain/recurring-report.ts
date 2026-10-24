import type { MonthStr, Series, Transaction } from "./types";
import { seriesKey } from "./series";
import { monthOf } from "./derive";

/**
 * The Recurring tab's numbers (ADR 0042): the window's spending split fixed
 * against variable, and each Recurring series read over the same slice.
 * Fixed is a membership test — a row whose payee and kind name a detected
 * series — so history keeps its months: a dormant series still owns the rows
 * it posted (dormancy is a forecast concept), and a muted one still counts
 * (mute means "don't forecast me", never "this isn't regular"). Nothing here
 * is stored, and nothing here writes — like every other report.
 */

/** How many times a cadence comes round in a year — the annual column's multiplier. */
export const PER_YEAR: Record<Series["cadence"], number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  yearly: 1,
};

export interface FixedSplitPoint {
  month: MonthStr;
  /** Short axis label — "26-03". */
  label: string;
  /** Cents of the month's expense rows that belong to a Recurring series. */
  fixed: number;
  /** Cents of every other expense row. */
  variable: number;
}

/**
 * Each month's spending split fixed / variable. Expenses only: income is not
 * spending, and a salary series says nothing about what a month cost.
 */
export function fixedSplit(transactions: Transaction[], series: Series[], months: MonthStr[]): FixedSplitPoint[] {
  const keys = new Set(series.filter((s) => s.kind === "expense").map((s) => s.key));
  const index = new Map(months.map((m, i) => [m, i]));
  const fixed = new Array(months.length).fill(0) as number[];
  const variable = new Array(months.length).fill(0) as number[];
  for (const t of transactions) {
    if (t.kind !== "expense") continue;
    const i = index.get(monthOf(t.date));
    if (i === undefined) continue;
    if (keys.has(seriesKey(t.payee, "expense"))) fixed[i]! += t.amount;
    else variable[i]! += t.amount;
  }
  return months.map((month, i) => ({ month, label: month.slice(2), fixed: fixed[i]!, variable: variable[i]! }));
}

/** One Recurring series over the window: the series itself plus what the filtered slice shows of it. */
export interface SeriesReportRow {
  series: Series;
  /** Cents per month, aligned with the window's months — this series' rows only. */
  perMonth: number[];
  /** The window's total for this series. */
  total: number;
  /** Rows in the window. */
  count: number;
  /** What a year of it costs at the median: the series' amount × the cadence's per-year. */
  annual: number;
  /** 0..1 of the window's fixed spending (expense series; 0 for an income series). */
  share: number;
}

/**
 * Every series with at least one row in the filtered window, biggest window
 * total first. The rows come from the filtered slice, so the table answers
 * for what is on screen — same contract as every other tab.
 */
export function seriesReport(transactions: Transaction[], series: Series[], months: MonthStr[]): SeriesReportRow[] {
  const index = new Map(months.map((m, i) => [m, i]));
  const byKey = new Map(series.map((s) => [s.key, s]));
  const sums = new Map<string, number[]>();
  const counts = new Map<string, number>();
  for (const t of transactions) {
    if (t.kind !== "expense" && t.kind !== "income") continue;
    const key = seriesKey(t.payee, t.kind);
    if (!byKey.has(key)) continue;
    const i = index.get(monthOf(t.date));
    if (i === undefined) continue;
    const row = sums.get(key) ?? (new Array(months.length).fill(0) as number[]);
    row[i]! += t.amount;
    sums.set(key, row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const totals = new Map(Array.from(sums, ([key, perMonth]) => [key, perMonth.reduce((a, b) => a + b, 0)]));
  const grandFixed = Array.from(totals).reduce((s, [key, total]) => (byKey.get(key)?.kind === "expense" ? s + total : s), 0);

  const rows: SeriesReportRow[] = [];
  for (const [key, perMonth] of sums) {
    const s = byKey.get(key);
    if (!s) continue;
    const total = totals.get(key) ?? 0;
    rows.push({
      series: s,
      perMonth,
      total,
      count: counts.get(key) ?? 0,
      annual: s.amount * PER_YEAR[s.cadence],
      share: s.kind === "expense" && grandFixed > 0 ? total / grandFixed : 0,
    });
  }
  return rows.sort((a, b) => b.total - a.total || a.series.payee.localeCompare(b.series.payee));
}
