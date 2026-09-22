import {
  documentsOf,
  documentsTable,
  getDocument,
  newId,
  normalizeTags,
  putDocument,
  removeDocument,
  removePlacementsOf,
  todayStr,
  useLiveQuery,
  type DateStr,
} from "@lifeline/core";
import {
  TASK,
  TASK_OCCURRENCE,
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
    estimate: Number(t.estimate) > 0 ? Math.round(Number(t.estimate)) : null,
    tags: t.tags ?? [],
  };
}

function normalizeOverride(o: OccurrenceOverride): OccurrenceOverride {
  return { ...o, movedTo: o.movedTo || null, completedOn: o.completedOn || null };
}

export function useTasks(): Task[] {
  return useLiveQuery(async () => (await documentsOf<Task>(TASK)).map(normalizeTask), [], [] as Task[]);
}

export function useOverrides(): OccurrenceOverride[] {
  return useLiveQuery(async () => (await documentsOf<OccurrenceOverride>(TASK_OCCURRENCE)).map(normalizeOverride), [], [] as OccurrenceOverride[]);
}

export async function addTask(input: {
  title: string;
  notes?: string;
  date?: DateStr | null;
  recurrence?: Recurrence | null;
  estimate?: number | null;
  tags?: string[];
}): Promise<string> {
  const id = newId();
  await putDocument<Task>({
    id,
    type: TASK,
    title: input.title,
    notes: input.notes ?? "",
    status: "active",
    date: input.recurrence ? null : (input.date ?? null),
    completedOn: null,
    recurrence: input.recurrence ?? null,
    estimate: input.estimate ?? null,
    createdAt: todayStr(),
    tags: normalizeTags(input.tags),
  });
  return id;
}

export async function updateTask(task: Task): Promise<void> {
  await putDocument<Task>({ ...task, tags: normalizeTags(task.tags) });
}

export async function setArchived(task: Task, archived: boolean): Promise<void> {
  await putDocument<Task>({ ...task, status: archived ? "archived" : "active" });
}

/** Delete a task and cascade to its occurrence overrides. */
export async function deleteTask(taskId: string): Promise<void> {
  const overrides = (await documentsTable().where("[type+taskId]").equals([TASK_OCCURRENCE, taskId]).toArray()) as OccurrenceOverride[];
  for (const o of overrides) if (!o.deleted) await removeDocument(o.id);
  await removeDocument(taskId);
  // Its Time blocks go with it (ADR 0028): the task's own id, or any of its Occurrences' `taskId|date`.
  await removePlacementsOf("tasks", (id) => parseItemId(id).taskId === taskId);
}

async function getTask(taskId: string): Promise<Task | undefined> {
  const t = await getDocument<Task>(taskId);
  return t && t.type === TASK ? normalizeTask(t) : undefined;
}

async function getOverride(
  taskId: string,
  sourceDate: DateStr,
): Promise<OccurrenceOverride | undefined> {
  const o = (await documentsTable().where("[type+taskId+sourceDate]").equals([TASK_OCCURRENCE, taskId, sourceDate]).first()) as OccurrenceOverride | undefined;
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
    if (existing) await removeDocument(existing.id);
    return;
  }
  await putDocument<OccurrenceOverride>({
    id: existing?.id ?? newId(),
    type: TASK_OCCURRENCE,
    taskId,
    sourceDate,
    ...next,
  });
}

/** Give an item's Task its Estimate (ADR 0054): an Occurrence's lands on its recurring Task. */
export async function setEstimate(itemId: ItemId, minutes: number | null): Promise<void> {
  const task = await getTask(parseItemId(itemId).taskId);
  if (task && task.estimate !== minutes) await putDocument<Task>({ ...task, estimate: minutes });
}

/** Unified intent: mark an item done (`on`) or not done (null). */
export async function setCompleted(itemId: ItemId, on: DateStr | null): Promise<void> {
  const { taskId, sourceDate } = parseItemId(itemId);
  if (sourceDate === null) {
    const task = await getTask(taskId);
    if (task) await putDocument<Task>({ ...task, completedOn: on });
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
    if (task && task.date !== to) await putDocument<Task>({ ...task, date: to });
    return;
  }
  if (to === null) throw new Error("A recurring task's occurrence can't be unassigned");
  await writeOverride(taskId, sourceDate, { movedTo: to });
}
