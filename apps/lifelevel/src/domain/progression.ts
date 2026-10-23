import {
  damageForNegativeCompletion,
  effectiveDecayParams,
  expPerLevelFromDifficulty,
  xpGainForPositiveCompletion,
} from "./difficulty";
import { dayKeyOf } from "./daylog";
import type {
  ComputedHabitState,
  ComputedNegativeState,
  Habit,
  HabitCompletion,
  Negative,
  NegativeCompletion,
} from "./types";

function hoursBetween(fromIso: string, to: Date): number {
  const a = new Date(fromIso).getTime();
  return Math.max(0, (to.getTime() - a) / 3_600_000);
}

/** Oldest first, parsing each instant once rather than twice per comparison. */
function chronological<T extends { occurredAt: string }>(rows: T[]): T[] {
  return rows
    .map((row) => ({ row, at: Date.parse(row.occurredAt) }))
    .sort((a, b) => a.at - b.at)
    .map((x) => x.row);
}

/** Rows grouped by a key, each group keeping the input order. */
function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}

function levelFromExp(exp: number, expPerLevel: number): number {
  if (expPerLevel <= 0) return 1;
  return Math.max(1, Math.floor(exp / expPerLevel) + 1);
}

function expProgressInCurrentLevel(exp: number, expPerLevel: number, level: number): number {
  const base = (level - 1) * expPerLevel;
  return Math.max(0, exp - base);
}

/** EXP lost to decay for one continuous idle span (same rules as a single gap between logs). */
function decayFromIdleSpan(
  hours: number,
  effectiveDecayAfterHours: number,
  effectiveDecayIntervalHours: number,
  effectiveDecayLevelsPerInterval: number,
  expPerLevel: number,
): { ticks: number; expLoss: number } {
  if (hours <= effectiveDecayAfterHours) {
    return { ticks: 0, expLoss: 0 };
  }
  const over = hours - effectiveDecayAfterHours;
  const ticks = Math.floor(over / effectiveDecayIntervalHours);
  const expLoss = ticks * effectiveDecayLevelsPerInterval * expPerLevel;
  return { ticks, expLoss };
}

/** When the next decay tick fires if the user stays idle from the last completion through `now`. */
function nextDecayAtFromTail(
  now: Date,
  hoursSinceLastPositive: number,
  effectiveDecayAfterHours: number,
  effectiveDecayIntervalHours: number,
): string | null {
  if (hoursSinceLastPositive <= effectiveDecayAfterHours) return null;
  const over = hoursSinceLastPositive - effectiveDecayAfterHours;
  const intoInterval = over % effectiveDecayIntervalHours;
  const hoursUntilTick = effectiveDecayIntervalHours - intoInterval;
  return new Date(now.getTime() + hoursUntilTick * 3_600_000).toISOString();
}

/**
 * The whole App's derived state at one instant (ADR 0026): every number is
 * recomputed from the Completion ledger plus the wall clock. Ported from
 * life-level's progression.ts; the asymmetric floors are ADR 0025 — decay is
 * floored at 0 per idle gap, only Negative damage digs below zero.
 */
