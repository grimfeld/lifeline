import type { DaylogItem } from "@lifeline/core";
import { damageForNegativeCompletion, xpGainForPositiveCompletion } from "./difficulty";
import { APP_ID, type Habit, type HabitCompletion, type Negative, type NegativeCompletion } from "./types";

export function habitHref(habitId: string): string {
  return `/app/lifelevel/${habitId}`;
}

export const LIFELEVEL_HREF = "/app/lifelevel";

/** Local "YYYY-MM-DD" of an ISO instant. */
export function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Local "HH:MM" of an ISO instant. */
export function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
}

/**
 * The Daylog facts of Life Level for one local day, keyed on `occurredAt` —
 * a back-logged completion appears on the day it happened, not the day it
 * was typed. Completions of unknown parents are skipped (cascade deletion
 * should make that impossible; sync races shouldn't crash the Journal).
 */
export function daylogItems(
  habits: Habit[],
  negatives: Negative[],
  habitCompletions: HabitCompletion[],
  negativeCompletions: NegativeCompletion[],
  day: string,
): DaylogItem[] {
  const habitById = new Map(habits.map((h) => [h.id, h]));
  const negativeById = new Map(negatives.map((n) => [n.id, n]));
  const out: DaylogItem[] = [];
  for (const c of habitCompletions) {
    if (dayKeyOf(c.occurredAt) !== day) continue;
    const h = habitById.get(c.habitId);
    if (!h) continue;
    out.push({
      key: `${APP_ID}/${c.id}`,
      appId: APP_ID,
      itemId: h.id,
      kind: "Completed",
      title: h.title,
      subtitle: `+${Math.round(xpGainForPositiveCompletion(h.difficulty))} XP`,
      time: timeOf(c.occurredAt),
      href: habitHref(h.id),
      tags: h.tags ?? [],
    });
  }
  for (const c of negativeCompletions) {
    if (dayKeyOf(c.occurredAt) !== day) continue;
    const n = negativeById.get(c.negativeId);
    if (!n) continue;
    const victim = habitById.get(c.affectedHabitId);
    out.push({
      key: `${APP_ID}/${c.id}`,
      appId: APP_ID,
      itemId: n.id,
      kind: "Logged",
      title: n.title,
      subtitle: `−${Math.round(damageForNegativeCompletion(n.gravity))} XP · ${victim ? victim.title : "a deleted habit"}`,
      time: timeOf(c.occurredAt),
      href: LIFELEVEL_HREF,
      tags: n.tags ?? [],
    });
  }
  return out;
}
