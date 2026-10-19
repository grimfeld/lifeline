import { describe, expect, it } from "vitest";
import { eventFormErrors, whenOf, type EventForm } from "./eventForm";

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
