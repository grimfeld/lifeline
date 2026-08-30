import { describe, expect, it } from "vitest";
import type { Allowance, Spend } from "./types";
import { allowanceRows, canRenew, jarLevel, leftOf, renewable, sortRows, successorOf } from "./derive";

function allowance(partial: Partial<Allowance>): Allowance {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    type: "pocket_allowance",
    title: "",
    tags: [],
    folder: "",
    createdAt: "2026-01-01",
    updatedAt: "",
    deleted: false,
    name: "Eating out",
    period: "month",
    from: "2026-09-01",
    to: "",
    amount: 30000,
    ...partial,
  } as unknown as Allowance;
}

function spend(allowanceId: string, amount: number, date = "2026-09-10", createdAt = "2026-09-10"): Spend {
  return { id: Math.random().toString(36).slice(2), type: "pocket_spend", title: "", tags: [], folder: "", createdAt, updatedAt: "", deleted: false, allowanceId, amount, date, label: "" } as unknown as Spend;
}

describe("leftOf / allowanceRows", () => {
  it("derives left from the Allowance's own Spends and lets it go negative", () => {
    const a = allowance({ id: "a" });
    const b = allowance({ id: "b", name: "Books", amount: 2000 });
    const spends = [spend("a", 12000), spend("a", 19000), spend("b", 500)];
    expect(leftOf(a, spends)).toBe(-1000);
    expect(leftOf(b, spends)).toBe(1500);
    const rows = allowanceRows([a, b], spends, "2026-09-15");
    expect(rows[0].spent).toBe(31000);
    expect(rows[0].spends).toHaveLength(2);
    expect(rows[0].bucket).toBe("current");
  });
  it("counts a Spend dated outside the period all the same — the Allowance was picked explicitly", () => {
    const a = allowance({ id: "a" });
    expect(leftOf(a, [spend("a", 1000, "2026-10-01")])).toBe(29000);
  });
  it("orders Spends newest first", () => {
    const rows = allowanceRows([allowance({ id: "a" })], [spend("a", 1, "2026-09-01"), spend("a", 2, "2026-09-12"), spend("a", 3, "2026-09-05")], "2026-09-15");
    expect(rows[0].spends.map((s) => s.amount)).toEqual([2, 3, 1]);
  });
});

describe("sortRows", () => {
  it("puts current first, then upcoming, then past — most recent past first", () => {
    const rows = allowanceRows(
      [
        allowance({ id: "aug", from: "2026-08-01" }),
        allowance({ id: "oct", from: "2026-10-01" }),
        allowance({ id: "sep", from: "2026-09-01" }),
        allowance({ id: "jul", from: "2026-07-01" }),
        allowance({ id: "wk", name: "Coffee", period: "week", from: "2026-09-14" }),
      ],
      [],
      "2026-09-15",
    );
    expect(sortRows(rows).map((r) => r.allowance.id)).toEqual(["wk", "sep", "oct", "aug", "jul"]);
  });
});

describe("renewal", () => {
  it("finds a successor by name, kind and next period, case-insensitively", () => {
    const aug = allowance({ id: "aug", from: "2026-08-01" });
    const sep = allowance({ id: "sep", name: "eating OUT", from: "2026-09-01" });
    expect(successorOf(aug, [aug, sep])?.id).toBe("sep");
    expect(canRenew(aug, [aug, sep])).toBe(false);
    expect(canRenew(sep, [aug, sep])).toBe(true);
  });
  it("does not mistake a different kind or a different name for a successor", () => {
    const aug = allowance({ id: "aug", from: "2026-08-01" });
    const week = allowance({ id: "w", period: "week", from: "2026-09-01" });
    const books = allowance({ id: "b", name: "Books", from: "2026-09-01" });
    expect(successorOf(aug, [aug, week, books])).toBeUndefined();
  });
  it("never renews a custom span", () => {
    const trip = allowance({ id: "t", name: "Vacation", period: "custom", from: "2026-09-12", to: "2026-09-20" });
    expect(canRenew(trip, [trip])).toBe(false);
    expect(renewable([trip], "2026-10-01")).toEqual([]);
  });
  it("lists only ended Allowances without a successor", () => {
    const jul = allowance({ id: "jul", from: "2026-07-01" });
    const aug = allowance({ id: "aug", from: "2026-08-01" });
    const books = allowance({ id: "books", name: "Books", from: "2026-08-01" });
    const sep = allowance({ id: "sep", from: "2026-09-01" });
    expect(renewable([jul, aug, books, sep], "2026-10-02").map((a) => a.id)).toEqual(["books", "sep"]);
    expect(renewable([jul, aug, books, sep], "2026-09-15").map((a) => a.id)).toEqual(["books"]);
  });
});

describe("jarLevel", () => {
  it("is full with nothing spent, half at half, empty when overspent, never above 1 or below 0", () => {
    const a = allowance({ id: "a", amount: 30000 });
    expect(jarLevel({ allowance: a, left: 30000 })).toBe(1);
    expect(jarLevel({ allowance: a, left: 15000 })).toBe(0.5);
    expect(jarLevel({ allowance: a, left: 0 })).toBe(0);
    expect(jarLevel({ allowance: a, left: -4000 })).toBe(0);
  });

  it("is empty for a zero-amount allowance", () => {
    expect(jarLevel({ allowance: allowance({ amount: 0 }), left: 0 })).toBe(0);
  });
});
