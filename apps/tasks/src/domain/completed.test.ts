import { describe, expect, it } from "vitest";
import { completedInRange, dayLabel, groupByDay } from "./completed";
import type { OccurrenceOverride, Task } from "./types";

const base = { updatedAt: "2026-01-01T00:00:00.000Z", deleted: 0 as const, notes: "" };

function oneTime(id: string, completedOn: string | null, extra: Partial<Task> = {}): Task {
  return {
    ...base,
    id,
    title: id,
    status: "active",
    date: completedOn,
    completedOn,
    recurrence: null,
    createdAt: "2026-01-01",
    ...extra,
  };
}

function weekly(id: string, extra: Partial<Task> = {}): Task {
  return {
    ...base,
    id,
    title: id,
    status: "active",
    date: null,
    completedOn: null,
    recurrence: { kind: "weekly", weekdays: [1, 3] },
    createdAt: "2026-01-01",
    ...extra,
  };
}

function ov(taskId: string, sourceDate: string, p: Partial<OccurrenceOverride>): OccurrenceOverride {
  return { ...base, id: `${taskId}${sourceDate}`, taskId, sourceDate, movedTo: null, completedOn: null, ...p };
}

describe("completedInRange", () => {
  it("includes both range boundaries and excludes outside days", () => {
    const tasks = [
      oneTime("before", "2026-08-09"),
      oneTime("from", "2026-08-10"),
      oneTime("mid", "2026-08-13"),
      oneTime("to", "2026-08-16"),
      oneTime("after", "2026-08-17"),
      oneTime("open", null),
    ];
    const keys = completedInRange(tasks, [], "2026-08-10", "2026-08-16").map((e) => e.key);
    expect(keys).toEqual(["to", "mid", "from"]);
  });

  it("orders newest first, then by title within a day", () => {
    const tasks = [
      oneTime("b", "2026-08-15"),
      oneTime("a", "2026-08-15"),
      oneTime("z", "2026-08-16"),
    ];
    const keys = completedInRange(tasks, [], "2026-08-01", "2026-08-16").map((e) => e.key);
    expect(keys).toEqual(["z", "a", "b"]);
  });

  it("flags completed occurrences as recurring with their task's title", () => {
    const tasks = [weekly("gym", { title: "Gym" }), oneTime("mail", "2026-08-15")];
    const overrides = [
      ov("gym", "2026-08-10", { completedOn: "2026-08-10" }),
      ov("gym", "2026-08-12", { movedTo: "2026-08-13" }), // moved, not done
    ];
    const entries = completedInRange(tasks, overrides, "2026-08-10", "2026-08-16");
    expect(entries.map((e) => e.key)).toEqual(["mail", "gym|2026-08-10"]);
    expect(entries[1]).toMatchObject({
      taskId: "gym",
      title: "Gym",
      sourceDate: "2026-08-10",
      recurring: true,
    });
    expect(entries[0].recurring).toBe(false);
  });

  it("carries the task's tags on entries; occurrences inherit the definition's, untagged reads as []", () => {
    const tasks = [weekly("gym", { tags: ["health", "gym"] }), oneTime("mail", "2026-08-15")];
    const overrides = [ov("gym", "2026-08-10", { completedOn: "2026-08-10" })];
    const entries = completedInRange(tasks, overrides, "2026-08-10", "2026-08-16");
    expect(entries.find((e) => e.key === "gym|2026-08-10")?.tags).toEqual(["health", "gym"]);
    expect(entries.find((e) => e.key === "mail")?.tags).toEqual([]);
  });

  it("ignores deleted and archived tasks, and occurrences of missing tasks", () => {
    const tasks = [
      oneTime("del", "2026-08-15", { deleted: 1 }),
      oneTime("arch", "2026-08-15", { status: "archived" }),
      weekly("gone-arch", { status: "archived" }),
      oneTime("ok", "2026-08-15"),
    ];
    const overrides = [
      ov("gone-arch", "2026-08-10", { completedOn: "2026-08-10" }),
      ov("missing", "2026-08-10", { completedOn: "2026-08-10" }),
      ov("ok", "2026-08-10", { completedOn: "2026-08-10" }), // one-time task: no occurrences
    ];
    const keys = completedInRange(tasks, overrides, "2026-08-01", "2026-08-16").map((e) => e.key);
    expect(keys).toEqual(["ok"]);
  });
});

describe("groupByDay", () => {
  it("groups consecutive entries by completion day, newest first", () => {
    const tasks = [
      oneTime("a", "2026-08-16"),
      oneTime("b", "2026-08-14"),
      oneTime("c", "2026-08-16"),
    ];
    const groups = groupByDay(completedInRange(tasks, [], "2026-08-01", "2026-08-16"));
    expect(groups.map((g) => [g.day, g.entries.map((e) => e.key)])).toEqual([
      ["2026-08-16", ["a", "c"]],
      ["2026-08-14", ["b"]],
    ]);
  });
});

describe("dayLabel", () => {
  it("names today and yesterday", () => {
    expect(dayLabel("2026-08-16", "2026-08-16")).toBe("Today");
    expect(dayLabel("2026-08-15", "2026-08-16")).toBe("Yesterday");
    expect(dayLabel("2026-08-10", "2026-08-16")).toMatch(/Mon/);
  });
});
