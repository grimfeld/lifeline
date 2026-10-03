import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { capturedClock, capturedDay } from "./data";

// A zone where the evening is already tomorrow in UTC.
beforeAll(() => {
  vi.stubEnv("TZ", "America/New_York");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

describe("captured day and clock", () => {
  it("are local, not UTC", () => {
    expect(capturedDay("2026-10-04T02:30:00.000Z")).toBe("2026-10-03");
    expect(capturedClock("2026-10-04T02:30:00.000Z")).toBe("22:30");
  });
  it("are null for a missing capture time", () => {
    expect(capturedDay("")).toBeNull();
    expect(capturedClock("undefined")).toBeNull();
  });
});
