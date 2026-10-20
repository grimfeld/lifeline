import { describe, expect, it } from "vitest";
import { endDayPicked, eventArgsError, eventFormErrors, lengthOf, newEventWhen, whenOf, withAllDay, withDate, withEnd, withStart, type EventForm } from "./eventForm";

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

  it("an end equal to the start is refused; an end on a later day is not", () => {
    expect(eventFormErrors({ ...ok, allDay: false, start: "10:00", end: "10:00" })).toEqual({ end: "End must be after start" });
    expect(eventFormErrors({ ...ok, allDay: false, start: "22:00", endDate: "2026-08-11", end: "06:00" })).toEqual({});
    expect(eventFormErrors({ ...ok, allDay: false, start: "09:00", endDate: "2026-08-12", end: "17:00" })).toEqual({});
    expect(eventFormErrors({ ...ok, allDay: false, start: "09:00", endDate: "2026-08-09", end: "17:00" })).toEqual({ end: "End must be after start" });
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

  it("a timed event keeps its end day when it ends another day; an empty end means none", () => {
    expect(whenOf({ ...ok, allDay: false, endDate: "2026-08-12", start: "09:00", end: "10:30" })).toEqual({ date: "2026-08-10", endDate: "2026-08-12", start: "09:00", end: "10:30" });
    expect(whenOf({ ...ok, allDay: false, endDate: "2026-08-10", start: "09:00", end: "10:30" })).toEqual({ date: "2026-08-10", endDate: null, start: "09:00", end: "10:30" });
    expect(whenOf({ ...ok, allDay: false, endDate: "2026-08-12", start: "09:00", end: "" })).toEqual({ date: "2026-08-10", endDate: null, start: "09:00", end: null });
    expect(whenOf({ ...ok, allDay: false, start: "09:00", end: "" })).toEqual({ date: "2026-08-10", endDate: null, start: "09:00", end: null });
  });
});

