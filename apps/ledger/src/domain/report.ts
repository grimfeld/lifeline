import type { DateStr } from "@lifeline/core";
import type { Allocation, CategoryKind, LedgerAccount, LedgerCategory, MonthStr, Transaction } from "./types";
import { effectOn, monthAdd, monthOf, targetFor } from "./derive";

/**
 * Every number the Reports screen draws (ADR 0033): one window over the flat
 * fact ledger, sliced by the filters, rolled up per month / category / group /
 * payee, and against the Budget's Targets. Nothing here is ever stored — the
 * charts are a reading of the Transactions, same as the Budget and the
 * Recurring series. Scans are fine at personal scale; each roll-up is one
 * pass over the already-filtered rows.
 */

/** The window the Reports screen reads over, as the filter bar offers it. */
export type ReportRange = "3m" | "6m" | "12m" | "24m" | "ytd" | "last-year" | "all" | "custom";

export const REPORT_RANGES: ReportRange[] = ["3m", "6m", "12m", "24m", "ytd", "last-year", "all", "custom"];

export const RANGE_LABEL: Record<ReportRange, string> = {
  "3m": "Last 3 months",
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  "24m": "Last 24 months",
  ytd: "This year",
  "last-year": "Last year",
  all: "All time",
  custom: "Custom range",
};

/** The slice of the ledger the charts read: a month window plus the filters over it. Nothing stored. */
export interface ReportFilter {
  /** Inclusive month window. */
  from: MonthStr;
  to: MonthStr;
  /** Empty = every Account. A transfer counts for both of its sides. */
  accountIds: string[];
  /** Empty = every group; "" is the ungrouped group (Categories with no group). */
  groups: string[];
  /** Empty = every Category. */
  categoryIds: string[];
  /** The import inbox — uncategorized expense/income — in or out. Loud by default. */
  includeUncategorized: boolean;
  /** Drop rows under this many cents: the noise floor that leaves the big movements. */
  minAmount: number;
  /** Free text over payee, note and the bank's own payee string. */
  search: string;
}

export function emptyFilter(from: MonthStr, to: MonthStr): ReportFilter {
  return { from, to, accountIds: [], groups: [], categoryIds: [], includeUncategorized: true, minAmount: 0, search: "" };
}

/** How many filters are narrowing the window — what the filter bar's "Clear" badge counts. */
export function activeFilterCount(f: ReportFilter): number {
  return (
    (f.accountIds.length > 0 ? 1 : 0) +
    (f.groups.length > 0 ? 1 : 0) +
    (f.categoryIds.length > 0 ? 1 : 0) +
    (f.includeUncategorized ? 0 : 1) +
    (f.minAmount > 0 ? 1 : 0) +
    (f.search.trim() ? 1 : 0)
  );
}

/** Every month from `from` to `to` inclusive, oldest first. Empty when the window is inverted. */
export function monthRange(from: MonthStr, to: MonthStr): MonthStr[] {
  const out: MonthStr[] = [];
  for (let m = from; m <= to && out.length < 600; m = monthAdd(m, 1)) out.push(m);
  return out;
}

/** Every month the ledger touches, oldest first — the custom range's options. */
export function ledgerMonths(transactions: Transaction[]): MonthStr[] {
  return Array.from(new Set(transactions.map((t) => monthOf(t.date)))).sort();
}

/**
 * A range preset resolved against today and the ledger's own span: presets
 * never run past today, and "All time" starts at the oldest Transaction.
 */
