import { describe, expect, it } from "vitest";
import type { SurfaceItem, SurfaceTimedItem, TimedTemplate } from "@lifeline/core";
import { HOUR_PX, addHours, bandsOn, durationOf, entriesByDay, hourLabel, landingHours, lengthOf, resizedEnd, slotHours, stripOn, templateLength, weekdayName } from "./scheduleGrid";

const work = (over: Partial<SurfaceItem> = {}): SurfaceItem => ({ key: "tasks/a", appId: "tasks", itemId: "a", title: "Write", date: "2026-10-23", urgency: "none", displayDate: "2026-10-23", ...over });
const timed = (over: Partial<SurfaceTimedItem> = {}): SurfaceTimedItem => ({ key: "calendar/e", appId: "calendar", itemId: "e", title: "Dentist", date: "2026-10-23", start: "10:00", end: "11:00", ...over });
const template = (durationMin: number | null): TimedTemplate => ({ key: "calendar/t", appId: "calendar", id: "t", title: "Gym", durationMin, defaultStart: null });

describe("durationOf", () => {
  it("is the hours between start and end", () => {
    expect(durationOf("09:00", "10:30")).toBe(1.5);
  });

  it("is at least one quarter hour", () => {
    expect(durationOf("09:00", "09:00")).toBe(0.25);
    expect(durationOf("10:00", "09:00")).toBe(0.25);
  });

  it("falls back to a block's default length, or the one given, with no end", () => {
    expect(durationOf("09:00", null)).toBe(0.5);
    expect(durationOf("09:00", undefined, 60)).toBe(1);
  });
});

describe("addHours", () => {
  it("adds hours to a clock time", () => {
    expect(addHours("09:15", 0.5)).toBe("09:45");
  });

  it("stops at midnight", () => {
    expect(addHours("23:30", 1)).toBe("24:00");
  });
});

/** A bottom edge dragged on the grid (ADR 0015): the end moves by the pixels dragged, on quarter hours. */
describe("resizedEnd", () => {
  it("moves the end by the hours dragged, snapped to a quarter", () => {
    expect(resizedEnd(9, 10, HOUR_PX)).toBe(11);
    expect(resizedEnd(9, 10, HOUR_PX / 2 + 3)).toBe(10.5);
  });

  it("never ends before a quarter hour after the start", () => {
    expect(resizedEnd(9, 10, -5 * HOUR_PX)).toBe(9.25);
  });
});

describe("slotHours", () => {
  it("adds at the quarter hour the click falls in", () => {
    // Row 3 from 7:00 is 10:00; 40 minutes in is the 10:30 quarter.
    expect(slotHours(7, 23, 3, (40 / 60) * HOUR_PX)).toBe(10.5);
    expect(slotHours(7, 23, 3, 0)).toBe(10);
  });

  it("starts no later than a quarter hour before the end of the hours shown", () => {
    expect(slotHours(7, 23, 15, HOUR_PX - 1)).toBe(22.75);
  });
});

describe("landingHours", () => {
  it("lands on the quarter hour nearest the lifted top", () => {
    expect(landingHours(2 * HOUR_PX + 0.3 * HOUR_PX, 7, 23)).toBe(9.25);
  });

  it("stays inside the hours shown", () => {
    expect(landingHours(-200, 7, 23)).toBe(7);
    expect(landingHours(100 * HOUR_PX, 7, 23)).toBe(22.75);
  });
});

describe("lengthOf", () => {
  it("is a template's duration, or null for an all-day one", () => {
    expect(lengthOf({ template: template(90) })).toBe(1.5);
    expect(lengthOf({ template: template(null) })).toBeNull();
  });

  it("is a block's own length, or the default for an untimed chip", () => {
    expect(lengthOf({ item: work({ start: "09:00", end: "11:00" }) })).toBe(2);
    expect(lengthOf({ item: work() })).toBe(0.5);
  });

  it("is a timed item's own length, an hour when it has no end or no time", () => {
    expect(lengthOf({ timed: timed({ start: "09:00", end: "09:45" }) })).toBe(0.75);
    expect(lengthOf({ timed: timed({ end: null }) })).toBe(1);
    expect(lengthOf({ timed: timed({ start: null, end: null }) })).toBe(1);
  });

  it("is null for nothing lifted", () => {
    expect(lengthOf({})).toBeNull();
  });
});

