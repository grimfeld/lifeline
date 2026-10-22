import { todayStr, type Document } from "@lifeline/core";
import { tasksOfProject } from "@lifeline/app-tasks/data";
import { boardOf, byRank, nextTaskOf, progressOf } from "./domain/board";
import { getProject, lanesOf, milestonesOf } from "./data/repo";

/**
 * A Project as an agent reads it through `get_document` (ADR 0098): the Board
 * the Projects Module shows — Milestones in order with their progress, Lanes
 * in order with their Tasks in hand order, recurring Tasks apart, and the
 * next Task by the App's own rule.
 */
export async function describeProject(doc: Document): Promise<Record<string, unknown>> {
  const p = await getProject(doc.id);
  if (!p) return {};
  const [milestones, lanes, tasks] = await Promise.all([milestonesOf(p.id), lanesOf(p.id), tasksOfProject(p.id)]);
  const next = nextTaskOf(lanes, tasks, p.id, todayStr());
  return {
    stage: p.stage,
    outcome: p.outcome,
    start: p.start,
    deadline: p.deadline,
    face: { emoji: p.emoji, color: p.color },
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      start: m.start,
      deadline: m.deadline,
      reachedOn: m.reachedOn,
      progress: progressOf(tasks, p.id, m.id),
    })),
    lanes: boardOf(lanes, tasks, p.id).map(({ lane, tasks: column }) => ({
      id: lane.id,
      title: lane.title,
      done: lane.done,
      tasks: column.map((t) => ({ id: t.id, title: t.title, day: t.date, done: !!t.completedOn, milestone: t.milestone })),
    })),
    recurring: tasks
      .filter((t) => t.recurrence && t.status !== "archived")
      .sort(byRank)
      .map((t) => ({ id: t.id, title: t.title, milestone: t.milestone })),
    next: next ? { id: next.id, title: next.title } : null,
  };
}

/** A Milestone or Lane speaks through its Project. */
export async function ownerProject(doc: Document): Promise<Document | undefined> {
  return typeof doc.project === "string" ? getProject(doc.project) : undefined;
}
