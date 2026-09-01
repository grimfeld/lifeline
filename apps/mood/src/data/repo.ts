import { useMemo } from "react";
import { documentsOf, patchDocument, putDocument, removeDocument, todayStr, useDocuments, type DateStr } from "@lifeline/core";
import { MOOD, type Mood, type MoodLevel } from "../domain/types";
import { moodByDate } from "../domain/grid";

/** Every Mood Document, live. */
export function useMoods(): Mood[] {
  return useDocuments<Mood>(MOOD);
}

/** Date → level for the whole history, live. The grid's one read. */
export function useMoodsByDate(): Map<DateStr, MoodLevel> {
  const moods = useMoods();
  return useMemo(() => moodByDate(moods), [moods]);
}

/** The Mood recorded for one day, or null. */
export function useMoodOn(date: DateStr): MoodLevel | null {
  return useMoodsByDate().get(date) ?? null;
}

/** A day you haven't lived can't have felt like anything (ADR 0044). */
export const isSettable = (date: DateStr, today: DateStr = todayStr()): boolean => date <= today;

/**
 * Set a day's Mood: at most one per day, so an existing one is replaced
 * rather than joined. Future days are refused.
 */
export async function setMood(date: DateStr, level: MoodLevel): Promise<void> {
  if (!isSettable(date)) return;
  const existing = (await documentsOf<Mood>(MOOD)).find((m) => m.title === date);
  if (existing) await patchDocument(existing.id, { level });
  else await putDocument<Mood>({ type: MOOD, title: date, level });
}

/** Clear a day back to "nothing recorded" — an absence, never a sixth mood. */
export async function clearMood(date: DateStr): Promise<void> {
  const existing = (await documentsOf<Mood>(MOOD)).find((m) => m.title === date);
  if (existing) await removeDocument(existing.id);
}

/** Set today's Mood, or clear it when it is already that level (the Card's toggle). */
export async function toggleMood(date: DateStr, level: MoodLevel, current: MoodLevel | null): Promise<void> {
  if (current === level) await clearMood(date);
  else await setMood(date, level);
}
