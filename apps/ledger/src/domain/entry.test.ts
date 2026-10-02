import { describe, expect, it } from "vitest";
import type { Transaction } from "./types";
import { assertWitnessed, completeEntry } from "./entry";

const tx = (partial: Partial<Transaction>): Transaction =>
  ({ id: "t", type: "ledger_transaction", title: "", tags: [], folder: "", createdAt: "", updatedAt: "", deleted: false, kind: "expense", date: "2026-03-10", amount: 0, accountId: "", fromAccountId: "", toAccountId: "", categoryId: "", payee: "", note: "", importId: "", ...partial }) as Transaction;

describe("assertWitnessed", () => {
  it("takes today and the past, refuses tomorrow", () => {
    expect(() => assertWitnessed("2026-10-02", "2026-10-02")).not.toThrow();
    expect(() => assertWitnessed("2026-09-30", "2026-10-02")).not.toThrow();
    expect(() => assertWitnessed("2026-10-03", "2026-10-02")).toThrow("records what happened");
  });
});

describe("completeEntry", () => {
  const history = [
    tx({ payee: "Lidl", accountId: "old", categoryId: "food", amount: 900, date: "2026-01-01" }),
    tx({ payee: "Lidl", accountId: "card", categoryId: "groceries", amount: 2500, date: "2026-03-01" }),
    tx({ payee: "Employer", kind: "income", accountId: "bank", categoryId: "salary", amount: 300000 }),
  ];

  it("lends a known payee's latest category and account, never its amount", () => {
    expect(completeEntry({ kind: "expense", date: "2026-03-05", amount: 1234, payee: "lidl" }, history)).toEqual({
      kind: "expense",
      date: "2026-03-05",
      amount: 1234,
      payee: "lidl",
      accountId: "card",
      categoryId: "groceries",
    });
  });

  it("keeps what was given over the payee's", () => {
    const e = completeEntry({ kind: "expense", date: "2026-03-05", amount: 100, payee: "Lidl", accountId: "cash", categoryId: "treats" }, history);
    expect([e.accountId, e.categoryId]).toEqual(["cash", "treats"]);
  });

  it("only lends from the same kind", () => {
    expect(() => completeEntry({ kind: "expense", date: "2026-03-05", amount: 100, payee: "Employer" }, history)).toThrow("Name the account");
  });

  it("refuses a missing account, a missing category and a non-positive amount", () => {
    expect(() => completeEntry({ kind: "expense", date: "2026-03-05", amount: 100, categoryId: "x" }, [])).toThrow("Name the account");
    expect(() => completeEntry({ kind: "expense", date: "2026-03-05", amount: 100, accountId: "a" }, [])).toThrow("Pick a category");
    expect(() => completeEntry({ kind: "expense", date: "2026-03-05", amount: 0, accountId: "a", categoryId: "x" }, [])).toThrow("above zero");
  });
});
