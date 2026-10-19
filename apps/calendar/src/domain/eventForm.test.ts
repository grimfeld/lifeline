import { describe, expect, it } from "vitest";
import { eventFormErrors, type EventForm } from "./eventForm";

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
