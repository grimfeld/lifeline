import { describe, expect, it } from "vitest";
import { formatTime, type TimedSpan } from "@lifeline/core";
import { describeBeside, followedSpan } from "./attached";

const span = (date: string, start: string, endDate: string, end: string): TimedSpan => ({ date, start, endDate, end });

// 2026-08-24 is a Monday.
describe("followedSpan", () => {
  it.each([
    {
      case: "an Event moved an hour later takes its before band an hour later, keeping gap and length",
      old: span("2026-08-24", "09:00", "2026-08-24", "10:00"),
      now: span("2026-08-24", "10:00", "2026-08-24", "11:00"),
      band: span("2026-08-24", "08:15", "2026-08-24", "08:45"),
      side: "before" as const,
      want: span("2026-08-24", "09:15", "2026-08-24", "09:45"),
    },
    {
      case: "an Event moved to another day takes its after band to that day",
      old: span("2026-08-24", "09:00", "2026-08-24", "10:00"),
      now: span("2026-08-27", "09:00", "2026-08-27", "10:00"),
      band: span("2026-08-24", "10:00", "2026-08-24", "10:30"),
      side: "after" as const,
      want: span("2026-08-27", "10:00", "2026-08-27", "10:30"),
    },
    {
      case: "a longer Event leaves its before band where it is",
      old: span("2026-08-24", "09:00", "2026-08-24", "10:00"),
      now: span("2026-08-24", "09:00", "2026-08-24", "11:00"),
      band: span("2026-08-24", "08:30", "2026-08-24", "09:00"),
      side: "before" as const,
      want: span("2026-08-24", "08:30", "2026-08-24", "09:00"),
    },
    {
      case: "a longer Event pushes its after band by as much",
      old: span("2026-08-24", "09:00", "2026-08-24", "10:00"),
      now: span("2026-08-24", "09:00", "2026-08-24", "11:00"),
      band: span("2026-08-24", "10:15", "2026-08-24", "10:45"),
      side: "after" as const,
      want: span("2026-08-24", "11:15", "2026-08-24", "11:45"),
    },
    {
      case: "an earlier start pulls the before band by as much",
      old: span("2026-08-24", "09:00", "2026-08-24", "10:00"),
      now: span("2026-08-24", "08:00", "2026-08-24", "10:00"),
      band: span("2026-08-24", "08:30", "2026-08-24", "09:00"),
      side: "before" as const,
      want: span("2026-08-24", "07:30", "2026-08-24", "08:00"),
    },
    {
      case: "an earlier start leaves the after band where it is",
      old: span("2026-08-24", "09:00", "2026-08-24", "10:00"),
      now: span("2026-08-24", "08:00", "2026-08-24", "10:00"),
      band: span("2026-08-24", "10:00", "2026-08-24", "10:30"),
      side: "after" as const,
      want: span("2026-08-24", "10:00", "2026-08-24", "10:30"),
    },
    {
      case: "a before band moved past midnight ends at 00:00 the next day (ADR 0090)",
      old: span("2026-08-24", "22:30", "2026-08-24", "23:30"),
      now: span("2026-08-25", "00:30", "2026-08-25", "01:30"),
      band: span("2026-08-24", "22:00", "2026-08-24", "22:30"),
      side: "before" as const,
      want: span("2026-08-25", "00:00", "2026-08-25", "00:30"),
    },
    {
      case: "a before band that runs across midnight keeps doing so",
      old: span("2026-08-25", "00:30", "2026-08-25", "01:30"),
      now: span("2026-08-26", "00:15", "2026-08-26", "01:00"),
      band: span("2026-08-24", "23:45", "2026-08-25", "00:15"),
      side: "before" as const,
      want: span("2026-08-25", "23:30", "2026-08-26", "00:00"),
    },
    {
      case: "an overnight Event moved two days takes its after band to its new end day",
      old: span("2026-08-24", "22:00", "2026-08-25", "06:00"),
      now: span("2026-08-26", "22:00", "2026-08-27", "06:00"),
      band: span("2026-08-25", "06:00", "2026-08-25", "06:30"),
      side: "after" as const,
      want: span("2026-08-27", "06:00", "2026-08-27", "06:30"),
    },
    {
      case: "a multi-day Event made a day longer pushes its after band a day",
      old: span("2026-08-24", "09:00", "2026-08-26", "17:00"),
      now: span("2026-08-24", "09:00", "2026-08-27", "17:00"),
      band: span("2026-08-26", "17:00", "2026-08-26", "19:00"),
      side: "after" as const,
      want: span("2026-08-27", "17:00", "2026-08-27", "19:00"),
    },
    {
      case: "a band whose gap was set by hand keeps that gap",
      old: span("2026-08-24", "09:00", "2026-08-24", "10:00"),
      now: span("2026-08-24", "14:00", "2026-08-24", "15:00"),
      band: span("2026-08-24", "07:45", "2026-08-24", "08:30"),
      side: "before" as const,
      want: span("2026-08-24", "12:45", "2026-08-24", "13:30"),
    },
    {
      case: "a band dragged past its Event keeps its side: a before band still follows the start",
      old: span("2026-08-24", "09:00", "2026-08-24", "10:00"),
      now: span("2026-08-24", "09:00", "2026-08-24", "12:00"),
      band: span("2026-08-24", "10:30", "2026-08-24", "11:00"),
      side: "before" as const,
      want: span("2026-08-24", "10:30", "2026-08-24", "11:00"),
    },
  ])("$case", ({ old, now, band, side, want }) => {
    expect(followedSpan(old, now, band, side)).toEqual(want);
  });
});

describe("describeBeside", () => {
  it("gives a band on its Event's day its times only", () => {
    expect(describeBeside(span("2026-08-24", "08:30", "2026-08-24", "09:00"), "2026-08-24")).toBe(`${formatTime("08:30")} – ${formatTime("09:00")}`);
  });

  it("names the day of a band that starts the day before its Event", () => {
    expect(describeBeside(span("2026-08-23", "23:30", "2026-08-24", "00:15"), "2026-08-24")).toBe(`Sun ${formatTime("23:30")} – Mon ${formatTime("00:15")}`);
  });

  it("names the end day of an after band that runs past midnight", () => {
    expect(describeBeside(span("2026-08-24", "23:45", "2026-08-25", "00:15"), "2026-08-24")).toBe(`${formatTime("23:45")} – Tue ${formatTime("00:15")}`);
  });
});
