import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsOf, documentsTable, initApps, putDocument, removeDocument } from "@lifeline/core";
import { ledgerApp } from "../index";
import { ACCOUNT, ALLOCATION, CATEGORY, TRANSACTION, type Allocation, type LedgerAccount, type LedgerCategory, type Transaction } from "../domain/types";
import { addAccount, addCategory, deleteAccount, deleteCategory, mergeCategory, setAllocation } from "./repo";

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
