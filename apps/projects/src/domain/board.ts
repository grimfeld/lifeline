import type { DateStr, TimedItem } from "@lifeline/core";
import type { Task } from "@lifeline/app-tasks/data";
import { APP_ID, isOpenStage, type Lane, type Milestone, type Project } from "./types";

/** Hand order: ranked first, lowest rank first, then oldest first, then by title. */
export function byRank<T extends { rank: number | null; createdAt: string; title: string }>(a: T, b: T): number {
  const ra = a.rank ?? Number.POSITIVE_INFINITY;
  const rb = b.rank ?? Number.POSITIVE_INFINITY;
  if (ra !== rb) return ra - rb;
  return a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title);
}

/** A rank that sorts between two neighbours (either may be missing: the ends). */
export function rankBetween(before: number | null | undefined, after: number | null | undefined): number {
  if (before == null && after == null) return 1000;
  if (before == null) return (after as number) - 1000;
  if (after == null) return before + 1000;
  return (before + after) / 2;
}

/** The Tasks a Project's progress and Board count: its own, one-time, not archived (ADR 0060). */
export function boardTasks(tasks: Task[], projectId: string): Task[] {
  return tasks.filter((t) => t.project === projectId && !t.recurrence && t.status !== "archived");
}

/**
 * Progress, derived and never stored: ticked over all of the Project's
 * one-time Tasks. Recurring Tasks have no single done state and count for
 * nothing; archived ones are out of both sides.
 */
export function progressOf(tasks: Task[], projectId: string, milestoneId?: string): { done: number; total: number } {
  const counted = boardTasks(tasks, projectId).filter((t) => milestoneId === undefined || t.milestone === milestoneId);
  return { done: counted.filter((t) => !!t.completedOn).length, total: counted.length };
}

/** The Estimate still ahead: the sum of the open one-time Tasks' Estimates, in minutes. */
export function remainingEstimate(tasks: Task[], projectId: string): number {
  return boardTasks(tasks, projectId)
    .filter((t) => !t.completedOn)
    .reduce((sum, t) => sum + (t.estimate ?? 0), 0);
}

export interface Column {
  lane: Lane;
  tasks: Task[];
}

/**
 * The Board (ADR 0060): one column per Lane, in order, each Task in exactly
 * one. A ticked Task stands in the done Lane whatever its own field says; an
 * open Task stands in its Lane — unless that is the done Lane (it was
 * unticked) or a Lane that no longer exists, when it stands in the first.
 */
export function boardOf(lanes: Lane[], tasks: Task[], projectId: string, milestoneId?: string | null): Column[] {
  const ordered = lanes.filter((l) => l.project === projectId).sort(byRank);
  if (ordered.length === 0) return [];
  const first = ordered[0];
  const doneLane = ordered.find((l) => l.done);
  const cols = new Map(ordered.map((l) => [l.id, [] as Task[]]));
  for (const t of boardTasks(tasks, projectId)) {
    if (milestoneId !== undefined && t.milestone !== milestoneId) continue;
    let at: Lane = ordered.find((l) => l.id === t.lane) ?? first;
    if (t.completedOn && doneLane) at = doneLane;
    else if (!t.completedOn && at.done) at = ordered.find((l) => !l.done) ?? first;
    cols.get(at.id)!.push(t);
  }
  return ordered.map((lane) => ({ lane, tasks: cols.get(lane.id)!.sort(byRank) }));
}

/**
 * A Project's next Task, read never stored: its earliest Task due today or
 * overdue, else the top Task of its first Lane — not the done Lane — that
 * holds any. Without Lanes, the oldest open Task.
 */
export function nextTaskOf(lanes: Lane[], tasks: Task[], projectId: string, today: DateStr): Task | undefined {
  const open = boardTasks(tasks, projectId).filter((t) => !t.completedOn);
  const due = open.filter((t) => t.date !== null && t.date <= today).sort((a, b) => (a.date as string).localeCompare(b.date as string));
  if (due[0]) return due[0];
  const board = boardOf(lanes, tasks, projectId);
  if (board.length === 0) return open.sort(byRank)[0];
  for (const col of board) if (!col.lane.done && col.tasks.length > 0) return col.tasks[0];
  return undefined;
}

/**
 * The Deadlines that stand on the time Surfaces as markers (ADR 0061): an
 * open Project's own, and those of its Milestones not yet reached. Nothing
 * of a Done or Dropped Project.
 */
export function markersIn(projects: Project[], milestones: Milestone[], range: { start: DateStr; end: DateStr }): TimedItem[] {
  const out: TimedItem[] = [];
  const inRange = (d: DateStr | null): d is DateStr => !!d && d >= range.start && d <= range.end;
  const open = new Map(projects.filter((p) => isOpenStage(p.stage)).map((p) => [p.id, p]));
  for (const p of open.values()) {
    if (!inRange(p.deadline)) continue;
    out.push(marker(markerId(p.id), `⚑ ${p.title}`, p.deadline, p, "Project deadline"));
  }
  for (const m of milestones) {
    const p = open.get(m.project);
    if (!p || m.reachedOn || !inRange(m.deadline)) continue;
    out.push(marker(markerId(p.id, m.id), `⚑ ${m.title}`, m.deadline, p, p.title));
  }
  return out;
}

/** A marker's item id: its Project's, then its Milestone's when it is one's. */
export function markerId(projectId: string, milestoneId?: string): string {
  return milestoneId ? `${projectId}:${milestoneId}` : projectId;
}

export function parseMarkerId(itemId: string): { projectId: string; milestoneId: string | null } {
  const [projectId, milestoneId] = itemId.split(":");
  return { projectId, milestoneId: milestoneId ?? null };
}

function marker(id: string, title: string, date: DateStr, p: Project, subtitle: string): TimedItem {
  return {
    key: `${APP_ID}/${id}`,
    appId: APP_ID,
    itemId: id,
    title,
    subtitle,
    date,
    start: null,
    end: null,
    tags: p.tags,
    color: p.color ? `var(--chart-${p.color})` : undefined,
    marker: true,
  };
}

/** A Project's face as one glyph: its emoji, else its title's first letter. */
export function faceOf(p: Pick<Project, "emoji" | "title">): string {
  return p.emoji || Array.from(p.title.trim())[0]?.toUpperCase() || "•";
}
