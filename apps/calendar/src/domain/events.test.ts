import { describe, expect, it } from "vitest";
import { formatTime } from "@lifeline/core";
import { daysOf, describeTime, describeUntil, eventsOn, rescheduled, spanOf } from "./events";
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

describe("describeUntil", () => {
  it("names the end day on a day the Event doesn't end on", () => {
    const flight = ev({ start: "22:00", endDate: "2026-08-11", end: "06:00" });
    expect(describeUntil(flight, "2026-08-10")).toBe(`until Tue ${formatTime("06:00")}`);
    expect(describeUntil(flight, "2026-08-11")).toBe(`until ${formatTime("06:00")}`);
  });
  it("reads a same-day end, an all-day Event and an Event with no end", () => {
    expect(describeUntil(ev({ start: "09:00", end: "10:00" }), "2026-08-10")).toBe(`until ${formatTime("10:00")}`);
    expect(describeUntil(ev({}), "2026-08-10")).toBe("all day");
    expect(describeUntil(ev({ start: "09:00" }), "2026-08-10")).toBeUndefined();
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

describe("rescheduled", () => {
  const when = (p: Partial<Pick<Event, "date" | "start" | "end">> & { endDate?: string }) => ({ date: "2026-08-10", start: null, end: null, ...p });

  it("keeps the end day a reschedule gives a timed Event", () => {
    const night = rescheduled(ev({ start: "09:00", end: "10:00" }), when({ start: "22:00", endDate: "2026-08-11", end: "06:00" }));
    expect([night.date, night.start, night.endDate, night.end]).toEqual(["2026-08-10", "22:00", "2026-08-11", "06:00"]);
  });

  it("stores no end day for a timed Event that ends on its start day", () => {
    const back = rescheduled(ev({ start: "22:00", endDate: "2026-08-11", end: "06:00" }), when({ date: "2026-08-12", start: "09:00", endDate: "2026-08-12", end: "10:00" }));
    expect([back.date, back.endDate, back.end]).toEqual(["2026-08-12", null, "10:00"]);
  });

  it("keeps how many days an Event covers when it becomes all day with no last day given", () => {
    const allDay = rescheduled(ev({ start: null, endDate: "2026-08-12" }), when({ date: "2026-08-14" }));
    expect([allDay.date, allDay.endDate, allDay.start]).toEqual(["2026-08-14", "2026-08-16", null]);
    const fromNight = rescheduled(ev({ start: "22:00", endDate: "2026-08-11", end: "06:00" }), when({ date: "2026-08-14" }));
    expect([fromNight.endDate, fromNight.end]).toEqual(["2026-08-15", null]);
    const toMidnight = rescheduled(ev({ start: "22:00", endDate: "2026-08-11", end: "00:00" }), when({ date: "2026-08-14" }));
    expect(toMidnight.endDate).toBeNull();
  });

  it("takes an all-day last day when one is given", () => {
    expect(rescheduled(ev({}), when({ date: "2026-08-14", endDate: "2026-08-15" })).endDate).toBe("2026-08-15");
  });
});
