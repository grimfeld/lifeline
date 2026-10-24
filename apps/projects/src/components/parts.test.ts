import { describe, expect, it } from "vitest";
import { deadlineText, formatMinutes } from "./parts";

describe("deadlineText", () => {
  const today = "2026-10-23";
  it("reads a Deadline against today", () => {
    expect(deadlineText("2026-10-23", today)).toEqual({ text: "Due today", late: false });
    expect(deadlineText("2026-10-24", today)).toEqual({ text: "Due tomorrow", late: false });
    expect(deadlineText("2026-11-02", today)).toEqual({ text: "Due in 10 days", late: false });
    expect(deadlineText("2026-10-22", today)).toEqual({ text: "1 day late", late: true });
    expect(deadlineText("2026-10-01", today)).toEqual({ text: "22 days late", late: true });
  });

  it("counts whole days across a clock change", () => {
    // Europe and America leave summer time between these two days.
    expect(deadlineText("2026-11-05", today).text).toBe("Due in 13 days");
  });
});

describe("formatMinutes", () => {
  it("writes minutes, hours, or both", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatMinutes(200)).toBe("3 h 20 min");
  });
});
