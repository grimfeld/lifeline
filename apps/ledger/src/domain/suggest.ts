import type { Transaction } from "./types";

/**
 * Auto-categorization (ADR 0033 spirit): the ledger's own history is the
 * rulebook — the category you last gave a payee is what its next import
 * gets suggested. Derived on the spot, nothing stored, no rules to
 * maintain: recategorize once in the Register and every later import
 * follows. Suggestions only ever surface in the import preview, where the
 * user is the witness; nothing is guessed into the ledger silently.
 */

/** Bank strings are noisy ("ALBERT HEIJN 1543 AMS NLD"): lowercase, drop digits and punctuation, collapse spaces. */
export function normalizePayee(s: string): string {
  return s
    .toLowerCase()
    .replace(/[0-9]/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PayeeCategory {
  /** Normalized payee the entry is keyed by. */
  key: string;
  categoryId: string;
  kind: "expense" | "income";
  /** Day of the Transaction the mapping came from — newest wins. */
  at: string;
}

/** Last-used category per normalized payee, from every categorized expense/income. Self-correcting: recategorizing updates it. */
export function payeeCategoryIndex(transactions: Transaction[]): PayeeCategory[] {
  const best = new Map<string, PayeeCategory>();
  for (const t of transactions) {
    if (t.kind !== "expense" && t.kind !== "income") continue;
    if (!t.categoryId) continue;
    const key = normalizePayee(t.payee);
    if (!key) continue;
    const cur = best.get(key);
    if (cur && cur.at >= t.date) continue;
    best.set(key, { key, categoryId: t.categoryId, kind: t.kind, at: t.date });
  }
  return Array.from(best.values());
}

export interface Suggestion {
  categoryId: string;
  confidence: "exact" | "contains";
}

/** Substring matches shorter than this are junk ("de", "ah"). */
const MIN_CONTAINS = 4;

/**
 * Suggest a category for an incoming payee string: an exact normalized
 * match first; else the longest known payee contained in the bank string
 * (or containing it) — "albert heijn" inside "albert heijn ams nld".
 * Only entries of the right kind apply; null when history says nothing.
 */
export function suggestCategory(payee: string, kind: "expense" | "income", index: PayeeCategory[]): Suggestion | null {
  const key = normalizePayee(payee);
  if (!key) return null;
  const candidates = index.filter((e) => e.kind === kind);
  const exact = candidates.find((e) => e.key === key);
  if (exact) return { categoryId: exact.categoryId, confidence: "exact" };
  let bestLen = 0;
  let best: PayeeCategory | null = null;
  for (const e of candidates) {
    const len = Math.min(e.key.length, key.length);
    if (len < MIN_CONTAINS || len <= bestLen) continue;
    if (key.includes(e.key) || e.key.includes(key)) {
      best = e;
      bestLen = len;
    }
  }
  return best ? { categoryId: best.categoryId, confidence: "contains" } : null;
}
