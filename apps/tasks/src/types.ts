import type { DocumentTypeDef } from "@lifeline/core";
import { ListTodo } from "lucide-react";
import { TASK, TASK_OCCURRENCE, TASKS_HREF, type Recurrence } from "./domain/types";
import { describeRecurrence } from "./domain/occurrences";

/**
 * The Tasks App's Document types (ADR 0019). `date`, `completedOn` and
 * `recurrence` are guarded: moving and completing go through the App's
 * intents (ADR 0004), never a raw Base write.
 */
export const taskType: DocumentTypeDef = {
  id: TASK,
  label: "Tasks",
  icon: ListTodo,
  titleRule: "name",
  body: "none",
  order: 10,
  linkable: { subtitle: (d) => (d.recurrence ? describeRecurrence(d.recurrence as Recurrence) : undefined) },
  href: () => TASKS_HREF,
  indexes: ["date", "status"],
  fields: [
    { key: "status", label: "Status", kind: "select", options: [{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }], column: true },
    { key: "date", label: "Day", kind: "date", guarded: true, column: true },
    { key: "completedOn", label: "Completed on", kind: "date", guarded: true, column: true },
    { key: "recurrence", label: "Recurrence", kind: "text", guarded: true, hidden: true },
    { key: "estimate", label: "Estimate (min)", kind: "number", column: true },
    { key: "notes", label: "Notes", kind: "longtext" },
  ],
  builtIn: true,
};

export const occurrenceType: DocumentTypeDef = {
  id: TASK_OCCURRENCE,
  label: "Task occurrences",
  internal: true,
  titleRule: "derived",
  titleOf: (d) => `${d.taskId} · ${d.sourceDate}`,
  body: "none",
  indexes: ["taskId", "[type+taskId+sourceDate]", "movedTo"],
  fields: [
    { key: "taskId", label: "Task", kind: "link", linkType: TASK, guarded: true },
    { key: "sourceDate", label: "Source day", kind: "date", guarded: true },
    { key: "movedTo", label: "Moved to", kind: "date", guarded: true },
    { key: "completedOn", label: "Completed on", kind: "date", guarded: true },
  ],
  builtIn: true,
};

export const taskTypes: DocumentTypeDef[] = [taskType, occurrenceType];
