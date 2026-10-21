import {
  documentsOf,
  documentsWhere,
  normalizeTags,
  patchDocument,
  putDocument,
  removeDocument,
  removePlacementsOf,
  todayStr,
  useDocuments,
  type DateStr,
} from "@lifeline/core";
import { useMemo } from "react";
import { uniqueCompletions } from "../domain/completions";
import { CHORE, COMPLETION, type Chore, type Completion, type Schedule } from "../domain/types";

export function useChores(): Chore[] {
  return useDocuments<Chore>(CHORE);
}

/** Every completion, one per chore per day, read once outside React. */
export async function allCompletions(): Promise<Completion[]> {
  return uniqueCompletions(await documentsOf<Completion>(COMPLETION));
}

/** Every completion, one per chore per day (see `uniqueCompletions`). */
export function useCompletions(): Completion[] {
  const raw = useDocuments<Completion>(COMPLETION);
  return useMemo(() => uniqueCompletions(raw), [raw]);
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
  title: string;
  tags: string[];
  schedule: Schedule;
  anchorDate: DateStr | null;
}): Promise<string> {
  const chore = await putDocument<Chore>({
    type: CHORE,
    title: input.title,
    tags: normalizeTags(input.tags),
    status: "active",
    schedule: input.schedule,
    anchorDate: input.anchorDate,
    createdAt: todayStr(),
  });
  return chore.id;
}

export async function updateChore(chore: Chore): Promise<void> {
  await putDocument<Chore>({ ...chore, tags: normalizeTags(chore.tags) });
}

/**
 * Record that a chore was done on a day. Once per day: a second tick on the
 * same day records nothing and returns false, so a double click, a stale
 * button or two surfaces offering the same chore cannot log it twice.
 */
export async function completeChore(choreId: string, on: DateStr): Promise<boolean> {
  const existing = await documentsWhere<Completion>(COMPLETION, "choreId", choreId);
  if (existing.some((c) => c.doneOn === on)) return false;
  await putDocument<Completion>({
    type: COMPLETION,
    choreId,
    doneOn: on,
    recordedAt: new Date().toISOString(),
  });
  return true;
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
  // Only what the operation changes, so a Field edited meanwhile elsewhere is not written back.
  await patchDocument(chore.id, { status, anchorDate });
}

/** A new Schedule for a Chore; its cycle's anchor stays, as when edited in the dialog. */
export async function rescheduleChore(choreId: string, schedule: Schedule): Promise<void> {
  await patchDocument(choreId, { schedule });
}

/** Tombstone — allowed only for chores with zero completions. */
export async function deleteChore(choreId: string): Promise<void> {
  await removeDocument(choreId);
  await removePlacementsOf("chores", choreId);
}

export async function completionCount(choreId: string): Promise<number> {
  return (await documentsWhere<Completion>(COMPLETION, "choreId", choreId)).length;
}

/** Every live chore, outside React. */
export async function allChores(): Promise<Chore[]> {
  return documentsOf<Chore>(CHORE);
}
