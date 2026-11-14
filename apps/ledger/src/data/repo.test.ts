import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsOf, documentsTable, initApps, putDocument, removeDocument } from "@lifeline/core";
import { ledgerApp } from "../index";
import { ACCOUNT, ALLOCATION, CATEGORY, TRANSACTION, type Allocation, type LedgerAccount, type LedgerCategory, type Transaction } from "../domain/types";
import { addAccount, addCategory, addTransaction, allTransactions, deleteAccount, deleteCategory, editTransaction, mergeCategory, setAllocation, updateTransaction } from "./repo";

initApps([ledgerApp]);

beforeEach(async () => {
  await documentsTable().clear();
});

const txn = (row: Partial<Transaction>) =>
  putDocument<Transaction>({ type: TRANSACTION, title: "", kind: "expense", date: "2026-03-01", amount: 100, folder: "", tags: [], ...row } as unknown as Transaction);

describe("removing an Account (the type's onDelete guard)", () => {
  it.each(["accountId", "fromAccountId", "toAccountId"])("is refused while a Transaction references it by %s, and nothing is tombstoned", async (field) => {
    const id = await addAccount({ title: "Current", flavor: "checking", openingBalance: 0 });
    await txn({ [field]: id });
    await expect(removeDocument(id)).rejects.toThrow("Account has transactions — archive it instead");
    expect((await documentsOf<LedgerAccount>(ACCOUNT)).map((a) => a.id)).toEqual([id]);
  });

  it("still removes an unused Account", async () => {
    const id = await addAccount({ title: "Current", flavor: "checking", openingBalance: 0 });
    const other = await addAccount({ title: "Savings", flavor: "savings", openingBalance: 0 });
    await txn({ accountId: other });
    await removeDocument(id);
    expect((await documentsOf<LedgerAccount>(ACCOUNT)).map((a) => a.id)).toEqual([other]);
  });

  it("is what deleteAccount runs", async () => {
    const id = await addAccount({ title: "Current", flavor: "checking", openingBalance: 0 });
    await txn({ accountId: id });
    await expect(deleteAccount(id)).rejects.toThrow("archive it instead");
  });
});

describe("removing a Category (the type's onDelete guard)", () => {
  it("is refused while a Transaction references it, and its Allocations stay", async () => {
    const id = await addCategory({ title: "Food", kind: "expense" });
    await setAllocation(id, "2026-03", 5000, []);
    await txn({ categoryId: id });
    await expect(removeDocument(id)).rejects.toThrow("Category has transactions — merge it instead");
    expect((await documentsOf<LedgerCategory>(CATEGORY)).map((c) => c.id)).toEqual([id]);
    expect(await documentsOf<Allocation>(ALLOCATION)).toHaveLength(1);
  });

  it("removes an unused Category with its Allocation overrides, and only its own", async () => {
    const id = await addCategory({ title: "Food", kind: "expense" });
    const other = await addCategory({ title: "Fun", kind: "expense" });
    await setAllocation(id, "2026-03", 5000, []);
    await setAllocation(other, "2026-03", 700, []);
    await removeDocument(id);
    expect((await documentsOf<LedgerCategory>(CATEGORY)).map((c) => c.id)).toEqual([other]);
    expect((await documentsOf<Allocation>(ALLOCATION)).map((a) => a.categoryId)).toEqual([other]);
  });

  it("is what deleteCategory runs", async () => {
    const id = await addCategory({ title: "Food", kind: "expense" });
    await txn({ categoryId: id });
    await expect(deleteCategory(id)).rejects.toThrow("merge it instead");
  });

  it("lets a merge through: the Transactions move first, then the Category and its overrides go", async () => {
    const from = await addCategory({ title: "Food", kind: "expense" });
    const into = await addCategory({ title: "Groceries", kind: "expense" });
    await setAllocation(from, "2026-03", 5000, []);
    await txn({ categoryId: from });
    await mergeCategory(from, into);
    expect((await documentsOf<LedgerCategory>(CATEGORY)).map((c) => c.id)).toEqual([into]);
    expect((await documentsOf<Transaction>(TRANSACTION)).map((t) => t.categoryId)).toEqual([into]);
    expect(await documentsOf<Allocation>(ALLOCATION)).toEqual([]);
  });
});

