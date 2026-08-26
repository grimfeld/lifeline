import { useMemo } from "react";
import { documentsOf, documentsWhere, newId, normalizeTags, patchDocument, putDocument, removeDocument, todayStr, useDocuments, type DateStr } from "@lifeline/core";
import {
  ACCOUNT,
  ALLOCATION,
  CATEGORY,
  SERIES,
  TRANSACTION,
  type Allocation,
  type Due,
  type ImportMapping,
  type LedgerAccount,
  type LedgerCategory,
  type MonthStr,
  type Series,
  type SeriesOverride,
  type Transaction,
  type TransactionKind,
} from "../domain/types";
import { detectSeries } from "../domain/series";
import { formatCents } from "../domain/money";
import type { ImportRow } from "../domain/csv";

/** PocketBase returns absent fields as "" / undefined; re-establish shapes on read. */
function normalizeTransaction(t: Transaction): Transaction {
  return {
    ...t,
    kind: t.kind || "expense",
    date: t.date || t.createdAt,
    amount: Number(t.amount) || 0,
    accountId: t.accountId ?? "",
    fromAccountId: t.fromAccountId ?? "",
    toAccountId: t.toAccountId ?? "",
    categoryId: t.categoryId ?? "",
    payee: t.payee ?? "",
    note: t.note ?? "",
    importId: t.importId ?? "",
    tags: t.tags ?? [],
  };
}

function normalizeAccount(a: LedgerAccount): LedgerAccount {
  return { ...a, flavor: a.flavor || "checking", openingBalance: Number(a.openingBalance) || 0, archived: !!a.archived, importMapping: a.importMapping ?? null, tags: a.tags ?? [] };
}

function normalizeCategory(c: LedgerCategory): LedgerCategory {
  return { ...c, kind: c.kind || "expense", group: c.group ?? "", target: Number(c.target) || 0, accumulating: !!c.accumulating, tags: c.tags ?? [] };
}

function normalizeAllocation(a: Allocation): Allocation {
  return { ...a, categoryId: a.categoryId ?? "", month: a.month ?? "", amount: Number(a.amount) || 0 };
}

function normalizeSeriesOverride(o: SeriesOverride): SeriesOverride {
  return { ...o, key: o.key ?? "", muted: !!o.muted, skipped: Array.isArray(o.skipped) ? o.skipped : [], tags: o.tags ?? [] };
}

// ---- Reads ----

export function useTransactions(): Transaction[] {
  const rows = useDocuments<Transaction>(TRANSACTION);
  return useMemo(() => rows.map(normalizeTransaction).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [rows]);
}

export function useAccounts(): LedgerAccount[] {
  const rows = useDocuments<LedgerAccount>(ACCOUNT);
  return useMemo(() => rows.map(normalizeAccount).sort((a, b) => a.title.localeCompare(b.title)), [rows]);
}

export function useCategories(): LedgerCategory[] {
  const rows = useDocuments<LedgerCategory>(CATEGORY);
  return useMemo(() => rows.map(normalizeCategory).sort((a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title)), [rows]);
}

export function useAllocations(): Allocation[] {
  const rows = useDocuments<Allocation>(ALLOCATION);
  return useMemo(() => rows.map(normalizeAllocation), [rows]);
}

export function useSeriesOverrides(): SeriesOverride[] {
  const rows = useDocuments<SeriesOverride>(SERIES);
  return useMemo(() => rows.map(normalizeSeriesOverride), [rows]);
}

/**
 * Every Recurring series the ledger shows (ADR 0034) — derived from the
 * Transactions on every read, with the hand-made overrides laid over.
 */
export function useSeries(): Series[] {
  const transactions = useTransactions();
  const overrides = useSeriesOverrides();
  const today = todayStr();
  return useMemo(() => detectSeries(transactions, overrides, today), [transactions, overrides, today]);
}

// ---- Transactions ----

export interface TransactionInput {
  kind: TransactionKind;
  date: DateStr;
  /** Magnitude cents for expense/income/transfer; signed for adjustment. */
  amount: number;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  categoryId?: string;
  payee?: string;
  note?: string;
  tags?: string[];
  importId?: string;
}

function validate(input: TransactionInput): void {
  if (input.kind === "transfer") {
    if (!input.fromAccountId || !input.toAccountId) throw new Error("A transfer needs both accounts");
    if (input.fromAccountId === input.toAccountId) throw new Error("A transfer needs two different accounts");
  } else if (!input.accountId) {
    throw new Error("Pick an account");
  }
  if (input.kind !== "adjustment" && input.amount <= 0) throw new Error("Amount must be above zero");
}