export function resolveRange(range: Exclude<ReportRange, "custom">, today: DateStr, months: MonthStr[]): { from: MonthStr; to: MonthStr } {
  const now = monthOf(today);
  const year = now.slice(0, 4);
  switch (range) {
    case "3m":
      return { from: monthAdd(now, -2), to: now };
    case "6m":
      return { from: monthAdd(now, -5), to: now };
    case "12m":
      return { from: monthAdd(now, -11), to: now };
    case "24m":
      return { from: monthAdd(now, -23), to: now };
    case "ytd":
      return { from: `${year}-01`, to: now };
    case "last-year": {
      const last = String(Number(year) - 1);
      return { from: `${last}-01`, to: `${last}-12` };
    }
    case "all": {
      const last = months.at(-1) ?? now;
      // A future-dated Transaction still belongs to "All time" — the window ends at whichever is later.
      return { from: months[0] ?? now, to: last > now ? last : now };
    }
  }
}

/** Does one Transaction touch this Account at all (a transfer from either side)? */
export function touchesAccount(t: Transaction, accountId: string): boolean {
  return t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId;
}

function matchesSearch(t: Transaction, q: string): boolean {
  return `${t.payee} ${t.note} ${t.bankPayee}`.toLowerCase().includes(q);
}

/**
 * The filtered slice every chart on the screen reads. Category and group
 * filters only speak for rows that *have* a Category (expense / income):
 * transfers and adjustments are nobody's spending and are left to the
 * balance charts, which take the slice whole.
 */
export function filterTransactions(transactions: Transaction[], filter: ReportFilter, categories: LedgerCategory[]): Transaction[] {
  const groupOf = new Map(categories.map((c) => [c.id, c.group ?? ""]));
  const q = filter.search.trim().toLowerCase();
  return transactions.filter((t) => {
    const m = monthOf(t.date);
    if (m < filter.from || m > filter.to) return false;
    if (filter.accountIds.length > 0 && !filter.accountIds.some((id) => touchesAccount(t, id))) return false;
    if (filter.minAmount > 0 && Math.abs(t.amount) < filter.minAmount) return false;
    if (q && !matchesSearch(t, q)) return false;
    const categorizable = t.kind === "expense" || t.kind === "income";
    if (categorizable) {
      if (!t.categoryId && !filter.includeUncategorized) return false;
      if (filter.categoryIds.length > 0 && !filter.categoryIds.includes(t.categoryId)) return false;
      if (filter.groups.length > 0 && !filter.groups.includes(groupOf.get(t.categoryId) ?? "")) return false;
    }
    return true;
  });
}

export interface MonthTotals {
  month: MonthStr;
  /** Short axis label — "26-03". */
  label: string;
  income: number;
  spent: number;
  /** income − spent: what the month put by (negative = it ate into savings). */
  net: number;
  /** Running net across the window — the "cumulative" reading of the same bars. */
  cumulative: number;
}

/** Income, spending and net per month of the window — the shape both the bar and the line reading draw. */
export function monthlyTotals(transactions: Transaction[], months: MonthStr[]): MonthTotals[] {
  const index = new Map(months.map((m, i) => [m, i]));
  const income = new Array(months.length).fill(0) as number[];
  const spent = new Array(months.length).fill(0) as number[];
  for (const t of transactions) {
    const i = index.get(monthOf(t.date));
    if (i === undefined) continue;
    if (t.kind === "expense") spent[i] += t.amount;
    else if (t.kind === "income") income[i] += t.amount;
  }
  let running = 0;
  return months.map((month, i) => {
    const net = income[i] - spent[i];
    running += net;
    return { month, label: month.slice(2), income: income[i], spent: spent[i], net, cumulative: running };
  });
}

export interface ReportSummary {
  income: number;
  spent: number;
  /** income − spent over the whole window. */
  net: number;
  /** Spending per month of the window (the window's months, not just the active ones). */
  averageSpent: number;
  averageIncome: number;
  /** net / income, 0 when nothing came in — the share of income that stayed. */
  savingsRate: number;
  /** The window's worst and best month by net, when the window has months at all. */
  worst: MonthTotals | null;
  best: MonthTotals | null;
  transactions: number;
}

