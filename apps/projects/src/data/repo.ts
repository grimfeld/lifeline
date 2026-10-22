import {
  documentsOf,
  getDocument,
  newId,
  normalizeTags,
  putDocument,
  removeDocument,
  removeDocumentsWhere,
  todayStr,
  useLiveQuery,
  type DateStr,
} from "@lifeline/core";
import { placeTask, setArchived, settleForLane, setTaskProject, TASK, type Task } from "@lifeline/app-tasks/data";
import { boardTasks, byRank, rankBetween } from "../domain/board";
import {
  PROJECT,
  PROJECT_LANE,
  PROJECT_MILESTONE,
  SEED_LANES,
  type Lane,
  type Milestone,
  type Project,
  type Stage,
} from "../domain/types";

/**
 * PocketBase hands an absent field back as "", so every read re-establishes
 * the domain's `null` for "no value".
 */
const day = (v: unknown): DateStr | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

function normalizeProject(p: Project): Project {
  return {
    ...p,
    stage: (p.stage as Stage) || "planned",
    outcome: p.outcome ?? "",
    start: day(p.start),
    deadline: day(p.deadline),
    startedOn: day(p.startedOn),
    endedOn: day(p.endedOn),
    emoji: p.emoji ?? "",
    color: p.color ?? "",
    rank: num(p.rank),
    tags: p.tags ?? [],
  };
}

function normalizeMilestone(m: Milestone): Milestone {
  return { ...m, rank: num(m.rank), start: day(m.start), deadline: day(m.deadline), reachedOn: day(m.reachedOn) };
}

function normalizeLane(l: Lane): Lane {
  return { ...l, rank: num(l.rank), done: !!l.done };
}

// --- reads ---

export function useProjects(): Project[] {
  return useLiveQuery(async () => (await documentsOf<Project>(PROJECT)).map(normalizeProject), [], [] as Project[]);
}

export function useMilestones(): Milestone[] {
  return useLiveQuery(async () => (await documentsOf<Milestone>(PROJECT_MILESTONE)).map(normalizeMilestone), [], [] as Milestone[]);
}

export async function allProjects(): Promise<Project[]> {
  return (await documentsOf<Project>(PROJECT)).map(normalizeProject);
}

export async function allMilestones(): Promise<Milestone[]> {
  return (await documentsOf<Milestone>(PROJECT_MILESTONE)).map(normalizeMilestone);
}

export function useLanes(): Lane[] {
  return useLiveQuery(async () => (await documentsOf<Lane>(PROJECT_LANE)).map(normalizeLane), [], [] as Lane[]);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const p = await getDocument<Project>(id);
  return p && p.type === PROJECT && !p.deleted ? normalizeProject(p) : undefined;
}

export async function milestonesOf(projectId: string): Promise<Milestone[]> {
  return (await documentsOf<Milestone>(PROJECT_MILESTONE)).map(normalizeMilestone).filter((m) => m.project === projectId).sort(byRank);
}

export async function lanesOf(projectId: string): Promise<Lane[]> {
  return (await documentsOf<Lane>(PROJECT_LANE)).map(normalizeLane).filter((l) => l.project === projectId).sort(byRank);
}

// --- Projects ---

export interface ProjectInput {
  title: string;
  outcome?: string;
  stage?: Stage;
  start?: DateStr | null;
  deadline?: DateStr | null;
  emoji?: string;
  color?: string;
  tags?: string[];
}

/** A new Project, its Board seeded with To do / Doing / Done. */
export async function addProject(input: ProjectInput): Promise<string> {
  const id = newId();
  const stage = input.stage ?? "planned";
  await putDocument<Project>({
    id,
    type: PROJECT,
    title: input.title.trim(),
    outcome: input.outcome?.trim() ?? "",
    stage,
    start: input.start ?? null,
    deadline: input.deadline ?? null,
    startedOn: stage === "active" ? todayStr() : null,
    endedOn: null,
    emoji: input.emoji ?? "",
    color: input.color ?? "",
    rank: null,
    tags: normalizeTags(input.tags),
  });
  let rank = 0;
  for (const l of SEED_LANES) {
    rank += 1000;
    await putDocument<Lane>({ id: newId(), type: PROJECT_LANE, title: l.title, project: id, rank, done: l.done, tags: [] });
  }
  return id;
}

