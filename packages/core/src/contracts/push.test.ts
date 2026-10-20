import { describe, expect, it } from "vitest";
import { freeStretch, planPush, spanMinutes, type TakenSpan } from "./push";

const D = "2026-09-23";
const D1 = "2026-09-24";

describe("freeStretch", () => {
  it("takes the first gap long enough, starting on the grid", () => {
    const taken: TakenSpan[] = [
      { date: D, start: "09:00", end: "10:00" },
      { date: D, start: "10:30", end: "12:00" },
    ];
    expect(freeStretch(taken, { date: D, time: "09:10" }, 45)).toEqual({ date: D, start: "12:00", end: "12:45" });
  });

  it("fits a gap exactly the Estimate, not one a minute short", () => {
    const exact: TakenSpan[] = [
      { date: D, start: "09:00", end: "10:00" },
      { date: D, start: "10:30", end: "12:00" },
    ];
    expect(freeStretch(exact, { date: D, time: "09:00" }, 30)?.start).toBe("10:00");
    const short: TakenSpan[] = [
      { date: D, start: "09:00", end: "10:00" },
      { date: D, start: "10:29", end: "12:00" },
    ];
    expect(freeStretch(short, { date: D, time: "09:00" }, 30)?.start).toBe("12:00");
  });

  it("rounds the start and every restart up to the quarter hour", () => {
    expect(freeStretch([], { date: D, time: "14:01" }, 30)).toEqual({ date: D, start: "14:15", end: "14:45" });
    const taken: TakenSpan[] = [{ date: D, start: "14:00", end: "14:50" }];
    expect(freeStretch(taken, { date: D, time: "14:00" }, 30)?.start).toBe("15:00");
  });

  it("merges overlapping spans", () => {
    const taken: TakenSpan[] = [
      { date: D, start: "09:00", end: "11:00" },
      { date: D, start: "10:00", end: "10:30" },
      { date: D, start: "10:45", end: "12:00" },
    ];
    expect(freeStretch(taken, { date: D, time: "09:00" }, 60)?.start).toBe("12:00");
  });

  it("reads an end-less span as the Schedule's default length", () => {
    const taken: TakenSpan[] = [{ date: D, start: "09:00", end: null }];
    expect(freeStretch(taken, { date: D, time: "09:00" }, 15)?.start).toBe("09:30");
  });

  it("rolls to the next day from midnight, around an overnight band", () => {
    const taken: TakenSpan[] = [
      { date: D, start: "22:00", end: "24:00" },
      { date: D1, start: "00:00", end: "07:00" },
    ];
    expect(freeStretch(taken, { date: D, time: "21:30" }, 60)).toEqual({ date: D1, start: "07:00", end: "08:00" });
  });

  it("takes every piece of a multi-day Event, as its App reports them", () => {
    const D2 = "2026-09-25";
    const conference: TakenSpan[] = [
      { date: D, start: "09:00", end: "24:00" },
      { date: D1, start: "00:00", end: "24:00" },
      { date: D2, start: "00:00", end: "17:00" },
    ];
    expect(freeStretch(conference, { date: D, time: "08:00" }, 120)).toEqual({ date: D2, start: "17:00", end: "19:00" });
  });

  it("never crosses midnight", () => {
    expect(freeStretch([], { date: D, time: "23:30" }, 60)).toEqual({ date: D1, start: "00:00", end: "01:00" });
  });

  it("gives up after the horizon", () => {
    const full = (date: string): TakenSpan => ({ date, start: "00:00", end: "24:00" });
    expect(freeStretch([full(D), full(D1)], { date: D, time: "00:00" }, 30, { horizonDays: 2 })).toBeNull();
    expect(freeStretch([full(D)], { date: D, time: "00:00" }, 30, { horizonDays: 2 })?.date).toBe(D1);
  });
});

describe("spanMinutes", () => {
  it("measures a block, an end-less one, and one reaching midnight", () => {
    expect(spanMinutes({ start: "09:00", end: "10:15" })).toBe(75);
    expect(spanMinutes({ start: "09:00", end: null })).toBe(30);
    expect(spanMinutes({ start: "23:00", end: "24:00" })).toBe(60);
  });
});

describe("planPush", () => {
  const base = { itemDate: D, blocks: [], estimateMin: 45, today: D, now: "10:07" };

  it("makes a new block of the Estimate from now", () => {
    expect(planPush(base)).toEqual({ from: { date: D, time: "10:07" }, minutes: 45 });
  });

  it("starts from the item's own day when it is still ahead", () => {
    expect(planPush({ ...base, itemDate: "2026-09-26" })).toEqual({ from: { date: "2026-09-26", time: "00:00" }, minutes: 45 });
  });

  it("starts from now for an overdue or unassigned item", () => {
    expect(planPush({ ...base, itemDate: "2026-09-20" }).from).toEqual({ date: D, time: "10:07" });
    expect(planPush({ ...base, itemDate: null }).from).toEqual({ date: D, time: "10:07" });
  });

  it("pushes the earliest block ahead from its end, at its own length", () => {
    const blocks = [
      { id: "late", date: D1, start: "09:00", end: "10:00" },
      { id: "soon", date: D, start: "14:00", end: "15:30" },
      { id: "past", date: D, start: "08:00", end: "09:00" },
    ];
    expect(planPush({ ...base, blocks })).toEqual({ from: { date: D, time: "15:30" }, minutes: 90, blockId: "soon" });
  });

  it("pushes a block already under way from now", () => {
    const blocks = [{ id: "now", date: D, start: "10:00", end: "11:00" }];
    expect(planPush({ ...base, blocks })).toEqual({ from: { date: D, time: "10:07" }, minutes: 60, blockId: "now" });
  });

  it("ignores blocks that have ended", () => {
    const blocks = [{ id: "done", date: D, start: "09:00", end: "10:00" }];
    expect(planPush({ ...base, blocks }).blockId).toBeUndefined();
  });
});