/** Day splitting: what each day column draws on its hours. */
describe("entriesByDay", () => {
  it("puts a block on its display day and a timed item, or a piece of one, on its own day", () => {
    const block = work({ start: "09:00", end: "10:00", displayDate: "2026-10-24", placementId: "p1" });
    const late = timed({ key: "calendar/n", start: "22:00", end: "24:00" });
    const early = timed({ key: "calendar/n", date: "2026-10-24", start: "00:00", end: "06:00" });
    const days = entriesByDay([block], [late, early]);
    expect(days.get("2026-10-23")).toEqual([{ kind: "timed", item: late, start: "22:00", end: "24:00" }]);
    expect(days.get("2026-10-24")).toEqual([
      { kind: "block", item: block, start: "09:00", end: "10:00" },
      { kind: "timed", item: early, start: "00:00", end: "06:00" },
    ]);
  });

  it("gives an end-less block the default length and an end-less timed item an hour", () => {
    const days = entriesByDay([work({ start: "09:00", end: null })], [timed({ start: "14:00", end: null })]);
    expect(days.get("2026-10-23")!.map((e) => [e.start, e.end])).toEqual([
      ["09:00", "09:30"],
      ["14:00", "15:00"],
    ]);
  });

  it("has no entry for a day with nothing on it", () => {
    expect(entriesByDay([], []).size).toBe(0);
  });
});

describe("bandsOn", () => {
  it("is the day's blocker bands, a weekly one fixed, an end-less one to midnight", () => {
    const weekly = timed({ key: "calendar/w", background: true, fixed: true, start: "12:00", end: "13:00" });
    const oneOff = timed({ key: "calendar/o", background: true, start: "18:00", end: null, color: "red" });
    const other = timed({ key: "calendar/x", background: true, date: "2026-10-24" });
    expect(bandsOn([weekly, oneOff, other], "2026-10-23")).toEqual([
      { key: "calendar/w", title: "Dentist", start: "12:00", end: "13:00", color: undefined, fixed: true, item: weekly },
      { key: "calendar/o", title: "Dentist", start: "18:00", end: "24:00", color: "red", fixed: false, item: oneOff },
    ]);
  });
});

describe("stripOn", () => {
  it("is the day's untimed work and all-day items, not its blocks or timed items", () => {
    const chip = work();
    const block = work({ key: "tasks/b", start: "09:00" });
    const elsewhere = work({ key: "tasks/c", displayDate: "2026-10-24" });
    const allDay = timed({ key: "calendar/a", start: null, end: null });
    const atTen = timed();
    expect(stripOn([chip, block, elsewhere], [allDay, atTen], "2026-10-23")).toEqual({ work: [chip], allDay: [allDay] });
  });
});

describe("templateLength", () => {
  it("says all day, minutes under an hour, and hours to a tenth past it", () => {
    expect(templateLength(null)).toBe("all day");
    expect(templateLength(45)).toBe("45m");
    expect(templateLength(60)).toBe("1h");
    expect(templateLength(100)).toBe("1.7h");
  });
});

describe("weekdayName", () => {
  it("names the day, Monday first, whatever the time zone", () => {
    expect(weekdayName("2026-10-19")).toBe("Mon");
    expect(weekdayName("2026-10-23")).toBe("Fri");
    expect(weekdayName("2026-10-25")).toBe("Sun");
  });
});

describe("hourLabel", () => {
  it("labels the hour asked for, not one shifted by the time zone", () => {
    // "1:00 PM" / "13:00" with room, "1 PM" / "13 h" on a phone, depending on the locale.
    expect(hourLabel(13, false)).toMatch(/\b(1|13)\b/);
    expect(hourLabel(13, false)).toMatch(/00/);
    expect(hourLabel(13, true)).toMatch(/\b(1|13)\b/);
    expect(hourLabel(13, true)).not.toMatch(/00/);
  });
});