describe("newEventWhen", () => {
  const at = (hm: string) => new Date(`2026-08-10T${hm}:00`);

  it("today starts at the next quarter hour and lasts an hour", () => {
    expect(newEventWhen("2026-08-10", at("10:07"))).toEqual({ date: "2026-08-10", start: "10:15", endDate: "", end: "11:15" });
    expect(newEventWhen("2026-08-10", at("10:15"))).toEqual({ date: "2026-08-10", start: "10:15", endDate: "", end: "11:15" });
  });

  it("another day starts at 09:00 and lasts an hour", () => {
    expect(newEventWhen("2026-08-12", at("10:07"))).toEqual({ date: "2026-08-12", start: "09:00", endDate: "", end: "10:00" });
    expect(newEventWhen("2026-08-01", at("10:07"))).toEqual({ date: "2026-08-01", start: "09:00", endDate: "", end: "10:00" });
  });

  it("late today it starts on the day and ends the next", () => {
    expect(newEventWhen("2026-08-10", at("23:20"))).toEqual({ date: "2026-08-10", start: "23:30", endDate: "2026-08-11", end: "00:30" });
  });

  it("past the last quarter hour of today it is the start of tomorrow", () => {
    expect(newEventWhen("2026-08-10", at("23:50"))).toEqual({ date: "2026-08-11", start: "00:00", endDate: "", end: "01:00" });
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

  it("an end carried past midnight lands on the next day", () => {
    expect(withStart(timed, "23:00")).toMatchObject({ start: "23:00", endDate: "2026-08-11", end: "00:30" });
  });

  it("an overnight or multi-day event keeps its length, and comes back to one day when it fits", () => {
    const night = { ...timed, start: "22:00", endDate: "2026-08-11", end: "06:00" };
    expect(withStart(night, "23:00")).toMatchObject({ start: "23:00", endDate: "2026-08-11", end: "07:00" });
    expect(withStart(night, "08:00")).toMatchObject({ start: "08:00", endDate: "", end: "16:00" });
    const conference = { ...timed, start: "09:00", endDate: "2026-08-12", end: "17:00" };
    expect(withStart(conference, "10:00")).toMatchObject({ start: "10:00", endDate: "2026-08-12", end: "18:00" });
  });
});

describe("withEnd", () => {
  const timed = { ...ok, allDay: false, start: "22:00", end: "23:00" };

  it("an end earlier than the start rolls to the next day", () => {
    expect(withEnd(timed, "06:00")).toMatchObject({ endDate: "2026-08-11", end: "06:00" });
  });

  it("an end after the start stays on the day, and comes back from the next", () => {
    expect(withEnd(timed, "23:30")).toMatchObject({ endDate: "", end: "23:30" });
    expect(withEnd({ ...timed, endDate: "2026-08-11", end: "06:00" }, "23:30")).toMatchObject({ endDate: "", end: "23:30" });
  });

  it("an end equal to the start stays on the day, to be refused", () => {
    expect(withEnd(timed, "22:00")).toMatchObject({ endDate: "", end: "22:00" });
  });

  it("an end day picked further off is kept", () => {
    const conference = { ...timed, start: "09:00", endDate: "2026-08-12", end: "17:00" };
    expect(withEnd(conference, "08:00")).toMatchObject({ endDate: "2026-08-12", end: "08:00" });
    const nextDayLater = { ...timed, start: "09:00", endDate: "2026-08-11", end: "17:00" };
    expect(withEnd(nextDayLater, "18:00")).toMatchObject({ endDate: "2026-08-11", end: "18:00" });
  });
});

describe("withDate", () => {
  it("moving the day moves the end day with it", () => {
    const night = { ...ok, allDay: false, start: "22:00", endDate: "2026-08-11", end: "06:00" };
    expect(withDate(night, "2026-08-14")).toMatchObject({ date: "2026-08-14", endDate: "2026-08-15" });
    expect(withDate({ ...night, endDate: "" }, "2026-08-14")).toMatchObject({ date: "2026-08-14", endDate: "" });
  });

  it("an all-day event's last day stays where it is", () => {
    expect(withDate({ ...ok, endDate: "2026-08-12" }, "2026-08-11")).toMatchObject({ date: "2026-08-11", endDate: "2026-08-12" });
  });
});

describe("withAllDay", () => {
  it("an overnight event made all day runs to its end day; a timed one made from all day is on one day", () => {
    const night = { ...ok, allDay: false, start: "22:00", endDate: "2026-08-11", end: "06:00" };
    expect(withAllDay(night, true)).toMatchObject({ allDay: true, endDate: "2026-08-11" });
    expect(withAllDay({ ...ok, endDate: "2026-08-12" }, false)).toMatchObject({ allDay: false, endDate: "" });
  });
});

describe("lengthOf", () => {
  it("is the minutes from the start to the end", () => {
    expect(lengthOf({ start: "10:00", end: "11:30" })).toBe(90);
    expect(lengthOf({ start: "10:00", end: "10:00" })).toBe(0);
  });

  it("counts the days between, for an end another day", () => {
    expect(lengthOf({ date: "2026-08-10", start: "22:00", endDate: "2026-08-11", end: "06:00" })).toBe(8 * 60);
    expect(lengthOf({ date: "2026-08-10", start: "09:00", endDate: "2026-08-12", end: "17:00" })).toBe(56 * 60);
  });

  it("is null when either is missing or the end is before the start", () => {
    expect(lengthOf({ start: "10:00", end: "" })).toBeNull();
    expect(lengthOf({ start: "", end: "10:00" })).toBeNull();
    expect(lengthOf({ start: "10:00", end: "09:00" })).toBeNull();
  });
});

describe("eventArgsError", () => {
  const day = "2026-08-10";

  it("takes a timed Event that ends another day, by the same rule as the form", () => {
    expect(eventArgsError({ date: day, start: "22:00", endDate: "2026-08-11", end: "06:00" })).toBeNull();
    expect(eventArgsError({ date: day, start: "09:00", endDate: "2026-08-12", end: "17:00" })).toBeNull();
    expect(eventArgsError({ date: day, start: "09:00", end: "10:00" })).toBeNull();
  });

  it("refuses an end that is not after the start", () => {
    expect(eventArgsError({ date: day, start: "10:00", end: "10:00" })).toBe("End must be after start");
    expect(eventArgsError({ date: day, start: "22:00", end: "06:00" })).toBe("End must be after start");
    expect(eventArgsError({ date: day, start: "09:00", endDate: "2026-08-09", end: "17:00" })).toBe("End must be after start");
  });

  it("refuses an end without a start, an end day without an end, and an all-day last day before the first", () => {
    expect(eventArgsError({ date: day, end: "10:00" })).toBe("An end time needs a start time");
    expect(eventArgsError({ date: day, start: "09:00", endDate: "2026-08-11" })).toBe("An end day needs an end time");
    expect(eventArgsError({ date: day, endDate: "2026-08-09" })).toBe("Last day is before the first");
    expect(eventArgsError({ date: day, endDate: "2026-08-12" })).toBeNull();
  });
});

describe("endDayPicked", () => {
  const timed = { date: "2026-08-10", start: "22:00", endDate: "", end: "23:00" };
  it("is false for an end on the day or rolled to the next", () => {
    expect(endDayPicked(timed)).toBe(false);
    expect(endDayPicked({ ...timed, endDate: "2026-08-11", end: "06:00" })).toBe(false);
  });
  it("is true for an end day rolling would not give", () => {
    expect(endDayPicked({ ...timed, endDate: "2026-08-12", end: "06:00" })).toBe(true);
    expect(endDayPicked({ ...timed, start: "09:00", endDate: "2026-08-11", end: "17:00" })).toBe(true);
  });
});
