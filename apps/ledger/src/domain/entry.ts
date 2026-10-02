import type { DateStr } from "@lifeline/core";
import { payeeIndex } from "./derive";
import type { Transaction } from "./types";

/**
 * Nothing enters the ledger ahead of reality (ADR 0042): a Transaction is a
 * witnessed past event, so a day after today is refused, whoever writes it.
 */
export function assertWitnessed(date: DateStr, today: DateStr): void {
  if (date > today) throw new Error(`The ledger records what happened, and ${date} is after today. For an expected payment, use Pocket or a Task.`);
}

export interface EntryDraft {
  kind: "expense" | "income";
  date: DateStr;
  /** Magnitude, integer cents. */
  amount: number;
  accountId?: string;
  categoryId?: string;
  payee?: string;
}

/**
 * A headless entry, completed the way the form completes it: a known payee
 * lends its last Transaction's category and account where none was given —
 * never the amount, which the caller always states. With no account even
 * then, it is an error: no human sees a default being picked.
 */
export function completeEntry(draft: EntryDraft, transactions: readonly Transaction[]): EntryDraft & { accountId: string; categoryId: string } {
  if (!(draft.amount > 0)) throw new Error("Amount must be above zero");
  const payee = draft.payee?.trim().toLowerCase();
  const hit = payee ? payeeIndex([...transactions]).find((p) => p.payee.toLowerCase() === payee && p.kind === draft.kind) : undefined;
  const accountId = draft.accountId || hit?.accountId || "";
  const categoryId = draft.categoryId || hit?.categoryId || "";
  if (!accountId) throw new Error("Name the account it was paid from or into");
  if (!categoryId) throw new Error("Pick a category");
  return { ...draft, accountId, categoryId };
}
