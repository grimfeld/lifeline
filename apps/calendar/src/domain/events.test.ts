import { describe, expect, it } from "vitest";
import { daysOf, describeTime, eventsOn } from "./events";
import type { Event } from "./types";

function ev(p: Partial<Event>): Event {
  return {
    id: "e",
    updatedAt: "",
    deleted: 0,
    title: "t",
    notes: "",
    date: "2026-08-10",
    endDate: null,
    start: null,
    end: null,
    createdAt: "2026-08-01",
    ...p,
  };
}
const range = { start: "2026-08-10", end: "2026-08-16" };

describe("daysOf", () => {
  it("single-day events occupy one day", () => {
    expect(daysOf(ev({ start: "09:00" }), range)).toEqual(["2026-08-10"]);
  });
  it("all-day spans are clamped to the range", () => {
    expect(daysOf(ev({ date: "2026-08-08", endDate: "2026-08-11" }), range)).toEqual(["2026-08-10", "2026-08-11"]);
    expect(daysOf(ev({ date: "2026-08-20", endDate: "2026-08-22" }), range)).toEqual([]);
  });
  it("ignores endDate on timed events", () => {
    expect(daysOf(ev({ start: "09:00", endDate: "2026-08-12" }), range)).toEqual(["2026-08-10"]);
  });
});

describe("describeTime", () => {
  it("labels all-day and multi-day", () => {
    expect(describeTime(ev({}))).toBe("All day");
    expect(describeTime(ev({ endDate: "2026-08-12" }))).toBe("All day · 3 days");
  });
});

describe("eventsOn", () => {
  it("picks single-day, spanning and timed events for the day, all-day first then by start", () => {
    const later = ev({ id: "b", title: "b", start: "14:00" });
    const early = ev({ id: "a", title: "a", start: "09:00" });
    const span = ev({ id: "s", title: "s", date: "2026-08-08", endDate: "2026-08-11" });
    const other = ev({ id: "o", title: "o", date: "2026-08-11" });
    const timedWithEndDate = ev({ id: "t", title: "t", start: "08:00", endDate: "2026-08-12" });
    const all = [later, other, span, early, timedWithEndDate];
    expect(eventsOn(all, "2026-08-10").map((e) => e.id)).toEqual(["s", "t", "a", "b"]);
    expect(eventsOn(all, "2026-08-11").map((e) => e.id)).toEqual(["s", "o"]);
    expect(eventsOn(all, "2026-08-12")).toEqual([]);
  });
});
