import { describe, expect, it } from "vitest";
import { allowanceTitle, bucketOf, daysLeft, endOf, isoWeek, nextFrom, normalizeFrom, periodLabel } from "./period";

describe("normalizeFrom", () => {
  it("snaps a week onto its Monday", () => {
    expect(normalizeFrom("week", "2026-09-03")).toBe("2026-08-31"); // Thursday → Monday
    expect(normalizeFrom("week", "2026-08-31")).toBe("2026-08-31");
    expect(normalizeFrom("week", "2026-09-06")).toBe("2026-08-31"); // Sunday belongs to the week before
  });
  it("snaps month and year onto their first day, leaves custom alone", () => {
    expect(normalizeFrom("month", "2026-09-17")).toBe("2026-09-01");
    expect(normalizeFrom("year", "2026-09-17")).toBe("2026-01-01");
    expect(normalizeFrom("custom", "2026-09-17")).toBe("2026-09-17");
  });
});

describe("endOf", () => {
  it("derives the last day for week, month and year", () => {
    expect(endOf("week", "2026-08-31")).toBe("2026-09-06");
    expect(endOf("month", "2026-02-01")).toBe("2026-02-28");
    expect(endOf("month", "2028-02-01")).toBe("2028-02-29");
    expect(endOf("year", "2026-01-01")).toBe("2026-12-31");
  });
  it("uses the stored end for a custom span, never before its start", () => {
    expect(endOf("custom", "2026-09-12", "2026-09-20")).toBe("2026-09-20");
    expect(endOf("custom", "2026-09-12", "2026-09-01")).toBe("2026-09-12");
    expect(endOf("custom", "2026-09-12")).toBe("2026-09-12");
  });
});

describe("nextFrom", () => {
  it("steps by the calendar, not by day count", () => {
    expect(nextFrom("week", "2026-08-31")).toBe("2026-09-07");
    expect(nextFrom("month", "2026-01-01")).toBe("2026-02-01");
    expect(nextFrom("month", "2026-12-01")).toBe("2027-01-01");
    expect(nextFrom("year", "2026-01-01")).toBe("2027-01-01");
  });
  it("never renews a custom span", () => {
    expect(nextFrom("custom", "2026-09-12")).toBeNull();
  });
});

describe("isoWeek", () => {
  it("follows ISO 8601", () => {
    expect(isoWeek("2026-01-01")).toEqual({ year: 2026, week: 1 });
    expect(isoWeek("2027-01-01")).toEqual({ year: 2026, week: 53 });
    expect(isoWeek("2026-08-31")).toEqual({ year: 2026, week: 36 });
    expect(isoWeek("2024-12-30")).toEqual({ year: 2025, week: 1 });
  });
});

describe("periodLabel / allowanceTitle", () => {
  it("names weeks and years without locale", () => {
    expect(periodLabel({ period: "week", from: "2026-08-31", to: "" })).toBe("W36 2026");
    expect(periodLabel({ period: "year", from: "2026-01-01", to: "" })).toBe("2026");
  });
  it("always carries the year and both days of a custom span", () => {
    const label = periodLabel({ period: "custom", from: "2026-09-12", to: "2026-09-20" });
    expect(label).toMatch(/^12–20 .+ 2026$/);
    const across = periodLabel({ period: "custom", from: "2026-09-28", to: "2026-10-03" });
    expect(across).toMatch(/^28 .+ – 3 .+ 2026$/);
    const years = periodLabel({ period: "custom", from: "2026-12-28", to: "2027-01-03" });
    expect(years).toMatch(/^28 .+ 2026 – 3 .+ 2027$/);
  });
  it("derives the title as name · period", () => {
    expect(allowanceTitle({ name: "Eating out", period: "week", from: "2026-08-31", to: "" })).toBe("Eating out · W36 2026");
    expect(allowanceTitle({ name: "", period: "year", from: "2026-01-01", to: "" })).toBe("Allowance · 2026");
  });
});

describe("bucketOf / daysLeft", () => {
  const sept = { period: "month" as const, from: "2026-09-01", to: "" };
  it("buckets against today", () => {
    expect(bucketOf(sept, "2026-08-31")).toBe("upcoming");
    expect(bucketOf(sept, "2026-09-01")).toBe("current");
    expect(bucketOf(sept, "2026-09-30")).toBe("current");
    expect(bucketOf(sept, "2026-10-01")).toBe("past");
  });
  it("counts today as a day left", () => {
    expect(daysLeft(sept, "2026-09-30")).toBe(1);
    expect(daysLeft(sept, "2026-09-01")).toBe(30);
    expect(daysLeft(sept, "2026-08-15")).toBe(30);
    expect(daysLeft(sept, "2026-10-01")).toBe(0);
  });
});
