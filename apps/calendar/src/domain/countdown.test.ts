import { describe, expect, it } from "vitest";
import { countdownWord, daysUntil, futureEvents, groupEvents, isOver, nextEvents } from "./countdown";
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
const today = "2026-08-10";

describe("daysUntil", () => {
  it("is 0 on the event's day", () => {
    expect(daysUntil(ev({ date: today }), today)).toBe(0);
    expect(daysUntil(ev({ date: today, start: "23:00" }), today)).toBe(0);
  });
  it("is 1 tomorrow and n further out", () => {
    expect(daysUntil(ev({ date: "2026-08-11" }), today)).toBe(1);
    expect(daysUntil(ev({ date: "2026-09-10" }), today)).toBe(31);
  });
  it("is 0 while a multi-day event is in progress", () => {
    const e = ev({ date: "2026-08-08", endDate: "2026-08-12" });
    expect(daysUntil(e, today)).toBe(0);
    expect(daysUntil(e, "2026-08-12")).toBe(0);
    expect(daysUntil(e, "2026-08-07")).toBe(1);
  });
  it("is negative once passed, counting from the last day", () => {
    expect(daysUntil(ev({ date: "2026-08-07" }), today)).toBe(-3);
    expect(daysUntil(ev({ date: "2026-08-01", endDate: "2026-08-08" }), today)).toBe(-2);
  });
  it("is 0 on every day a timed Event runs across", () => {
    const flight = ev({ date: "2026-08-09", start: "22:00", endDate: today, end: "06:00" });
    expect(daysUntil(flight, today)).toBe(0);
    expect(daysUntil(flight, "2026-08-11")).toBe(-1);
  });
  it("leaves out the end day of a timed Event ending at 00:00", () => {
    const late = ev({ date: "2026-08-09", start: "20:00", endDate: today, end: "00:00" });
    expect(daysUntil(late, today)).toBe(-1);
  });
});

describe("isOver", () => {
  it("counts a timed Event as running until its end day and time", () => {
    const flight = ev({ date: "2026-08-09", start: "22:00", endDate: today, end: "06:00" });
    expect(isOver(flight, { date: today, time: "05:59" })).toBe(false);
    expect(isOver(flight, { date: today, time: "06:00" })).toBe(true);
  });
  it("counts a same-day timed Event over once its end time has passed", () => {
    const meeting = ev({ date: today, start: "10:00", end: "11:00" });
    expect(isOver(meeting, { date: today, time: "10:30" })).toBe(false);
    expect(isOver(meeting, { date: today, time: "11:00" })).toBe(true);
  });
  it("counts an Event with no end over once its start has passed", () => {
    const moment = ev({ date: today, start: "10:00" });
    expect(isOver(moment, { date: today, time: "09:59" })).toBe(false);
    expect(isOver(moment, { date: today, time: "10:00" })).toBe(true);
  });
  it("counts an all-day Event as running through its last day", () => {
    const trip = ev({ date: "2026-08-08", endDate: today });
    expect(isOver(trip, { date: today, time: "23:59" })).toBe(false);
    expect(isOver(trip, { date: "2026-08-11", time: "00:00" })).toBe(true);
  });
});

describe("futureEvents", () => {
  it("keeps an overnight Event on its second day until it ends", () => {
    const flight = ev({ id: "flight", date: "2026-08-09", start: "22:00", endDate: today, end: "06:00" });
    expect(futureEvents([flight], { date: today, time: "03:00" }).map((e) => e.id)).toEqual(["flight"]);
    expect(futureEvents([flight], { date: today, time: "07:00" })).toEqual([]);
  });

  it("keeps today, later and in-progress multi-day; drops passed; sorts by date then time", () => {
    const list = [
      ev({ id: "later", date: "2026-08-12" }),
      ev({ id: "passed", date: "2026-08-09" }),
      ev({ id: "timed", date: today, start: "14:00" }),
      ev({ id: "allday", date: today }),
      ev({ id: "multi", date: "2026-08-08", endDate: "2026-08-11" }),
      ev({ id: "oldmulti", date: "2026-08-01", endDate: "2026-08-09" }),
    ];
    expect(futureEvents(list, { date: today, time: "08:00" }).map((e) => e.id)).toEqual(["multi", "allday", "timed", "later"]);
  });
});

describe("nextEvents", () => {
  const list = [
    ev({ id: "c", date: "2026-08-13" }),
    ev({ id: "a", date: "2026-08-11" }),
    ev({ id: "b", date: "2026-08-12" }),
    ev({ id: "x", date: "2026-08-01" }),
  ];
  it("limits to n", () => {
    expect(nextEvents(list, { date: today, time: "08:00" }, 2).map((e) => e.id)).toEqual(["a", "b"]);
    expect(nextEvents(list, { date: today, time: "08:00" }, 10).map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(nextEvents(list, { date: today, time: "08:00" }, 0)).toEqual([]);
  });
});

describe("countdownWord", () => {
  it("names today and tomorrow only", () => {
    expect(countdownWord(0)).toBe("Today");
    expect(countdownWord(1)).toBe("Tomorrow");
    expect(countdownWord(2)).toBeNull();
    expect(countdownWord(-1)).toBeNull();
  });
});

describe("groupEvents", () => {
  const ids = (g: Event[]) => g.map((e) => e.id);
  it("lists an overnight Event under Today on its second day until it ends, then under Past", () => {
    const flight = ev({ id: "flight", date: "2026-08-09", start: "22:00", endDate: today, end: "06:00" });
    const at3 = groupEvents([flight], { date: today, time: "03:00" });
    expect([ids(at3.today), ids(at3.upcoming), ids(at3.past)]).toEqual([["flight"], [], []]);
    const at7 = groupEvents([flight], { date: today, time: "07:00" });
    expect([ids(at7.today), ids(at7.upcoming), ids(at7.past)]).toEqual([[], [], ["flight"]]);
  });
  it("splits the rest into Today, Upcoming and the past 30 days, newest past first", () => {
    const list = [
      ev({ id: "later", date: "2026-08-12" }),
      ev({ id: "done", date: today, start: "07:00", end: "07:30" }),
      ev({ id: "soon", date: today, start: "14:00", end: "15:00" }),
      ev({ id: "trip", date: "2026-08-08", endDate: "2026-08-11" }),
      ev({ id: "yesterday", date: "2026-08-09" }),
      ev({ id: "long ago", date: "2026-07-01" }),
    ];
    const g = groupEvents(list, { date: today, time: "08:00" });
    expect([ids(g.today), ids(g.upcoming), ids(g.past)]).toEqual([["trip", "soon"], ["later"], ["done", "yesterday"]]);
  });
});
