import { describe, expect, it } from "vitest";
import type { TimedItem } from "@lifeline/core";
import { timedControls, timedAllDay, timedEndingAt, timedNudged, timedOnDay, timedStartingAt, timedWhenOf } from "./timedTiming";

const item = (over: Partial<TimedItem>): TimedItem => ({ key: "calendar/b", appId: "calendar", itemId: "b", title: "Focus", date: "2026-11-10", start: "10:00", end: "11:00", ...over });

describe("a Timed item's timing in the Peek (#538)", () => {
  it("is the whole item, whichever piece was tapped (ADR 0090)", () => {
    const night = item({ date: "2026-11-11", start: "00:00", end: "06:00", span: { date: "2026-11-10", start: "22:00", endDate: "2026-11-11", end: "06:00" } });
    expect(timedWhenOf(night)).toEqual({ date: "2026-11-10", start: "22:00", endDate: "2026-11-11", end: "06:00" });
  });

  it("is the item's own day and hours when it reports no span", () => {
    expect(timedWhenOf(item({}))).toEqual({ date: "2026-11-10", start: "10:00", endDate: "2026-11-10", end: "11:00" });
    expect(timedWhenOf(item({ start: null, end: null }))).toEqual({ date: "2026-11-10", start: null, endDate: "2026-11-10", end: null });
  });

  it("moves its start by a nudge, keeping its length, across midnight too", () => {
    const w = { date: "2026-11-10", start: "23:30", endDate: "2026-11-11", end: "00:30" };
    expect(timedNudged(w, 15)).toEqual({ date: "2026-11-10", start: "23:45", endDate: "2026-11-11", end: "00:45" });
    expect(timedNudged({ date: "2026-11-10", start: "10:00", endDate: "2026-11-10", end: "11:00" }, -15)).toEqual({ date: "2026-11-10", start: "09:45", endDate: "2026-11-10", end: "10:45" });
  });

  it("takes a new start keeping its length", () => {
    expect(timedStartingAt({ date: "2026-11-10", start: "10:00", endDate: "2026-11-10", end: "11:30" }, "14:00")).toEqual({ date: "2026-11-10", start: "14:00", endDate: "2026-11-10", end: "15:30" });
  });

  it("rolls an End earlier than its Start to the next day (ADR 0090)", () => {
    expect(timedEndingAt({ date: "2026-11-10", start: "22:00", endDate: "2026-11-10", end: "23:00" }, "06:00")).toEqual({ date: "2026-11-10", start: "22:00", endDate: "2026-11-11", end: "06:00" });
  });

  it("moves to another day with its end day", () => {
    expect(timedOnDay({ date: "2026-11-10", start: "22:00", endDate: "2026-11-11", end: "06:00" }, "2026-11-12")).toEqual({ date: "2026-11-12", start: "22:00", endDate: "2026-11-13", end: "06:00" });
  });

  it("goes all day on its start day", () => {
    expect(timedAllDay({ date: "2026-11-10", start: "22:00", endDate: "2026-11-11", end: "06:00" })).toEqual({ date: "2026-11-10", start: null, endDate: "2026-11-10", end: null });
  });
});

describe("what a Timed item's timing section lets the user do", () => {
  it("retimes it where its App reschedules", () => {
    expect(timedControls({}, { reschedule: true, move: true })).toBe("retime");
    expect(timedControls({}, { reschedule: true, move: false })).toBe("retime");
  });
  it("moves it to another day only where its App moves but does not reschedule (a Deadline)", () => {
    expect(timedControls({}, { reschedule: false, move: true })).toBe("day");
  });
  it("is read-only where its App does neither, and for a weekly blocker's rule", () => {
    expect(timedControls({}, { reschedule: false, move: false })).toBe("none");
    expect(timedControls({ fixed: true }, { reschedule: true, move: true })).toBe("none");
  });
});