/** The window in five numbers — the tiles above the charts. */
export function summarize(totals: MonthTotals[], transactionCount: number): ReportSummary {
  const income = totals.reduce((s, t) => s + t.income, 0);
  const spent = totals.reduce((s, t) => s + t.spent, 0);
  const n = Math.max(1, totals.length);
  const sorted = [...totals].sort((a, b) => a.net - b.net);
  return {
    income,
    spent,
    net: income - spent,
    averageSpent: Math.round(spent / n),
    averageIncome: Math.round(income / n),
    savingsRate: income > 0 ? (income - spent) / income : 0,
    worst: sorted[0] ?? null,
    best: sorted.at(-1) ?? null,
    transactions: transactionCount,
  };
}

/** One Category's row in the window: its months, its totals, and — for spending — the Targets it was held to. */
export interface CategoryReportRow {
  /** "" = the uncategorized inbox, which is a row like any other so it is never quietly dropped. */
  categoryId: string;
  title: string;
  group: string;
  /** Cents per month, aligned with the window's months. */
  perMonth: number[];
  total: number;
  /** Total over the window's months (empty months included — this is the run rate). */
  average: number;
  /** 0..1 of the window's total for this kind. */
  share: number;
  /** Months with any movement at all. */
  activeMonths: number;
  /** The last active month minus the average: the direction of travel, positive = climbing. */
  change: number;
  /** Summed monthly Targets over the window (expense Categories only; 0 when none). */
  target: number;
  /** target − total: positive = under, negative = over. Meaningless without a target. */
  budgetDelta: number;
  /** total / target, or null when the Category carries no Target in this window. */
  budgetRatio: number | null;
  accumulating: boolean;
}

/**
 * Spending (or income) per Category across the window, with each Category's
 * Targets summed over the same months so the Budget charts and the category
 * charts read from one row. The uncategorized inbox comes back as the ""
 * row whenever the filter lets it through.
 */
export function categoryReport(
  transactions: Transaction[],
  categories: LedgerCategory[],
  allocations: Allocation[],
  months: MonthStr[],
  kind: CategoryKind,
): CategoryReportRow[] {
  const index = new Map(months.map((m, i) => [m, i]));
  const sums = new Map<string, number[]>();
  const blank = () => new Array(months.length).fill(0) as number[];
  for (const t of transactions) {
    if (t.kind !== kind) continue;
    const i = index.get(monthOf(t.date));
    if (i === undefined) continue;
    const row = sums.get(t.categoryId) ?? blank();
    row[i] += t.amount;
    sums.set(t.categoryId, row);
  }

  const byId = new Map(categories.map((c) => [c.id, c]));
  // Every Category of this kind gets a row — a Target with nothing spent on it is a report, not a blank.
  for (const c of categories) {
    if (c.kind !== kind || sums.has(c.id)) continue;
    const hasTarget = kind === "expense" && months.some((m) => targetFor(c, allocations, m) > 0);
    if (hasTarget) sums.set(c.id, blank());
  }

  const grand = Array.from(sums.values()).reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
  const rows: CategoryReportRow[] = [];
  for (const [categoryId, perMonth] of sums) {
    const category = byId.get(categoryId);
    const total = perMonth.reduce((a, b) => a + b, 0);
    const activeMonths = perMonth.filter((v) => v !== 0).length;
    const average = Math.round(total / Math.max(1, months.length));
    const lastActive = [...perMonth].reverse().find((v) => v !== 0) ?? 0;
    const target = category && kind === "expense" ? months.reduce((s, m) => s + targetFor(category, allocations, m), 0) : 0;
    rows.push({
      categoryId,
      title: category?.title ?? "Uncategorized",
      group: category?.group ?? "",
      perMonth,
      total,
      average,
      share: grand > 0 ? total / grand : 0,
      activeMonths,
      change: lastActive - average,
      target,
      budgetDelta: target - total,
      budgetRatio: target > 0 ? total / target : null,
      accumulating: !!category?.accumulating,
    });
  }
  return rows.sort((a, b) => b.total - a.total);
}

