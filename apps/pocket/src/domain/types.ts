import type { DateStr, Document } from "@lifeline/core";

export const APP_ID = "pocket";
export const ALLOWANCE = "pocket_allowance";
export const SPEND = "pocket_spend";

export const POCKET_HREF = "/app/pocket";

/**
 * The period an Allowance is granted for (ADR 0037): a Monday-first calendar
 * week, a calendar month, a calendar year, or a custom span of days. Only a
 * custom span stores its end; the others derive it from `from`.
 */
export type PeriodKind = "week" | "month" | "year" | "custom";
export const PERIOD_KINDS: PeriodKind[] = ["week", "month", "year", "custom"];
export const PERIOD_LABEL: Record<PeriodKind, string> = { week: "Week", month: "Month", year: "Year", custom: "Custom span" };

/**
 * An Allowance (ADR 0037): a named sum the user grants themself for one
 * period. Bound to that period — renewing clones it into the next one; what
 * is left derives from its Spends and is never stored. Nothing rolls over.
 */
export interface Allowance extends Document {
  type: typeof ALLOWANCE;
  /** "Eating out" — the title derives as "<name> · <period label>". */
  name: string;
  period: PeriodKind;
  /** First day of the period. Week → its Monday, month → the 1st, year → Jan 1; custom → as typed. */
  from: DateStr;
  /** Last day, inclusive — stored for a custom span only, "" otherwise (derived). */
  to: DateStr;
  /** Granted amount, integer cents. */
  amount: number;
}

/**
 * A Spend (ADR 0037, internal): one hand-typed amount taken from an
 * Allowance on a day. A belief, not a fact — the Ledger's Transaction is the
 * fact. Its day is unconstrained by the Allowance's period.
 */
export interface Spend extends Document {
  type: typeof SPEND;
  allowanceId: string;
  /** Integer cents, always positive. */
  amount: number;
  date: DateStr;
  /** "lunch", "cinema" — optional. */
  label: string;
}

/** Where an Allowance stands against today — derived from its period, never stored. */
export type Bucket = "current" | "upcoming" | "past";
