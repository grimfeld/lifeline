import { describe, expect, it } from "vitest";
import type { SeriesOverride, Transaction } from "./types";
import { detectSeries } from "./series";
import { fixedSplit, seriesReport } from "./recurring-report";

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

function override(key: string, muted: boolean): SeriesOverride {
  return { id: `o-${key}`, type: "ledger_series", title: "", tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: false, key, muted, skipped: [] } as unknown as SeriesOverride;
}

const TODAY = "2026-03-20";
const MONTHS = ["2026-01", "2026-02", "2026-03"];

/** Three months of Netflix — a monthly series — plus noise around it. */
const netflix = [
  tx({ payee: "NETFLIX.COM", date: "2026-01-15", amount: 1399 }),
  tx({ payee: "NETFLIX.COM", date: "2026-02-15", amount: 1399 }),
  tx({ payee: "NETFLIX.COM", date: "2026-03-15", amount: 1399 }),
];
const salary = [
  tx({ payee: "ACME Corp", kind: "income", date: "2026-01-28", amount: 250_000 }),
  tx({ payee: "ACME Corp", kind: "income", date: "2026-02-28", amount: 250_000 }),
  tx({ payee: "ACME Corp", kind: "income", date: "2026-03-28", amount: 250_000 }),
];
const groceries = [tx({ payee: "Aldi", date: "2026-02-03", amount: 4_250 }), tx({ payee: "Aldi", date: "2026-03-07", amount: 6_800 })];

describe("fixedSplit", () => {
  it("splits each month's spending by series membership", () => {
    const rows = [...netflix, ...salary, ...groceries];
    const series = detectSeries(rows, [], TODAY);
    const split = fixedSplit(rows, series, MONTHS);
    expect(split.map((p) => p.fixed)).toEqual([1399, 1399, 1399]);
    expect(split.map((p) => p.variable)).toEqual([0, 4_250, 6_800]);
  });

  it("leaves income out entirely — a salary series is not spending", () => {
    const rows = [...salary];
    const series = detectSeries(rows, [], TODAY);
    const split = fixedSplit(rows, series, MONTHS);
    expect(split.every((p) => p.fixed === 0 && p.variable === 0)).toBe(true);
  });

  it("history keeps its months: a payee's row outside the current run still counts fixed", () => {
    // August broke the cadence — the run reads back only to January — but the
    // old row still belongs to the series' payee, so its month reads fixed.
    const old = tx({ payee: "NETFLIX.COM", date: "2025-08-15", amount: 1399 });
    const rows = [...netflix, old];
    const series = detectSeries(rows, [], TODAY);
    const split = fixedSplit(rows, series, ["2025-08", ...MONTHS]);
    expect(split[0]).toMatchObject({ month: "2025-08", fixed: 1399, variable: 0 });
  });

  it("a muted series still counts fixed — mute means don't forecast, not don't count", () => {
    const rows = [...netflix, ...groceries];
    const unmutedSeries = detectSeries(rows, [], TODAY);
    const muted = detectSeries(rows, [override(unmutedSeries[0]!.key, true)], TODAY);
    expect(muted[0]!.muted).toBe(true);
    expect(fixedSplit(rows, muted, MONTHS)).toEqual(fixedSplit(rows, unmutedSeries, MONTHS));
  });
});

describe("seriesReport", () => {
  it("reads each series over the window: totals, counts, annual cost, share of fixed", () => {
    const rows = [...netflix, ...salary, ...groceries];
    const series = detectSeries(rows, [], TODAY);
    const report = seriesReport(rows, series, MONTHS);
    expect(report).toHaveLength(2);

    const acme = report.find((r) => r.series.payee === "ACME Corp");
    const nf = report.find((r) => r.series.payee === "NETFLIX.COM");
    expect(acme).toMatchObject({ total: 750_000, count: 3, annual: 250_000 * 12, share: 0 });
    expect(nf).toMatchObject({ total: 1399 * 3, count: 3, annual: 1399 * 12 });
    expect(nf?.perMonth).toEqual([1399, 1399, 1399]);
    // Netflix is the only expense series, so it is all of the fixed spending.
    expect(nf?.share).toBe(1);
    // Biggest window total first.
    expect(report[0]?.series.payee).toBe("ACME Corp");
  });

  it("drops a series with nothing in the window — the table answers for what is on screen", () => {
    const rows = [...netflix];
    const series = detectSeries(rows, [], TODAY);
    expect(seriesReport(rows, series, ["2026-04", "2026-05"])).toEqual([]);
  });
});
