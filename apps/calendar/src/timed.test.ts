import { describe, expect, it } from "vitest";
import { timedItemsOf } from "./timed";
import type { Event, TimeBlocker } from "./domain/types";

const event = (p: Partial<Event>) =>
  ({ id: "e", type: "event", title: "Night flight", notes: "", tags: [], date: "2026-08-10", endDate: null, start: "22:00", end: "06:00", ...p }) as unknown as Event;

const blocker = (p: Partial<TimeBlocker>) =>
  ({ id: "b", type: "time_blocker", title: "Travelling", tags: [], date: "2026-08-10", endDate: null, weekdays: [], start: "18:00", end: "09:00", color: null, active: true, ...p }) as unknown as TimeBlocker;

describe("timedItemsOf", () => {
  it("reports a one-off blocker across days as one movable band per day, each carrying the whole span", () => {
    const items = timedItemsOf([], [blocker({ endDate: "2026-08-12" })], { start: "2026-08-09", end: "2026-08-16" });
    const span = { date: "2026-08-10", start: "18:00", endDate: "2026-08-12", end: "09:00" };
    expect(items.map((i) => ({ date: i.date, start: i.start, end: i.end, background: i.background, fixed: i.fixed, span: i.span }))).toEqual([
      { date: "2026-08-10", start: "18:00", end: "24:00", background: true, fixed: false, span },
      { date: "2026-08-11", start: "00:00", end: "24:00", background: true, fixed: false, span },
      { date: "2026-08-12", start: "00:00", end: "09:00", background: true, fixed: false, span },
    ]);
  });

  it("reports a weekly blocker's bands fixed, with no span", () => {
    const items = timedItemsOf([], [blocker({ date: null, start: "23:00", end: "07:00" })], { start: "2026-08-10", end: "2026-08-10" });
    expect(items.map((i) => [i.start, i.end, i.fixed, i.span])).toEqual([
      ["00:00", "07:00", true, undefined],
      ["23:00", "24:00", true, undefined],
    ]);
  });

  it("reports a timed Event that runs across days as one piece per day, each carrying the whole span", () => {
    const items = timedItemsOf([event({ endDate: "2026-08-11" })], [], { start: "2026-08-09", end: "2026-08-16" });
    const span = { date: "2026-08-10", start: "22:00", endDate: "2026-08-11", end: "06:00" };
    expect(items.map((i) => ({ key: i.key, date: i.date, start: i.start, end: i.end, span: i.span }))).toEqual([
      { key: "calendar/e@2026-08-10", date: "2026-08-10", start: "22:00", end: "24:00", span },
      { key: "calendar/e@2026-08-11", date: "2026-08-11", start: "00:00", end: "06:00", span },
    ]);
  });

  it("reports only the pieces in range, a multi-day Event's middle days whole", () => {
    const conference = event({ start: "09:00", endDate: "2026-08-12", end: "17:00" });
    const items = timedItemsOf([conference], [], { start: "2026-08-11", end: "2026-08-11" });
    expect(items.map((i) => [i.date, i.start, i.end])).toEqual([["2026-08-11", "00:00", "24:00"]]);
  });

  it("keeps a one-day Event whole, with its span", () => {
    const [item] = timedItemsOf([event({ start: "09:00", end: "10:00" })], [], { start: "2026-08-10", end: "2026-08-10" });
    expect([item?.start, item?.end, item?.span]).toEqual(["09:00", "10:00", { date: "2026-08-10", start: "09:00", endDate: "2026-08-10", end: "10:00" }]);
  });

  it("reports an all-day Event on each day, with no span", () => {
    const items = timedItemsOf([event({ start: null, end: null, endDate: "2026-08-11" })], [], { start: "2026-08-10", end: "2026-08-16" });
    expect(items.map((i) => [i.date, i.start, i.span])).toEqual([
      ["2026-08-10", null, undefined],
      ["2026-08-11", null, undefined],
    ]);
  });
});
