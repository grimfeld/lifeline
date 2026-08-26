import { describe, expect, it } from "vitest";
import type { Series, Transaction } from "./types";
import { detectSeries } from "./series";
import { openDues } from "./recur";

function series(partial: Partial<Series> = {}): Series {
  return {
    key: "expense/landlord",
    payee: "Landlord",
    kind: "expense",
    cadence: "monthly",
    period: 30,
    amount: 90_000,
    spread: 0,
    accountId: "checking",
    categoryId: "rent",
    occurrences: [],
    firstDate: "2026-01-01",
    lastDate: "2026-03-01",
    anchorDay: 1,
    anchorMonth: 3,
    dormant: false,
    overrideId: "",
    muted: false,
    skipped: [],
    ...partial,
  };
}

const TODAY = "2026-03-10";

describe("openDues", () => {
  it("projects forward from the newest occurrence, over the horizon and no further", () => {
    expect(openDues([series()], TODAY).map((d) => d.date)).toEqual(["2026-04-01"]);
  });

  it("an occurrence not yet posted is overdue and stays loud", () => {
    const dues = openDues([series({ lastDate: "2026-01-01" })], TODAY);
    expect(dues.map((d) => d.date)).toEqual(["2026-02-01", "2026-03-01", "2026-04-01"]);
  });

  it("a skipped day is waved off; muted and dormant series surface nothing", () => {
    expect(openDues([series({ lastDate: "2026-01-01", skipped: ["2026-02-01"] })], TODAY).map((d) => d.date)).toEqual(["2026-03-01", "2026-04-01"]);
    expect(openDues([series({ muted: true })], TODAY)).toEqual([]);
    expect(openDues([series({ dormant: true })], TODAY)).toEqual([]);
  });

  it("dues sort oldest first across series", () => {
    const dues = openDues([series({ lastDate: "2026-03-05", anchorDay: 5 }), series({ key: "expense/netflix", payee: "Netflix", amount: 1_399 })], TODAY);
    expect(dues.map((d) => `${d.series.payee} ${d.date}`)).toEqual(["Netflix 2026-04-01", "Landlord 2026-04-05"]);
  });

  it("posting the transaction is what closes the due — no bookkeeping on the row", () => {
    function tx(date: string): Transaction {
      return { id: date, type: "ledger_transaction", title: "", tags: [], folder: "", createdAt: date, updatedAt: "", deleted: false, kind: "expense", date, amount: 90_000, accountId: "checking", fromAccountId: "", toAccountId: "", categoryId: "rent", payee: "Landlord", note: "", importId: "" } as unknown as Transaction;
    }
    const posted = [tx("2026-01-01"), tx("2026-02-01"), tx("2026-03-01")];
    expect(openDues(detectSeries(posted, [], TODAY), TODAY).map((d) => d.date)).toEqual(["2026-04-01"]);
    // Confirming April's due adds one more fact; the ledger alone moves the series on.
    expect(openDues(detectSeries([...posted, tx("2026-04-01")], [], "2026-04-02"), "2026-04-02").map((d) => d.date)).toEqual(["2026-05-01"]);
  });
});
