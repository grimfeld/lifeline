import { describe, expect, it } from "vitest";
import type { Series, SeriesOverride, Transaction } from "./types";
import { describeCadence, detectSeries, nextOccurrence, seriesKey } from "./series";

function tx(date: string, payee: string, amount: number, partial: Partial<Transaction> = {}): Transaction {
  return {
    id: `${payee}-${date}`,
    type: "ledger_transaction",
    title: "",
    tags: [],
    folder: "",
    createdAt: date,
    updatedAt: "",
    deleted: false,
    kind: "expense",
    date,
    amount,
    accountId: "checking",
    fromAccountId: "",
    toAccountId: "",
    categoryId: "rent",
    payee,
    note: "",
    importId: "",
    ...partial,
  } as unknown as Transaction;
}

function override(key: string, partial: Partial<SeriesOverride> = {}): SeriesOverride {
  return { id: `o-${key}`, type: "ledger_series", title: key, tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: false, key, muted: false, skipped: [], ...partial } as unknown as SeriesOverride;
}

const TODAY = "2026-03-10";

describe("detectSeries", () => {
  it("reads a monthly bill off three payments of the same size", () => {
    const rows = [tx("2026-01-01", "Landlord", 90_000), tx("2026-02-01", "Landlord", 90_000), tx("2026-03-01", "Landlord", 90_000)];
    const s = detectSeries(rows, [], TODAY)[0]!;
    expect(s.payee).toBe("Landlord");
    expect(s.cadence).toBe("monthly");
    expect(s.amount).toBe(90_000);
    expect(s.anchorDay).toBe(1);
    expect(s.lastDate).toBe("2026-03-01");
    expect(s.occurrences).toHaveLength(3);
    expect(s.dormant).toBe(false);
  });

  it("two payments are a coincidence, not a series", () => {
    expect(detectSeries([tx("2026-02-01", "Landlord", 90_000), tx("2026-03-01", "Landlord", 90_000)], [], TODAY)).toEqual([]);
  });

  it("the bank's noise around one payee collapses into one series", () => {
    // Case, punctuation and the row's own digits are noise; the words are the payee.
    const rows = [tx("2026-01-05", "NETFLIX.COM 1234", 1_399), tx("2026-02-05", "netflix com 5678", 1_399), tx("2026-03-05", "Netflix.com", 1_399)];
    const s = detectSeries(rows, [], TODAY)[0]!;
    expect(s.key).toBe(seriesKey("netflix com", "expense"));
    expect(s.occurrences).toHaveLength(3);
    // The newest spelling wins.
    expect(s.payee).toBe("Netflix.com");
  });

  it("the weekly supermarket run is regular but its amounts are not — no series", () => {
    const rows = [tx("2026-02-14", "Albert Heijn", 1_240), tx("2026-02-21", "Albert Heijn", 5_830), tx("2026-02-28", "Albert Heijn", 3_115), tx("2026-03-07", "Albert Heijn", 6_402)];
    expect(detectSeries(rows, [], TODAY)).toEqual([]);
  });

  it("a steady weekly payment is a series", () => {
    const rows = [tx("2026-02-17", "Cleaner", 4_000), tx("2026-02-24", "Cleaner", 4_000), tx("2026-03-03", "Cleaner", 4_500)];
    const s = detectSeries(rows, [], TODAY)[0]!;
    expect(s.cadence).toBe("weekly");
    expect(s.amount).toBe(4_000);
    expect(s.spread).toBeCloseTo(0.125);
  });

  it("irregular days are no series however steady the amount", () => {
    // Eleven days then sixteen: both inside the fortnightly window, neither a rhythm.
    const rows = [tx("2026-02-02", "Bakery", 500), tx("2026-02-13", "Bakery", 500), tx("2026-03-01", "Bakery", 500)];
    expect(detectSeries(rows, [], TODAY)).toEqual([]);
    // Days apart is no cadence at all.
    expect(detectSeries([tx("2026-03-02", "Kiosk", 500), tx("2026-03-04", "Kiosk", 500), tx("2026-03-07", "Kiosk", 500)], [], TODAY)).toEqual([]);
  });

  it("the run ends at the newest payment and stretches back only while the gaps hold", () => {
    const rows = [
      // An old weekly stretch, then the monthly bill it became.
      tx("2025-11-01", "Gym", 3_000),
      tx("2025-11-08", "Gym", 3_000),
      tx("2026-01-05", "Gym", 3_000),
      tx("2026-02-05", "Gym", 3_000),
      tx("2026-03-05", "Gym", 3_000),
    ];
    const s = detectSeries(rows, [], TODAY)[0]!;
    expect(s.cadence).toBe("monthly");
    expect(s.occurrences).toHaveLength(3);
    expect(s.firstDate).toBe("2026-01-05");
  });

  it("a monthly bill on the 31st keeps the 31st as its anchor through February", () => {
    const rows = [tx("2025-12-31", "Loan", 20_000), tx("2026-01-31", "Loan", 20_000), tx("2026-02-28", "Loan", 20_000)];
    const s = detectSeries(rows, [], TODAY)[0]!;
    expect(s.anchorDay).toBe(31);
    expect(nextOccurrence(s, s.lastDate)).toBe("2026-03-31");
  });

  it("income recurs too, and nothing for two periods marks a series over", () => {
    const salary = [tx("2026-01-25", "Acme Payroll", 250_000, { kind: "income", categoryId: "salary" }), tx("2026-02-25", "Acme Payroll", 250_000, { kind: "income", categoryId: "salary" }), tx("2026-03-25", "Acme Payroll", 250_000, { kind: "income", categoryId: "salary" })];
    const s = detectSeries(salary, [], "2026-03-26")[0]!;
    expect(s.kind).toBe("income");
    expect(s.dormant).toBe(false);
    expect(detectSeries(salary, [], "2026-06-30")[0]!.dormant).toBe(true);
  });

  it("an override lays the user's word over the derived facts", () => {
    const rows = [tx("2026-01-01", "Landlord", 90_000), tx("2026-02-01", "Landlord", 90_000), tx("2026-03-01", "Landlord", 90_000)];
    const s = detectSeries(rows, [override(seriesKey("Landlord", "expense"), { muted: true, skipped: ["2026-04-01"] })], TODAY)[0]!;
    expect(s.muted).toBe(true);
    expect(s.skipped).toEqual(["2026-04-01"]);
    expect(s.overrideId).toBe(`o-${seriesKey("Landlord", "expense")}`);
  });

  it("a payee with no name is nobody's series", () => {
    expect(detectSeries([tx("2026-01-01", "", 100), tx("2026-02-01", "", 100), tx("2026-03-01", "", 100)], [], TODAY)).toEqual([]);
  });
});

