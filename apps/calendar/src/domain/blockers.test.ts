import { describe, expect, it } from "vitest";
import { bandsIn, bandsOn, compareBlockers, describeBlocker, describeWeekdays, isOvernight } from "./blockers";
import type { TimeBlocker } from "./types";
import type { Weekday } from "@lifeline/core";

function blocker(over: Partial<TimeBlocker> = {}): TimeBlocker {
  return {
    id: "b1",
    type: "time_blocker",
    title: "Work",
    tags: [],
    folder: "",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01T00:00:00Z",
    deleted: 0,
    date: null,
    weekdays: [1, 2, 3, 4, 5] as Weekday[],
    start: "09:00",
    end: "17:00",
    color: null,
    active: true,
    ...over,
  } as TimeBlocker;
}

// 2026-08-24 is a Monday, 2026-08-29 a Saturday.
describe("bandsOn", () => {
  it("paints the covered weekdays only", () => {
    expect(bandsOn(blocker(), "2026-08-24")).toEqual([{ date: "2026-08-24", start: "09:00", end: "17:00" }]);
    expect(bandsOn(blocker(), "2026-08-29")).toEqual([]);
  });
  it("treats no weekdays as every day", () => {
    expect(bandsOn(blocker({ weekdays: [] }), "2026-08-29")).toHaveLength(1);
  });
  it("paints nothing when switched off", () => {
    expect(bandsOn(blocker({ active: false }), "2026-08-24")).toEqual([]);
  });
  it("splits an overnight band across midnight", () => {
    const sleep = blocker({ title: "Sleep", weekdays: [], start: "23:00", end: "07:00" });
    expect(bandsOn(sleep, "2026-08-24")).toEqual([
      { date: "2026-08-24", start: "00:00", end: "07:00" },
      { date: "2026-08-24", start: "23:00", end: "24:00" },
    ]);
  });
  it("carries an overnight tail onto the day after a covered one", () => {
    const sleep = blocker({ weekdays: [5] as Weekday[], start: "23:00", end: "07:00" }); // Friday nights
    // Friday: the evening half. Saturday: only the morning tail.
    expect(bandsOn(sleep, "2026-08-28")).toEqual([{ date: "2026-08-28", start: "23:00", end: "24:00" }]);
    expect(bandsOn(sleep, "2026-08-29")).toEqual([{ date: "2026-08-29", start: "00:00", end: "07:00" }]);
    expect(bandsOn(sleep, "2026-08-30")).toEqual([]);
  });
  it("paints a one-off blocker on its day only, whatever the weekdays say (ADR 0029)", () => {
    const travel = blocker({ title: "Travel", date: "2026-08-29", weekdays: [1] as Weekday[], start: "08:00", end: "08:30" });
    expect(bandsOn(travel, "2026-08-29")).toEqual([{ date: "2026-08-29", start: "08:00", end: "08:30" }]);
    expect(bandsOn(travel, "2026-08-24")).toEqual([]);
    expect(bandsOn(travel, "2026-09-05")).toEqual([]);
  });
  it("carries a one-off overnight tail onto the next day", () => {
    const flight = blocker({ date: "2026-08-24", weekdays: [], start: "22:00", end: "02:00" });
    expect(bandsOn(flight, "2026-08-24")).toEqual([{ date: "2026-08-24", start: "22:00", end: "24:00" }]);
    expect(bandsOn(flight, "2026-08-25")).toEqual([{ date: "2026-08-25", start: "00:00", end: "02:00" }]);
  });
  it("leaves no tail when the band just reaches midnight", () => {
    expect(bandsOn(blocker({ weekdays: [], start: "22:00", end: "00:00" }), "2026-08-25")).toEqual([
      { date: "2026-08-25", start: "22:00", end: "24:00" },
    ]);
  });
});

describe("bandsIn", () => {
  it("covers every day of the range", () => {
    const bands = bandsIn([blocker()], { start: "2026-08-24", end: "2026-08-30" });
    expect(bands.map((b) => b.date)).toEqual(["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"]);
    expect(bands.every((b) => b.blocker.title === "Work")).toBe(true);
  });
});

describe("isOvernight", () => {
  it("is true when the end is at or before the start", () => {
    expect(isOvernight({ start: "23:00", end: "07:00" })).toBe(true);
    expect(isOvernight({ start: "09:00", end: "17:00" })).toBe(false);
  });
});

describe("describeWeekdays", () => {
  it("names the common runs", () => {
    expect(describeWeekdays([])).toBe("Every day");
    expect(describeWeekdays([1, 2, 3, 4, 5] as Weekday[])).toBe("Weekdays");
    expect(describeWeekdays([6, 0] as Weekday[])).toBe("Weekends");
    expect(describeWeekdays([0, 3] as Weekday[])).toBe("Wed, Sun");
  });
});

describe("describeBlocker", () => {
  it("says when it repeats and marks a band crossing midnight", () => {
    expect(describeBlocker(blocker())).toMatch(/^Weekdays · /);
    expect(describeBlocker(blocker({ start: "23:00", end: "07:00" }))).toMatch(/\(next day\)$/);
  });
});

describe("compareBlockers", () => {
  it("sorts by start time", () => {
    const order = [blocker({ start: "12:00" }), blocker({ start: "07:00" })].sort(compareBlockers).map((b) => b.start);
    expect(order).toEqual(["07:00", "12:00"]);
  });
});