/** A display group's roll-up of its Category rows — the second reading of the same window. */
export interface GroupReportRow {
  group: string;
  title: string;
  perMonth: number[];
  total: number;
  share: number;
  target: number;
  budgetDelta: number;
  categories: number;
}

export function groupReport(rows: CategoryReportRow[], months: MonthStr[]): GroupReportRow[] {
  const out = new Map<string, GroupReportRow>();
  for (const row of rows) {
    const cur =
      out.get(row.group) ??
      ({ group: row.group, title: row.group || "Ungrouped", perMonth: new Array(months.length).fill(0) as number[], total: 0, share: 0, target: 0, budgetDelta: 0, categories: 0 } satisfies GroupReportRow);
    cur.perMonth = cur.perMonth.map((v, i) => v + (row.perMonth[i] ?? 0));
    cur.total += row.total;
    cur.target += row.target;
    cur.budgetDelta = cur.target - cur.total;
    cur.categories += 1;
    out.set(row.group, cur);
  }
  const grand = Array.from(out.values()).reduce((s, g) => s + g.total, 0);
  return Array.from(out.values())
    .map((g) => ({ ...g, share: grand > 0 ? g.total / grand : 0 }))
    .sort((a, b) => b.total - a.total);
}

export type CategorySortKey = "total-desc" | "total-asc" | "average-desc" | "share-desc" | "change-desc" | "change-asc" | "over-budget" | "under-budget" | "name" | "group";

/** The sorts the category and budget tables offer — one comparator per option, no hidden tiebreaks. */
export const CATEGORY_SORTS: Record<CategorySortKey, (a: CategoryReportRow, b: CategoryReportRow) => number> = {
  "total-desc": (a, b) => b.total - a.total || a.title.localeCompare(b.title),
  "total-asc": (a, b) => a.total - b.total || a.title.localeCompare(b.title),
  "average-desc": (a, b) => b.average - a.average || a.title.localeCompare(b.title),
  "share-desc": (a, b) => b.share - a.share || a.title.localeCompare(b.title),
  "change-desc": (a, b) => b.change - a.change || a.title.localeCompare(b.title),
  "change-asc": (a, b) => a.change - b.change || a.title.localeCompare(b.title),
  // Rows without a Target sort last either way — "over budget" says nothing about them.
  "over-budget": (a, b) => Number(b.budgetRatio !== null) - Number(a.budgetRatio !== null) || (b.budgetRatio ?? 0) - (a.budgetRatio ?? 0) || b.total - a.total,
  "under-budget": (a, b) => Number(b.budgetRatio !== null) - Number(a.budgetRatio !== null) || (a.budgetRatio ?? 0) - (b.budgetRatio ?? 0) || a.total - b.total,
  name: (a, b) => a.title.localeCompare(b.title),
  group: (a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title),
};

/** Sort by one month's column — what clicking a month header in the matrix does. */
export function sortByMonth(rows: CategoryReportRow[], monthIndex: number, direction: "asc" | "desc"): CategoryReportRow[] {
  const sign = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => sign * ((a.perMonth[monthIndex] ?? 0) - (b.perMonth[monthIndex] ?? 0)) || a.title.localeCompare(b.title));
}

export interface Slice {
  id: string;
  title: string;
  value: number;
  share: number;
}

/**
 * The pie's slices: the biggest `n`, everything else collected into one
 * "Other" — a hundred hairline slices say nothing, and the tail is still
 * counted. Zero and negative values are left out; a pie cannot draw them.
 */
export function topSlices(rows: { categoryId?: string; group?: string; title: string; total: number }[], n: number): Slice[] {
  const positive = rows.filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  const grand = positive.reduce((s, r) => s + r.total, 0);
  const head = positive.slice(0, n);
  const tail = positive.slice(n);
  const slices = head.map((r) => ({ id: r.categoryId ?? r.group ?? r.title, title: r.title, value: r.total, share: grand > 0 ? r.total / grand : 0 }));
  if (tail.length > 0) {
    const rest = tail.reduce((s, r) => s + r.total, 0);
    slices.push({ id: "__other", title: `Other (${tail.length})`, value: rest, share: grand > 0 ? rest / grand : 0 });
  }
  return slices;
}

