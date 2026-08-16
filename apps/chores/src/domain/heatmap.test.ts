import { describe, expect, it } from "vitest";
import { weekdayOf } from "@lifeline/core";
import { completionsPerDay, heatmapDays } from "./heatmap";
import type { Completion } from "./types";

function done(choreId: string, doneOn: string, id = `${choreId}-${doneOn}`): Completion {
  return { id, choreId, doneOn, recordedAt: `${doneOn}T10:00:00.000Z`, updatedAt: "", deleted: 0 };
}

describe("heatmapDays", () => {
  it("starts on a Monday weeksBack weeks ago and ends on this week's Sunday", () => {
    // 2026-08-12 is a Wednesday
    const days = heatmapDays(12, "2026-08-12");
    expect(days.length).toBe(13 * 7);
    expect(weekdayOf(days[0])).toBe(1); // Monday
    expect(weekdayOf(days[days.length - 1])).toBe(0); // Sunday
    expect(days[0]).toBe("2026-05-18");
    expect(days[days.length - 1]).toBe("2026-08-16");
    expect(days).toContain("2026-08-12");
  });

  it("weeksBack 0 is just the current week", () => {
    expect(heatmapDays(0, "2026-08-16")).toEqual([
      "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13",
      "2026-08-14", "2026-08-15", "2026-08-16",
    ]);
  });
});

describe("completionsPerDay", () => {
  const days = heatmapDays(1, "2026-08-12");
  const all = [
    done("a", "2026-08-12"),
    done("b", "2026-08-12"),
    done("a", "2026-08-03"),
    done("a", "2026-01-01"), // outside window
  ];

  it("buckets by day, only within the window, empty arrays elsewhere", () => {
    const m = completionsPerDay(all, days);
    expect(m.size).toBe(days.length);
    expect(m.get("2026-08-12")?.length).toBe(2);
    expect(m.get("2026-08-03")?.length).toBe(1);
    expect(m.get("2026-08-04")).toEqual([]);
    expect(m.has("2026-01-01")).toBe(false);
  });

  it("filters by choreId", () => {
    const m = completionsPerDay(all, days, "b");
    expect(m.get("2026-08-12")?.map((c) => c.choreId)).toEqual(["b"]);
    expect(m.get("2026-08-03")).toEqual([]);
  });
});
