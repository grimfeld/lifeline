import { describe, expect, it } from "vitest";
import type { Allocation, LedgerAccount, LedgerCategory, Transaction } from "./types";
import { balanceOf, budgetRows, monthAdd, netWorth, payeeIndex, spentByCategory, targetFor, transferCounterparts, uncategorizedSpent } from "./derive";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    type: "ledger_transaction",
    title: "",
    tags: [],
    folder: "",
    createdAt: "2026-01-01",
    updatedAt: "",
    deleted: false,
    kind: "expense",
    date: "2026-03-10",
    amount: 0,
    accountId: "",
    fromAccountId: "",
    toAccountId: "",
    categoryId: "",
    payee: "",
    note: "",
    importId: "",
    ...partial,
  } as unknown as Transaction;
}

function account(id: string, openingBalance = 0, archived = false): LedgerAccount {
  return { id, type: "ledger_account", title: id, tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: false, flavor: "checking", openingBalance, archived, importMapping: null } as unknown as LedgerAccount;
}

function category(id: string, partial: Partial<LedgerCategory> = {}): LedgerCategory {
  return { id, type: "ledger_category", title: id, tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: false, kind: "expense", group: "", target: 0, accumulating: false, ...partial } as unknown as LedgerCategory;
}

describe("balanceOf", () => {
  it("sums opening + effects; transfers read from both sides", () => {
    const a = account("a", 10_000);
    const b = account("b", 0);
    const ts = [
      tx({ kind: "expense", accountId: "a", amount: 2_000 }),
      tx({ kind: "income", accountId: "a", amount: 5_000 }),
      tx({ kind: "transfer", fromAccountId: "a", toAccountId: "b", amount: 3_000 }),
      tx({ kind: "adjustment", accountId: "a", amount: -500 }),
    ];
    expect(balanceOf(a, ts)).toBe(10_000 - 2_000 + 5_000 - 3_000 - 500);
    expect(balanceOf(b, ts)).toBe(3_000);
  });

  it("cuts off at a day and leaves archived accounts out of net worth", () => {
    const a = account("a", 0);
    const z = account("z", 99_999, true);
    const ts = [tx({ kind: "income", accountId: "a", amount: 100, date: "2026-03-01" }), tx({ kind: "income", accountId: "a", amount: 100, date: "2026-04-01" })];
    expect(balanceOf(a, ts, "2026-03-31")).toBe(100);
    expect(netWorth([a, z], ts)).toBe(200);
  });
});

describe("budget", () => {
  it("spent groups by category, uncategorized collects the inbox", () => {
    const ts = [
      tx({ categoryId: "food", amount: 1_000 }),
      tx({ categoryId: "food", amount: 500 }),
      tx({ categoryId: "", amount: 700 }),
      tx({ kind: "transfer", amount: 9_999, fromAccountId: "a", toAccountId: "b" }),
      tx({ kind: "adjustment", accountId: "a", amount: -9_999 }),
    ];
    expect(spentByCategory(ts, "2026-03").get("food")).toBe(1_500);
    expect(uncategorizedSpent(ts, "2026-03")).toBe(700);
  });

  it("override beats the standing target for its month only", () => {
    const c = category("food", { target: 40_000 });
    const allocations = [{ id: "x", categoryId: "food", month: "2026-12", amount: 60_000 } as Allocation];
    expect(targetFor(c, allocations, "2026-03")).toBe(40_000);
    expect(targetFor(c, allocations, "2026-12")).toBe(60_000);
  });

  it("a plain category resets monthly; available = target − spent", () => {
    const c = category("food", { target: 40_000 });
    const rows = budgetRows([c], [], [tx({ categoryId: "food", amount: 15_000 })], "2026-03");
    expect(rows[0]).toMatchObject({ target: 40_000, spent: 15_000, available: 25_000, pot: null });
  });

  it("a category with no target is untracked — spending it is not overspending", () => {
    const c = category("coffee");
    const rows = budgetRows([c], [], [tx({ categoryId: "coffee", amount: 3_000 })], "2026-03");
    expect(rows[0]).toMatchObject({ target: 0, spent: 3_000, tracked: false, available: null, pot: null });
  });

  it("an accumulating pot rolls, honours overrides, and goes negative without clamping", () => {
    const c = category("vacation", { target: 10_000, accumulating: true, createdAt: "2026-01-15" });
    const allocations = [{ id: "x", categoryId: "vacation", month: "2026-02", amount: 20_000 } as Allocation];
    // Jan 10k + Feb 20k (override) + Mar 10k = 40k allocated; 50k spent in Mar → pot −10k.
    const rows = budgetRows([c], allocations, [tx({ categoryId: "vacation", amount: 50_000, date: "2026-03-05" })], "2026-03");
    expect(rows[0].pot).toBe(-10_000);
    expect(rows[0].available).toBe(-10_000);
  });

  it("each category's pot counts only its own spending, through the shown month", () => {
    const trip = category("vacation", { target: 10_000, accumulating: true, createdAt: "2026-01-15" });
    const car = category("car", { target: 5_000, accumulating: true, createdAt: "2026-02-01" });
    const food = category("food", { target: 40_000 });
    const ts = [
      tx({ categoryId: "vacation", amount: 4_000, date: "2026-01-20" }),
      tx({ categoryId: "car", amount: 1_000, date: "2026-03-02" }),
      tx({ categoryId: "car", amount: 9_000, date: "2026-04-02" }),
      tx({ categoryId: "food", amount: 15_000, date: "2026-03-05" }),
      tx({ categoryId: "food", amount: 2_000, date: "2026-02-05" }),
    ];
    const rows = budgetRows([trip, car, food], [], ts, "2026-03");
    expect(rows.map((r) => [r.category.id, r.spent, r.pot, r.available])).toEqual([
      ["vacation", 0, 26_000, 26_000],
      ["car", 1_000, 9_000, 9_000],
      ["food", 15_000, null, 25_000],
    ]);
  });
});

describe("payeeIndex", () => {
  it("keeps the most recent shape per payee, case-insensitively", () => {
    const ts = [
      tx({ payee: "Albert Heijn", categoryId: "food", accountId: "a", amount: 1_000, date: "2026-03-01" }),
      tx({ payee: "albert heijn", categoryId: "household", accountId: "b", amount: 2_000, date: "2026-03-09" }),
    ];
    const idx = payeeIndex(ts);
    expect(idx).toHaveLength(1);
    expect(idx[0]).toMatchObject({ categoryId: "household", accountId: "b", amount: 2_000 });
  });
});

describe("transferCounterparts", () => {
  it("finds the other side of a both-sides import", () => {
    const out = tx({ id: "1", kind: "expense", accountId: "checking", amount: 20_000, date: "2026-03-02" });
    const inn = tx({ id: "2", kind: "income", accountId: "savings", amount: 20_000, date: "2026-03-02" });
    const other = tx({ id: "3", kind: "income", accountId: "savings", amount: 21_000, date: "2026-03-02" });
    expect(transferCounterparts(out, [out, inn, other]).map((t) => t.id)).toEqual(["2"]);
  });
});

describe("monthAdd", () => {
  it("crosses year boundaries both ways", () => {
    expect(monthAdd("2026-12", 1)).toBe("2027-01");
    expect(monthAdd("2026-01", -1)).toBe("2025-12");
    expect(monthAdd("2026-03", 12)).toBe("2027-03");
  });
});