/** One month of the window as a stacked bar: a key per shown Category, the tail under "Other". */
export interface StackPoint {
  month: MonthStr;
  label: string;
  [key: string]: number | string;
}

/** The stacked-bars reading: the top `n` rows keep their own band, every other row joins "Other". */
export function stackedByMonth(rows: CategoryReportRow[], months: MonthStr[], n: number): { keys: { id: string; title: string }[]; data: StackPoint[] } {
  const ranked = [...rows].filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  const head = ranked.slice(0, n);
  const tail = ranked.slice(n);
  const keys = head.map((r) => ({ id: r.categoryId, title: r.title }));
  if (tail.length > 0) keys.push({ id: "__other", title: `Other (${tail.length})` });
  const data = months.map((month, i) => {
    const point: StackPoint = { month, label: month.slice(2) };
    for (const r of head) point[r.categoryId] = (r.perMonth[i] ?? 0) / 100;
    if (tail.length > 0) point.__other = tail.reduce((s, r) => s + (r.perMonth[i] ?? 0), 0) / 100;
    return point;
  });
  return { keys, data };
}

export interface PayeeReportRow {
  payee: string;
  total: number;
  count: number;
  average: number;
  last: DateStr;
  /** The Category its newest row wears — what the payee mostly means. */
  categoryId: string;
}

export type PayeeSortKey = "total-desc" | "count-desc" | "average-desc" | "recent" | "name";

export const PAYEE_SORT_LABEL: Record<PayeeSortKey, string> = {
  "total-desc": "Biggest total",
  "count-desc": "Most transactions",
  "average-desc": "Biggest average",
  recent: "Most recent",
  name: "Name A–Z",
};

const PAYEE_SORTS: Record<PayeeSortKey, (a: PayeeReportRow, b: PayeeReportRow) => number> = {
  "total-desc": (a, b) => b.total - a.total,
  "count-desc": (a, b) => b.count - a.count || b.total - a.total,
  "average-desc": (a, b) => b.average - a.average,
  recent: (a, b) => b.last.localeCompare(a.last),
  name: (a, b) => a.payee.localeCompare(b.payee),
};

/** Who the money went to (or came from) in the window — the payee strings the ledger already holds, grouped case-insensitively. */
export function payeeReport(transactions: Transaction[], kind: CategoryKind, sort: PayeeSortKey = "total-desc"): PayeeReportRow[] {
  const out = new Map<string, PayeeReportRow>();
  for (const t of transactions) {
    if (t.kind !== kind) continue;
    const payee = t.payee.trim();
    if (!payee) continue;
    const key = payee.toLowerCase();
    const cur = out.get(key) ?? { payee, total: 0, count: 0, average: 0, last: t.date, categoryId: t.categoryId };
    cur.total += t.amount;
    cur.count += 1;
    cur.average = Math.round(cur.total / cur.count);
    if (t.date >= cur.last) {
      cur.last = t.date;
      cur.payee = payee;
      cur.categoryId = t.categoryId;
    }
    out.set(key, cur);
  }
  return Array.from(out.values()).sort(PAYEE_SORTS[sort]);
}

export interface BudgetTrendPoint {
  month: MonthStr;
  label: string;
  /** Every shown Category's Target for that month, summed. */
  target: number;
  spent: number;
  /** target − spent: the month's headroom, negative when it went over. */
  left: number;
}

/**
 * Targets against spending, month by month — the Budget's own question asked
 * across the window instead of one month at a time. Only the Categories the
 * filters left in are counted, so the line answers for what is on screen.
 */