export function computeProgression(
  habits: Habit[],
  negatives: Negative[],
  habitCompletions: HabitCompletion[],
  negativeCompletions: NegativeCompletion[],
  now: Date,
): { habits: ComputedHabitState[]; negatives: ComputedNegativeState[] } {
  const negativesById = new Map(negatives.map((n) => [n.id, n]));
  const negativeCompletionsSorted = chronological(negativeCompletions);
  // One pass to group, rather than a filter over the whole ledger per Habit / Negative.
  const habitCompletionsByHabit = groupBy(chronological(habitCompletions), (c) => c.habitId);
  const negativeCompletionsByNegative = groupBy(negativeCompletionsSorted, (c) => c.negativeId);

  const penaltyByHabit = new Map<string, number>();
  for (const c of negativeCompletionsSorted) {
    const act = negativesById.get(c.negativeId);
    if (!act) continue;
    const dmg = damageForNegativeCompletion(act.gravity);
    penaltyByHabit.set(c.affectedHabitId, (penaltyByHabit.get(c.affectedHabitId) ?? 0) + dmg);
  }

  // "Already done today" is read from the ledger like every other number (ADR 0026),
  // keyed on `occurredAt` and on the local calendar day — a completion back-logged to
  // yesterday leaves today empty, and midnight clears it on its own.
  const today = dayKeyOf(now.toISOString());

  const habitsOut: ComputedHabitState[] = habits.map((act) => {
    const mine = habitCompletionsByHabit.get(act.id) ?? [];
    const expPerLevel = expPerLevelFromDifficulty(act.difficulty);
    const completionCount = mine.length;
    const completionsToday = mine.filter((c) => dayKeyOf(c.occurredAt) === today).length;
    const lastCompletedAt =
      mine.length > 0 ? mine.reduce((best, c) => (c.occurredAt > best ? c.occurredAt : best), mine[0]!.occurredAt) : null;

    const gain = xpGainForPositiveCompletion(act.difficulty);
    const totalPositiveXp = completionCount * gain;
    const penalties = penaltyByHabit.get(act.id) ?? 0;
    const netBeforeDecay = totalPositiveXp - penalties;

    let decayTicks = 0;
    let nextDecayAt: string | null = null;
    let hoursSinceLastPositive: number | null = null;

    if (lastCompletedAt) {
      hoursSinceLastPositive = hoursBetween(lastCompletedAt, now);
    }

    const { effectiveDecayAfterHours, effectiveDecayIntervalHours, effectiveDecayLevelsPerInterval } =
      effectiveDecayParams(act.difficulty);

    // Replay completions chronologically, decaying the running balance over each idle
    // gap. Decay only erodes positive XP and is floored at 0 per gap, so a long lapse
    // can never build hidden "debt" that swallows a freshly logged completion.
    let decayedGrossXp = 0;
    if (mine.length > 0) {
      for (let i = 0; i < mine.length; i++) {
        decayedGrossXp += gain;
        const fromIso = mine[i]!.occurredAt;
        const next = mine[i + 1];
        const toDate = next ? new Date(next.occurredAt) : now;
        const gapHours = hoursBetween(fromIso, toDate);
        const { expLoss } = decayFromIdleSpan(
          gapHours,
          effectiveDecayAfterHours,
          effectiveDecayIntervalHours,
          effectiveDecayLevelsPerInterval,
          expPerLevel,
        );
        decayedGrossXp = Math.max(0, decayedGrossXp - expLoss);
      }

      if (lastCompletedAt != null && hoursSinceLastPositive != null) {
        const tail = decayFromIdleSpan(
          hoursSinceLastPositive,
          effectiveDecayAfterHours,
          effectiveDecayIntervalHours,
          effectiveDecayLevelsPerInterval,
          expPerLevel,
        );
        decayTicks = tail.ticks;
        if (hoursSinceLastPositive > effectiveDecayAfterHours) {
          nextDecayAt = nextDecayAtFromTail(now, hoursSinceLastPositive, effectiveDecayAfterHours, effectiveDecayIntervalHours);
        }
      }
    }

    const rawXp = decayedGrossXp - penalties;
    const effectiveExp = rawXp;
    const effectiveForLevel = Math.max(0, rawXp);
    const level = levelFromExp(effectiveForLevel, expPerLevel);
    const expIntoLevel = rawXp < 0 ? 0 : expProgressInCurrentLevel(effectiveForLevel, expPerLevel, level);
    const expToNextLevel = rawXp < 0 ? expPerLevel : Math.max(0, expPerLevel - expIntoLevel);
    const progress01 = rawXp < 0 ? 0 : expPerLevel > 0 ? Math.min(1, expIntoLevel / expPerLevel) : 0;

    return {
      habitId: act.id,
      name: act.title,
      difficulty: act.difficulty,
      netBeforeDecay,
      rawXp,
      effectiveExp,
      level,
      expPerLevel,
      expIntoLevel,
      expToNextLevel,
      progress01,
      completionCount,
      completionsToday,
      lastCompletedAt,
      hoursSinceLastPositive,
      decayTicks,
      effectiveDecayAfterHours,
      effectiveDecayIntervalHours,
      effectiveDecayLevelsPerInterval,
      nextDecayAt,
    };
  });

  const negativesOut: ComputedNegativeState[] = negatives.map((act) => {
    const mine = negativeCompletionsByNegative.get(act.id) ?? [];
    const lastOccurredAt =
      mine.length > 0 ? mine.reduce((best, c) => (c.occurredAt > best ? c.occurredAt : best), mine[0]!.occurredAt) : null;
    return {
      negativeId: act.id,
      name: act.title,
      gravity: act.gravity,
      affectsHabitId: act.affectsHabitId || null,
      completionCount: mine.length,
      lastOccurredAt,
    };
  });

  return { habits: habitsOut, negatives: negativesOut };
}
