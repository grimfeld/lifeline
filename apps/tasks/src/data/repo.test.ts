import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, documentsOf, initApps, startOfWeek, todayStr, type Weekday } from "@lifeline/core";
import { taskTypes } from "../types";
import { TASK, TASK_OCCURRENCE, type OccurrenceOverride, type Task } from "../domain/types";
import { deriveItems, occurrenceItemId } from "../domain/occurrences";
import { addTask, deleteTask, editTask, moveItem, setCompleted } from "./repo";

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
    expect((await state()).items[0].completedOn).toBe(day(2));
    await setCompleted(id, null);
    expect((await state()).items[0].completedOn).toBeNull();
    await moveItem(id, day(4));
    expect((await state()).items[0].date).toBe(day(4));
    await moveItem(id, null);
    expect((await state()).items[0].date).toBeNull();
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
    expect(s.overrides[0].movedTo).toBe(day(3));
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
    expect({ notes: t.notes, tags: t.tags, date: t.date }).toEqual({ notes: "new", tags: ["home", "errands"], date: day(2) });
  });
});
