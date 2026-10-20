import { describe, expect, it } from "vitest";
import { bandsIn, bandsOn, blockerSpan, rescheduledBlocker, compareBlockers, describeBlocker, describeWeekdays, isOvernight } from "./blockers";
import type { TimeBlocker } from "./types";
import { formatHuman, type Weekday } from "@lifeline/core";

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
    endDate: null,
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
  it("splits a one-off blocker across the days it covers: first day from its start, middle days whole, last until its end", () => {
    const trip = blocker({ title: "Travelling", date: "2026-08-24", endDate: "2026-08-26", weekdays: [], start: "18:00", end: "09:00" });
    expect(bandsOn(trip, "2026-08-23")).toEqual([]);
    expect(bandsOn(trip, "2026-08-24")).toEqual([{ date: "2026-08-24", start: "18:00", end: "24:00" }]);
    expect(bandsOn(trip, "2026-08-25")).toEqual([{ date: "2026-08-25", start: "00:00", end: "24:00" }]);
    expect(bandsOn(trip, "2026-08-26")).toEqual([{ date: "2026-08-26", start: "00:00", end: "09:00" }]);
    expect(bandsOn(trip, "2026-08-27")).toEqual([]);
  });
  it("keeps a one-off blocker whose end day is its own day on that day, even when the end is earlier than the start", () => {
    // The end day decides, not the times: an explicit same-day end never rolls.
    const prep = blocker({ date: "2026-08-24", endDate: "2026-08-24", weekdays: [], start: "08:00", end: "08:30" });
    expect(bandsIn([prep], { start: "2026-08-23", end: "2026-08-26" }).map((b) => [b.date, b.start, b.end])).toEqual([["2026-08-24", "08:00", "08:30"]]);
  });
  it("gives a one-off blocker ending at 00:00 no band on its end day", () => {
    const late = blocker({ date: "2026-08-24", endDate: "2026-08-25", weekdays: [], start: "22:00", end: "00:00" });
    expect(bandsIn([late], { start: "2026-08-24", end: "2026-08-25" }).map((b) => [b.date, b.start, b.end])).toEqual([["2026-08-24", "22:00", "24:00"]]);
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

describe("blockerSpan", () => {
  it("is a one-off blocker's whole span, its end on the end day", () => {
    expect(blockerSpan(blocker({ date: "2026-08-24", endDate: "2026-08-26", start: "18:00", end: "09:00" }))).toEqual({
      date: "2026-08-24",
      start: "18:00",
      endDate: "2026-08-26",
      end: "09:00",
    });
  });
  it("reads a one-off with no end day the old way: an end at or before the start is the next morning", () => {
    expect(blockerSpan(blocker({ date: "2026-08-24", start: "22:00", end: "02:00" }))).toEqual({ date: "2026-08-24", start: "22:00", endDate: "2026-08-25", end: "02:00" });
    expect(blockerSpan(blocker({ date: "2026-08-24", start: "08:00", end: "09:00" }))?.endDate).toBe("2026-08-24");
  });
  it("is null for a weekly blocker: a rule has no one span", () => {
    expect(blockerSpan(blocker())).toBeNull();
  });
});

describe("rescheduledBlocker", () => {
  const overnight = blocker({ date: "2026-08-24", endDate: "2026-08-25", weekdays: [], start: "22:00", end: "06:00" });
  it("takes the whole new span, end day included", () => {
    expect(rescheduledBlocker(overnight, { date: "2026-08-25", start: "21:00", endDate: "2026-08-26", end: "05:00" })).toEqual({
      date: "2026-08-25",
      start: "21:00",
      endDate: "2026-08-26",
      end: "05:00",
    });
  });
  it("ends on its start day when given no end day", () => {
    expect(rescheduledBlocker(overnight, { date: "2026-08-25", start: "08:00", end: "09:00" })).toEqual({ date: "2026-08-25", start: "08:00", endDate: "2026-08-25", end: "09:00" });
  });
  it("keeps its length when given a start and no end", () => {
    expect(rescheduledBlocker(overnight, { date: "2026-08-25", start: "23:00", end: null })).toEqual({ date: "2026-08-25", start: "23:00", endDate: "2026-08-26", end: "07:00" });
  });
  it("moves by whole days, keeping its hours, when given no start", () => {
    expect(rescheduledBlocker(overnight, { date: "2026-08-27", start: null, end: null })).toEqual({ date: "2026-08-27", start: "22:00", endDate: "2026-08-28", end: "06:00" });
  });
  it("reads an old overnight one-off with no end day as ending the next morning", () => {
    const legacy = blocker({ date: "2026-08-24", weekdays: [], start: "22:00", end: "06:00" });
    expect(rescheduledBlocker(legacy, { date: "2026-08-26", start: null, end: null })).toEqual({ date: "2026-08-26", start: "22:00", endDate: "2026-08-27", end: "06:00" });
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
  it("names a one-off blocker's end day when it ends on another", () => {
    const text = describeBlocker(blocker({ date: "2026-08-24", endDate: "2026-08-26", start: "18:00", end: "09:00" }));
    expect(text).toContain(formatHuman("2026-08-26"));
    expect(text).not.toMatch(/next day/);
  });
});

describe("compareBlockers", () => {
  it("sorts by start time", () => {
    const order = [blocker({ start: "12:00" }), blocker({ start: "07:00" })].sort(compareBlockers).map((b) => b.start);
    expect(order).toEqual(["07:00", "12:00"]);
  });
});
