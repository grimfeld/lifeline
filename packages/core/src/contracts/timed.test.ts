import { describe, expect, it } from "vitest";
import { formatTime } from "./timed";

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
