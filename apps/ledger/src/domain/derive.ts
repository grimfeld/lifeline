import type { DateStr } from "@lifeline/core";
import type { Allocation, LedgerAccount, LedgerCategory, MonthStr, Transaction } from "./types";

/**
 * Every total the Ledger shows derives here from the flat fact ledger
 * (ADR 0033): balances, spent-per-category-month, pots, payee prefill.
 * Nothing in this file is ever stored. Scans are fine at personal scale.
 */

export function monthOf(d: DateStr): MonthStr {
  return d.slice(0, 7);
}

export function monthAdd(m: MonthStr, n: number): MonthStr {
  const [y = 0, mo = 1] = m.split("-").map(Number);
  const t = y * 12 + (mo - 1) + n;
  const ny = Math.floor(t / 12);
  const nm = (t % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function thisMonth(today: DateStr): MonthStr {
  return monthOf(today);
}

export function formatMonth(m: MonthStr): string {
  const [y = 0, mo = 1] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Signed effect of one Transaction on one Account (transfers read from both sides). */
export function effectOn(t: Transaction, accountId: string): number {
  switch (t.kind) {
    case "expense":
      return t.accountId === accountId ? -t.amount : 0;
    case "income":
      return t.accountId === accountId ? t.amount : 0;
    case "adjustment":
      // Adjustment amounts are signed — the reconcile gap goes either way.
      return t.accountId === accountId ? t.amount : 0;
    case "transfer":
      if (t.fromAccountId === accountId) return -t.amount;
      if (t.toAccountId === accountId) return t.amount;
      return 0;
  }
}

/** An Account's balance: opening plus every Transaction, optionally only up to a day (inclusive). */
export function balanceOf(account: LedgerAccount, transactions: Transaction[], upTo?: DateStr): number {
  let sum = account.openingBalance;
  for (const t of transactions) {
    if (upTo && t.date > upTo) continue;
    sum += effectOn(t, account.id);
  }
  return sum;
}

/** Net worth: every non-archived Account's balance summed (credit cards run negative). */
export function netWorth(accounts: LedgerAccount[], transactions: Transaction[], upTo?: DateStr): number {
  return accounts.filter((a) => !a.archived).reduce((s, a) => s + balanceOf(a, transactions, upTo), 0);
}

/** The import inbox's mark: an expense or income the user has not classified yet (ADR 0033) — never hidden, and the Register's quick filter. */
export function isUncategorized(t: Transaction): boolean {
  return (t.kind === "expense" || t.kind === "income") && !t.categoryId;
}

/** Spending Transactions of one month (expenses only — transfers and adjustments are nobody's spending). */
export function spendingIn(transactions: Transaction[], month: MonthStr): Transaction[] {
  return transactions.filter((t) => t.kind === "expense" && monthOf(t.date) === month);
}

/** Cents spent per categoryId in a month; "" collects the uncategorized (the import inbox — shown loudly). */
export function spentByCategory(transactions: Transaction[], month: MonthStr): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of spendingIn(transactions, month)) out.set(t.categoryId, (out.get(t.categoryId) ?? 0) + t.amount);
  return out;
}

/** Cents of income per categoryId in a month ("" = uncategorized imports). */
export function incomeByCategory(transactions: Transaction[], month: MonthStr): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of transactions) {
    if (t.kind !== "income" || monthOf(t.date) !== month) continue;
    out.set(t.categoryId, (out.get(t.categoryId) ?? 0) + t.amount);
  }
  return out;
}

/** The month's Target for a Category: the Allocation override when one exists, else the standing target. */
export function targetFor(category: LedgerCategory, allocations: Allocation[], month: MonthStr): number {
  const override = allocations.find((a) => a.categoryId === category.id && a.month === month);
  return override ? override.amount : category.target;
}

