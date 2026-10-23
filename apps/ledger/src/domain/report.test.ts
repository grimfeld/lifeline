import { describe, expect, it } from "vitest";
import type { Allocation, LedgerAccount, LedgerCategory, Transaction } from "./types";
import {
  activeFilterCount,
  balanceTrend,
  budgetTrend,
  categoryReport,
  emptyFilter,
  filterTransactions,
  groupReport,
  ledgerMonths,
  monthRange,
  monthlyTotals,
  payeeReport,
  potTrend,
  resolveRange,
  sortByMonth,
  stackedByMonth,
  summarize,
  topSlices,
  CATEGORY_SORTS,
} from "./report";

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
    paypalId: "",
    bankPayee: "",
    ...partial,
  } as unknown as Transaction;
}

function category(id: string, partial: Partial<LedgerCategory> = {}): LedgerCategory {
  return { id, type: "ledger_category", title: id, tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: false, kind: "expense", group: "", target: 0, accumulating: false, ...partial } as unknown as LedgerCategory;
}

function account(id: string, openingBalance = 0, archived = false): LedgerAccount {
  return { id, type: "ledger_account", title: id, tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: false, flavor: "checking", openingBalance, archived, importMapping: null } as unknown as LedgerAccount;
}

function allocation(categoryId: string, month: string, amount: number): Allocation {
  return { id: `${categoryId}-${month}`, type: "ledger_allocation", title: "", tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: false, categoryId, month, amount } as unknown as Allocation;
}

describe("monthRange / resolveRange", () => {
  it("walks the window inclusively and comes back empty when inverted", () => {
    expect(monthRange("2026-01", "2026-04")).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(monthRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthRange("2026-04", "2026-01")).toEqual([]);
  });

  it("resolves presets against today, and All time against the ledger's own span", () => {
    const months = ["2024-05", "2025-01", "2026-02"];
    expect(resolveRange("3m", "2026-03-10", months)).toEqual({ from: "2026-01", to: "2026-03" });
    expect(resolveRange("12m", "2026-03-10", months)).toEqual({ from: "2025-04", to: "2026-03" });
    expect(resolveRange("ytd", "2026-03-10", months)).toEqual({ from: "2026-01", to: "2026-03" });
    expect(resolveRange("last-year", "2026-03-10", months)).toEqual({ from: "2025-01", to: "2025-12" });
    expect(resolveRange("all", "2026-03-10", months)).toEqual({ from: "2024-05", to: "2026-03" });
    expect(resolveRange("all", "2026-03-10", [])).toEqual({ from: "2026-03", to: "2026-03" });
  });

  it("reads the ledger's months oldest first", () => {
    expect(ledgerMonths([tx({ date: "2026-03-01" }), tx({ date: "2025-12-31" }), tx({ date: "2026-03-30" })])).toEqual(["2025-12", "2026-03"]);
  });
});

describe("filterTransactions", () => {
  const categories = [category("food", { group: "Living" }), category("rent", { group: "Living" }), category("fun", { group: "Play" })];
  const rows = [
    tx({ id: "a", date: "2026-01-05", amount: 1_000, categoryId: "food", accountId: "acc1", payee: "Aldi" }),
    tx({ id: "b", date: "2026-02-05", amount: 90_000, categoryId: "rent", accountId: "acc1", payee: "Landlord" }),
    tx({ id: "c", date: "2026-02-06", amount: 2_500, categoryId: "fun", accountId: "acc2", payee: "Cinema" }),
    tx({ id: "d", date: "2026-02-07", amount: 3_000, categoryId: "", accountId: "acc2", payee: "Unknown" }),
    tx({ id: "e", date: "2026-05-01", amount: 5_000, categoryId: "food", accountId: "acc1" }),
    tx({ id: "f", date: "2026-02-08", kind: "transfer", amount: 10_000, fromAccountId: "acc1", toAccountId: "acc2" }),
  ];
  const base = emptyFilter("2026-01", "2026-02");

  function ids(filter = base) {
    return filterTransactions(rows, filter, categories).map((t) => t.id);
  }

  it("keeps the month window only", () => {
    expect(ids()).toEqual(["a", "b", "c", "d", "f"]);
  });

  it("reads a transfer from both of its accounts", () => {
    expect(ids({ ...base, accountIds: ["acc2"] })).toEqual(["c", "d", "f"]);
    expect(ids({ ...base, accountIds: ["acc1"] })).toEqual(["a", "b", "f"]);
  });

  it("filters by category and by group, leaving uncategorizable kinds alone", () => {
    expect(ids({ ...base, categoryIds: ["food", "fun"] })).toEqual(["a", "c", "f"]);
    expect(ids({ ...base, groups: ["Play"] })).toEqual(["c", "f"]);
    // "" is the ungrouped group — and the uncategorized row lives there.
    expect(ids({ ...base, groups: [""] })).toEqual(["d", "f"]);
  });

  it("drops the inbox only when asked, and honours the noise floor and the search", () => {
    expect(ids({ ...base, includeUncategorized: false })).toEqual(["a", "b", "c", "f"]);
    expect(ids({ ...base, minAmount: 3_000 })).toEqual(["b", "d", "f"]);
    expect(ids({ ...base, search: "cine" })).toEqual(["c"]);
  });

  it("counts the filters that are actually narrowing", () => {
    expect(activeFilterCount(base)).toBe(0);
    expect(activeFilterCount({ ...base, accountIds: ["acc1"], search: " ", minAmount: 500 })).toBe(2);
    expect(activeFilterCount({ ...base, includeUncategorized: false })).toBe(1);
  });
});

