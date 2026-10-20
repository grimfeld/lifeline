import { describe, expect, it } from "vitest";
import { hourWindow, layoutColumns, toHours } from "./agenda";

describe("hourWindow", () => {
  it("uses the configured range when nothing falls outside", () => {
    expect(hourWindow([{ start: "09:00", end: "10:00" }], 7, 23)).toEqual({ from: 7, to: 23 });
  });
  it("stretches to early and late items, capped at 24", () => {
    expect(hourWindow([{ start: "05:30", end: "06:00" }, { start: "23:15", end: "23:45" }], 7, 22)).toEqual({ from: 5, to: 24 });
  });
  it("ignores all-day items and guards degenerate ranges", () => {
    expect(hourWindow([{ start: null, end: null }], 10, 10)).toEqual({ from: 9, to: 10 });
  });
});

describe("layoutColumns", () => {
  it("leaves off an item whose times are no times, rather than laying it at NaN", () => {
    const out = layoutColumns([{ start: "Start with a long name", end: "End" }, { start: "09:00", end: "10:00" }]);
    expect(out.map((b) => b.start)).toEqual([9]);
  });
  it("gives non-overlapping items a single column", () => {
    const out = layoutColumns([{ start: "09:00", end: "10:00" }, { start: "10:00", end: "11:00" }]);
    expect(out.map((b) => [b.col, b.cols])).toEqual([[0, 1], [0, 1]]);
  });
  it("puts overlapping items side by side and shares cols across the cluster", () => {
    const out = layoutColumns([
      { start: "09:00", end: "10:30" },
      { start: "10:00", end: "11:00" },
      { start: "10:45", end: "11:30" },
    ]);
    expect(out.map((b) => [b.col, b.cols])).toEqual([[0, 2], [1, 2], [0, 2]]);
  });
  it("skips all-day items and enforces a 30-minute minimum", () => {
    const out = layoutColumns([{ start: null, end: null }, { start: "12:00", end: null }]);
    expect(out).toHaveLength(1);
    expect(out[0].end - out[0].start).toBe(0.5);
  });
  it("toHours parses minutes", () => {
    expect(toHours("13:30")).toBe(13.5);
  });
});
