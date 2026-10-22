/**
 * The Tasks App's operations and types without any UI (ADR 0060): what the
 * Projects App calls to place, tick and release Tasks — it asks, the Tasks
 * App writes, since it owns the Task. Importable where React views are not
 * wanted (a type's cascade hooks, tests).
 */
export { TASK, TASK_OCCURRENCE, TASKS_HREF, PROJECT, PROJECT_MILESTONE, PROJECT_LANE } from "./domain/types";
export type { Task, OccurrenceOverride, Recurrence } from "./domain/types";
export {
  useTasks,
  addTask,
  setCompleted,
  setArchived,
  setTaskProject,
  placeTask,
  releaseTasksOf,
  clearMilestone,
  clearLane,
  tasksOfProject,
} from "./data/repo";
export { taskTypes } from "./types";
export { resolveInProject, type ScopedKind } from "./data/scoped";
