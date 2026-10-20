import { describe, expect, it } from "vitest";
import { dateOf, valueOf, formatDateValue, yearSpan, withinSpan } from "./date-value";

describe("the stored day (YYYY-MM-DD) and the calendar's Date", () => {
  it("reads a stored day as that day at local midnight, not UTC", () => {
    const d = dateOf("2026-10-20")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 20, 0]);
  });

  it("reads an empty or broken value as no day", () => {
    expect(dateOf("")).toBeUndefined();
    expect(dateOf("2026-13-01")).toBeUndefined();
    expect(dateOf("2026-02-30")).toBeUndefined();
    expect(dateOf("soon")).toBeUndefined();
  });

  it("writes a picked Date back as the same string the native input gave", () => {
    expect(valueOf(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(valueOf(new Date(867, 10, 7))).toBe("0867-11-07");
  });
});

describe("the trigger's text", () => {
  it("shows the day with its weekday, month and year in the given locale", () => {
    expect(formatDateValue("2026-10-20", "en-GB")).toBe("Tue 20 Oct 2026");
  });

  it("shows nothing for no day", () => {
    expect(formatDateValue("", "en-GB")).toBe("");
  });
});

describe("the header's year dropdown", () => {
  const today = new Date(2026, 9, 20);

  it("runs from 1900 to ten years ahead by default", () => {
    expect(yearSpan(today)).toEqual({ from: 1900, to: 2036 });
  });

  it("widens to an earlier start year, and to min/max beyond it", () => {
    expect(yearSpan(today, { startYear: 1500 })).toEqual({ from: 1500, to: 2036 });
    expect(yearSpan(today, { min: "1850-03-01", max: "2050-01-01" })).toEqual({ from: 1850, to: 2050 });
  });

  it("keeps a stored day outside the range reachable", () => {
    expect(yearSpan(today, { value: "1867-11-07" })).toEqual({ from: 1867, to: 2036 });
  });
});

describe("min and max", () => {
  it("lets a day through only inside them, either end open", () => {
    expect(withinSpan("2026-10-20", "2026-10-20", "2026-10-31")).toBe(true);
    expect(withinSpan("2026-10-19", "2026-10-20", undefined)).toBe(false);
    expect(withinSpan("2026-11-01", undefined, "2026-10-31")).toBe(false);
    expect(withinSpan("2026-11-01", undefined, undefined)).toBe(true);
  });
});