describe("nextOccurrence", () => {
  const monthly = { cadence: "monthly", anchorDay: 15, anchorMonth: 3 } as Series;

  it("steps a month and rolls the year", () => {
    expect(nextOccurrence(monthly, "2026-11-15")).toBe("2026-12-15");
    expect(nextOccurrence(monthly, "2026-12-15")).toBe("2027-01-15");
  });

  it("steps weeks and fortnights by days", () => {
    expect(nextOccurrence({ cadence: "weekly" } as Series, "2026-03-10")).toBe("2026-03-17");
    expect(nextOccurrence({ cadence: "fortnightly" } as Series, "2026-03-10")).toBe("2026-03-24");
  });

  it("steps a year onto the same date", () => {
    expect(nextOccurrence({ cadence: "yearly", anchorMonth: 7, anchorDay: 1 } as Series, "2026-07-01")).toBe("2027-07-01");
  });
});

describe("describeCadence", () => {
  it("says the cadence in words", () => {
    expect(describeCadence({ cadence: "monthly", anchorDay: 1, lastDate: "2026-03-01" } as Series)).toBe("monthly on the 1st");
    expect(describeCadence({ cadence: "monthly", anchorDay: 22, lastDate: "2026-03-22" } as Series)).toBe("monthly on the 22nd");
    expect(describeCadence({ cadence: "monthly", anchorDay: 11, lastDate: "2026-03-11" } as Series)).toBe("monthly on the 11th");
    expect(describeCadence({ cadence: "fortnightly", lastDate: "2026-03-10" } as Series)).toBe("every two weeks");
  });
});