describe("monthlyTotals / summarize", () => {
  const months = ["2026-01", "2026-02", "2026-03"];
  const rows = [
    tx({ date: "2026-01-10", kind: "income", amount: 200_000 }),
    tx({ date: "2026-01-11", amount: 50_000 }),
    tx({ date: "2026-02-10", kind: "income", amount: 200_000 }),
    tx({ date: "2026-02-11", amount: 250_000 }),
    tx({ date: "2026-03-10", amount: 20_000 }),
    tx({ date: "2026-04-10", amount: 99_000 }),
    tx({ date: "2026-02-12", kind: "transfer", amount: 500_000, fromAccountId: "a", toAccountId: "b" }),
    tx({ date: "2026-02-13", kind: "adjustment", amount: -1_000, accountId: "a" }),
  ];

  it("counts expenses and income only, month by month, and runs a cumulative net", () => {
    const totals = monthlyTotals(rows, months);
    expect(totals.map((t) => [t.month, t.income, t.spent, t.net])).toEqual([
      ["2026-01", 200_000, 50_000, 150_000],
      ["2026-02", 200_000, 250_000, -50_000],
      ["2026-03", 0, 20_000, -20_000],
    ]);
    expect(totals.map((t) => t.cumulative)).toEqual([150_000, 100_000, 80_000]);
  });

  it("summarises the window with averages over its months and the best/worst by net", () => {
    const s = summarize(monthlyTotals(rows, months), 6);
    expect(s.income).toBe(400_000);
    expect(s.spent).toBe(320_000);
    expect(s.net).toBe(80_000);
    expect(s.averageSpent).toBe(Math.round(320_000 / 3));
    expect(s.savingsRate).toBeCloseTo(0.2);
    expect(s.best?.month).toBe("2026-01");
    expect(s.worst?.month).toBe("2026-02");
    expect(s.transactions).toBe(6);
  });

  it("reports a zero savings rate when nothing came in", () => {
    expect(summarize(monthlyTotals([tx({ date: "2026-01-05", amount: 1_000 })], months), 1).savingsRate).toBe(0);
  });
});

describe("categoryReport", () => {
  const months = ["2026-01", "2026-02"];
  const categories = [category("food", { title: "Food", group: "Living", target: 40_000 }), category("rent", { title: "Rent", group: "Living", target: 90_000 }), category("pay", { title: "Salary", kind: "income" })];
  const rows = [
    tx({ date: "2026-01-05", amount: 30_000, categoryId: "food" }),
    tx({ date: "2026-02-05", amount: 50_000, categoryId: "food" }),
    tx({ date: "2026-02-06", amount: 10_000, categoryId: "" }),
    tx({ date: "2026-01-06", kind: "income", amount: 200_000, categoryId: "pay" }),
  ];

  it("rolls spending per category per month with share, average, change and Targets", () => {
    const report = categoryReport(rows, categories, [], months, "expense");
    const food = report.find((r) => r.categoryId === "food")!;
    expect(food.perMonth).toEqual([30_000, 50_000]);
    expect(food.total).toBe(80_000);
    expect(food.average).toBe(40_000);
    expect(food.share).toBeCloseTo(80_000 / 90_000);
    expect(food.activeMonths).toBe(2);
    // Latest active month against the run rate: €500 spent where €400 is the average.
    expect(food.change).toBe(10_000);
    expect(food.target).toBe(80_000);
    expect(food.budgetDelta).toBe(0);
    expect(food.budgetRatio).toBe(1);
  });

  it("keeps the uncategorized inbox as a row of its own and never gives it a target", () => {
    const inbox = categoryReport(rows, categories, [], months, "expense").find((r) => r.categoryId === "")!;
    expect(inbox.title).toBe("Uncategorized");
    expect(inbox.total).toBe(10_000);
    expect(inbox.target).toBe(0);
    expect(inbox.budgetRatio).toBeNull();
  });

  it("lists a Category with a Target and nothing spent, so an untouched budget still reports", () => {
    const rent = categoryReport(rows, categories, [], months, "expense").find((r) => r.categoryId === "rent")!;
    expect(rent.total).toBe(0);
    expect(rent.target).toBe(180_000);
    expect(rent.budgetDelta).toBe(180_000);
  });

  it("reads income the same way, and lets a month's Allocation override the standing Target", () => {
    const income = categoryReport(rows, categories, [], months, "income");
    expect(income.map((r) => [r.categoryId, r.total])).toEqual([["pay", 200_000]]);
    const withOverride = categoryReport(rows, categories, [allocation("food", "2026-02", 60_000)], months, "expense");
    expect(withOverride.find((r) => r.categoryId === "food")!.target).toBe(40_000 + 60_000);
  });
});

