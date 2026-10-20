import { describe, expect, it } from "vitest";
import { formatTime } from "@lifeline/core";
import { daysOf, describeTime, eventsOn, spanOf } from "./events";
import type { Event } from "./types";

function ev(p: Partial<Event>): Event {
  return {
    id: "e",
    type: "event",
    updatedAt: "",
    deleted: 0,
    title: "t",
    tags: [],
    folder: "",
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
  it("a timed event covers each day to its end day", () => {
    expect(daysOf(ev({ start: "22:00", endDate: "2026-08-11", end: "06:00" }), range)).toEqual(["2026-08-10", "2026-08-11"]);
    expect(daysOf(ev({ start: "09:00", endDate: "2026-08-12", end: "17:00" }), range)).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
    expect(daysOf(ev({ date: "2026-08-09", start: "22:00", endDate: "2026-08-10", end: "06:00" }), range)).toEqual(["2026-08-10"]);
  });
  it("a timed event ending at 00:00 is not on its end day", () => {
    expect(daysOf(ev({ start: "22:00", endDate: "2026-08-11", end: "00:00" }), range)).toEqual(["2026-08-10"]);
  });
  it("a timed event with text that is no time still shows on its day", () => {
    expect(daysOf(ev({ start: "soon", endDate: "later", end: "whenever" }), range)).toEqual(["2026-08-10"]);
  });
});

describe("describeTime", () => {
  it("labels all-day and multi-day", () => {
    expect(describeTime(ev({}))).toBe("All day");
    expect(describeTime(ev({ endDate: "2026-08-12" }))).toBe("All day · 3 days");
  });
  it("names the end day of a timed event that ends another day", () => {
    expect(describeTime(ev({ start: "22:00", endDate: "2026-08-11", end: "06:00" }))).toBe(`${formatTime("22:00")} – Tue ${formatTime("06:00")}`);
    expect(describeTime(ev({ start: "09:00", end: "10:00" }))).toBe(`${formatTime("09:00")} – ${formatTime("10:00")}`);
  });
});

describe("spanOf", () => {
  it("is a timed event's whole span; its own day when it ends the same day", () => {
    expect(spanOf(ev({ start: "22:00", endDate: "2026-08-11", end: "06:00" }))).toEqual({ date: "2026-08-10", start: "22:00", endDate: "2026-08-11", end: "06:00" });
    expect(spanOf(ev({ start: "09:00", end: "10:00" }))).toEqual({ date: "2026-08-10", start: "09:00", endDate: "2026-08-10", end: "10:00" });
  });
  it("is none for an all-day event", () => {
    expect(spanOf(ev({ endDate: "2026-08-12" }))).toBeNull();
  });
});

describe("eventsOn", () => {
  it("picks single-day, spanning and timed events for the day, all-day first then by start", () => {
    const later = ev({ id: "b", title: "b", start: "14:00" });
    const early = ev({ id: "a", title: "a", start: "09:00" });
    const span = ev({ id: "s", title: "s", date: "2026-08-08", endDate: "2026-08-11" });
    const other = ev({ id: "o", title: "o", date: "2026-08-11" });
    const overnight = ev({ id: "t", title: "t", start: "22:00", endDate: "2026-08-11", end: "06:00" });
    const all = [later, other, span, early, overnight];
    expect(eventsOn(all, "2026-08-10").map((e) => e.id)).toEqual(["s", "a", "b", "t"]);
    expect(eventsOn(all, "2026-08-11").map((e) => e.id)).toEqual(["s", "t", "o"]);
    expect(eventsOn(all, "2026-08-12")).toEqual([]);
  });
});
