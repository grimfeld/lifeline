import {
  db,
  put,
  remove,
  newId,
  todayStr,
  useLiveQuery,
  type DateStr,
} from "@lifeline/core";
import {
  OCCURRENCES,
  TASKS,
  type OccurrenceOverride,
  type Recurrence,
  type Task,
} from "../domain/types";
import { parseItemId, type ItemId } from "../domain/occurrences";

/**
 * PocketBase stores an absent text field as "" and hands it back that way,
 * so every read re-establishes the domain's `null` for "no value".
 */
function normalizeTask(t: Task): Task {
  return {
    ...t,
    notes: t.notes ?? "",
    date: t.date || null,
    completedOn: t.completedOn || null,
    recurrence: t.recurrence || null,
  };
}

function normalizeOverride(o: OccurrenceOverride): OccurrenceOverride {
  return { ...o, movedTo: o.movedTo || null, completedOn: o.completedOn || null };
}

export function useTasks(): Task[] {
  return useLiveQuery(
    async () =>
      (await db().collection<Task>(TASKS).where("deleted").equals(0).toArray()).map(normalizeTask),
    [],
    [] as Task[],
  );
}

export function useOverrides(): OccurrenceOverride[] {
  return useLiveQuery(
    async () =>
      (
        await db().collection<OccurrenceOverride>(OCCURRENCES).where("deleted").equals(0).toArray()
      ).map(normalizeOverride),
    [],
    [] as OccurrenceOverride[],
  );
}

export async function addTask(input: {
  title: string;
  notes?: string;
  date?: DateStr | null;
  recurrence?: Recurrence | null;
}): Promise<string> {
  const id = newId();
  await put<Task>(TASKS, {
    id,
    title: input.title,
    notes: input.notes ?? "",
    status: "active",
    date: input.recurrence ? null : (input.date ?? null),
    completedOn: null,
    recurrence: input.recurrence ?? null,
    createdAt: todayStr(),
  });
  return id;
}

export async function updateTask(task: Task): Promise<void> {
  await put<Task>(TASKS, task);
}

export async function setArchived(task: Task, archived: boolean): Promise<void> {
  await put<Task>(TASKS, { ...task, status: archived ? "archived" : "active" });
}

/** Delete a task and cascade to its occurrence overrides. */
export async function deleteTask(taskId: string): Promise<void> {
  const overrides = await db()
    .collection<OccurrenceOverride>(OCCURRENCES)
    .where("taskId")
    .equals(taskId)
    .toArray();
  for (const o of overrides) if (!o.deleted) await remove(OCCURRENCES, o.id);
  await remove(TASKS, taskId);
}

async function getTask(taskId: string): Promise<Task | undefined> {
  const t = await db().collection<Task>(TASKS).get(taskId);
  return t && !t.deleted ? normalizeTask(t) : undefined;
}

async function getOverride(
  taskId: string,
  sourceDate: DateStr,
): Promise<OccurrenceOverride | undefined> {
  const o = await db()
    .collection<OccurrenceOverride>(OCCURRENCES)
    .where("[taskId+sourceDate]")
    .equals([taskId, sourceDate])
    .first();
  return o && !o.deleted ? normalizeOverride(o) : undefined;
}

/**
 * The upsert-or-delete rule for overrides lives here and only here: an
 * override that neither moves nor completes its Occurrence is removed.
 */
async function writeOverride(
  taskId: string,
  sourceDate: DateStr,
  patch: Partial<Pick<OccurrenceOverride, "movedTo" | "completedOn">>,
): Promise<void> {
  const existing = await getOverride(taskId, sourceDate);
  const next = {
    movedTo: existing?.movedTo ?? null,
    completedOn: existing?.completedOn ?? null,
    ...patch,
  };
  if (next.movedTo === sourceDate) next.movedTo = null;
  if (next.movedTo === null && next.completedOn === null) {
    if (existing) await remove(OCCURRENCES, existing.id);
    return;
  }
  await put<OccurrenceOverride>(OCCURRENCES, {
    id: existing?.id ?? newId(),
    taskId,
    sourceDate,
    ...next,
  });
}

/** Unified intent: mark an item done (`on`) or not done (null). */
export async function setCompleted(itemId: ItemId, on: DateStr | null): Promise<void> {
  const { taskId, sourceDate } = parseItemId(itemId);
  if (sourceDate === null) {
    const task = await getTask(taskId);
    if (task) await put<Task>(TASKS, { ...task, completedOn: on });
    return;
  }
  await writeOverride(taskId, sourceDate, { completedOn: on });
}

/**
 * Unified intent: move an item to a day, or to the Unassigned pool (null).
 * Recurring Occurrences can never be Unassigned — a null move throws.
 */
export async function moveItem(itemId: ItemId, to: DateStr | null): Promise<void> {
  const { taskId, sourceDate } = parseItemId(itemId);
  if (sourceDate === null) {
    const task = await getTask(taskId);
    if (task && task.date !== to) await put<Task>(TASKS, { ...task, date: to });
    return;
  }
  if (to === null) throw new Error("A recurring task's occurrence can't be unassigned");
  await writeOverride(taskId, sourceDate, { movedTo: to });
}
