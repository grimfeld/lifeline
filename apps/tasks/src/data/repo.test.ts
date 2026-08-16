import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { all, initApps, type Weekday } from "@lifeline/core";
import { OCCURRENCES, TASKS, type OccurrenceOverride, type Task } from "../domain/types";
import { deriveItems, occurrenceItemId } from "../domain/occurrences";
import { addTask, deleteTask, moveItem, setCompleted } from "./repo";

// Open the local database once with the Tasks App's collections (no sync started).
initApps([
  {
    id: "tasks",
    title: "Tasks",
    collections: [
      { name: TASKS, indexes: ["date", "status"] },
      { name: OCCURRENCES, indexes: ["taskId", "[taskId+sourceDate]", "movedTo"] },
    ],
    screens: [],
    cards: [],
    commands: [],
  },
]);

const MON: Weekday = 1;
const week = { start: "2026-08-24", end: "2026-08-30" };

async function state() {
  const tasks = await all<Task>(TASKS);
  const overrides = await all<OccurrenceOverride>(OCCURRENCES);
  return { tasks, overrides, items: deriveItems(tasks, overrides, week) };
}

beforeEach(async () => {
  for (const t of await all<Task>(TASKS)) await deleteTask(t.id);
});

describe("one-time intents", () => {
  it("completes and un-completes on the definition; moves change the day; null unassigns", async () => {
    const id = await addTask({ title: "a", date: "2026-08-26" });
    await setCompleted(id, "2026-08-26");
    expect((await state()).items[0].completedOn).toBe("2026-08-26");
    await setCompleted(id, null);
    expect((await state()).items[0].completedOn).toBeNull();
    await moveItem(id, "2026-08-28");
    expect((await state()).items[0].date).toBe("2026-08-28");
    await moveItem(id, null);
    expect((await state()).items[0].date).toBeNull();
    expect((await state()).overrides).toEqual([]);
  });
});

describe("recurring intents", () => {
  it("creates an override on complete and removes it on un-complete", async () => {
    const id = await addTask({ title: "w", recurrence: { kind: "weekly", weekdays: [MON] } });
    const occ = occurrenceItemId(id, "2026-08-24");
    await setCompleted(occ, "2026-08-24");
    expect((await state()).overrides).toHaveLength(1);
    expect((await state()).items.find((i) => i.itemId === occ)?.completedOn).toBe("2026-08-24");
    await setCompleted(occ, null);
    expect((await state()).overrides).toEqual([]);
  });

  it("moves an occurrence, and moving it home clears the override", async () => {
    const id = await addTask({ title: "w", recurrence: { kind: "weekly", weekdays: [MON] } });
    const occ = occurrenceItemId(id, "2026-08-24");
    await moveItem(occ, "2026-08-27");
    let s = await state();
    expect(s.overrides[0].movedTo).toBe("2026-08-27");
    expect(s.items.find((i) => i.itemId === occ)?.date).toBe("2026-08-27");
    await moveItem(occ, "2026-08-24");
    s = await state();
    expect(s.overrides).toEqual([]);
    expect(s.items.find((i) => i.itemId === occ)?.date).toBe("2026-08-24");
  });

  it("refuses to unassign an occurrence", async () => {
    const id = await addTask({ title: "w", recurrence: { kind: "weekly", weekdays: [MON] } });
    await expect(moveItem(occurrenceItemId(id, "2026-08-24"), null)).rejects.toThrow();
  });

  it("keeps a moved + completed override until both are cleared", async () => {
    const id = await addTask({ title: "w", recurrence: { kind: "weekly", weekdays: [MON] } });
    const occ = occurrenceItemId(id, "2026-08-24");
    await moveItem(occ, "2026-08-25");
    await setCompleted(occ, "2026-08-25");
    await setCompleted(occ, null);
    expect((await state()).overrides).toHaveLength(1);
    await moveItem(occ, "2026-08-24");
    expect((await state()).overrides).toEqual([]);
  });

  it("deleting a task cascades to its overrides", async () => {
    const id = await addTask({ title: "w", recurrence: { kind: "weekly", weekdays: [MON] } });
    await setCompleted(occurrenceItemId(id, "2026-08-24"), "2026-08-24");
    await deleteTask(id);
    const s = await state();
    expect(s.tasks).toEqual([]);
    expect(s.overrides).toEqual([]);
  });
});
