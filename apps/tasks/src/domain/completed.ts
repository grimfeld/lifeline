import { addDays, formatHuman, type DateStr } from "@lifeline/core";
import { occurrenceItemId, type ItemId } from "./occurrences";
import type { OccurrenceOverride, Task } from "./types";

/** One completed thing: a one-time Task, or an Occurrence of a recurring one. */
export interface CompletedEntry {
  /** Same identity as the item's ItemId, so `setCompleted(key, null)` undoes it. */
  key: ItemId;
  taskId: string;
  title: string;
  /** Recurring only: the natural day of the Occurrence. */
  sourceDate?: DateStr;
  completedOn: DateStr;
  recurring: boolean;
  /** The Task's tags; Occurrences inherit the definition's (ADR 0014). */
  tags: string[];
}

export interface CompletedGroup {
  day: DateStr;
  entries: CompletedEntry[];
}

function usable(task: Task | undefined): task is Task {
  return !!task && !task.deleted && task.status === "active";
}

/**
 * Everything completed in [from, to] (both inclusive), newest first, then by
 * title. Deleted or archived Tasks are ignored, as are Occurrences whose Task
 * is missing, deleted or archived.
 */
export function completedInRange(
  tasks: Task[],
  overrides: OccurrenceOverride[],
  from: DateStr,
  to: DateStr,
): CompletedEntry[] {
  const inRange = (d: DateStr | null): d is DateStr => d !== null && d >= from && d <= to;
  const byTask = new Map(tasks.map((t) => [t.id, t]));
  const out: CompletedEntry[] = [];

  for (const task of tasks) {
    if (!usable(task) || task.recurrence || !inRange(task.completedOn)) continue;
    out.push({
      key: task.id,
      taskId: task.id,
      title: task.title,
      completedOn: task.completedOn,
      recurring: false,
      tags: task.tags ?? [],
    });
  }
  for (const o of overrides) {
    if (o.deleted || !inRange(o.completedOn)) continue;
    const task = byTask.get(o.taskId);
    if (!usable(task) || !task.recurrence) continue;
    out.push({
      key: occurrenceItemId(o.taskId, o.sourceDate),
      taskId: o.taskId,
      title: task.title,
      sourceDate: o.sourceDate,
      completedOn: o.completedOn,
      recurring: true,
      tags: task.tags ?? [],
    });
  }
  return out.sort(
    (a, b) => b.completedOn.localeCompare(a.completedOn) || a.title.localeCompare(b.title),
  );
}

/** Groups (already sorted) entries by completion day, preserving order. */
export function groupByDay(entries: CompletedEntry[]): CompletedGroup[] {
  const groups: CompletedGroup[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.day === e.completedOn) last.entries.push(e);
    else groups.push({ day: e.completedOn, entries: [e] });
  }
  return groups;
}

/** "Today" / "Yesterday" / "Mon, Aug 10". */
export function dayLabel(day: DateStr, today: DateStr): string {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  return formatHuman(day);
}
