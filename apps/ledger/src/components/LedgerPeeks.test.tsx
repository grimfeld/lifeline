// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { fill, has, peekNew, peekTests, press, stored } from "@lifeline/parts/testing";
import { ledgerApp } from "../index";

/** The Ledger's Peeks write their own Fields through its operations (ADR 0085). */
peekTests([ledgerApp]);

it("a Transaction's payee is edited in its Peek; its kind has no control there", async () => {
  const ids = await peekNew(
    { type: "ledger_account", title: "Checking", flavor: "checking", openingBalance: 0, archived: false, importMapping: null },
    { type: "ledger_category", title: "Food", kind: "expense", group: "", target: 0, accumulating: false },
    { type: "ledger_transaction", kind: "expense", date: "2026-10-01", amount: 1250, accountId: "$0", fromAccountId: "", toAccountId: "", categoryId: "$1", payee: "Bakery", note: "", importId: "", paypalId: "", bankPayee: "" },
  );
  await fill("Payee", "Baker");
  await press("Payee", "Enter");
  expect(await stored(ids[2]!, "payee")).toBe("Baker");
  // The kind is the Ledger's (guarded).
  expect(has("Kind")).toBe(false);
});