describe("groupReport / topSlices / stackedByMonth / sorts", () => {
  const months = ["2026-01", "2026-02"];
  const categories = [category("food", { title: "Food", group: "Living" }), category("rent", { title: "Rent", group: "Living" }), category("fun", { title: "Fun", group: "Play" })];
  const rows = [
    tx({ date: "2026-01-05", amount: 30_000, categoryId: "food" }),
    tx({ date: "2026-02-05", amount: 90_000, categoryId: "rent" }),
    tx({ date: "2026-02-06", amount: 10_000, categoryId: "fun" }),
  ];
  const report = categoryReport(rows, categories, [], months, "expense");

  it("rolls categories up into their display groups", () => {
    const groups = groupReport(report, months);
    expect(groups.map((g) => [g.title, g.total, g.categories])).toEqual([
      ["Living", 120_000, 2],
      ["Play", 10_000, 1],
    ]);
    expect(groups[0]!.perMonth).toEqual([30_000, 90_000]);
    expect(groups[0]!.share).toBeCloseTo(120_000 / 130_000);
  });

  it("collects the pie's tail into one Other slice instead of a hundred hairlines", () => {
    const slices = topSlices(report, 1);
    expect(slices.map((s) => s.title)).toEqual(["Rent", "Other (2)"]);
    expect(slices[1]!.value).toBe(40_000);
    expect(slices[0]!.share + slices[1]!.share).toBeCloseTo(1);
    expect(topSlices([{ title: "nothing", total: 0 }], 5)).toEqual([]);
  });

  it("stacks the top categories per month and bands the rest as Other, in units", () => {
    const { keys, data } = stackedByMonth(report, months, 1);
    expect(keys.map((k) => k.title)).toEqual(["Rent", "Other (2)"]);
    expect(data[0]).toMatchObject({ label: "26-01", rent: 0, __other: 300 });
    expect(data[1]).toMatchObject({ label: "26-02", rent: 900, __other: 100 });
  });

  it("sorts by every offered key, and by one month's column", () => {
    expect([...report].sort(CATEGORY_SORTS["total-desc"]).map((r) => r.categoryId)).toEqual(["rent", "food", "fun"]);
    expect([...report].sort(CATEGORY_SORTS["total-asc"]).map((r) => r.categoryId)).toEqual(["fun", "food", "rent"]);
    expect([...report].sort(CATEGORY_SORTS.name).map((r) => r.title)).toEqual(["Food", "Fun", "Rent"]);
    expect(sortByMonth(report, 0, "desc").map((r) => r.categoryId)).toEqual(["food", "fun", "rent"]);
    expect(sortByMonth(report, 1, "desc")[0]!.categoryId).toBe("rent");
  });

  it("sorts rows without a Target last, whichever way budget sorting goes", () => {
    const withTargets = categoryReport(rows, [category("food", { title: "Food", target: 10_000 }), category("rent", { title: "Rent", target: 100_000 }), category("fun", { title: "Fun" })], [], months, "expense");
    expect([...withTargets].sort(CATEGORY_SORTS["over-budget"]).map((r) => r.categoryId)).toEqual(["food", "rent", "fun"]);
    expect([...withTargets].sort(CATEGORY_SORTS["under-budget"]).map((r) => r.categoryId)).toEqual(["rent", "food", "fun"]);
  });
});

