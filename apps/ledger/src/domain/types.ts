import type { DateStr, Document, Weekday } from "@lifeline/core";

export const APP_ID = "ledger";
export const TRANSACTION = "ledger_transaction";
export const ACCOUNT = "ledger_account";
export const CATEGORY = "ledger_category";
export const RECURRING = "ledger_recurring";
export const ALLOCATION = "ledger_allocation";

export const REGISTER_HREF = "/app/ledger";
export const BUDGET_HREF = "/app/ledger/budget";
export const REPORTS_HREF = "/app/ledger/reports";

/** "YYYY-MM" — the Budget's unit of time. */
export type MonthStr = string;

export type TransactionKind = "expense" | "income" | "transfer" | "adjustment";

/**
 * A Transaction (ADR 0033): one movement of money on a day, a witnessed
 * fact. Amounts are integer cents, always positive; the kind says which way
 * money went. No splits — one Transaction, one Category.
 */
export interface Transaction extends Document {
  type: typeof TRANSACTION;
  kind: TransactionKind;
  date: DateStr;
  /** Integer cents. ≥ 0 for expense/income/transfer (the kind says the direction); signed for adjustment (the reconcile gap goes either way). */
  amount: number;
  /** expense / income / adjustment: the Account it happened on. */
  accountId: string;
  /** transfer only. */
  fromAccountId: string;
  /** transfer only. */
  toAccountId: string;
  /** expense / income. Empty = uncategorized (imports only — a loud inbox). */
  categoryId: string;
  /** Free text; autocomplete and prefill derive from ledger history, never stored elsewhere. */
  payee: string;
  note: string;
  /** Posted from this Recurring definition (confirmed Due). */
  recurringId: string;
  /** The due day the confirm covered, so the Due stops surfacing. */
  dueDate: DateStr | "";
  /** The bank's row identity, for import dedupe. */
  importId: string;
  /** The PayPal transaction this payee was resolved from — the sweep skips what it already did. */
  paypalId: string;
  /** What the bank called it before PayPal's merchant name replaced it. Nothing is lost. */
  bankPayee: string;
}

export type AccountFlavor = "checking" | "savings" | "cash" | "credit" | "other";
export const ACCOUNT_FLAVORS: AccountFlavor[] = ["checking", "savings", "cash", "credit", "other"];

/** Saved CSV import mapping (ADR 0033): remembered on the Account after the first import. */
export interface ImportMapping {
  /** 0-based column indexes. */
  dateCol: number;
  amountCol: number;
  payeeCol: number | null;
  noteCol: number | null;
  idCol: number | null;
  dateFormat: "YMD" | "DMY" | "MDY";
  decimal: "dot" | "comma";
  /** Flip the sign — for banks that write debits positive. */
  invert: boolean;
  /** Skip the first row (headers). */
  skipHeader: boolean;
}

/** An Account (ADR 0033): a named place money lives. Balance is always derived. */
export interface LedgerAccount extends Document {
  type: typeof ACCOUNT;
  flavor: AccountFlavor;
  /** Integer cents; may be negative (credit card). */
  openingBalance: number;
  /** Archived: history kept, out of pickers and default balance views. */
  archived: boolean;
  importMapping: ImportMapping | null;
}

export type CategoryKind = "expense" | "income";

/** A Category (ADR 0033): classification plus budget policy (standing Target, accumulating flag). */
export interface LedgerCategory extends Document {
  type: typeof CATEGORY;
  kind: CategoryKind;
  /** Display group — two levels for reading, no policy at group level. */
  group: string;
  /** Standing monthly Target, integer cents. 0 = no target. */
  target: number;
  /** Sinking fund: the pot rolls month to month, derived from full history, may go negative. */
  accumulating: boolean;
}

/** An Allocation override (internal): one month's Target for one Category — December ≠ March. */
export interface Allocation extends Document {
  type: typeof ALLOCATION;
  categoryId: string;
  month: MonthStr;
  /** Integer cents. */
  amount: number;
}

/**
 * How a Recurring transaction repeats. Weekday convention and month-length
 * clamping follow Tasks/Chores (0 = Sunday … 6 = Saturday; the 31st in
 * February → the 28th/29th).
 */
export type RecurRule =
  | { kind: "weekly"; weekdays: Weekday[] }
  | { kind: "monthly"; days: number[] } // 1–31
  | { kind: "yearly"; dates: { month: number; day: number }[] };

/**
 * A Recurring transaction (ADR 0033): a standing definition. Never posts
 * itself — a Due is confirmed in one tap into a real Transaction.
 */
export interface Recurring extends Document {
  type: typeof RECURRING;
  kind: Extract<TransactionKind, "expense" | "income">;
  /** Suggested amount, integer cents. */
  amount: number;
  accountId: string;
  categoryId: string;
  payee: string;
  rule: RecurRule;
  /** Dues start surfacing from this day (default: createdAt). */
  startDate: DateStr;
  /** Paused: no Dues surface, definition kept. */
  paused: boolean;
  /** Dismissed due days — the Due was declined, not forgotten. */
  skipped: DateStr[];
}

/** One pending occurrence of a Recurring transaction — derived, never stored. */
export interface Due {
  recurring: Recurring;
  date: DateStr;
}

export const KIND_LABEL: Record<TransactionKind, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  adjustment: "Adjustment",
};
