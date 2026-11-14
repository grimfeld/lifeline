import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, documentsOf, initApps, startOfWeek, todayStr, type Weekday } from "@lifeline/core";
import { taskTypes } from "../types";
import { TASK, TASK_OCCURRENCE, type OccurrenceOverride, type Task } from "../domain/types";
import { deriveItems, occurrenceItemId } from "../domain/occurrences";
import { addTask, allTasks, deleteTask, editTask, moveItem, normalizeTask, setCompleted } from "./repo";

// Open the local database once with the Tasks App's types (no sync started).
initApps([{ id: "tasks", title: "Tasks", types: taskTypes, screens: [], cards: [], commands: [] }]);

const MON: Weekday = 1;
// A recurring task never occurs before the day it was created (always today
// here), so the test week is the one starting next Monday.
const MONDAY = startOfWeek(addDays(todayStr(), 7));
const day = (n: number) => addDays(MONDAY, n);
const week = { start: MONDAY, end: day(6) };

async function state() {
  const tasks = await documentsOf<Task>(TASK);
  const overrides = await documentsOf<OccurrenceOverride>(TASK_OCCURRENCE);
  return { tasks, overrides, items: deriveItems(tasks, overrides, week) };
}

beforeEach(async () => {
  for (const t of await documentsOf<Task>(TASK)) await deleteTask(t.id);
});

describe("one-time intents", () => {
  it("completes and un-completes on the definition; moves change the day; null unassigns", async () => {
    const id = await addTask({ title: "a", date: day(2) });
    await setCompleted(id, day(2));
    expect((await state()).items[0]?.completedOn).toBe(day(2));
    await setCompleted(id, null);
    expect((await state()).items[0]?.completedOn).toBeNull();
    await moveItem(id, day(4));
    expect((await state()).items[0]?.date).toBe(day(4));
    await moveItem(id, null);
    expect((await state()).items[0]?.date).toBeNull();
    expect((await state()).overrides).toEqual([]);
  });
});

describe("recurring intents", () => {
  it("creates an override on complete and removes it on un-complete", async () => {
    const id = await addTask({ title: "w", recurrence: { kind: "weekly", weekdays: [MON] } });
    const occ = occurrenceItemId(id, day(0));
    await setCompleted(occ, day(0));
    expect((await state()).overrides).toHaveLength(1);
    expect((await state()).items.find((i) => i.itemId === occ)?.completedOn).toBe(day(0));
    await setCompleted(occ, null);
    expect((await state()).overrides).toEqual([]);
  });

  it("moves an occurrence, and moving it home clears the override", async () => {
    const id = await addTask({ title: "w", recurrence: { kind: "weekly", weekdays: [MON] } });
    const occ = occurrenceItemId(id, day(0));
    await moveItem(occ, day(3));
    let s = await state();
    expect(s.overrides[0]?.movedTo).toBe(day(3));
    expect(s.items.find((i) => i.itemId === occ)?.date).toBe(day(3));
    await moveItem(occ, day(0));
    s = await state();
    expect(s.overrides).toEqual([]);
    expect(s.items.find((i) => i.itemId === occ)?.date).toBe(day(0));
  });

  it("refuses to unassign an occurrence", async () => {
    const id = await addTask({ title: "w", recurrence: { kind: "weekly", weekdays: [MON] } });
    await expect(moveItem(occurrenceItemId(id, day(0)), null)).rejects.toThrow();
  });

  it("keeps a moved + completed override until both are cleared", async () => {
    const id = await addTask({ title: "w", recurrence: { kind: "weekly", weekdays: [MON] } });
    const occ = occurrenceItemId(id, day(0));
    await moveItem(occ, day(1));
    await setCompleted(occ, day(1));
    await setCompleted(occ, null);
    expect((await state()).overrides).toHaveLength(1);
    await moveItem(occ, day(0));
    expect((await state()).overrides).toEqual([]);
  });

  it("deleting a task cascades to its overrides", async () => {
    const id = await addTask({ title: "w", recurrence: { kind: "weekly", weekdays: [MON] } });
    await setCompleted(occurrenceItemId(id, day(0)), day(0));
    await deleteTask(id);
    const s = await state();
    expect(s.tasks).toEqual([]);
    expect(s.overrides).toEqual([]);
  });
});

