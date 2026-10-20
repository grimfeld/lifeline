import { describe, expect, it } from "vitest";
import { cutEdges, describeSpan, formatTime, pieceLead, spanIsValid } from "./timed";

describe("formatTime", () => {
  it("reads a clock time in the locale's style", () => {
    expect(formatTime("09:05")).toMatch(/^9:05/);
  });
  it("is empty for an all-day item", () => {
    expect(formatTime(null)).toBe("");
  });
  it("is empty, not a thrown RangeError, for text that is no time", () => {
    // A synced or typed value can be anything; one bad Event must not blank the Calendar.
    expect(formatTime("Start with an exceptionally long name Donaudampfschifffahrt")).toBe("");
    expect(formatTime("9")).toBe("");
    expect(formatTime(":")).toBe("");
  });
});

describe("spanIsValid", () => {
  it("needs the end moment strictly after the start moment", () => {
    expect(spanIsValid({ date: "2026-08-10", start: "09:00", endDate: "2026-08-10", end: "10:00" })).toBe(true);
    expect(spanIsValid({ date: "2026-08-10", start: "09:00", endDate: "2026-08-10", end: "09:00" })).toBe(false);
    expect(spanIsValid({ date: "2026-08-10", start: "09:00", endDate: "2026-08-10", end: "08:30" })).toBe(false);
  });
  it("takes an end on a later day, even at an earlier time", () => {
    expect(spanIsValid({ date: "2026-08-10", start: "22:00", endDate: "2026-08-11", end: "06:00" })).toBe(true);
    expect(spanIsValid({ date: "2026-08-10", start: "09:00", endDate: "2026-08-12", end: "17:00" })).toBe(true);
    expect(spanIsValid({ date: "2026-08-10", start: "09:00", endDate: "2026-08-11", end: "09:00" })).toBe(true);
  });
  it("refuses an end day before the start day, and text that is no time", () => {
    expect(spanIsValid({ date: "2026-08-10", start: "09:00", endDate: "2026-08-09", end: "23:00" })).toBe(false);
    expect(spanIsValid({ date: "2026-08-10", start: "9am", endDate: "2026-08-10", end: "10:00" })).toBe(false);
  });
});

describe("pieces of a span", () => {
  const night = { date: "2026-08-10", start: "22:00", endDate: "2026-08-11", end: "06:00" };
  const conference = { date: "2026-08-10", start: "09:00", endDate: "2026-08-12", end: "17:00" };
  const t = formatTime;

  it("describes a span, naming the end day when it is another", () => {
    expect(describeSpan(night)).toBe(`${t("22:00")} – Tue ${t("06:00")}`);
    expect(describeSpan({ ...night, endDate: "2026-08-10", end: "23:00" })).toBe(`${t("22:00")} – ${t("23:00")}`);
  });

  it("labels the cut edges of a piece with where the span carries on", () => {
    expect(cutEdges({ date: "2026-08-10", span: night })).toEqual({ before: null, after: `↓ Tue ${t("06:00")}` });
    expect(cutEdges({ date: "2026-08-11", span: night })).toEqual({ before: `↑ from Mon ${t("22:00")}`, after: null });
    expect(cutEdges({ date: "2026-08-11", span: conference })).toEqual({ before: `↑ from Mon ${t("09:00")}`, after: `↓ Wed ${t("17:00")}` });
  });

  it("cuts nothing on a span that ends at midnight, or an item with no span", () => {
    expect(cutEdges({ date: "2026-08-10", span: { ...night, end: "00:00" } })).toEqual({ before: null, after: null });
    expect(cutEdges({ date: "2026-08-10" })).toEqual({ before: null, after: null });
  });

  it("leads a piece by the whole span on its first day, by where it ends after", () => {
    expect(pieceLead({ date: "2026-08-10", span: night })).toBe(`${t("22:00")} – Tue ${t("06:00")}`);
    expect(pieceLead({ date: "2026-08-11", span: night })).toBe(`→ ${t("06:00")}`);
    expect(pieceLead({ date: "2026-08-11", span: conference })).toBe(`→ Wed ${t("17:00")}`);
    expect(pieceLead({ date: "2026-08-10", span: { ...night, endDate: "2026-08-10", end: "23:00" } })).toBeNull();
    expect(pieceLead({ date: "2026-08-10" })).toBeNull();
  });
});
