import { describe, expect, it } from "vitest";
import { readSchedule } from "./readSchedule";

describe("readSchedule", () => {
  it("reads each kind", () => {
    expect(readSchedule({ kind: "weekly", weekdays: [6, 0, 6] })).toEqual({ kind: "weekly", weekdays: [0, 6] });
    expect(readSchedule({ kind: "monthly", dayOfMonth: 31 })).toEqual({ kind: "monthly", dayOfMonth: 31 });
    expect(readSchedule({ kind: "yearly", month: 4, day: 1 })).toEqual({ kind: "yearly", month: 4, day: 1 });
    expect(readSchedule({ kind: "interval", days: 14 })).toEqual({ kind: "interval", days: 14 });
  });

  it("refuses shapes the due rules cannot read", () => {
    expect(() => readSchedule(undefined)).toThrow("kind must be");
    expect(() => readSchedule({ kind: "weekly", weekdays: [] })).toThrow("weekdays");
    expect(() => readSchedule({ kind: "monthly", dayOfMonth: 0 })).toThrow("dayOfMonth");
    expect(() => readSchedule({ kind: "interval", days: 0.5 })).toThrow("days");
  });
});
