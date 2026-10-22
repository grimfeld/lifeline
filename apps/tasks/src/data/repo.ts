import {
  documentsOf,
  documentsTable,
  getDocument,
  newId,
  normalizeTags,
  patchDocument,
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
export function normalizeTask(t: Task): Task {
  return {
    ...t,
    notes: t.notes ?? "",
    date: t.date || null,
    completedOn: t.completedOn || null,
    recurrence: t.recurrence || null,
    estimate: Number(t.estimate) > 0 ? Math.round(Number(t.estimate)) : null,
    tags: t.tags ?? [],
    project: t.project || null,
    milestone: (t.project && t.milestone) || null,
    lane: (t.project && t.lane) || null,
    rank: t.rank === null || t.rank === undefined || t.rank === ("" as unknown) || !Number.isFinite(Number(t.rank)) ? null : Number(t.rank),
  };
}

function normalizeOverride(o: OccurrenceOverride): OccurrenceOverride {
  return { ...o, movedTo: o.movedTo || null, completedOn: o.completedOn || null };
}

export async function allTasks(): Promise<Task[]> {
  return (await documentsOf<Task>(TASK)).map(normalizeTask);
}

export async function allOverrides(): Promise<OccurrenceOverride[]> {
  return (await documentsOf<OccurrenceOverride>(TASK_OCCURRENCE)).map(normalizeOverride);
}

export function useTasks(): Task[] {
  return useLiveQuery(allTasks, [], [] as Task[]);
}

export function useOverrides(): OccurrenceOverride[] {
  return useLiveQuery(allOverrides, [], [] as OccurrenceOverride[]);
}

export async function addTask(input: {
  title: string;
  notes?: string;
  date?: DateStr | null;
  recurrence?: Recurrence | null;
  estimate?: number | null;
  tags?: string[];
  project?: string | null;
  milestone?: string | null;
  lane?: string | null;
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
    project: input.project ?? null,
    milestone: input.project ? (input.milestone ?? null) : null,
    lane: input.project ? (input.lane ?? null) : null,
    rank: null,
  });
  return id;
}

export async function updateTask(task: Task): Promise<void> {
  await putDocument<Task>({ ...task, tags: normalizeTags(task.tags) });
}

/**
 * Edit a Task's own words — its notes and Tags — from wherever it is shown (its
 * Peek, ADR 0085). Its day, completion and place in a Project are guarded and
 * move only through their intents below; nothing else passed here is written.
 */
export async function editTask(taskId: string, edit: { notes?: string; tags?: string[] }): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (edit.notes !== undefined) patch.notes = edit.notes;
  if (edit.tags !== undefined) patch.tags = normalizeTags(edit.tags);
  if (Object.keys(patch).length > 0) await patchDocument(taskId, patch);
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

// --- a Task's place in a Project (ADR 0060) ---

/** Every Task of a Project, read once — what the Projects App moves and releases with it. */
export async function tasksOfProject(projectId: string): Promise<Task[]> {
  return (await documentsOf<Task>(TASK)).map(normalizeTask).filter((t) => t.project === projectId);
}

/**
 * Put a Task in a Project, or take it out (null). Changing Project clears the
 * Milestone and the Lane: neither may belong to another Project, and the new
 * Project's first Lane is where a Task with none stands.
 */
export async function setTaskProject(taskId: string, project: string | null, milestone: string | null = null): Promise<void> {
  const task = await getTask(taskId);
  if (!task) return;
  const moved = task.project !== project;
  const next = moved
    ? { project, milestone: project ? milestone : null, lane: null, rank: null }
    : { project, milestone: project ? milestone : null, lane: task.lane, rank: task.rank };
  if (!moved && next.milestone === task.milestone) return;
  await putDocument<Task>({ ...task, ...next });
}

/** Place a Task on its Project's Board: its Lane and its hand order there. */
export async function placeTask(taskId: string, lane: string | null, rank: number | null): Promise<void> {
  const task = await getTask(taskId);
  if (!task || !task.project) return;
  if (task.lane === lane && task.rank === rank) return;
  await putDocument<Task>({ ...task, lane, rank });
}

/**
 * A Task stands in a Lane: ticked when it is the Board's done Lane, unticked in
 * any other (ADR 0062). The one rule behind a Board drop and `tasks.add`.
 */
export async function settleForLane(task: Pick<Task, "id" | "completedOn">, laneDone: boolean): Promise<void> {
  if (laneDone && !task.completedOn) await setCompleted(task.id, todayStr());
  if (!laneDone && task.completedOn) await setCompleted(task.id, null);
}

/** A deleted Project releases its Tasks: they stay, as loose Tasks (ADR 0060). */
export async function releaseTasksOf(projectId: string): Promise<void> {
  for (const t of await tasksOfProject(projectId)) await putDocument<Task>({ ...t, project: null, milestone: null, lane: null, rank: null });
}

/** A deleted Milestone leaves its Tasks in the Project under no Milestone. */
export async function clearMilestone(milestoneId: string): Promise<void> {
  for (const t of (await documentsOf<Task>(TASK)).map(normalizeTask)) {
    if (t.milestone === milestoneId) await putDocument<Task>({ ...t, milestone: null });
  }
}

/** A deleted Lane sends its Tasks to the first Lane, which is where a Task with none stands. */
export async function clearLane(laneId: string): Promise<void> {
  for (const t of (await documentsOf<Task>(TASK)).map(normalizeTask)) {
    if (t.lane === laneId) await putDocument<Task>({ ...t, lane: null });
  }
}
