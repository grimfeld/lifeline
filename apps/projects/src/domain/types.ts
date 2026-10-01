import type { DateStr, Document } from "@lifeline/core";

/** Document type ids (ADR 0019). The Tasks App reads the first two by these strings. */
export const PROJECT = "project";
export const PROJECT_MILESTONE = "project_milestone";
export const PROJECT_LANE = "project_lane";

export const APP_ID = "projects";
export const PROJECTS_HOME = "/module/tasks";

/**
 * Where a Project stands with the user (ADR 0060) — moved only by their hand.
 * Done is declared, never derived from the Tasks.
 */
export type Stage = "planned" | "active" | "paused" | "done" | "dropped";

export const STAGES: { value: Stage; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done" },
  { value: "dropped", label: "Dropped" },
];

export const stageLabel = (s: Stage): string => STAGES.find((x) => x.value === s)?.label ?? s;

/** Stages whose Project is still a promise: its Deadlines stand on the time Surfaces (ADR 0061). */
export const isOpenStage = (s: Stage): boolean => s === "planned" || s === "active" || s === "paused";

/** An outcome the user can declare finished (CONTEXT.md "Project"). */
export interface Project extends Document {
  type: typeof PROJECT;
  stage: Stage;
  /** One line: what finished looks like. */
  outcome: string;
  start: DateStr | null;
  deadline: DateStr | null;
  /** The day it last became Active, and the day it became Done or Dropped — what the Daylog reports. */
  startedOn: DateStr | null;
  endedOn: DateStr | null;
  /** Its face: an optional emoji and colour slot, as an Allowance's. */
  emoji: string;
  color: string;
  /** Hand order among the Projects of its stage. */
  rank: number | null;
}

/** A named checkpoint inside one Project — internal to it. */
export interface Milestone extends Document {
  type: typeof PROJECT_MILESTONE;
  project: string;
  rank: number | null;
  start: DateStr | null;
  deadline: DateStr | null;
  /** Declared reached on this day; null while still ahead. */
  reachedOn: DateStr | null;
}

/** One step of a Project's own flow — a column of its Board. */
export interface Lane extends Document {
  type: typeof PROJECT_LANE;
  project: string;
  rank: number | null;
  /** The done Lane: a Task dropped here is ticked, a ticked Task stands here. */
  done: boolean;
}

/** What a new Project's Board starts with — all editable at once. */
export const SEED_LANES: { title: string; done: boolean }[] = [
  { title: "To do", done: false },
  { title: "Doing", done: false },
  { title: "Done", done: true },
];

/** A Project's route inside the Projects Module. */
export const projectHref = (id: string): string => `/app/projects/p/${id}`;
