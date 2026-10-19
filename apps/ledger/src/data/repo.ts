import { useMemo } from "react";
import { assertWitnessed } from "../domain/entry";
import { documentsOf, documentsWhere, newId, normalizeTags, patchDocument, putDocument, removeDocument, todayStr, useDocuments, type DateStr } from "@lifeline/core";
import {
  ACCOUNT,
  ALLOCATION,
  CATEGORY,
  RULE,
  SERIES,
  TRANSACTION,
  type Allocation,
  type CategorizeRule,
  type Due,
  type ImportMapping,
  type LedgerAccount,
  type LedgerCategory,
  type MonthStr,
  type RuleMode,
  type Series,
  type SeriesOverride,
  type Transaction,
  type TransactionKind,
} from "../domain/types";
import { detectSeries } from "../domain/series";
import { MIN_CONTAINS, normalizePayee } from "../domain/suggest";
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
    paypalId: t.paypalId ?? "",
    bankPayee: t.bankPayee ?? "",
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

function normalizeRule(r: CategorizeRule): CategorizeRule {
  return { ...r, match: r.match ?? "", mode: r.mode || "contains", kind: r.kind || "both", categoryId: r.categoryId ?? "", never: !!r.never, tags: r.tags ?? [] };
}

function normalizeSeriesOverride(o: SeriesOverride): SeriesOverride {
  return { ...o, key: o.key ?? "", muted: !!o.muted, skipped: Array.isArray(o.skipped) ? o.skipped : [], tags: o.tags ?? [] };
}

// ---- Reads ----

export function useTransactions(): Transaction[] {
  const rows = useDocuments<Transaction>(TRANSACTION);
  return useMemo(() => rows.map(normalizeTransaction).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [rows]);
}

export async function allTransactions(): Promise<Transaction[]> {
  return (await documentsOf<Transaction>(TRANSACTION)).map(normalizeTransaction);
}

export async function allAccounts(): Promise<LedgerAccount[]> {
  return (await documentsOf<LedgerAccount>(ACCOUNT)).map(normalizeAccount);
}

