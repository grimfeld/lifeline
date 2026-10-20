import { useMemo } from "react";
import { documentsOf, getDocument, normalizeTags, patchDocument, putDocument, removeDocument, useDocuments, type DateStr, type TimedWhen, type TimeStr, type Weekday } from "@lifeline/core";
import { blockerSpan, compareBlockers, rescheduledBlocker } from "../domain/blockers";
import { midnightNextDay } from "../domain/span";
import { TIME_BLOCKER_TYPE, type TimeBlocker } from "../domain/types";

/** PocketBase returns absent text fields as ""; re-establish null/defaults on read. */
function normalize(b: TimeBlocker): TimeBlocker {
  const date = b.date || null;
  const start = b.start || "09:00";
  // A one-off stored ending at "24:00" ends at 00:00 the next day (ADR 0090).
  const until = date ? midnightNextDay({ date, endDate: b.endDate || null, start, end: b.end || "17:00" }) : { endDate: b.endDate || null, end: b.end || "17:00" };
  const end = until.end;
  return {
    ...b,
    date,
    // A one-off always has its end day (ADR 0090); one stored without it ends the next morning when overnight.
    endDate: blockerSpan({ date, endDate: until.endDate, start, end })?.endDate ?? null,
    weekdays: Array.isArray(b.weekdays) ? (b.weekdays.map(Number).filter((d) => d >= 0 && d <= 6) as Weekday[]) : [],
    start,
    end,
    color: b.color || null,
    active: b.active !== false,
    tags: b.tags ?? [],
  };
}

/** A one-off's end at midnight is stored as 00:00 the next day, never "24:00" (ADR 0090); a weekly rule is kept as it is. */
function oneOffMidnight<T extends Pick<TimeBlocker, "date" | "endDate" | "start" | "end">>(b: T): T {
  if (!b.date) return b;
  const { endDate, end } = midnightNextDay({ date: b.date, endDate: b.endDate ?? null, start: b.start, end: b.end });
  return { ...b, endDate, end };
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
  /** Set for a one-off blocker (ADR 0029); the weekdays are then ignored. */
  date?: DateStr | null;
  /** A one-off's end day (ADR 0090); left out, it ends on its day, or the next morning when overnight. */
  endDate?: DateStr | null;
  weekdays: Weekday[];
  start: TimeStr;
  end: TimeStr;
  color?: string | null;
  active?: boolean;
  tags?: string[];
}): Promise<string> {
  const when = input.date ? midnightNextDay({ date: input.date, endDate: input.endDate ?? null, start: input.start, end: input.end }) : { endDate: null, end: input.end };
  const row = await putDocument<TimeBlocker>({
    type: TIME_BLOCKER_TYPE,
    title: input.title,
    date: input.date ?? null,
    endDate: input.date ? (blockerSpan({ date: input.date, endDate: when.endDate, start: input.start, end: when.end })?.endDate ?? null) : null,
    weekdays: input.date ? [] : [...input.weekdays].sort(),
    start: input.start,
    end: when.end,
    color: input.color ?? null,
    active: input.active !== false,
    tags: normalizeTags(input.tags ?? []),
  });
  return row.id;
}

export async function updateTimeBlocker(b: TimeBlocker): Promise<void> {
  const kept = oneOffMidnight(b);
  await putDocument<TimeBlocker>({ ...kept, type: TIME_BLOCKER_TYPE, endDate: kept.date ? (kept.endDate ?? null) : null, weekdays: [...(b.weekdays ?? [])].sort(), tags: normalizeTags(b.tags ?? []) });
}

/** Switch a blocker off (keeping it) or back on. */
export async function setBlockerActive(id: string, active: boolean): Promise<void> {
  await patchDocument(id, { active });
}

export async function deleteTimeBlocker(id: string): Promise<void> {
  await removeDocument(id);
}

/**
 * A one-off blocker dragged or resized on the Schedule (ADR 0029), or
 * retimed in its Hours editor: it moves alone, as a whole span, across days
 * when it runs across them (ADR 0090). A weekly one refuses — a drag would
 * retime the rule for every week. A null start (dropped on the untimed strip)
 * keeps the hours and only changes the days: a band without hours is no band.
 */
export async function rescheduleTimeBlocker(id: string, when: TimedWhen): Promise<void> {
  const row = await getDocument<TimeBlocker>(id);
  if (!row || row.type !== TIME_BLOCKER_TYPE) throw new Error("That blocker is gone");
  const b = normalize(row);
  if (!b.date) throw new Error("A weekly blocker is a rule — edit it on the Events screen's Blockers tab");
  await patchDocument(id, oneOffMidnight(rescheduledBlocker(b, when)));
}
