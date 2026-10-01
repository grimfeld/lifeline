import {
  documentsOf,
  todayStr,
  useLiveQuery,
  type DateStr,
  type Document,
  vaultDocPath,
  type SchedulableItem,
  type SchedulableProvider,
  type Urgency,
} from "@lifeline/core";
import { deriveItems, describeRecurrence, parseItemId } from "./domain/occurrences";
import { allOverrides, allTasks, moveItem, setCompleted, setEstimate, useOverrides, useTasks } from "./data/repo";
import { PROJECT, type OccurrenceOverride, type Task } from "./domain/types";

/**
 * Each Project's face, read from the Projects App's Documents (ADR 0060): what
 * a Task's chip wears to say which Project it serves — the emoji, else the
 * name's first letter, in the Project's colour.
 */
function useProjectMarks(): ProjectMarks {
  return marksOf(useLiveQuery(() => documentsOf<Document>(PROJECT), [], [] as Document[]));
}

type ProjectMarks = Map<string, { text: string; color?: string }>;

function marksOf(projects: Document[]): ProjectMarks {
  return new Map(
    projects.map((p) => [
      p.id,
      {
        text: (p.emoji as string) || Array.from(p.title.trim())[0]?.toUpperCase() || "•",
        color: p.color ? `var(--chart-${String(p.color)})` : undefined,
      },
    ]),
  );
}

export const APP_ID = "tasks";

/**
 * Tasks on time surfaces. A one-time task sits on its day (or in the pool
 * when unassigned); a recurring task contributes one item per Occurrence.
 * Missing a day does not roll a task forward: it stays where it was and
 * reads as overdue (CONTEXT.md — "a simple task's placement just passes").
 * A recurring task is overdue at most once, though: an Occurrence the rule
 * has moved past has lapsed and reads as plain history (ADR 0036).
 * Moves are owned by the App: they change the task's day / the Occurrence's
 * override, never a Core Placement pin.
 */
/** Tasks and Occurrences in range as Schedulable items — what `useItems` and `itemsIn` both report. */
function itemsOf(tasks: Task[], overrides: OccurrenceOverride[], marks: ProjectMarks, range: { start: DateStr; end: DateStr }): SchedulableItem[] {
  const today = todayStr();
  return deriveItems(tasks, overrides, range, today).map((it): SchedulableItem => {
    let urgency: Urgency = "none";
    if (!it.completedOn && !it.lapsed && it.date !== null) {
      urgency = it.date < today ? "overdue" : it.date === today ? "due-today" : "upcoming";
    }
    return {
      key: `${APP_ID}/${it.itemId}`,
      appId: APP_ID,
      itemId: it.itemId,
      title: it.task.title,
      subtitle: it.task.recurrence
        ? describeRecurrence(it.task.recurrence)
        : it.task.notes || undefined,
      date: it.date,
      urgency,
      completedOn: it.completedOn,
      tags: it.task.tags ?? [],
      estimateMin: it.task.estimate,
      mark: it.task.project ? marks.get(it.task.project) : undefined,
    };
  });
}

export const tasksSchedulable: SchedulableProvider = {
  appId: APP_ID,
  overduePolicy: "stay",

  useItems(range) {
    return itemsOf(useTasks(), useOverrides(), useProjectMarks(), range);
  },

  async itemsIn(range) {
    return itemsOf(await allTasks(), await allOverrides(), marksOf(await documentsOf<Document>(PROJECT)), range);
  },

  async complete(itemId, on) {
    await setCompleted(itemId, on);
  },

  async move(itemId, to) {
    await moveItem(itemId, to);
  },

  async setEstimate(itemId, minutes) {
    await setEstimate(itemId, minutes);
  },

  // An Occurrence opens its Task: the rule is what gets edited.
  href(itemId) {
    return vaultDocPath(parseItemId(itemId).taskId);
  },
};
