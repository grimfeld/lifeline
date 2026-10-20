import { describe, expect, it } from "vitest";
import { eventFormErrors, lengthOf, newEventWhen, whenOf, withStart, type EventForm } from "./eventForm";

const ok: EventForm = { title: "Dentist", date: "2026-08-10", endDate: "", allDay: true, start: "09:00", end: "10:00" };

describe("eventFormErrors", () => {
  it("a complete form has no errors", () => {
    expect(eventFormErrors(ok)).toEqual({});
  });

  it("a blank title is required", () => {
    expect(eventFormErrors({ ...ok, title: "   " })).toEqual({ title: "Title required" });
  });

  it("a missing day is required", () => {
    expect(eventFormErrors({ ...ok, date: "" })).toEqual({ date: "Day required" });
  });

  it("a timed event needs a start, and its end after it", () => {
    expect(eventFormErrors({ ...ok, allDay: false, start: "" })).toEqual({ start: "Start time required" });
    expect(eventFormErrors({ ...ok, allDay: false, start: "10:00", end: "09:30" })).toEqual({ end: "End must be after start" });
    expect(eventFormErrors({ ...ok, allDay: false, start: "10:00", end: "" })).toEqual({});
  });

  it("an all-day event ignores the times; its last day can't be before the first", () => {
    expect(eventFormErrors({ ...ok, start: "", end: "08:00" })).toEqual({});
    expect(eventFormErrors({ ...ok, endDate: "2026-08-09" })).toEqual({ endDate: "End day must be after the first day" });
    expect(eventFormErrors({ ...ok, endDate: "2026-08-12" })).toEqual({});
  });

  it("reports every wrong field at once", () => {
    expect(eventFormErrors({ ...ok, title: "", date: "", allDay: false, start: "" })).toEqual({
      title: "Title required",
      date: "Day required",
      start: "Start time required",
    });
  });
});

describe("whenOf", () => {
  it("an all-day event has no times, and a last day only when it runs past the first", () => {
    expect(whenOf({ ...ok, start: "09:00", end: "10:00" })).toEqual({ date: "2026-08-10", endDate: null, start: null, end: null });
    expect(whenOf({ ...ok, endDate: "2026-08-12" })).toEqual({ date: "2026-08-10", endDate: "2026-08-12", start: null, end: null });
    expect(whenOf({ ...ok, endDate: "2026-08-10" })).toEqual({ date: "2026-08-10", endDate: null, start: null, end: null });
  });

  it("a timed event is on one day; an empty end means none", () => {
    expect(whenOf({ ...ok, allDay: false, endDate: "2026-08-12", start: "09:00", end: "10:30" })).toEqual({ date: "2026-08-10", endDate: null, start: "09:00", end: "10:30" });
    expect(whenOf({ ...ok, allDay: false, start: "09:00", end: "" })).toEqual({ date: "2026-08-10", endDate: null, start: "09:00", end: null });
  });
});

describe("newEventWhen", () => {
  const at = (hm: string) => new Date(`2026-08-10T${hm}:00`);

  it("today starts at the next quarter hour and lasts an hour", () => {
    expect(newEventWhen("2026-08-10", at("10:07"))).toEqual({ date: "2026-08-10", start: "10:15", end: "11:15" });
    expect(newEventWhen("2026-08-10", at("10:15"))).toEqual({ date: "2026-08-10", start: "10:15", end: "11:15" });
  });

  it("another day starts at 09:00 and lasts an hour", () => {
    expect(newEventWhen("2026-08-12", at("10:07"))).toEqual({ date: "2026-08-12", start: "09:00", end: "10:00" });
    expect(newEventWhen("2026-08-01", at("10:07"))).toEqual({ date: "2026-08-01", start: "09:00", end: "10:00" });
  });

  it("late today it stays on the day, ending by midnight", () => {
    expect(newEventWhen("2026-08-10", at("23:20"))).toEqual({ date: "2026-08-10", start: "23:30", end: "23:59" });
  });

  it("past the last quarter hour of today it is the start of tomorrow", () => {
    expect(newEventWhen("2026-08-10", at("23:50"))).toEqual({ date: "2026-08-11", start: "00:00", end: "01:00" });
  });
});

describe("withStart", () => {
  const timed = { ...ok, allDay: false, start: "10:00", end: "11:30" };

  it("moving the start moves the end by as much, keeping the length", () => {
    expect(withStart(timed, "13:15")).toMatchObject({ start: "13:15", end: "14:45" });
    expect(withStart(timed, "08:00")).toMatchObject({ start: "08:00", end: "09:30" });
  });

  it("with no end, or no start to measure from, only the start changes", () => {
    expect(withStart({ ...timed, end: "" }, "13:00")).toMatchObject({ start: "13:00", end: "" });
    expect(withStart({ ...timed, start: "" }, "13:00")).toMatchObject({ start: "13:00", end: "11:30" });
    expect(withStart(timed, "")).toMatchObject({ start: "", end: "11:30" });
  });

  it("an end that was before the start stays where it is", () => {
    expect(withStart({ ...timed, end: "09:00" }, "12:00")).toMatchObject({ start: "12:00", end: "09:00" });
  });
});

describe("lengthOf", () => {
  it("is the minutes from the start to the end", () => {
    expect(lengthOf({ start: "10:00", end: "11:30" })).toBe(90);
    expect(lengthOf({ start: "10:00", end: "10:00" })).toBe(0);
  });

  it("is null when either is missing or the end is before the start", () => {
    expect(lengthOf({ start: "10:00", end: "" })).toBeNull();
    expect(lengthOf({ start: "", end: "10:00" })).toBeNull();
    expect(lengthOf({ start: "10:00", end: "09:00" })).toBeNull();
  });
});
