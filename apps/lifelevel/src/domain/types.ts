import type { Document } from "@lifeline/core";

export const APP_ID = "lifelevel";

/** Document type ids (ADR 0019) — match life-level's final collection names. */
export const HABIT = "habit";
export const NEGATIVE = "negative";
export const HABIT_COMPLETION = "habit_completion";
export const NEGATIVE_COMPLETION = "negative_completion";

export const DIFFICULTIES = ["easy", "normal", "hard", "expert", "master"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const GRAVITIES = ["minor", "severe", "catastrophic"] as const;
export type Gravity = (typeof GRAVITIES)[number];

/**
 * A Habit (CONTEXT.md): a positive activity, an XP-bearing track. Completing
 * earns XP toward its Level; idleness bleeds XP through Decay. Only the
 * Difficulty is stored — every number is derived (ADR 0026).
 */
export interface Habit extends Document {
  type: typeof HABIT;
  difficulty: Difficulty;
}

/**
 * A Negative activity: an anti-habit that drains XP from a Habit. Fixed mode
 * pairs it with one rival Habit (`affectsHabitId`); "" means random mode —
 * every log rolls a fresh victim (the roll is persisted on the completion).
 */
export interface Negative extends Document {
  type: typeof NEGATIVE;
  gravity: Gravity;
  /** Rival Habit id; "" = random targeting. */
  affectsHabitId: string;
}

/** One logged occurrence of a Habit. `occurredAt` is when it really happened (back-logging allowed). */
export interface HabitCompletion extends Document {
  type: typeof HABIT_COMPLETION;
  habitId: string;
  occurredAt: string;
  note: string;
}

/**
 * One logged occurrence of a Negative activity. `affectedHabitId` is the
 * Habit it hit — the persisted outcome of the fixed pair or the random roll,
 * a fact, never re-rolled (ADR 0026).
 */
export interface NegativeCompletion extends Document {
  type: typeof NEGATIVE_COMPLETION;
  negativeId: string;
  affectedHabitId: string;
  occurredAt: string;
  note: string;
}

/** Derived, never stored (ADR 0026): a Habit's whole progression state at one instant. */
export interface ComputedHabitState {
  habitId: string;
  name: string;
  difficulty: Difficulty;
  /** Completions XP minus penalties (signed, before decay eats completion XP). */
  netBeforeDecay: number;
  /** Decayed completion XP minus penalties; the signed Raw XP shown in UI. Negative = debt. */
  rawXp: number;
  /** Same as rawXp; used by diffs and damage feedback. */
  effectiveExp: number;
  level: number;
  expPerLevel: number;
  expIntoLevel: number;
  expToNextLevel: number;
  progress01: number;
  completionCount: number;
  /** Completions logged on the local calendar day of `now` — the "already done today" fact. */
  completionsToday: number;
  lastCompletedAt: string | null;
  hoursSinceLastPositive: number | null;
  /** Decay ticks accrued in the idle tail since the last completion. */
  decayTicks: number;
  effectiveDecayAfterHours: number;
  effectiveDecayIntervalHours: number;
  effectiveDecayLevelsPerInterval: number;
  nextDecayAt: string | null;
}

export interface ComputedNegativeState {
  negativeId: string;
  name: string;
  gravity: Gravity;
  /** null = random targeting. */
  affectsHabitId: string | null;
  completionCount: number;
  lastOccurredAt: string | null;
}
