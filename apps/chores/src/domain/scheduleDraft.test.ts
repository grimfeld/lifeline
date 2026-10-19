import { describe, expect, it } from "vitest";
import { draftOf, scheduleOf } from "./scheduleDraft";

describe("a Schedule being edited", () => {
  it("starts from the Chore's schedule, or weekly on Monday for a new one", () => {
    expect(draftOf({ kind: "monthly", dayOfMonth: 15 })).toMatchObject({ kind: "monthly", dayOfMonth: 15 });
    expect(draftOf(undefined)).toMatchObject({ kind: "weekly", weekdays: [1] });
  });

  it("reads back as the Schedule of the kind picked, keeping what the other kinds held", () => {
    const d = { ...draftOf({ kind: "weekly", weekdays: [3, 1] }), kind: "interval" as const, intervalDays: 10 };
    expect(scheduleOf(d)).toEqual({ ok: true, schedule: { kind: "interval", days: 10 } });
    expect(scheduleOf({ ...d, kind: "weekly" })).toEqual({ ok: true, schedule: { kind: "weekly", weekdays: [1, 3] } });
  });

  it("is not a Schedule while half typed", () => {
    expect(scheduleOf({ ...draftOf(undefined), weekdays: [] })).toEqual({ ok: false, error: "Pick at least one weekday" });
    expect(scheduleOf({ ...draftOf({ kind: "monthly", dayOfMonth: 1 }), dayOfMonth: 0 }).ok).toBe(false);
    expect(scheduleOf({ ...draftOf({ kind: "yearly", month: 1, day: 1 }), month: 13 }).ok).toBe(false);
    expect(scheduleOf({ ...draftOf({ kind: "interval", days: 7 }), intervalDays: 0 }).ok).toBe(false);
  });
});
