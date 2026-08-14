import { describe, expect, it } from "vitest";
import { addDays, clampedDate, diffDays, weekdayOf } from "@lifeline/core";
import {
  dueCountsByDay,
  dueDate,
  dueState,
  nextPatternDateOnOrAfter,
} from "./schedule";
import type { Chore, Schedule } from "./types";

function chore(overrides: Partial<Chore> & { schedule: Schedule }): Chore {
  return {
    id: "c1",
    updatedAt: "2026-07-01T00:00:00.000Z",
    deleted: 0 as const,
    name: "Test chore",
    category: null,
    status: "active",
    anchorDate: null,
    createdAt: "2026-07-01",
    ...overrides,
  };
}

describe("date utils", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("diffs days", () => {
    expect(diffDays("2026-07-01", "2026-07-08")).toBe(7);
    expect(diffDays("2026-07-08", "2026-07-01")).toBe(-7);
  });

  it("knows weekdays", () => {
    // 2026-07-29 is a Wednesday
    expect(weekdayOf("2026-07-29")).toBe(3);
  });

  it("clamps day-of-month to month length", () => {
    expect(clampedDate(2026, 2, 31)).toBe("2026-02-28");
    expect(clampedDate(2028, 2, 31)).toBe("2028-02-29"); // leap year
    expect(clampedDate(2026, 4, 31)).toBe("2026-04-30");
  });
});

describe("nextPatternDateOnOrAfter", () => {
  it("weekly: finds the next matching weekday, including today", () => {
    const mondays: Schedule = { kind: "weekly", weekdays: [1] };
    // 2026-07-27 is a Monday
    expect(nextPatternDateOnOrAfter(mondays as never, "2026-07-27")).toBe(
      "2026-07-27",
    );
    expect(nextPatternDateOnOrAfter(mondays as never, "2026-07-28")).toBe(
      "2026-08-03",
    );
  });

  it("weekly: supports multiple weekdays", () => {
    const monThu: Schedule = { kind: "weekly", weekdays: [1, 4] };
    // From Wednesday 2026-07-29 the next hit is Thursday
    expect(nextPatternDateOnOrAfter(monThu as never, "2026-07-29")).toBe(
      "2026-07-30",
    );
  });

  it("monthly: this month if not yet passed, else next month, clamped", () => {
    const s: Schedule = { kind: "monthly", dayOfMonth: 31 };
    expect(nextPatternDateOnOrAfter(s as never, "2026-01-15")).toBe(
      "2026-01-31",
    );
    expect(nextPatternDateOnOrAfter(s as never, "2026-02-01")).toBe(
      "2026-02-28",
    );
    expect(nextPatternDateOnOrAfter(s as never, "2026-12-31")).toBe(
      "2026-12-31",
    );
  });

  it("yearly: clamps Feb 29 in non-leap years", () => {
    const s: Schedule = { kind: "yearly", month: 2, day: 29 };
    expect(nextPatternDateOnOrAfter(s as never, "2026-01-01")).toBe(
      "2026-02-28",
    );
    expect(nextPatternDateOnOrAfter(s as never, "2028-01-01")).toBe(
      "2028-02-29",
    );
  });
});

describe("dueDate — interval", () => {
  const water = chore({
    schedule: { kind: "interval", days: 7 },
    anchorDate: "2026-07-10",
  });

  it("fresh chore is due on its anchor date", () => {
    expect(dueDate(water, null)).toBe("2026-07-10");
  });

  it("after a completion, due = last done + interval", () => {
    expect(dueDate(water, "2026-07-12")).toBe("2026-07-19");
  });

  it("completing late shifts the next due date", () => {
    expect(dueDate(water, "2026-07-25")).toBe("2026-08-01");
  });

  it("resume re-anchor: a newer anchor beats the last completion", () => {
    const resumed = { ...water, anchorDate: "2026-09-01" };
    expect(dueDate(resumed, "2026-07-12")).toBe("2026-09-01");
  });

  it("falls back to creation date without anchor or completions", () => {
    const bare = chore({ schedule: { kind: "interval", days: 3 } });
    expect(dueDate(bare, null)).toBe("2026-07-01");
  });
});

describe("dueDate — calendar", () => {
  const trash = chore({ schedule: { kind: "weekly", weekdays: [1] } }); // Mondays, created Wed 2026-07-01

  it("never completed: due at first pattern date on/after creation", () => {
    expect(dueDate(trash, null)).toBe("2026-07-06"); // first Monday after Jul 1
  });

  it("done on the due day: due again next occurrence", () => {
    expect(dueDate(trash, "2026-07-06")).toBe("2026-07-13");
  });

  it("missed occurrences collapse to one overdue date", () => {
    // Last done Jul 6; three Mondays missed by Jul 28 — still one due date, Jul 13
    expect(dueDate(trash, "2026-07-06")).toBe("2026-07-13");
    const state = dueState(trash, "2026-07-06", "2026-07-28");
    expect(state).toEqual({
      state: "overdue",
      dueOn: "2026-07-13",
      daysLate: 15,
    });
  });

  it("completed late: one completion resolves, next due is next pattern date", () => {
    // Overdue Monday Jul 13 done on Tuesday Jul 21 → next due Monday Jul 27
    expect(dueDate(trash, "2026-07-21")).toBe("2026-07-27");
  });

  it("paused and archived chores are never due", () => {
    expect(dueDate({ ...trash, status: "paused" }, "2026-07-06")).toBeNull();
    expect(dueDate({ ...trash, status: "archived" }, "2026-07-06")).toBeNull();
  });
});

describe("dueState", () => {
  const c = chore({
    schedule: { kind: "interval", days: 7 },
    anchorDate: "2026-07-10",
  });

  it("due today", () => {
    expect(dueState(c, null, "2026-07-10")).toEqual({
      state: "due-today",
      dueOn: "2026-07-10",
    });
  });

  it("upcoming with days until", () => {
    expect(dueState(c, null, "2026-07-08")).toEqual({
      state: "upcoming",
      dueOn: "2026-07-10",
      daysUntil: 2,
    });
  });

  it("overdue with days late", () => {
    expect(dueState(c, null, "2026-07-13")).toEqual({
      state: "overdue",
      dueOn: "2026-07-10",
      daysLate: 3,
    });
  });

  it("paused chore is not scheduled", () => {
    expect(dueState({ ...c, status: "paused" }, null, "2026-07-13")).toEqual({
      state: "not-scheduled",
    });
  });
});

describe("dueCountsByDay", () => {
  it("counts chores pending on each day, overdue included", () => {
    const a = chore({
      id: "a",
      schedule: { kind: "interval", days: 7 },
      anchorDate: "2026-07-01", // overdue by start
    });
    const b = chore({
      id: "b",
      schedule: { kind: "weekly", weekdays: [1] },
      createdAt: "2026-07-07",
    }); // due Monday 2026-07-13
    const paused = chore({
      id: "p",
      status: "paused",
      schedule: { kind: "interval", days: 2 },
      anchorDate: "2026-07-01",
    });

    const counts = dueCountsByDay(
      [
        { chore: a, lastDoneOn: null },
        { chore: b, lastDoneOn: null },
        { chore: paused, lastDoneOn: null },
      ],
      "2026-07-12",
      3,
    );
    expect(counts).toEqual([
      { date: "2026-07-12", count: 1 }, // a overdue
      { date: "2026-07-13", count: 2 }, // + b due Monday
      { date: "2026-07-14", count: 2 },
    ]);
  });
});
