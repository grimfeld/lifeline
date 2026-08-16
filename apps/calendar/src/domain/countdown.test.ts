import { describe, expect, it } from "vitest";
import { countdownWord, daysUntil, futureEvents, nextEvents } from "./countdown";
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
  it("ignores endDate on timed events", () => {
    expect(daysUntil(ev({ date: "2026-08-05", endDate: "2026-08-20", start: "10:00" }), today)).toBe(-5);
  });
});

describe("futureEvents", () => {
  it("keeps today, later and in-progress multi-day; drops passed; sorts by date then time", () => {
    const list = [
      ev({ id: "later", date: "2026-08-12" }),
      ev({ id: "passed", date: "2026-08-09" }),
      ev({ id: "timed", date: today, start: "14:00" }),
      ev({ id: "allday", date: today }),
      ev({ id: "multi", date: "2026-08-08", endDate: "2026-08-11" }),
      ev({ id: "oldmulti", date: "2026-08-01", endDate: "2026-08-09" }),
    ];
    expect(futureEvents(list, today).map((e) => e.id)).toEqual(["multi", "allday", "timed", "later"]);
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
    expect(nextEvents(list, today, 2).map((e) => e.id)).toEqual(["a", "b"]);
    expect(nextEvents(list, today, 10).map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(nextEvents(list, today, 0)).toEqual([]);
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
