import type { DateStr, SyncedRecord, Weekday } from "@lifeline/core";

/**
 * How a recurring Task repeats. Weekday values follow Core's convention
 * (0 = Sunday … 6 = Saturday); the UI shows weeks Monday-first.
 * Designed as a union so intervals/monthly can join later.
 */
export type Recurrence = { kind: "weekly"; weekdays: Weekday[] };

export type TaskStatus = "active" | "archived";

/**
 * A unit of work (CONTEXT.md). One-time and recurring Tasks are asymmetric
 * on purpose (week-planner ADR 0001): a one-time Task's day and completion
 * live on the record itself; a recurring Task's per-day state lives in
 * Occurrence overrides. Callers use the unified intents in data/repo.ts and
 * never branch on kind.
 */
export interface Task extends SyncedRecord {
  title: string;
  notes: string;
  status: TaskStatus;
  /** One-time only: the day it is assigned to. null = Unassigned pool. */
  date: DateStr | null;
  /** One-time only: set when done. */
  completedOn: DateStr | null;
  /** Recurring only. null = one-time. */
  recurrence: Recurrence | null;
  /** Recurring Tasks generate Occurrences from this day on. */
  createdAt: DateStr;
}

/**
 * Per-Occurrence state of a recurring Task, sparse: a record exists only
 * for Occurrences that were moved or completed. Keyed by (taskId, sourceDate)
 * — the natural day the recurrence rule produced — so completion is per
 * historical week and survives forever.
 */
export interface OccurrenceOverride extends SyncedRecord {
  taskId: string;
  sourceDate: DateStr;
  /** Day the Occurrence was moved to; null = still on sourceDate. */
  movedTo: DateStr | null;
  completedOn: DateStr | null;
}

export const TASKS = "tasks";
export const OCCURRENCES = "task_occurrences";
