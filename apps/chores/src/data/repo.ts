import {
  db,
  put,
  remove,
  newId,
  todayStr,
  useLiveQuery,
  type DateStr,
} from "@lifeline/core";
import { CHORES, COMPLETIONS, type Chore, type Completion, type Schedule } from "../domain/types";

export function useChores(): Chore[] {
  return useLiveQuery(
    () => db().collection<Chore>(CHORES).where("deleted").equals(0).toArray(),
    [],
    [] as Chore[],
  );
}

export function useCompletions(): Completion[] {
  return useLiveQuery(
    () => db().collection<Completion>(COMPLETIONS).where("deleted").equals(0).toArray(),
    [],
    [] as Completion[],
  );
}

/** Latest completion date per chore — the input to all due computation. */
export function lastDoneMap(completions: Completion[]): Map<string, DateStr> {
  const m = new Map<string, DateStr>();
  for (const c of completions) {
    const cur = m.get(c.choreId);
    if (!cur || c.doneOn > cur) m.set(c.choreId, c.doneOn);
  }
  return m;
}

export async function addChore(input: {
  name: string;
  category: string | null;
  schedule: Schedule;
  anchorDate: DateStr | null;
}): Promise<void> {
  await put<Chore>(CHORES, {
    id: newId(),
    name: input.name,
    category: input.category,
    status: "active",
    schedule: input.schedule,
    anchorDate: input.anchorDate,
    createdAt: todayStr(),
  });
}

export async function updateChore(chore: Chore): Promise<void> {
  await put<Chore>(CHORES, chore);
}

export async function completeChore(choreId: string, on: DateStr): Promise<void> {
  await put<Completion>(COMPLETIONS, {
    id: newId(),
    choreId,
    doneOn: on,
    recordedAt: new Date().toISOString(),
  });
}

export async function setStatus(
  chore: Chore,
  status: Chore["status"],
): Promise<void> {
  // Resuming an interval chore re-anchors its cycle to today (CONTEXT.md:
  // "on resume, an interval chore becomes due today").
  const anchorDate =
    status === "active" && chore.status === "paused" && chore.schedule.kind === "interval"
      ? todayStr()
      : chore.anchorDate;
  await put<Chore>(CHORES, { ...chore, status, anchorDate });
}

/** Hard delete — allowed only for chores with zero completions. */
export async function deleteChore(choreId: string): Promise<void> {
  await remove(CHORES, choreId);
}

export async function completionCount(choreId: string): Promise<number> {
  const all = await db()
    .collection<Completion>(COMPLETIONS)
    .where("deleted")
    .equals(0)
    .toArray();
  return all.filter((c) => c.choreId === choreId).length;
}
