import { afterAll, describe, expect, it, vi } from "vitest";
import { dotGridWeeks } from "./aggregate";

// West of UTC on purpose: a "YYYY-MM-DD" parsed by `new Date` is UTC midnight,
// which is the evening before here — the DotGrid's weekday came out one early.
vi.stubEnv("TZ", "America/New_York");
afterAll(() => {
  vi.unstubAllEnvs();
});

describe("dotGridWeeks", () => {
  it("starts each column on a Monday, whatever the time zone", () => {
    // 2026-08-13 is a Thursday; its week starts Monday 2026-08-10.
    const weeks = dotGridWeeks(new Set(["2026-08-13"]), "2026-08-13", "2026-08-19");
    expect(weeks.map((w) => w[0]?.day)).toEqual(["2026-08-10", "2026-08-17"]);
    expect(weeks[0]?.map((c) => c.state)).toEqual(["pad", "pad", "pad", "marked", "empty", "empty", "empty"]);
  });
});
