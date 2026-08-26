import { describe, expect, it } from "vitest";
import type { Transaction } from "./types";
import { normalizePayee, payeeCategoryIndex, suggestCategory } from "./suggest";

function tx(partial: Partial<Transaction>): Transaction {
  return { id: Math.random().toString(36).slice(2), kind: "expense", date: "2026-03-10", amount: 1000, categoryId: "", payee: "", accountId: "a", ...partial } as unknown as Transaction;
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
