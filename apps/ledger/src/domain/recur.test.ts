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
    // April's bank row arrives as one more fact; the ledger alone moves the series on.
    expect(openDues(detectSeries([...posted, tx("2026-04-01")], [], "2026-04-02"), "2026-04-02").map((d) => d.date)).toEqual(["2026-05-01"]);
  });

  describe("an early payment covers the anchor day it was for (CR-33)", () => {
    it("rent on the 1st paid on Aug 31 leaves Sep 1 closed", () => {
      expect(openDues([series({ lastDate: "2026-08-31" })], "2026-09-02").map((d) => d.date)).toEqual(["2026-10-01"]);
    });

    it("on-time and late payments still project from the month after", () => {
      expect(openDues([series({ lastDate: "2026-09-01" })], "2026-09-02").map((d) => d.date)).toEqual(["2026-10-01"]);
      expect(openDues([series({ lastDate: "2026-09-04" })], "2026-09-05").map((d) => d.date)).toEqual(["2026-10-01"]);
    });

    it("a payment far from any anchor day falls back to the month after", () => {
      expect(openDues([series({ lastDate: "2026-08-15" })], "2026-08-20").map((d) => d.date)).toEqual(["2026-09-01"]);
    });

    it("an early payment over a year end covers January's day", () => {
      expect(openDues([series({ lastDate: "2026-12-29" })], "2027-01-02").map((d) => d.date)).toEqual(["2027-02-01"]);
    });

    it("a yearly bill paid days before its anniversary is covered for that year", () => {
      const yearly = series({ cadence: "yearly", period: 365, anchorDay: 1, anchorMonth: 1, lastDate: "2025-12-30" });
      expect(openDues([yearly], "2026-12-20").map((d) => d.date)).toEqual(["2027-01-01"]);
    });

    it("read from the ledger: a yearly bill paid early keeps its anniversary month", () => {
      function tx(date: string): Transaction {
        return { id: date, type: "ledger_transaction", title: "", tags: [], folder: "", createdAt: date, updatedAt: "", deleted: false, kind: "expense", date, amount: 12_000, accountId: "checking", fromAccountId: "", toAccountId: "", categoryId: "insurance", payee: "Insurer", note: "", importId: "" } as unknown as Transaction;
      }
      const posted = [tx("2024-01-01"), tx("2025-01-01"), tx("2025-12-30")];
      expect(openDues(detectSeries(posted, [], "2026-12-20"), "2026-12-20").map((d) => d.date)).toEqual(["2027-01-01"]);
    });
  });
});
