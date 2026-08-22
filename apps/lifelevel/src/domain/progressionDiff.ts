import type { ComputedHabitState } from "./types";

export type HabitProgressionDelta = {
  habitId: string;
  name: string;
  effectiveExpDelta: number;
  levelDelta: number;
  previousLevel: number;
  nextLevel: number;
  expIntoLevelDelta: number;
};

function byHabitId(list: ComputedHabitState[]): Map<string, ComputedHabitState> {
  return new Map(list.map((p) => [p.habitId, p]));
}

/** Compare two progression snapshots (same `now` is fine) — drives the level-up burst. */
export function diffHabits(prev: ComputedHabitState[], next: ComputedHabitState[]): HabitProgressionDelta[] {
  const prevM = byHabitId(prev);
  const out: HabitProgressionDelta[] = [];
  for (const n of next) {
    const p = prevM.get(n.habitId);
    if (!p) continue;
    const effectiveExpDelta = n.effectiveExp - p.effectiveExp;
    const levelDelta = n.level - p.level;
    const expIntoLevelDelta = n.expIntoLevel - p.expIntoLevel;
    if (effectiveExpDelta === 0 && levelDelta === 0 && expIntoLevelDelta === 0) continue;
    out.push({
      habitId: n.habitId,
      name: n.name,
      effectiveExpDelta,
      levelDelta,
      previousLevel: p.level,
      nextLevel: n.level,
      expIntoLevelDelta,
    });
  }
  return out;
}

export function diffHabit(
  prev: ComputedHabitState[],
  next: ComputedHabitState[],
  habitId: string,
): HabitProgressionDelta | null {
  return diffHabits(prev, next).find((d) => d.habitId === habitId) ?? null;
}