/** Edit a Project's plain fields; the stage moves only through `setStage`. */
export async function updateProject(p: Project, patch: Omit<ProjectInput, "stage">): Promise<void> {
  await putDocument<Project>({
    ...p,
    title: patch.title.trim(),
    outcome: patch.outcome?.trim() ?? p.outcome,
    start: patch.start === undefined ? p.start : patch.start,
    deadline: patch.deadline === undefined ? p.deadline : patch.deadline,
    emoji: patch.emoji ?? p.emoji,
    color: patch.color ?? p.color,
    tags: normalizeTags(patch.tags ?? p.tags),
  });
}

/**
 * Move a Project to a stage, by the user's hand (ADR 0060). Becoming Active
 * stamps the day it started; Done or Dropped the day it ended; going back to
 * an open stage clears the end.
 */
export async function setStage(projectId: string, stage: Stage, on: DateStr = todayStr()): Promise<void> {
  const p = await getProject(projectId);
  if (!p || p.stage === stage) return;
  const ended = stage === "done" || stage === "dropped";
  await putDocument<Project>({
    ...p,
    stage,
    startedOn: stage === "active" ? on : p.startedOn,
    endedOn: ended ? on : null,
  });
}

/** What becomes of a Project's open Tasks when it is finished or dropped: the stage dialog's three choices. */
export type OpenTasks = "leave" | "archive" | "loose";

export async function settleOpenTasks(open: Task[], how: OpenTasks): Promise<void> {
  if (how === "archive") for (const t of open) await setArchived(t, true);
  if (how === "loose") for (const t of open) await setTaskProject(t.id, null);
}

/**
 * Move a Project to a stage as the stage dialog does. Done or Dropped with
 * open Tasks needs `openTasks` to say what becomes of them; without it the
 * move is refused, naming how many are open.
 */
export async function moveProject(projectId: string, stage: Stage, openTasks?: OpenTasks): Promise<void> {
  if (stage === "done" || stage === "dropped") {
    const open = boardTasks(await documentsOf<Task>(TASK), projectId).filter((t) => !t.completedOn);
    if (open.length > 0) {
      if (!openTasks) {
        throw new Error(`${open.length} open task${open.length === 1 ? " is" : "s are"} still in this project; say what becomes of them with openTasks: leave, archive or loose`);
      }
      await settleOpenTasks(open, openTasks);
    }
  }
  await setStage(projectId, stage);
}

export async function setDeadline(projectId: string, deadline: DateStr | null): Promise<void> {
  const p = await getProject(projectId);
  if (p && p.deadline !== deadline) await putDocument<Project>({ ...p, deadline });
}

/** Take down what exists only in a Project's service — run by its type's delete cascade. */
export async function removeChildren(projectId: string): Promise<void> {
  await removeDocumentsWhere(PROJECT_MILESTONE, (d) => d.project === projectId);
  await removeDocumentsWhere(PROJECT_LANE, (d) => d.project === projectId);
}

export async function deleteProject(projectId: string): Promise<void> {
  await removeDocument(projectId);
}

// --- Milestones ---

export async function addMilestone(
  projectId: string,
  title: string,
  deadline: DateStr | null = null,
  opts: { start?: DateStr | null; position?: number } = {},
): Promise<string> {
  const last = (await milestonesOf(projectId)).at(-1);
  const id = newId();
  await putDocument<Milestone>({
    id,
    type: PROJECT_MILESTONE,
    title: title.trim(),
    project: projectId,
    rank: rankBetween(last?.rank, null),
    start: opts.start ?? null,
    deadline,
    reachedOn: null,
    tags: [],
  });
  if (opts.position !== undefined) await setMilestonePosition(projectId, id, opts.position);
  return id;
}

export async function updateMilestone(m: Milestone, patch: Partial<Pick<Milestone, "title" | "deadline" | "start">>): Promise<void> {
  await putDocument<Milestone>({ ...m, ...patch, title: (patch.title ?? m.title).trim() });
}

/** Declare a Milestone reached (a day) or not yet (null) — never because its Tasks are ticked. */
export async function setReached(m: Milestone, on: DateStr | null): Promise<void> {
  if (m.reachedOn !== on) await putDocument<Milestone>({ ...m, reachedOn: on });
}

export async function setMilestoneDeadline(id: string, deadline: DateStr | null): Promise<void> {
  const m = await getDocument<Milestone>(id);
  if (m && m.type === PROJECT_MILESTONE && !m.deleted) await putDocument<Milestone>({ ...normalizeMilestone(m), deadline });
}