function rowOf(input: TransactionInput): Omit<Transaction, "id" | "updatedAt" | "deleted" | "createdAt"> {
  return {
    type: TRANSACTION,
    title: "",
    kind: input.kind,
    date: input.date,
    amount: input.amount,
    accountId: input.kind === "transfer" ? "" : (input.accountId ?? ""),
    fromAccountId: input.kind === "transfer" ? (input.fromAccountId ?? "") : "",
    toAccountId: input.kind === "transfer" ? (input.toAccountId ?? "") : "",
    categoryId: input.kind === "expense" || input.kind === "income" ? (input.categoryId ?? "") : "",
    payee: input.payee?.trim() ?? "",
    note: input.note?.trim() ?? "",
    importId: input.importId ?? "",
    folder: "",
    tags: normalizeTags(input.tags ?? []),
  };
}

export async function addTransaction(input: TransactionInput): Promise<string> {
  validate(input);
  const row = await putDocument<Transaction>(rowOf(input) as Transaction);
  return row.id;
}

export async function updateTransaction(t: Transaction, input: TransactionInput): Promise<void> {
  validate(input);
  await putDocument<Transaction>({ ...t, ...rowOf(input), importId: input.importId ?? t.importId });
}

export async function deleteTransaction(id: string): Promise<void> {
  await removeDocument(id);
}

/** Set just the category — the auto-categorize sweep and quick fixes use this. */
export async function categorizeTransaction(id: string, categoryId: string): Promise<void> {
  await patchDocument(id, { categoryId });
}

/**
 * Reconcile (ADR 0033): the real balance is typed in, the gap becomes an
 * adjustment — a visible fact, category-less, excluded from reports.
 */
export async function reconcile(account: LedgerAccount, actualBalance: number, currentBalance: number, date: DateStr): Promise<string | null> {
  const gap = actualBalance - currentBalance;
  if (gap === 0) return null;
  return addTransaction({ kind: "adjustment", date, amount: gap, accountId: account.id, note: `Reconciled to ${formatCents(actualBalance)}` });
}

/**
 * Re-kind two both-sides import rows into one transfer (ADR 0033): the
 * expense row becomes the transfer, the counterpart income row is removed.
 */
export async function mergeIntoTransfer(expenseRow: Transaction, incomeRow: Transaction): Promise<void> {
  await putDocument<Transaction>({
    ...expenseRow,
    kind: "transfer",
    fromAccountId: expenseRow.accountId,
    toAccountId: incomeRow.accountId,
    accountId: "",
    categoryId: "",
  });
  await removeDocument(incomeRow.id);
}

// ---- Accounts ----

export interface AccountInput {
  title: string;
  flavor: LedgerAccount["flavor"];
  openingBalance: number;
}

export async function addAccount(input: AccountInput): Promise<string> {
  const row = await putDocument<LedgerAccount>({ type: ACCOUNT, title: input.title.trim(), flavor: input.flavor, openingBalance: input.openingBalance, archived: false, importMapping: null, folder: "", tags: [] } as unknown as LedgerAccount);
  return row.id;
}

export async function updateAccount(a: LedgerAccount, input: AccountInput): Promise<void> {
  await putDocument<LedgerAccount>({ ...a, title: input.title.trim(), flavor: input.flavor, openingBalance: input.openingBalance });
}

export async function setAccountArchived(id: string, archived: boolean): Promise<void> {
  await patchDocument(id, { archived });
}

export async function saveImportMapping(id: string, importMapping: ImportMapping): Promise<void> {
  await patchDocument(id, { importMapping });
}

/** Hard delete only when empty (ADR 0033) — archive is the way out for a used Account. */
export async function deleteAccount(id: string): Promise<void> {
  const ts = (await documentsOf<Transaction>(TRANSACTION)).map(normalizeTransaction);
  if (ts.some((t) => t.accountId === id || t.fromAccountId === id || t.toAccountId === id)) throw new Error("Account has transactions — archive it instead");
  await removeDocument(id);
}

// ---- Categories ----

export interface CategoryInput {
  title: string;
  kind: LedgerCategory["kind"];
  group?: string;
  target?: number;
  accumulating?: boolean;
}

export async function addCategory(input: CategoryInput): Promise<string> {
  const row = await putDocument<LedgerCategory>({ type: CATEGORY, title: input.title.trim(), kind: input.kind, group: input.group?.trim() ?? "", target: input.target ?? 0, accumulating: !!input.accumulating, folder: "", tags: [] } as unknown as LedgerCategory);
  return row.id;
}

