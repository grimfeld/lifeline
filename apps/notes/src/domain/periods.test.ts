import { describe, expect, it } from "vitest";
import { daysOf, isoWeek, journalPageOf, kindOfKey, partsOf, periodKey, periodLabel, periodRange, shiftPeriod } from "./periods";

describe("isoWeek", () => {
  it("follows the Thursday rule at year edges", () => {
    expect(isoWeek("2026-10-15")).toEqual({ year: 2026, week: 42 });
    expect(isoWeek("2021-01-03")).toEqual({ year: 2020, week: 53 }); // a Sunday still in 2020's last week
    expect(isoWeek("2024-12-30")).toEqual({ year: 2025, week: 1 }); // a Monday already in 2025's first week
    expect(isoWeek("2026-01-01")).toEqual({ year: 2026, week: 1 });
  });
});

describe("periodKey", () => {
  it("titles each kind of stretch", () => {
    expect(periodKey("week", "2026-10-15")).toBe("2026-W42");
    expect(periodKey("month", "2026-10-15")).toBe("2026-10");
    expect(periodKey("quarter", "2026-10-15")).toBe("2026-Q4");
    expect(periodKey("quarter", "2026-03-31")).toBe("2026-Q1");
    expect(periodKey("year", "2026-10-15")).toBe("2026");
  });

  it("is read back by kindOfKey, and nothing else is a stretch", () => {
    expect(["2026-W42", "2026-10", "2026-Q4", "2026", "2026-10-15", "notes"].map(kindOfKey)).toEqual(["week", "month", "quarter", "year", undefined, undefined]);
  });
});

describe("periodRange", () => {
  it("bounds every kind inclusively", () => {
    expect(periodRange("2026-W42")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
    expect(periodRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(periodRange("2026-Q4")).toEqual({ from: "2026-10-01", to: "2026-12-31" });
    expect(periodRange("2026")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(periodRange("2021-W01")).toEqual({ from: "2021-01-04", to: "2021-01-10" });
  });

  it("lists a stretch's days", () => {
    expect(daysOf("2026-W42")).toHaveLength(7);
    expect(daysOf("2026")).toHaveLength(365);
  });
});

describe("partsOf and shiftPeriod", () => {
  it("steps one finer", () => {
    expect(partsOf("2026")).toEqual(["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]);
    expect(partsOf("2026-Q2")).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(partsOf("2026-10")[0]).toBe("2026-W40");
    expect(partsOf("2026-W42")).toEqual([]);
  });

  it("moves across year edges", () => {
    expect(shiftPeriod("2026-W01", -1)).toBe("2025-W52");
    expect(shiftPeriod("2026-12", 1)).toBe("2027-01");
    expect(shiftPeriod("2026-Q1", -1)).toBe("2025-Q4");
    expect(shiftPeriod("2026", 1)).toBe("2027");
  });

  it("labels for people", () => {
    expect(periodLabel("2026-W42")).toBe("Week 42, 2026");
    expect(periodLabel("2026-Q4")).toBe("Q4 2026");
  });
});

describe("journalPageOf", () => {
  it("reads an ISO date as that Day, labelled in full", () => {
    expect(journalPageOf("2023-03-14", "en-GB")).toEqual({ kind: "day", key: "2023-03-14", label: "Tuesday 14 March 2023" });
  });

  it("reads the Journal's period keys as their reviews", () => {
    expect(journalPageOf("2023-W11", "en-GB")).toEqual({ kind: "week", key: "2023-W11", label: "Week 11, 2023" });
    expect(journalPageOf("2023-03", "en-GB")).toEqual({ kind: "month", key: "2023-03", label: "March 2023" });
    expect(journalPageOf("2023-Q1", "en-GB")).toEqual({ kind: "quarter", key: "2023-Q1", label: "Q1 2023" });
    expect(journalPageOf("2023", "en-GB")).toEqual({ kind: "year", key: "2023", label: "2023" });
  });

  it("offers nothing for what the calendar doesn't have, or for words", () => {
    for (const text of ["2023-13", "2023-00", "2023-02-30", "2023-W60", "2023-W00", "2023-Q5", "2023-Q0", "0000", "hello", "", "14/03/2023"]) {
      expect(journalPageOf(text), text).toBeUndefined();
    }
  });

  it("accepts week 53 only in a year that has one", () => {
    expect(journalPageOf("2020-W53")?.key).toBe("2020-W53");
    expect(journalPageOf("2026-W53")?.key).toBe("2026-W53");
    expect(journalPageOf("2023-W53")).toBeUndefined();
    expect(journalPageOf("2025-W53")).toBeUndefined();
  });

  it("takes a leap day only in a leap year", () => {
    expect(journalPageOf("2024-02-29")?.key).toBe("2024-02-29");
    expect(journalPageOf("2023-02-29")).toBeUndefined();
  });

  it("opens future dates as readily as past ones", () => {
    expect(journalPageOf("2099-12-31")?.kind).toBe("day");
    expect(journalPageOf("2099-Q4")?.kind).toBe("quarter");
  });

  it("forgives spaces around the text and a lower-case w or q", () => {
    expect(journalPageOf(" 2023-w11 ")?.key).toBe("2023-W11");
    expect(journalPageOf("2023-q1")?.key).toBe("2023-Q1");
  });
});