export function budgetTrend(rows: CategoryReportRow[], categories: LedgerCategory[], allocations: Allocation[], months: MonthStr[]): BudgetTrendPoint[] {
  const shown = categories.filter((c) => c.kind === "expense" && rows.some((r) => r.categoryId === c.id));
  return months.map((month, i) => {
    const target = shown.reduce((s, c) => s + targetFor(c, allocations, month), 0);
    const spent = rows.reduce((s, r) => s + (r.perMonth[i] ?? 0), 0);
    return { month, label: month.slice(2), target, spent, left: target - spent };
  });
}

export interface PotPoint {
  month: MonthStr;
  label: string;
  /** Cents in the pot at the end of that month, per accumulating Category id. */
  [categoryId: string]: number | string;
}

/**
 * An accumulating Category's pot across the window (ADR 0033): allocations
 * since the Category's first month minus everything ever spent on it, read
 * at the end of each month. Derived from full history — the window only
 * decides which months are drawn, never what the pot holds.
 */
export function potTrend(categories: LedgerCategory[], allocations: Allocation[], transactions: Transaction[], months: MonthStr[]): { pots: LedgerCategory[]; data: PotPoint[] } {
  const pots = categories.filter((c) => c.kind === "expense" && c.accumulating);
  if (pots.length === 0 || months.length === 0) return { pots, data: [] };
  const spentByCategoryMonth = new Map<string, Map<MonthStr, number>>();
  for (const t of transactions) {
    if (t.kind !== "expense" || !t.categoryId) continue;
    const per = spentByCategoryMonth.get(t.categoryId) ?? new Map<MonthStr, number>();
    const m = monthOf(t.date);
    per.set(m, (per.get(m) ?? 0) + t.amount);
    spentByCategoryMonth.set(t.categoryId, per);
  }
  const data = months.map((month) => ({ month, label: month.slice(2) }) as PotPoint);
  for (const c of pots) {
    const start = monthOf(c.createdAt);
    const spent = spentByCategoryMonth.get(c.id);
    let sum = 0;
    // Walk from the Category's first month so the pot arrives at the window with its real balance.
    for (let m = start, i = 0; m <= (months.at(-1) as MonthStr) && i < 1200; m = monthAdd(m, 1), i++) {
      sum += targetFor(c, allocations, m);
      sum -= spent?.get(m) ?? 0;
      const at = months.indexOf(m);
      if (at >= 0) data[at][c.id] = sum / 100;
    }
    // Months before the Category existed carry the pot's first value, so the line starts where the pot does.
    for (const point of data) if (point[c.id] === undefined) point[c.id] = 0;
  }
  return { pots, data };
}

export interface BalancePoint {
  month: MonthStr;
  label: string;
  /** Cents at the end of that month. */
  balance: number;
}

/**
 * Balance at the end of each month of the window: opening balances plus
 * every Transaction up to that month, over the Accounts the filter left in
 * (all non-archived Accounts = net worth). Categories say nothing here —
 * a balance is the sum of movements, whatever they were for.
 */
export function balanceTrend(accounts: LedgerAccount[], transactions: Transaction[], months: MonthStr[], accountIds: string[]): BalancePoint[] {
  const shown = accounts.filter((a) => (accountIds.length > 0 ? accountIds.includes(a.id) : !a.archived));
  if (shown.length === 0 || months.length === 0) return [];
  const opening = shown.reduce((s, a) => s + a.openingBalance, 0);
  const perMonth = new Map<MonthStr, number>();
  for (const t of transactions) {
    const delta = shown.reduce((s, a) => s + effectOn(t, a.id), 0);
    if (delta === 0) continue;
    const m = monthOf(t.date);
    perMonth.set(m, (perMonth.get(m) ?? 0) + delta);
  }
  // Everything that happened before the window is already in the opening balance the first point shows.
  let running = opening;
  for (const [m, delta] of perMonth) if (m < months[0]) running += delta;
  return months.map((month) => {
    running += perMonth.get(month) ?? 0;
    return { month, label: month.slice(2), balance: running };
  });
}
