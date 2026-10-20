import { describe, expect, it } from "vitest";
import { dayPieces } from "./span";

describe("dayPieces", () => {
  it("keeps a same-day span as one piece", () => {
    expect(dayPieces({ date: "2026-08-24", start: "09:00", endDate: "2026-08-24", end: "17:00" })).toEqual([
      { date: "2026-08-24", start: "09:00", end: "17:00" },
    ]);
  });
  it("splits an overnight span at midnight", () => {
    expect(dayPieces({ date: "2026-08-24", start: "22:00", endDate: "2026-08-25", end: "06:00" })).toEqual([
      { date: "2026-08-24", start: "22:00", end: "24:00" },
      { date: "2026-08-25", start: "00:00", end: "06:00" },
    ]);
  });
  it("covers the middle days of a multi-day span whole", () => {
    expect(dayPieces({ date: "2026-08-24", start: "09:00", endDate: "2026-08-26", end: "17:00" })).toEqual([
      { date: "2026-08-24", start: "09:00", end: "24:00" },
      { date: "2026-08-25", start: "00:00", end: "24:00" },
      { date: "2026-08-26", start: "00:00", end: "17:00" },
    ]);
  });
  it("leaves no piece on the end day of a span ending at 00:00", () => {
    expect(dayPieces({ date: "2026-08-24", start: "22:00", endDate: "2026-08-25", end: "00:00" })).toEqual([
      { date: "2026-08-24", start: "22:00", end: "24:00" },
    ]);
    expect(dayPieces({ date: "2026-08-24", start: "09:00", endDate: "2026-08-26", end: "00:00" })).toEqual([
      { date: "2026-08-24", start: "09:00", end: "24:00" },
      { date: "2026-08-25", start: "00:00", end: "24:00" },
    ]);
  });
  it("gives an all-day span one whole piece on every day from its first to its last", () => {
    expect(dayPieces({ date: "2026-08-24", start: null, endDate: "2026-08-26", end: null })).toEqual([
      { date: "2026-08-24", start: null, end: null },
      { date: "2026-08-25", start: null, end: null },
      { date: "2026-08-26", start: null, end: null },
    ]);
  });
  it("keeps only the pieces inside a range of days", () => {
    const range = { start: "2026-08-25", end: "2026-08-26" };
    expect(dayPieces({ date: "2026-08-20", start: null, endDate: "2026-09-30", end: null }, range).map((p) => p.date)).toEqual([
      "2026-08-25",
      "2026-08-26",
    ]);
    expect(dayPieces({ date: "2026-08-24", start: "22:00", endDate: "2026-08-25", end: "06:00" }, range)).toEqual([
      { date: "2026-08-25", start: "00:00", end: "06:00" },
    ]);
    expect(dayPieces({ date: "2026-08-27", start: null, endDate: "2026-08-28", end: null }, range)).toEqual([]);
  });
});
