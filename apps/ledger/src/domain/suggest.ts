import type { CategorizeRule, Transaction } from "./types";

/**
 * Auto-categorization (ADR 0033 spirit, ADR 0040): the ledger's own history
 * is the rulebook — the category you last gave a payee is what its next
 * import gets suggested. Derived on the spot, nothing stored, no rules to
 * maintain: recategorize once in the Register and every later import
 * follows. Over that reading sit the hand-made Categorize rules — the two
 * things history cannot know: "this payee always means that Category", and
 * "never guess for this payee at all" (Amazon: one name, twenty
 * categories). Suggestions only ever surface where the user is the witness
 * — the import preview and the sweep button; nothing is guessed into the
 * ledger silently.
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
  /** "rule" — a hand-made Categorize rule; the other two are history's own reading. */
  confidence: "rule" | "exact" | "contains";
}

/** Substring matches shorter than this are junk ("de", "ah"). Guards the derived reading only — a hand-written rule is the user's own word. */
export const MIN_CONTAINS = 4;

/** Veto first, then exactness, then how much of the payee the rule names. */
type Rank = [veto: number, exact: number, length: number];

function outranks(a: Rank, b: Rank): boolean {
  return a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];
}

/**
 * The hand-made rule that decides a payee, or null (ADR 0040). A never rule
 * outranks a category rule — the blacklist is a veto, not a vote; an exact
 * rule outranks a contains one; among equals the longest match wins, being
 * the most specific thing the user wrote about this payee. "contains" reads
 * one way only — the rule's text inside the bank's string, never the
 * reverse — so a rule stays as narrow as it was written.
 */
export function matchRule(payee: string, kind: "expense" | "income", rules: CategorizeRule[]): CategorizeRule | null {
  const key = normalizePayee(payee);
  if (!key) return null;
  let best: CategorizeRule | null = null;
  let bestRank: Rank = [-1, -1, -1];
  for (const r of rules) {
    if (r.kind !== "both" && r.kind !== kind) continue;
    const m = normalizePayee(r.match);
    if (!m) continue;
    if (r.mode === "exact" ? m !== key : !key.includes(m)) continue;
    const rank: Rank = [r.never ? 1 : 0, r.mode === "exact" ? 1 : 0, m.length];
    if (outranks(rank, bestRank)) {
      best = r;
      bestRank = rank;
    }
  }
  return best;
}

/**
 * Suggest a category for an incoming payee string. A hand-made rule speaks
 * first — a never rule silences the payee for good, a category rule answers
 * outright. Failing a rule, history: an exact normalized match, else the
 * longest known payee contained in the bank string (or containing it) —
 * "albert heijn" inside "albert heijn ams nld". Only entries of the right
 * kind apply; null when neither rules nor history say anything.
 */
export function suggestCategory(payee: string, kind: "expense" | "income", index: PayeeCategory[], rules: CategorizeRule[] = []): Suggestion | null {
  const key = normalizePayee(payee);
  if (!key) return null;
  const rule = matchRule(payee, kind, rules);
  if (rule) return rule.never ? null : { categoryId: rule.categoryId, confidence: "rule" };
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

/**
 * How many distinct payees in the ledger each rule actually decides —
 * precedence and all, so a rule shadowed by a narrower one reads as the 0 it
 * is. Keyed by rule id; what the Rules panel shows beside each rule.
 */
export function ruleCoverage(transactions: Transaction[], rules: CategorizeRule[]): Map<string, number> {
  const payees = new Map<string, Set<string>>();
  for (const t of transactions) {
    if (t.kind !== "expense" && t.kind !== "income") continue;
    const key = normalizePayee(t.payee);
    if (!key) continue;
    const seen = payees.get(t.kind) ?? new Set<string>();
    if (seen.has(key)) continue;
    seen.add(key);
    payees.set(t.kind, seen);
  }
  const out = new Map<string, number>(rules.map((r) => [r.id, 0]));
  for (const [kind, keys] of payees) {
    for (const key of keys) {
      const rule = matchRule(key, kind as "expense" | "income", rules);
      if (rule) out.set(rule.id, (out.get(rule.id) ?? 0) + 1);
    }
  }
  return out;
}

/** One Transaction a rule would recategorize: its current Category ("" = uncategorized) and the rule's. */
export interface RuleChange {
  transaction: Transaction;
  from: string;
  to: string;
}

/**
 * Apply to history (ADR 0107, which narrows ADR 0040): the Transactions this
 * rule decides — precedence applied over all rules — whose Category differs
 * from the rule's, newest first. Inbox rows count (from ""). History plays
 * no part: read against already-categorized rows it would be circular. A
 * never rule changes nothing. Pure; the caller writes only what the user
 * ticks, and keeps `from` to be able to put it back.
 */
export function ruleHistoryChanges(transactions: Transaction[], rules: CategorizeRule[], rule: CategorizeRule): RuleChange[] {
  if (rule.never) return [];
  const out: RuleChange[] = [];
  for (const t of transactions) {
    if (t.kind !== "expense" && t.kind !== "income") continue;
    if (t.categoryId === rule.categoryId) continue;
    if (matchRule(t.payee, t.kind, rules)?.id !== rule.id) continue;
    out.push({ transaction: t, from: t.categoryId, to: rule.categoryId });
  }
  return out.sort((a, b) => (a.transaction.date < b.transaction.date ? 1 : a.transaction.date > b.transaction.date ? -1 : 0));
}

/**
 * How many existing Transactions a rule just saved would recategorize: the
 * size of the Apply to history preview, with the saved rule standing in for
 * its stored version (or added, when new).
 */
export function ruleSaveMatchCount(transactions: Transaction[], rules: CategorizeRule[], saved: CategorizeRule): number {
  const all = [...rules.filter((r) => r.id !== saved.id), saved];
  return ruleHistoryChanges(transactions, all, saved).length;
}