/** Move a Milestone one step earlier (-1) or later (+1) in its Project's order. */
export async function shiftMilestone(m: Milestone, dir: -1 | 1): Promise<void> {
  await shift(await milestonesOf(m.project), m.id, dir);
}

/** Put a Milestone at a 0-based place in its Project's order, rewriting the list whole. */
export async function setMilestonePosition(projectId: string, id: string, position: number): Promise<void> {
  await place(await milestonesOf(projectId), id, position);
}

export async function deleteMilestone(id: string): Promise<void> {
  await removeDocument(id);
}

// --- Lanes ---

export async function addLane(projectId: string, title: string, position?: number): Promise<string> {
  const lanes = await lanesOf(projectId);
  // A new Lane goes before the done Lane, which stays last unless moved.
  const doneAt = lanes.findIndex((l) => l.done);
  const before = doneAt > 0 ? lanes[doneAt - 1] : doneAt === 0 ? undefined : lanes.at(-1);
  const after = doneAt >= 0 ? lanes[doneAt] : undefined;
  const id = newId();
  await putDocument<Lane>({ id, type: PROJECT_LANE, title: title.trim(), project: projectId, rank: rankBetween(before?.rank, after?.rank), done: false, tags: [] });
  if (position !== undefined) await setLanePosition(projectId, id, position);
  return id;
}

/** Put a Lane at a 0-based place in its Board's order, rewriting the list whole. */
export async function setLanePosition(projectId: string, id: string, position: number): Promise<void> {
  await place(await lanesOf(projectId), id, position);
}

export async function renameLane(l: Lane, title: string): Promise<void> {
  if (title.trim() && title.trim() !== l.title) await putDocument<Lane>({ ...l, title: title.trim() });
}

/** Make a Lane the done Lane (or none, with null) — at most one per Project. */
export async function setDoneLane(projectId: string, laneId: string | null): Promise<void> {
  for (const l of await lanesOf(projectId)) {
    const done = l.id === laneId;
    if (l.done !== done) await putDocument<Lane>({ ...l, done });
  }
}

export async function shiftLane(l: Lane, dir: -1 | 1): Promise<void> {
  await shift(await lanesOf(l.project), l.id, dir);
}

/** Delete a Lane; its Tasks go to the first Lane (the Lane type's cascade). The last Lane stays. */
export async function deleteLane(l: Lane): Promise<void> {
  if ((await lanesOf(l.project)).length <= 1) throw new Error("A Board keeps at least one lane");
  await removeDocument(l.id);
}

// --- the Board ---

/**
 * Drop a Task into a Lane at a position (ADR 0060): `column` is the Lane's
 * Tasks as they stand, `index` where it lands among them. Into the done Lane
 * it is ticked; out of it, unticked. The Lane's hand order is rewritten whole,
 * so Tasks never ranked yet take their place too. The Tasks App does every
 * write — it owns the Task — and this only decides what they are.
 */
export async function dropTask(task: Task, lane: Lane, column: Task[], index: number): Promise<void> {
  await settleForLane(task, lane.done);
  const order = column.filter((t) => t.id !== task.id);
  order.splice(Math.max(0, Math.min(index, order.length)), 0, task);
  for (let k = 0; k < order.length; k++) {
    const t = order[k];
    const rank = (k + 1) * 1000;
    if (t.id === task.id || t.rank !== rank || t.lane !== lane.id) await placeTask(t.id, lane.id, rank);
  }
}

/** Move an ordered item to a 0-based index (clamped), re-ranking the whole list. */
async function place<T extends Milestone | Lane>(list: T[], id: string, position: number): Promise<void> {
  const item = list.find((x) => x.id === id);
  if (!item) return;
  const next = list.filter((x) => x.id !== id);
  next.splice(Math.max(0, Math.min(Math.trunc(position), next.length)), 0, item);
  for (let k = 0; k < next.length; k++) {
    const rank = (k + 1) * 1000;
    if (next[k].rank !== rank) await putDocument<T>({ ...next[k], rank });
  }
}

/** Swap an ordered item with its neighbour, re-ranking the whole list so ties never stick. */
async function shift<T extends Milestone | Lane>(list: T[], id: string, dir: -1 | 1): Promise<void> {
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  for (let k = 0; k < next.length; k++) {
    const rank = (k + 1) * 1000;
    if (next[k].rank !== rank) await putDocument<T>({ ...next[k], rank });
  }
}