export interface BudgetRow {
  category: LedgerCategory;
  /** This month's Target (override or standing). */
  target: number;
  /** Cents spent this month. */
  spent: number;
  /** Does policy say anything here this month — a Target, or an accumulating pot? */
  tracked: boolean;
  /**
   * Non-accumulating: target − spent. Accumulating: the pot (may be negative
   * — no clamping). Null when untracked: with no Target there is nothing to
   * be available against, and spending is not overspending.
   */
  available: number | null;
  /** Accumulating only: the pot after this month. */
  pot: number | null;
}

/**
 * One Budget month (ADR 0033): target / spent / available per expense
 * Category. An accumulating Category is a sinking fund: its pot is all
 * allocations minus all spending since its first month, rolling through
 * `month` — derived from full history, never stored. A Category with no
 * Target (and no pot) is untracked: it records what was spent and claims
 * nothing about it.
 */
export function budgetRows(
  categories: LedgerCategory[],
  allocations: Allocation[],
  transactions: Transaction[],
  month: MonthStr,
): BudgetRow[] {
  const expense = categories.filter((c) => c.kind === "expense");
  // One pass over the ledger for every Category, not one per Category.
  const spentIn = spentByCategory(transactions, month);
  const spentThrough = new Map<string, number>();
  for (const t of transactions) {
    if (t.kind === "expense" && monthOf(t.date) <= month) spentThrough.set(t.categoryId, (spentThrough.get(t.categoryId) ?? 0) + t.amount);
  }
  return expense.map((category) => {
    const target = targetFor(category, allocations, month);
    const spent = spentIn.get(category.id) ?? 0;
    let pot: number | null = null;
    if (category.accumulating) {
      const start = monthOf(category.createdAt);
      let sum = 0;
      // Allocations accrue from the Category's first month through the shown month…
      for (let m = start; m <= month; m = monthAdd(m, 1)) sum += targetFor(category, allocations, m);
      // …and every cent ever spent on it through the shown month comes out.
      pot = sum - (spentThrough.get(category.id) ?? 0);
    }
    const tracked = category.accumulating || target > 0;
    return { category, target, spent, tracked, available: tracked ? (pot ?? target - spent) : null, pot };
  });
}

/** Cents of uncategorized spending in a month — the inbox row, never hidden. */
export function uncategorizedSpent(transactions: Transaction[], month: MonthStr): number {
  return spentByCategory(transactions, month).get("") ?? 0;
}

export interface PayeeSuggestion {
  payee: string;
  /** The payee's most recent expense/income shape — what the entry form prefills. */
  kind: "expense" | "income";
  categoryId: string;
  accountId: string;
  amount: number;
}

/**
 * Payee intelligence (ADR 0033): autocomplete from the strings already in
 * the ledger; picking one prefills category, account and amount from that
 * payee's most recent Transaction. All derived, nothing stored.
 */
export function payeeIndex(transactions: Transaction[]): PayeeSuggestion[] {
  const best = new Map<string, { at: DateStr; s: PayeeSuggestion }>();
  for (const t of transactions) {
    if (t.kind !== "expense" && t.kind !== "income") continue;
    const p = t.payee.trim();
    if (!p) continue;
    const key = p.toLowerCase();
    const cur = best.get(key);
    if (cur && cur.at >= t.date) continue;
    best.set(key, { at: t.date, s: { payee: p, kind: t.kind, categoryId: t.categoryId, accountId: t.accountId, amount: t.amount } });
  }
  return Array.from(best.values())
    .map((v) => v.s)
    .sort((a, b) => a.payee.localeCompare(b.payee));
}

/**
 * A transfer imported from both sides shows as two rows in two Accounts
 * (ADR 0033): same day, same amount, opposite kinds. Given one row, find
 * candidate counterparts to merge when re-kinding it to a transfer.
 */
export function transferCounterparts(t: Transaction, transactions: Transaction[]): Transaction[] {
  const wanted = t.kind === "expense" ? "income" : "expense";
  return transactions.filter(
    (o) => o.id !== t.id && o.kind === wanted && o.amount === t.amount && o.date === t.date && o.accountId !== t.accountId,
  );
}
