import { useMemo } from "react";
import { documentsOf, normalizeTags, patchDocument, putDocument, removeDocument, useDocuments, type TimeStr, type Weekday } from "@lifeline/core";
import { compareBlockers } from "../domain/blockers";
import { TIME_BLOCKER_TYPE, type TimeBlocker } from "../domain/types";

/** PocketBase returns absent text fields as ""; re-establish null/defaults on read. */
function normalize(b: TimeBlocker): TimeBlocker {
  return {
    ...b,
    weekdays: Array.isArray(b.weekdays) ? (b.weekdays.map(Number).filter((d) => d >= 0 && d <= 6) as Weekday[]) : [],
    start: b.start || "09:00",
    end: b.end || "17:00",
    color: b.color || null,
    active: b.active !== false,
    tags: b.tags ?? [],
  };
}

export function useTimeBlockers(): TimeBlocker[] {
  const rows = useDocuments<TimeBlocker>(TIME_BLOCKER_TYPE);
  return useMemo(() => rows.map(normalize).sort(compareBlockers), [rows]);
}

export async function allTimeBlockers(): Promise<TimeBlocker[]> {
  return (await documentsOf<TimeBlocker>(TIME_BLOCKER_TYPE)).map(normalize);
}

export async function addTimeBlocker(input: {
  title: string;
  weekdays: Weekday[];
  start: TimeStr;
  end: TimeStr;
  color?: string | null;
  active?: boolean;
  tags?: string[];
}): Promise<string> {
  const row = await putDocument<TimeBlocker>({
    type: TIME_BLOCKER_TYPE,
    title: input.title,
    weekdays: [...input.weekdays].sort(),
    start: input.start,
    end: input.end,
    color: input.color ?? null,
    active: input.active !== false,
    tags: normalizeTags(input.tags ?? []),
  });
  return row.id;
}

export async function updateTimeBlocker(b: TimeBlocker): Promise<void> {
  await putDocument<TimeBlocker>({ ...b, type: TIME_BLOCKER_TYPE, weekdays: [...(b.weekdays ?? [])].sort(), tags: normalizeTags(b.tags ?? []) });
}

/** Switch a blocker off (keeping it) or back on. */
export async function setBlockerActive(id: string, active: boolean): Promise<void> {
  await patchDocument(id, { active });
}

export async function deleteTimeBlocker(id: string): Promise<void> {
  await removeDocument(id);
}