export async function allCategories(): Promise<LedgerCategory[]> {
  return (await documentsOf<LedgerCategory>(CATEGORY)).map(normalizeCategory);
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

/** Every Categorize rule (ADR 0040), the vetoes first — the panel and every suggestion read the same list. */
export function useCategorizeRules(): CategorizeRule[] {
  const rows = useDocuments<CategorizeRule>(RULE);
  return useMemo(() => rows.map(normalizeRule).sort((a, b) => Number(b.never) - Number(a.never) || a.match.localeCompare(b.match)), [rows]);
}

export function useSeriesOverrides(): SeriesOverride[] {
  const rows = useDocuments<SeriesOverride>(SERIES);
  return useMemo(() => rows.map(normalizeSeriesOverride), [rows]);
}

/**
 * Every Recurring series the ledger shows (ADR 0034) — derived from the
 * Transactions on every read, with the hand-made overrides laid over. The
 * caller hands in its useTransactions() so the ledger is normalized and
 * sorted once per screen, not once per hook.
 */
export function useSeries(transactions: Transaction[]): Series[] {
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
  paypalId?: string;
  bankPayee?: string;
}

function validate(input: TransactionInput): void {
  assertWitnessed(input.date, todayStr());
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
    paypalId: input.paypalId ?? "",
    bankPayee: input.bankPayee ?? "",
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
  await putDocument<Transaction>({
    ...t,
    ...rowOf(input),
    importId: input.importId ?? t.importId,
    // A hand-edited payee keeps both: the bank original stays readable, and the PayPal id
    // it was resolved from keeps the sweep from overwriting the correction.
    paypalId: input.paypalId ?? t.paypalId,
    bankPayee: input.bankPayee ?? t.bankPayee,
  });
}

/**
 * Some of a Transaction's own Fields edited in place (its Peek, ADR 0085):
 * the rest kept as they are, the whole checked as the entry form's save is.
 * The kind and import identity are not among them — they are the Ledger's.
 */
export async function editTransaction(t: Transaction, patch: Partial<Pick<TransactionInput, "date" | "amount" | "accountId" | "fromAccountId" | "toAccountId" | "categoryId" | "payee" | "note">>): Promise<void> {
  const n = normalizeTransaction(t);
  await updateTransaction(n, { kind: n.kind, date: n.date, amount: n.amount, accountId: n.accountId, fromAccountId: n.fromAccountId, toAccountId: n.toAccountId, categoryId: n.categoryId, payee: n.payee, note: n.note, tags: n.tags, ...patch });
}

export async function deleteTransaction(id: string): Promise<void> {
  await removeDocument(id);
}

/** Set just the category — the auto-categorize sweep and quick fixes use this. */
export async function categorizeTransaction(id: string, categoryId: string): Promise<void> {
  await patchDocument(id, { categoryId });
}

/**
 * Replace a bank row's payee with the merchant PayPal knows (`domain/paypal.ts`).
 * The bank's own string is kept in `bankPayee` so nothing is lost, and the
 * PayPal transaction id is recorded so a second sweep leaves the row alone.
 */
export async function resolvePaypalPayee(t: Transaction, payee: string, paypalId: string): Promise<void> {
  await patchDocument(t.id, { payee, paypalId, bankPayee: t.bankPayee || t.payee });
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

/** One of an Account's Fields edited in place (its Peek): the rest kept. */
export async function editAccount(a: LedgerAccount, patch: Partial<Omit<AccountInput, "title">>): Promise<void> {
  const n = normalizeAccount(a);
  await updateAccount(n, { title: n.title, flavor: n.flavor, openingBalance: n.openingBalance, ...patch });
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

/** One of a Category's Fields edited in place (its Peek): the rest kept, its kind (guarded) never. */
export async function editCategory(c: LedgerCategory, patch: Partial<Pick<CategoryInput, "group" | "target" | "accumulating">>): Promise<void> {
  const n = normalizeCategory(c);
  await updateCategory(n, { title: n.title, kind: n.kind, group: n.group, target: n.target, accumulating: n.accumulating, ...patch });
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

// ---- Categorize rules ----

export interface RuleInput {
  /** The payee text, as typed — matching normalizes it. */
  match: string;
  mode: RuleMode;
  /** The Category handed out; ignored (and cleared) for a never rule. */
  categoryId: string;
  /** A veto: this payee is never auto-categorized. */
  never: boolean;
}

/**
 * A rule's kind is never typed in: a category rule speaks for its Category's
 * own kind, a never rule for both. One less thing to keep in step.
 */
async function ruleKindOf(input: RuleInput): Promise<CategorizeRule["kind"]> {
  if (input.never) return "both";
  const category = (await documentsOf<LedgerCategory>(CATEGORY)).find((c) => c.id === input.categoryId);
  if (!category) throw new Error("Pick a category — or make it a never rule");
  return normalizeCategory(category).kind;
}

/** Two rules with the same text, mode and reach would argue forever; the second is refused and the first is there to edit. */
async function assertUnique(input: RuleInput, kind: CategorizeRule["kind"], exceptId?: string): Promise<void> {
  const match = normalizePayee(input.match);
  const clash = (await documentsOf<CategorizeRule>(RULE))
    .map(normalizeRule)
    .find((r) => r.id !== exceptId && normalizePayee(r.match) === match && r.mode === input.mode && (r.kind === "both" || kind === "both" || r.kind === kind));
  if (clash) throw new Error(`"${clash.match}" already has a rule — edit that one`);
}

function ruleRowOf(input: RuleInput, kind: CategorizeRule["kind"]) {
  return { title: input.match.trim(), match: input.match.trim(), mode: input.mode, kind, categoryId: input.never ? "" : input.categoryId, never: input.never };
}

export async function addRule(input: RuleInput): Promise<string> {
  if (!normalizePayee(input.match)) throw new Error("A rule needs payee text to look for");
  const kind = await ruleKindOf(input);
  await assertUnique(input, kind);
  const row = await putDocument<CategorizeRule>({ type: RULE, ...ruleRowOf(input, kind), folder: "", tags: [] } as unknown as CategorizeRule);
  return row.id;
}

export async function updateRule(rule: CategorizeRule, input: RuleInput): Promise<void> {
  if (!normalizePayee(input.match)) throw new Error("A rule needs payee text to look for");
  const kind = await ruleKindOf(input);
  await assertUnique(input, kind, rule.id);
  await putDocument<CategorizeRule>({ ...rule, ...ruleRowOf(input, kind) });
}

export async function deleteRule(id: string): Promise<void> {
  await removeDocument(id);
}

/**
 * How wide a one-tap rule made from a payee should read: one long enough to
 * survive history's own substring guard keeps history's reach; a short one is
 * pinned to the whole payee, so a tap never widens what was happening before.
 */
function reachOf(payee: string): RuleMode {
  return normalizePayee(payee).length >= MIN_CONTAINS ? "contains" : "exact";
}

/** Pin what history already does into a rule the user owns — the action beside each derived line in the Rules panel. */
export async function pinRule(payee: string, categoryId: string): Promise<string> {
  return addRule({ match: payee, mode: reachOf(payee), categoryId, never: false });
}

/** The veto in one tap: this payee is never auto-categorized again, whatever history thinks. */
export async function neverRule(payee: string): Promise<string> {
  return addRule({ match: payee, mode: reachOf(payee), categoryId: "", never: true });
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

/** Decline a Due: its day is remembered as skipped and never surfaces again. There is no confirm — the ledger accepts only witnessed events, and the bank's import is what makes a Due go (ADR 0042). */
export async function dismissDue(due: Due): Promise<void> {
  if (due.series.skipped.includes(due.date)) return;
  await overrideSeries(due.series, { muted: due.series.muted, skipped: [...due.series.skipped, due.date] });
}

// ---- Import ----

/**
 * Post the ticked preview rows (ADR 0033): sign decides expense/income.
 * A row may carry the category confirmed in the preview (history-derived
 * suggestion or a hand pick); without one it lands uncategorized — the
 * inbox is loud, never hidden. A failure midway throws with the rows before
 * it posted; `onPosted` lets the caller say how many.
 */
export async function importRows(rows: (ImportRow & { categoryId?: string; paypalId?: string; bankPayee?: string })[], accountId: string, onPosted?: (n: number) => void): Promise<number> {
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
      paypalId: r.paypalId ?? "",
      bankPayee: r.bankPayee ?? "",
    });
    n++;
    onPosted?.(n);
  }
  return n;
}

export { todayStr };
