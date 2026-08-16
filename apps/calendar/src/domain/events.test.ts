import { describe, expect, it } from "vitest";
import { daysOf, describeTime } from "./events";
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
