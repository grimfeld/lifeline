import { describe, expect, it } from "vitest";
import { readRecurrence } from "./recurrence";

describe("readRecurrence", () => {
  it("reads each kind, sorting and de-duplicating days", () => {
    expect(readRecurrence({ kind: "weekly", weekdays: [3, 1, 3] })).toEqual({ kind: "weekly", weekdays: [1, 3] });
    expect(readRecurrence({ kind: "monthly", days: [15, 1] })).toEqual({ kind: "monthly", days: [1, 15] });
    expect(readRecurrence({ kind: "yearly", dates: [{ month: 3, day: 14 }] })).toEqual({ kind: "yearly", dates: [{ month: 3, day: 14 }] });
  });

  it("refuses shapes the occurrence rules cannot read", () => {
    expect(() => readRecurrence({ kind: "daily" })).toThrow("kind must be");
    expect(() => readRecurrence({ kind: "weekly", weekdays: [] })).toThrow("weekdays");
    expect(() => readRecurrence({ kind: "weekly", weekdays: [7] })).toThrow("weekdays");
    expect(() => readRecurrence({ kind: "monthly", days: [0] })).toThrow("days");
    expect(() => readRecurrence({ kind: "yearly", dates: [{ month: 13, day: 1 }] })).toThrow("dates");
  });
});
