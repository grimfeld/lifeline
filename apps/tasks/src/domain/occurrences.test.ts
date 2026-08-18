import { describe, expect, it } from "vitest";
import { deriveItems, describeRecurrence, parseItemId, sourceDatesInRange } from "./occurrences";
import type { Weekday } from "@lifeline/core";
import type { OccurrenceOverride, Task } from "./types";

const base = { updatedAt: "2026-01-01T00:00:00.000Z", deleted: 0 as const, notes: "" };

function oneTime(id: string, date: string | null, extra: Partial<Task> = {}): Task {
  return {
    ...base,
    id,
    title: id,
    status: "active",
    date,
    completedOn: null,
    recurrence: null,
    createdAt: "2026-01-01",
    ...extra,
  };
}

function weekly(id: string, weekdays: number[], extra: Partial<Task> = {}): Task {
  return {
    ...base,
    id,
    title: id,
    status: "active",
    date: null,
    completedOn: null,
    recurrence: { kind: "weekly", weekdays: weekdays as Weekday[] },
    createdAt: "2026-01-01",
    ...extra,
  };
}

function ov(taskId: string, sourceDate: string, p: Partial<OccurrenceOverride>): OccurrenceOverride {
  return { ...base, id: `${taskId}${sourceDate}`, taskId, sourceDate, movedTo: null, completedOn: null, ...p };
}

// 2026-08-10 is a Monday; week = 10..16
const week = { start: "2026-08-10", end: "2026-08-16" };

describe("parseItemId", () => {
  it("splits occurrence ids and passes one-time ids through", () => {
    expect(parseItemId("abc")).toEqual({ taskId: "abc", sourceDate: null });
    expect(parseItemId("abc|2026-08-10")).toEqual({ taskId: "abc", sourceDate: "2026-08-10" });
  });
});

describe("sourceDatesInRange", () => {
  it("emits the weekdays inside the range, Monday=1 … Sunday=0", () => {
    expect(sourceDatesInRange(weekly("w", [1, 0]), week.start, week.end)).toEqual([
      "2026-08-10",
      "2026-08-16",
    ]);
  });
  it("never generates before createdAt", () => {
    expect(
      sourceDatesInRange(weekly("w", [1, 2, 3, 4, 5, 6, 0], { createdAt: "2026-08-14" }), week.start, week.end),
    ).toEqual(["2026-08-14", "2026-08-15", "2026-08-16"]);
  });
});

describe("monthly / yearly recurrence", () => {
  const monthly = (days: number[], createdAt = "2026-01-01"): Task => ({ ...weekly("m", []), recurrence: { kind: "monthly", days }, createdAt });
  const yearly = (dates: { month: number; day: number }[], createdAt = "2025-01-01"): Task => ({ ...weekly("y", []), recurrence: { kind: "yearly", dates }, createdAt });
  it("monthly emits each day of month, clamped to the month's length", () => {
    expect(sourceDatesInRange(monthly([1, 31]), "2026-02-01", "2026-03-31")).toEqual(["2026-02-01", "2026-02-28", "2026-03-01", "2026-03-31"]);
  });
  it("monthly respects range bounds and createdAt", () => {
    expect(sourceDatesInRange(monthly([15], "2026-08-20"), "2026-08-01", "2026-09-30")).toEqual(["2026-09-15"]);
    expect(sourceDatesInRange(monthly([15]), "2026-08-16", "2026-08-31")).toEqual([]);
  });
  it("yearly emits the dates in range, clamping Feb 29 in non-leap years", () => {
    expect(sourceDatesInRange(yearly([{ month: 2, day: 29 }, { month: 12, day: 25 }]), "2025-01-01", "2026-12-31")).toEqual(["2025-02-28", "2025-12-25", "2026-02-28", "2026-12-25"]);
  });
  it("describes them", () => {
    expect(describeRecurrence({ kind: "monthly", days: [15, 1] })).toBe("Monthly on the 1st, 15th");
    expect(describeRecurrence({ kind: "yearly", dates: [{ month: 12, day: 25 }, { month: 3, day: 2 }] })).toBe("Yearly on Mar 2, Dec 25");
    expect(describeRecurrence({ kind: "weekly", weekdays: [1, 3] })).toBe("Weekly on Mon, Wed");
  });
});

describe("deriveItems", () => {
  it("shows one-time tasks on their day, unassigned ones with date null, and hides archived", () => {
    const items = deriveItems(
      [oneTime("a", "2026-08-12"), oneTime("b", null), oneTime("c", "2026-09-01"), oneTime("d", "2026-08-12", { status: "archived" })],
      [],
      week,
    );
    expect(items.map((i) => [i.itemId, i.date])).toEqual([
      ["b", null],
      ["a", "2026-08-12"],
    ]);
  });

  it("materialises recurring occurrences with per-occurrence completion", () => {
    const items = deriveItems(
      [weekly("w", [1, 3])],
      [ov("w", "2026-08-10", { completedOn: "2026-08-10" })],
      week,
    );
    expect(items.map((i) => [i.itemId, i.date, i.completedOn])).toEqual([
      ["w|2026-08-10", "2026-08-10", "2026-08-10"],
      ["w|2026-08-12", "2026-08-12", null],
    ]);
  });

  it("shows a moved occurrence on its new day only, and pulls in ones moved from outside the range", () => {
    const items = deriveItems(
      [weekly("w", [1])],
      [
        ov("w", "2026-08-10", { movedTo: "2026-08-13" }),
        ov("w", "2026-08-03", { movedTo: "2026-08-11" }), // from previous week
        ov("w", "2026-08-17", { movedTo: "2026-08-24" }), // irrelevant
      ],
      week,
    );
    expect(items.map((i) => [i.itemId, i.date, i.moved])).toEqual([
      ["w|2026-08-03", "2026-08-11", true],
      ["w|2026-08-10", "2026-08-13", true],
    ]);
  });

  it("drops occurrences moved out of the range", () => {
    const items = deriveItems([weekly("w", [1])], [ov("w", "2026-08-10", { movedTo: "2026-08-20" })], week);
    expect(items).toEqual([]);
  });
});