describe("writing a Transaction", () => {
  const D = "2026-03-01";
  const only = async () => {
    const [t, ...rest] = await allTransactions();
    expect(rest).toEqual([]);
    return t!;
  };

  it("stores an expense on its Account and Category, trimmed, with its Tags and the People it was for once each", async () => {
    await addTransaction({ kind: "expense", date: D, amount: 1250, accountId: "acc", categoryId: "food", payee: " Bakery ", note: " bread ", tags: ["Home", "home"], for: ["ana", "ben", "ana"] });
    expect(await only()).toMatchObject({
      kind: "expense", date: D, amount: 1250, accountId: "acc", fromAccountId: "", toAccountId: "", categoryId: "food",
      payee: "Bakery", note: "bread", tags: ["home"], for: ["ana", "ben"], importId: "", paypalId: "", bankPayee: "",
    });
  });

  it("stores blanks for what an expense is not given", async () => {
    await addTransaction({ kind: "expense", date: D, amount: 1, accountId: "acc" });
    expect(await only()).toMatchObject({ categoryId: "", payee: "", note: "", tags: [], for: [] });
  });

  it("keeps income's Category", async () => {
    await addTransaction({ kind: "income", date: D, amount: 1, accountId: "acc", categoryId: "pay" });
    expect(await only()).toMatchObject({ accountId: "acc", categoryId: "pay" });
  });

  it("stores a transfer between its two Accounts, with no Account or Category of its own", async () => {
    await addTransaction({ kind: "transfer", date: D, amount: 1, accountId: "acc", fromAccountId: "a", toAccountId: "b", categoryId: "food" });
    expect(await only()).toMatchObject({ accountId: "", fromAccountId: "a", toAccountId: "b", categoryId: "" });
  });

  it("stores an adjustment on its Account, signed, with no Category or transfer Accounts", async () => {
    await addTransaction({ kind: "adjustment", date: D, amount: -300, accountId: "acc", fromAccountId: "a", toAccountId: "b", categoryId: "food" });
    expect(await only()).toMatchObject({ amount: -300, accountId: "acc", fromAccountId: "", toAccountId: "", categoryId: "" });
  });

  it("keeps the import identity an update does not mention, and takes what it does", async () => {
    await addTransaction({ kind: "expense", date: D, amount: 1, accountId: "acc", importId: "imp", paypalId: "pp", bankPayee: "BAKERY 123" });
    await updateTransaction(await only(), { kind: "expense", date: D, amount: 2, accountId: "acc" });
    expect(await only()).toMatchObject({ amount: 2, importId: "imp", paypalId: "pp", bankPayee: "BAKERY 123" });
    await updateTransaction(await only(), { kind: "expense", date: D, amount: 2, accountId: "acc", paypalId: "pp2", bankPayee: "B" });
    expect(await only()).toMatchObject({ importId: "imp", paypalId: "pp2", bankPayee: "B" });
  });

  it("keeps the People it was for, its Tags and the rest when one Field is edited in place", async () => {
    await addTransaction({ kind: "expense", date: D, amount: 1, accountId: "acc", categoryId: "food", payee: "Bakery", note: "n", tags: ["home"], for: ["ana"] });
    await editTransaction(await only(), { amount: 5 });
    expect(await only()).toMatchObject({ amount: 5, accountId: "acc", categoryId: "food", payee: "Bakery", note: "n", tags: ["home"], for: ["ana"] });
  });
});

describe("reading a Transaction", () => {
  it("re-establishes defaults from what PocketBase hands back blank", async () => {
    await putDocument<Transaction>({ type: TRANSACTION, title: "", kind: "", date: "", createdAt: "2026-02-02", amount: "x", folder: "" } as unknown as Transaction);
    const [t] = await allTransactions();
    expect(t).toMatchObject({
      kind: "expense", date: "2026-02-02", amount: 0, accountId: "", fromAccountId: "", toAccountId: "", categoryId: "",
      payee: "", note: "", for: [], importId: "", paypalId: "", bankPayee: "", tags: [],
    });
  });

  it("reads the People it was for as ids, skipping blanks, and none from a value that is not a list", async () => {
    await txn({ for: ["ana", "", 7] as never });
    await txn({ for: "ana" as never, date: "2026-03-02" });
    const byDate = Object.fromEntries((await allTransactions()).map((t) => [t.date, t.for]));
    expect(byDate).toEqual({ "2026-03-01": ["ana", "7"], "2026-03-02": [] });
  });
});
