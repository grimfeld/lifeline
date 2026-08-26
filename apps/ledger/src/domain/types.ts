import type { DateStr, Document } from "@lifeline/core";

export const APP_ID = "ledger";
export const TRANSACTION = "ledger_transaction";
export const ACCOUNT = "ledger_account";
export const CATEGORY = "ledger_category";
export const SERIES = "ledger_series";
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
  /** The bank's row identity, for import dedupe. */
  importId: string;
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

/** How often a Recurring series comes round — read off the ledger, never typed in. */
export type Cadence = "weekly" | "fortnightly" | "monthly" | "yearly";

/**
 * A Recurring series (ADR 0034): a bill the ledger already shows — one
 * payee whose Transactions keep a cadence and near enough one amount.
 * Derived on every read from the facts alone; nothing here is stored, and
 * there is nothing to type in.
 */
export interface Series {
  /** Identity: kind + normalized payee, so the bank's spellings collapse into one. */
  key: string;
  /** The newest occurrence's spelling — what a confirm posts. */
  payee: string;
  kind: Extract<TransactionKind, "expense" | "income">;
  cadence: Cadence;
  /** The cadence's nominal days — what the projection steps by. */
  period: number;
  /** The run's median amount, integer cents — the suggestion, never a promise. */
  amount: number;
  /** Widest deviation from `amount`, as a fraction of it. 0 = every occurrence identical. */
  spread: number;
  /** Where the next one would be posted: the newest occurrence's Account and Category. */
  accountId: string;
  categoryId: string;
  /** The Transactions the series is read from, newest first. */
  occurrences: Transaction[];
  firstDate: DateStr;
  lastDate: DateStr;
  /** Day of month the series lands on (monthly and yearly); with the month, for yearly. */
  anchorDay: number;
  anchorMonth: number;
  /** Nothing for two whole periods: the bill is over, so it surfaces no more Dues. */
  dormant: boolean;
  /** The Series override Document backing `muted`/`skipped`, or "" when the series says nothing but facts. */
  overrideId: string;
  /** Silenced by hand: listed, greyed, no Dues. The one thing that cannot derive. */
  muted: boolean;
  /** Due days dismissed by hand. */
  skipped: DateStr[];
}

/** One pending occurrence of a Recurring series — derived, never stored. */
export interface Due {
  series: Series;
  date: DateStr;
}

/**
 * A Series override (internal, ADR 0034): the user's own word over a
 * derived series — muted, and the due days waved off. Facts derive; only
 * intent is stored, and only while it says something.
 */
export interface SeriesOverride extends Document {
  type: typeof SERIES;
  /** The Series key it overlays. */
  key: string;
  /** Silenced: the series surfaces no Dues. */
  muted: boolean;
  /** Dismissed due days. */
  skipped: DateStr[];
}

export const KIND_LABEL: Record<TransactionKind, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  adjustment: "Adjustment",
};
