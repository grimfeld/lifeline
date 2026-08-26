import { describe, expect, it } from "vitest";
import { isDoneOn, uniqueCompletions } from "./completions";
import type { Completion } from "./types";

function done(choreId: string, doneOn: string, id: string, recordedAt = `${doneOn}T10:00:00.000Z`): Completion {
  return { id, type: "chore_completion", title: "", tags: [], folder: "", createdAt: doneOn, choreId, doneOn, recordedAt, updatedAt: "", deleted: 0 };
}

describe("uniqueCompletions", () => {
  it("keeps one completion per chore per day — the earliest recorded", () => {
    const all = [
      done("a", "2026-08-12", "second", "2026-08-12T18:00:00.000Z"),
      done("a", "2026-08-12", "first", "2026-08-12T09:00:00.000Z"),
      done("a", "2026-08-12", "third", "2026-08-12T21:00:00.000Z"),
      done("b", "2026-08-12", "b1"),
      done("a", "2026-08-13", "a-next"),
    ];
    expect(uniqueCompletions(all).map((c) => c.id)).toEqual(["first", "b1", "a-next"]);
  });

  it("breaks a recordedAt tie by id, deterministically", () => {
    const all = [done("a", "2026-08-12", "z"), done("a", "2026-08-12", "b")];
    expect(uniqueCompletions(all).map((c) => c.id)).toEqual(["b"]);
    expect(uniqueCompletions(all.reverse()).map((c) => c.id)).toEqual(["b"]);
  });

  it("leaves an already-clean list untouched, in order", () => {
    const all = [done("a", "2026-08-12", "1"), done("a", "2026-08-13", "2")];
    expect(uniqueCompletions(all)).toEqual(all);
  });
});

describe("isDoneOn", () => {
  const all = [done("a", "2026-08-12", "1")];
  it("is true on the day and false otherwise", () => {
    expect(isDoneOn(all, "a", "2026-08-12")).toBe(true);
    expect(isDoneOn(all, "a", "2026-08-13")).toBe(false);
    expect(isDoneOn(all, "b", "2026-08-12")).toBe(false);
  });
});
