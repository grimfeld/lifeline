import { describe, expect, it } from "vitest";
import type { CategorizeRule, Transaction } from "./types";
import { matchRule, normalizePayee, payeeCategoryIndex, ruleCoverage, ruleHistoryChanges, suggestCategory } from "./suggest";

function tx(partial: Partial<Transaction>): Transaction {
  return { id: Math.random().toString(36).slice(2), kind: "expense", date: "2026-03-10", amount: 1000, categoryId: "", payee: "", accountId: "a", ...partial } as unknown as Transaction;
}

function rule(partial: Partial<CategorizeRule>): CategorizeRule {
  return { id: Math.random().toString(36).slice(2), match: "", mode: "contains", kind: "both", categoryId: "", never: false, ...partial } as unknown as CategorizeRule;
}

describe("normalizePayee", () => {
  it("lowercases, strips digits and punctuation, collapses spaces", () => {
    expect(normalizePayee("ALBERT HEIJN 1543 AMS NLD")).toBe("albert heijn ams nld");
    expect(normalizePayee("Café-Restaurant 't Hoekje")).toBe("café restaurant t hoekje");
    expect(normalizePayee("123456")).toBe("");
  });
});

describe("payeeCategoryIndex", () => {
  it("keeps the last-used category per payee, ignores uncategorized and transfers", () => {
    const index = payeeCategoryIndex([
      tx({ payee: "Albert Heijn", categoryId: "food", date: "2026-01-05" }),
      tx({ payee: "ALBERT HEIJN 1543", categoryId: "", date: "2026-02-01" }),
      tx({ payee: "Albert Heijn", categoryId: "household", date: "2026-03-01" }),
      tx({ payee: "Bank", kind: "transfer", categoryId: "food" }),
    ]);
    expect(index).toHaveLength(1);
    expect(index[0]).toMatchObject({ key: "albert heijn", categoryId: "household" });
  });
});

describe("suggestCategory", () => {
  const index = payeeCategoryIndex([
    tx({ payee: "Albert Heijn", categoryId: "food" }),
    tx({ payee: "Shell", categoryId: "transport" }),
    tx({ payee: "Employer BV", kind: "income", categoryId: "salary", amount: 100 }),
  ]);

  it("matches exactly, case- and noise-insensitively", () => {
    expect(suggestCategory("ALBERT HEIJN", "expense", index)).toEqual({ categoryId: "food", confidence: "exact" });
  });

  it("matches a known payee inside a noisy bank string", () => {
    expect(suggestCategory("ALBERT HEIJN 1543 AMS NLD", "expense", index)).toEqual({ categoryId: "food", confidence: "contains" });
  });

  it("respects kind and refuses junk-short matches", () => {
    expect(suggestCategory("Employer BV", "expense", index)).toBeNull();
    expect(suggestCategory("Employer BV Payroll", "income", index)).toEqual({ categoryId: "salary", confidence: "contains" });
    // "Shell" is 5 chars — matches; a 3-char fragment must not.
    expect(suggestCategory("SHELL STATION 22", "expense", index)).toEqual({ categoryId: "transport", confidence: "contains" });
    expect(suggestCategory("SH", "expense", index)).toBeNull();
  });

  it("says nothing when history says nothing", () => {
    expect(suggestCategory("Never Seen Before", "expense", index)).toBeNull();
  });
});

describe("matchRule", () => {
  const rules = [
    rule({ id: "r-ah", match: "Albert Heijn", categoryId: "food", kind: "expense" }),
    rule({ id: "r-ah-xl", match: "albert heijn to go", categoryId: "lunch", kind: "expense" }),
    rule({ id: "r-amz", match: "amazon", never: true }),
    rule({ id: "r-pay", match: "Employer BV", mode: "exact", categoryId: "salary", kind: "income" }),
  ];

  it("reads its text inside the bank's noise, one way only", () => {
    expect(matchRule("ALBERT HEIJN 1543 AMS NLD", "expense", rules)?.id).toBe("r-ah");
    // The rule is longer than the payee: a rule never widens itself to match less than it says.
    expect(matchRule("albert", "expense", rules)).toBeNull();
  });

  it("prefers the longest match, and exactness over containment", () => {
    expect(matchRule("ALBERT HEIJN TO GO 88", "expense", rules)?.id).toBe("r-ah-xl");
    expect(matchRule("Employer BV", "income", rules)?.id).toBe("r-pay");
    expect(matchRule("Employer BV Payroll", "income", rules)).toBeNull();
  });

  it("respects kind — a category rule speaks only for its category's side", () => {
    expect(matchRule("Employer BV", "expense", rules)).toBeNull();
    // A never rule is kind-less: it silences the payee both ways.
    expect(matchRule("AMAZON EU SARL", "income", rules)?.id).toBe("r-amz");
  });

  it("lets a never rule outrank a longer category rule — the blacklist is a veto", () => {
    const withBoth = [...rules, rule({ id: "r-amz-books", match: "amazon eu sarl", categoryId: "books", kind: "expense" })];
    expect(matchRule("AMAZON EU SARL 12345", "expense", withBoth)?.id).toBe("r-amz");
  });
});

