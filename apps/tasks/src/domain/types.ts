import type { DateStr, Document, Weekday } from "@lifeline/core";

/**
 * How a recurring Task repeats. Weekday values follow Core's convention
 * (0 = Sunday … 6 = Saturday); the UI shows weeks Monday-first. Monthly
 * days-of-month and yearly dates are clamped to the month's length
 * (the 31st in February → the 28th/29th), like Chore schedules.
 */
export type Recurrence =
  | { kind: "weekly"; weekdays: Weekday[] }
  | { kind: "monthly"; days: number[] } // 1–31
  | { kind: "yearly"; dates: { month: number; day: number }[] }; // month 1–12, day 1–31

export type TaskStatus = "active" | "archived";

/**
 * A unit of work (CONTEXT.md). One-time and recurring Tasks are asymmetric
 * on purpose (week-planner ADR 0001): a one-time Task's day and completion
 * live on the record itself; a recurring Task's per-day state lives in
 * Occurrence overrides. Callers use the unified intents in data/repo.ts and
 * never branch on kind.
 */
export interface Task extends Document {
  type: typeof TASK;
  notes: string;
  status: TaskStatus;
  /** One-time only: the day it is assigned to. null = Unassigned pool. */
  date: DateStr | null;
  /** One-time only: set when done. */
  completedOn: DateStr | null;
  /** Recurring only. null = one-time. */
  recurrence: Recurrence | null;
  /** The Estimate (ADR 0054): whole minutes; a recurring Task's Occurrences inherit it. null = none given. */
  estimate: number | null;
  /** Recurring Tasks generate Occurrences from this day on (the Document's createdAt). */
  createdAt: DateStr;
  /** The Project it belongs to (ADR 0060), or null for a loose Task. */
  project: string | null;
  /** One of its Project's Milestones, or null. Never another Project's. */
  milestone: string | null;
  /**
   * The Lane of its Project's Board it stands in. null — or a Lane that no
   * longer exists — reads as the Project's first Lane; a ticked Task reads as
   * standing in the done Lane whatever this says (ADR 0060).
   */
  lane: string | null;
  /** Hand order within its Lane (lower first); null sorts after every ranked Task. */
  rank: number | null;
}

/**
 * Per-Occurrence state of a recurring Task, sparse: a record exists only
 * for Occurrences that were moved or completed. Keyed by (taskId, sourceDate)
 * — the natural day the recurrence rule produced — so completion is per
 * historical week and survives forever.
 */
export interface OccurrenceOverride extends Document {
  type: typeof TASK_OCCURRENCE;
  taskId: string;
  sourceDate: DateStr;
  /** Day the Occurrence was moved to; null = still on sourceDate. */
  movedTo: DateStr | null;
  completedOn: DateStr | null;
}

/** Document type ids (ADR 0019). */
export const TASK = "task";
export const TASK_OCCURRENCE = "task_occurrence";

/**
 * The Projects App's types, which the Tasks App only *reads* (any App may read
 * any Document): the Project a Task links to and its Milestones, so the Task's
 * own dialog can offer them. Writing them is the Projects App's business.
 */
export const PROJECT = "project";
export const PROJECT_MILESTONE = "project_milestone";
export const PROJECT_LANE = "project_lane";

/** Where a Task opens: the App has no per-task route, so the main screen. */
export const TASKS_HREF = "/app/tasks";
