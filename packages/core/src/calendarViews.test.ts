import { describe, expect, it } from "vitest";
import { stepView, upcomingRuns, viewDays } from "./calendarViews";

// 2026-10-15 is a Thursday.
const THU = "2026-10-15";

describe("the days a Calendar view shows", () => {
  it("starts 3 Day on the day in view, not on a week boundary", () => {
    expect(viewDays("3day", THU)).toEqual(["2026-10-15", "2026-10-16", "2026-10-17"]);
  });

  it("shows the Monday-started week holding the day", () => {
    const week = viewDays("week", THU);
    expect(week).toHaveLength(7);
    expect(week[0]).toBe("2026-10-12");
    expect(week[6]).toBe("2026-10-18");
  });

  it("lays Month out as six weeks from the week holding the 1st", () => {
    const grid = viewDays("month", THU);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-09-28");
    expect(grid).toContain("2026-10-31");
  });
});

describe("paging a Calendar view", () => {
  it("moves Day by one, 3 Day by three, Week by seven", () => {
    expect(stepView("day", THU, 1)).toBe("2026-10-16");
    expect(stepView("3day", THU, 1)).toBe("2026-10-18");
    expect(stepView("3day", THU, -1)).toBe("2026-10-12");
    expect(stepView("week", THU, -1)).toBe("2026-10-08");
  });

  it("moves Month by a month, keeping the day and clamping it", () => {
    expect(stepView("month", THU, 1)).toBe("2026-11-15");
    expect(stepView("month", "2026-01-31", 1)).toBe("2026-02-28");
    expect(stepView("month", "2026-01-10", -1)).toBe("2025-12-10");
    expect(stepView("month", "2026-12-10", 1)).toBe("2027-01-10");
  });
});

describe("Upcoming's runs of days", () => {
  const busy = new Set(["2026-10-15", "2026-10-19"]);

  it("folds a stretch of empty days into one line", () => {
    expect(upcomingRuns("2026-10-15", "2026-10-20", (d) => busy.has(d))).toEqual([
      { kind: "day", date: "2026-10-15" },
      { kind: "empty", from: "2026-10-16", to: "2026-10-18" },
      { kind: "day", date: "2026-10-19" },
      { kind: "empty", from: "2026-10-20", to: "2026-10-20" },
    ]);
  });

  it("always shows a kept day in full, even with nothing on", () => {
    expect(upcomingRuns("2026-10-16", "2026-10-18", () => false, ["2026-10-17"])).toEqual([
      { kind: "empty", from: "2026-10-16", to: "2026-10-16" },
      { kind: "day", date: "2026-10-17" },
      { kind: "empty", from: "2026-10-18", to: "2026-10-18" },
    ]);
  });

  it("breaks an empty run at the month's end, so each month keeps its heading", () => {
    expect(upcomingRuns("2026-10-30", "2026-11-02", () => false)).toEqual([
      { kind: "empty", from: "2026-10-30", to: "2026-10-31" },
      { kind: "empty", from: "2026-11-01", to: "2026-11-02" },
    ]);
  });
});
