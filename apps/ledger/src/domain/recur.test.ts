import { describe, expect, it } from "vitest";
import type { Recurring, Transaction } from "./types";
import { openDues, ruleDays } from "./recur";

function recurring(partial: Partial<Recurring>): Recurring {
  return {
    id: partial.id ?? "r1",
    type: "ledger_recurring",
    title: "",
    tags: [],
    folder: "",
    createdAt: "2026-01-01",
    updatedAt: "",
    deleted: false,
    kind: "expense",
    amount: 90_000,
    accountId: "a",
    categoryId: "rent",
    payee: "Landlord",
    rule: { kind: "monthly", days: [1] },
    startDate: "2026-01-01",
    paused: false,
    skipped: [],
    ...partial,
  } as unknown as Recurring;
}

describe("ruleDays", () => {
  it("monthly clamps the 31st to short months", () => {
    expect(ruleDays({ kind: "monthly", days: [31] }, "2026-02-01", "2026-04-30")).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("weekly picks the weekdays", () => {
    // 2026-03-02 is a Monday.
    expect(ruleDays({ kind: "weekly", weekdays: [1, 5] }, "2026-03-02", "2026-03-08")).toEqual(["2026-03-02", "2026-03-06"]);
  });

  it("yearly hits the date once a year", () => {
    expect(ruleDays({ kind: "yearly", dates: [{ month: 7, day: 1 }] }, "2026-01-01", "2027-12-31")).toEqual(["2026-07-01", "2027-07-01"]);
  });
});

describe("openDues", () => {
  const today = "2026-03-10";

  it("surfaces overdue and upcoming, oldest first", () => {
    const dues = openDues([recurring({})], [], today);
    expect(dues.map((d) => d.date)).toEqual(["2026-02-01", "2026-03-01", "2026-04-01"]);
  });

  it("a posted Transaction covers its due day; a skip dismisses one", () => {
    const posted = { recurringId: "r1", dueDate: "2026-03-01" } as Transaction;
    const dues = openDues([recurring({ skipped: ["2026-02-01"] })], [posted], today);
    expect(dues.map((d) => d.date)).toEqual(["2026-04-01"]);
  });

  it("paused definitions surface nothing; dues never precede startDate", () => {
    expect(openDues([recurring({ paused: true })], [], today)).toEqual([]);
    expect(openDues([recurring({ startDate: "2026-03-05" })], [], today).map((d) => d.date)).toEqual(["2026-04-01"]);
  });
});