describe("editing a Task's own words", () => {
  it("changes its notes and Tags, and only those, whatever else is passed", async () => {
    const id = await addTask({ title: "a", date: day(2), notes: "old" });
    await editTask(id, { notes: "new", tags: ["Home", "home", " errands "], date: day(5) } as never);
    const [t] = (await state()).tasks;
    expect({ notes: t?.notes, tags: t?.tags, date: t?.date }).toEqual({ notes: "new", tags: ["home", "errands"], date: day(2) });
  });
});

describe("adding a Task", () => {
  it("starts active and unplaced, with nothing but its title unless told", async () => {
    await addTask({ title: "a" });
    const [t] = await allTasks();
    expect(t).toMatchObject({ title: "a", notes: "", for: [], status: "active", date: null, completedOn: null, recurrence: null, estimate: null, tags: [], project: null, milestone: null, lane: null, rank: null, createdAt: todayStr() });
  });

  it("stores the People it is for once each", async () => {
    await addTask({ title: "Gift", for: ["ana", "ben", "ana"] });
    expect((await allTasks())[0]?.for).toEqual(["ana", "ben"]);
  });

  it("gives a recurring Task no day of its own", async () => {
    await addTask({ title: "Gym", date: day(1), recurrence: { kind: "weekly", weekdays: [MON] } });
    expect((await allTasks())[0]).toMatchObject({ date: null, recurrence: { kind: "weekly", weekdays: [MON] } });
  });

  it("keeps a Milestone and Lane only inside a Project", async () => {
    await addTask({ title: "a", project: "p", milestone: "m", lane: "l", estimate: 30, notes: "n", tags: ["Home"] });
    await addTask({ title: "b", milestone: "m", lane: "l" });
    const byTitle = Object.fromEntries((await allTasks()).map((t) => [t.title, t]));
    expect(byTitle.a).toMatchObject({ project: "p", milestone: "m", lane: "l", estimate: 30, notes: "n", tags: ["home"] });
    expect(byTitle.b).toMatchObject({ project: null, milestone: null, lane: null });
  });

  it("puts a Project Task in no Milestone or Lane unless told", async () => {
    await addTask({ title: "a", project: "p" });
    expect((await allTasks())[0]).toMatchObject({ project: "p", milestone: null, lane: null });
  });
});

describe("reading a Task (normalizeTask)", () => {
  const stored = (row: Record<string, unknown>) => normalizeTask({ id: "t", type: TASK, title: "a", status: "active", createdAt: "2026-01-01", ...row } as unknown as Task);

  it("reads what PocketBase hands back blank as no value", () => {
    expect(stored({ notes: undefined, date: "", completedOn: "", recurrence: "", estimate: "", tags: undefined, project: "", milestone: "", lane: "", rank: "" })).toMatchObject({
      notes: "", for: [], date: null, completedOn: null, recurrence: null, estimate: null, tags: [], project: null, milestone: null, lane: null, rank: null,
    });
  });

  it("reads the People it is for as ids, skipping blanks, and none from a value that is not a list", () => {
    expect(stored({ for: ["ana", "", 7] }).for).toEqual(["ana", "7"]);
    expect(stored({ for: "ana" }).for).toEqual([]);
  });

  it("rounds a positive estimate, and reads none from zero or less", () => {
    expect(stored({ estimate: "29.6" }).estimate).toBe(30);
    expect(stored({ estimate: 0 }).estimate).toBeNull();
    expect(stored({ estimate: -5 }).estimate).toBeNull();
  });

  it("keeps a Milestone and Lane only inside a Project", () => {
    expect(stored({ project: "p", milestone: "m", lane: "l" })).toMatchObject({ project: "p", milestone: "m", lane: "l" });
    expect(stored({ project: "", milestone: "m", lane: "l" })).toMatchObject({ project: null, milestone: null, lane: null });
  });

  it("reads a rank as a number, including 0, and none from what is not one", () => {
    expect(stored({ rank: 0 }).rank).toBe(0);
    expect(stored({ rank: "2.5" }).rank).toBe(2.5);
    expect(stored({ rank: null }).rank).toBeNull();
    expect(stored({ rank: undefined }).rank).toBeNull();
    expect(stored({ rank: "x" }).rank).toBeNull();
    expect(stored({ rank: Infinity }).rank).toBeNull();
  });

  it("keeps the days it has", () => {
    expect(stored({ date: "2026-02-02", completedOn: "2026-02-03", notes: "n", tags: ["home"] })).toMatchObject({ date: "2026-02-02", completedOn: "2026-02-03", notes: "n", tags: ["home"] });
  });
});