export async function updateCategory(c: LedgerCategory, input: CategoryInput): Promise<void> {
  await putDocument<LedgerCategory>({ ...c, title: input.title.trim(), kind: input.kind, group: input.group?.trim() ?? "", target: input.target ?? 0, accumulating: !!input.accumulating });
}

/**
 * A referenced Category can only be merged away (ADR 0033): its
 * Transactions move to the target, its Allocation overrides die with it,
 * then it goes. Recurring series follow for free — they are the
 * Transactions (ADR 0034).
 */
export async function mergeCategory(fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) throw new Error("Pick a different category to merge into");
  for (const t of await documentsWhere<Transaction>(TRANSACTION, "categoryId", fromId)) await patchDocument(t.id, { categoryId: intoId });
  for (const a of (await documentsOf<Allocation>(ALLOCATION)).filter((a) => a.categoryId === fromId)) await removeDocument(a.id);
  await removeDocument(fromId);
}

/** Plain delete passes only for an unreferenced Category. */
export async function deleteCategory(id: string): Promise<void> {
  if ((await documentsWhere<Transaction>(TRANSACTION, "categoryId", id)).length > 0) throw new Error("Category has transactions — merge it instead");
  for (const a of (await documentsOf<Allocation>(ALLOCATION)).filter((a) => a.categoryId === id)) await removeDocument(a.id);
  await removeDocument(id);
}

// ---- Allocation overrides ----

/** Set one month's Target override; amount = null clears it back to the standing target. */
export async function setAllocation(categoryId: string, month: MonthStr, amount: number | null, existing: Allocation[]): Promise<void> {
  const cur = existing.find((a) => a.categoryId === categoryId && a.month === month);
  if (amount === null) {
    if (cur) await removeDocument(cur.id);
    return;
  }
  if (cur) await patchDocument(cur.id, { amount });
  else await putDocument<Allocation>({ type: ALLOCATION, title: "", categoryId, month, amount, folder: "", tags: [] } as unknown as Allocation);
}

// ---- Recurring series ----

/**
 * The one thing a derived series cannot know: the user's own word. Written
 * only while it says something — unmuting a series with no skips left takes
 * the override Document away again (ADR 0034).
 */
async function overrideSeries(series: Series, next: { muted: boolean; skipped: DateStr[] }): Promise<void> {
  if (!next.muted && next.skipped.length === 0) {
    if (series.overrideId) await removeDocument(series.overrideId);
    return;
  }
  if (series.overrideId) {
    await patchDocument(series.overrideId, next);
    return;
  }
  await putDocument<SeriesOverride>({ type: SERIES, title: series.payee, key: series.key, ...next, folder: "", tags: [] } as unknown as SeriesOverride);
}

/** Silence a series: it stays listed and greyed, and surfaces no Dues. */
export async function setSeriesMuted(series: Series, muted: boolean): Promise<void> {
  await overrideSeries(series, { muted, skipped: series.skipped });
}

/** One tap: the Due becomes a real Transaction — amount editable at confirm, never auto-posted. Posting it advances the series, so the Due goes. */
export async function confirmDue(due: Due, amount?: number, date?: DateStr): Promise<string> {
  const s = due.series;
  return addTransaction({
    kind: s.kind,
    date: date ?? due.date,
    amount: amount ?? s.amount,
    accountId: s.accountId,
    categoryId: s.categoryId,
    payee: s.payee,
  });
}

/** Decline a Due: its day is remembered as skipped and never surfaces again. */
export async function dismissDue(due: Due): Promise<void> {
  if (due.series.skipped.includes(due.date)) return;
  await overrideSeries(due.series, { muted: due.series.muted, skipped: [...due.series.skipped, due.date] });
}

// ---- Import ----

/**
 * Post the ticked preview rows (ADR 0033): sign decides expense/income.
 * A row may carry the category confirmed in the preview (history-derived
 * suggestion or a hand pick); without one it lands uncategorized — the
 * inbox is loud, never hidden.
 */
export async function importRows(rows: (ImportRow & { categoryId?: string })[], accountId: string): Promise<number> {
  let n = 0;
  for (const r of rows) {
    if (r.invalid || r.date === null || r.amount === null) continue;
    await addTransaction({
      kind: r.amount < 0 ? "expense" : "income",
      date: r.date,
      amount: Math.abs(r.amount),
      accountId,
      categoryId: r.categoryId ?? "",
      payee: r.payee,
      note: r.note,
      importId: r.importId || `csv-${newId()}`,
    });
    n++;
  }
  return n;
}

export { todayStr };