describe("payeeReport", () => {
  const rows = [
    tx({ date: "2026-01-05", amount: 1_000, payee: "Aldi", categoryId: "food" }),
    tx({ date: "2026-02-05", amount: 3_000, payee: "aldi ", categoryId: "groceries" }),
    tx({ date: "2026-02-06", amount: 9_000, payee: "Landlord" }),
    tx({ date: "2026-02-07", amount: 100, payee: "" }),
    tx({ date: "2026-02-08", kind: "income", amount: 200_000, payee: "Work" }),
  ];

  it("groups payees case-insensitively, keeping the newest spelling and category", () => {
    const report = payeeReport(rows, "expense");
    expect(report.map((r) => [r.payee, r.total, r.count])).toEqual([
      ["Landlord", 9_000, 1],
      ["aldi", 4_000, 2],
    ]);
    expect(report[1]!.categoryId).toBe("groceries");
    expect(report[1]!.average).toBe(2_000);
    expect(report[1]!.last).toBe("2026-02-05");
  });

  it("offers its sorts and reads income too", () => {
    expect(payeeReport(rows, "expense", "count-desc")[0]!.payee).toBe("aldi");
    expect(payeeReport(rows, "expense", "name").map((r) => r.payee)).toEqual(["aldi", "Landlord"]);
    expect(payeeReport(rows, "income").map((r) => r.payee)).toEqual(["Work"]);
  });
});

describe("budgetTrend / potTrend", () => {
  const months = ["2026-01", "2026-02"];
  const categories = [category("food", { title: "Food", target: 40_000 }), category("gifts", { title: "Gifts", target: 10_000, accumulating: true, createdAt: "2025-11-01" })];
  const rows = [tx({ date: "2026-01-05", amount: 30_000, categoryId: "food" }), tx({ date: "2026-02-05", amount: 50_000, categoryId: "food" }), tx({ date: "2025-12-20", amount: 5_000, categoryId: "gifts" })];

  it("puts each month's Targets against its spending, for the shown categories only", () => {
    const report = categoryReport(rows, categories, [], months, "expense");
    const trend = budgetTrend(report, categories, [], months);
    expect(trend.map((p) => [p.month, p.target, p.spent, p.left])).toEqual([
      ["2026-01", 50_000, 30_000, 20_000],
      ["2026-02", 50_000, 50_000, 0],
    ]);
  });

  it("walks a pot from the Category's own first month, so the window opens on a real balance", () => {
    const { pots, data } = potTrend(categories, [], rows, months);
    expect(pots.map((c) => c.id)).toEqual(["gifts"]);
    // Nov + Dec + Jan allocations (€300) minus €50 spent in December, in units.
    expect(data[0]!.gifts).toBe(250);
    expect(data[1]!.gifts).toBe(350);
  });

  it("comes back empty when nothing accumulates", () => {
    expect(potTrend([category("food", { target: 10_000 })], [], rows, months)).toEqual({ pots: [], data: [] });
  });
});

describe("balanceTrend", () => {
  const months = ["2026-02", "2026-03"];
  const accounts = [account("a", 100_000), account("b", 50_000), account("z", 999_000, true)];
  const rows = [
    tx({ date: "2026-01-10", kind: "expense", amount: 10_000, accountId: "a" }),
    tx({ date: "2026-02-10", kind: "income", amount: 20_000, accountId: "a" }),
    tx({ date: "2026-03-10", kind: "transfer", amount: 5_000, fromAccountId: "a", toAccountId: "b" }),
    tx({ date: "2026-03-11", kind: "expense", amount: 1_000, accountId: "b" }),
    tx({ date: "2026-04-10", kind: "expense", amount: 70_000, accountId: "a" }),
  ];

  it("carries everything before the window into the first point and leaves archived accounts out", () => {
    expect(balanceTrend(accounts, rows, months, [])).toEqual([
      { month: "2026-02", label: "26-02", balance: 160_000 },
      { month: "2026-03", label: "26-03", balance: 159_000 },
    ]);
  });

  it("follows the account filter, transfers reading from both sides", () => {
    expect(balanceTrend(accounts, rows, months, ["b"]).map((p) => p.balance)).toEqual([50_000, 54_000]);
    expect(balanceTrend(accounts, rows, months, ["z"]).map((p) => p.balance)).toEqual([999_000, 999_000]);
    expect(balanceTrend(accounts, rows, [], [])).toEqual([]);
  });
});