describe("suggestCategory with rules", () => {
  const index = payeeCategoryIndex([
    tx({ payee: "Amazon", categoryId: "books" }),
    tx({ payee: "Albert Heijn", categoryId: "food" }),
  ]);

  it("answers from a rule before history, and marks it as one", () => {
    const rules = [rule({ match: "albert heijn", categoryId: "household", kind: "expense" })];
    expect(suggestCategory("ALBERT HEIJN 1543", "expense", index, rules)).toEqual({ categoryId: "household", confidence: "rule" });
  });

  it("says nothing at all for a never-ruled payee, whatever history remembers", () => {
    const rules = [rule({ match: "amazon", never: true })];
    expect(suggestCategory("AMAZON EU SARL", "expense", index, rules)).toBeNull();
    // Without the rule the same payee is answered — the veto is what changed.
    expect(suggestCategory("AMAZON EU SARL", "expense", index)).toEqual({ categoryId: "books", confidence: "contains" });
  });

  it("falls through to history where no rule speaks", () => {
    const rules = [rule({ match: "amazon", never: true })];
    expect(suggestCategory("Albert Heijn", "expense", index, rules)).toEqual({ categoryId: "food", confidence: "exact" });
  });
});

describe("ruleCoverage", () => {
  it("counts the distinct payees each rule actually decides, shadowing and all", () => {
    const transactions = [
      tx({ payee: "AMAZON EU SARL 1", categoryId: "books" }),
      tx({ payee: "Amazon Prime", categoryId: "books" }),
      tx({ payee: "Albert Heijn 1543", categoryId: "food" }),
      tx({ payee: "Shell", categoryId: "transport" }),
    ];
    const rules = [
      rule({ id: "r-amz", match: "amazon", never: true }),
      rule({ id: "r-prime", match: "amazon prime", categoryId: "fun", kind: "expense" }),
      rule({ id: "r-ah", match: "albert heijn", categoryId: "food", kind: "expense" }),
      rule({ id: "r-none", match: "hema", categoryId: "household", kind: "expense" }),
    ];
    const coverage = ruleCoverage(transactions, rules);
    // The never rule takes both Amazon payees; the narrower category rule is shadowed by it.
    expect(coverage.get("r-amz")).toBe(2);
    expect(coverage.get("r-prime")).toBe(0);
    expect(coverage.get("r-ah")).toBe(1);
    expect(coverage.get("r-none")).toBe(0);
  });
});

describe("ruleHistoryChanges", () => {
  const uber = rule({ id: "r-uber", match: "uber", categoryId: "uber", kind: "expense" });
  const ids = (ts: Transaction[], rules: CategorizeRule[], r: CategorizeRule) => ruleHistoryChanges(ts, rules, r).map((c) => c.transaction.id);

  it("includes a row filed under another Category, with old and new", () => {
    const t = tx({ id: "t1", payee: "Uber Trip 1234", categoryId: "taxi" });
    expect(ruleHistoryChanges([t], [uber], uber)).toEqual([{ transaction: t, from: "taxi", to: "uber" }]);
  });
  it("includes an uncategorized row with no old Category", () => {
    const t = tx({ id: "t1", payee: "UBER *TRIP", categoryId: "" });
    expect(ruleHistoryChanges([t], [uber], uber)[0]).toMatchObject({ from: "", to: "uber" });
  });
  it("excludes a row already in the rule's Category", () => {
    expect(ids([tx({ id: "t1", payee: "Uber", categoryId: "uber" })], [uber], uber)).toEqual([]);
  });
  it("excludes rows another rule decides: exact, longer contains, never", () => {
    const rows = [tx({ id: "a", payee: "Uber Eats", categoryId: "taxi" })];
    for (const other of [
      rule({ match: "uber eats", mode: "exact", categoryId: "food", kind: "expense" }),
      rule({ match: "uber eat", categoryId: "food", kind: "expense" }),
      rule({ match: "uber", never: true }),
    ]) {
      expect(ids(rows, [uber, other], uber)).toEqual([]);
    }
  });
  it("excludes the other kind, transfers and adjustments", () => {
    const rows = [
      tx({ id: "inc", kind: "income", payee: "Uber refund", categoryId: "salary" }),
      tx({ id: "trf", kind: "transfer", payee: "Uber", categoryId: "" }),
      tx({ id: "adj", kind: "adjustment", payee: "Uber", categoryId: "" }),
    ];
    expect(ids(rows, [uber], uber)).toEqual([]);
  });
  it("matches the normalized payee and lists newest first", () => {
    const rows = [
      tx({ id: "old", payee: "uber 99", date: "2026-01-01", categoryId: "taxi" }),
      tx({ id: "new", payee: "UBER   BV", date: "2026-03-01", categoryId: "taxi" }),
    ];
    expect(ids(rows, [uber], uber)).toEqual(["new", "old"]);
  });
  it("yields nothing for a never rule", () => {
    const never = rule({ match: "uber", never: true });
    expect(ids([tx({ id: "t", payee: "Uber", categoryId: "taxi" })], [never], never)).toEqual([]);
  });
});
