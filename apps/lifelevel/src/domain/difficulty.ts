import type { Difficulty, Gravity } from "./types";

/**
 * All tuning constants live here, keyed only by Difficulty/Gravity — no
 * per-Habit knobs (ADR 0026). Ported verbatim from life-level.
 */
export const BASE_XP_PER_COMPLETION = 10;
export const BASE_NEGATIVE_DAMAGE = 18;
export const BASE_DECAY_AFTER_HOURS = 24;
export const BASE_DECAY_INTERVAL_HOURS = 24;
export const BASE_DECAY_LEVELS_PER_INTERVAL = 1;
export const BASE_EXP_PER_LEVEL = 120;

const XP_POSITIVE: Record<Difficulty, number> = {
  easy: 1,
  normal: 1.25,
  hard: 1.5,
  expert: 1.85,
  master: 2.25,
};

const DECAY_EASE_POSITIVE: Record<Difficulty, number> = {
  easy: 1,
  normal: 1.2,
  hard: 1.45,
  expert: 1.75,
  master: 2.1,
};

const PENALTY_NEGATIVE: Record<Gravity, number> = {
  minor: 1,
  severe: 1.7,
  catastrophic: 2.6,
};

const EXP_PER_LEVEL: Record<Difficulty, number> = {
  easy: 140,
  normal: 120,
  hard: 100,
  expert: 90,
  master: 80,
};

export function xpMultiplierPositive(d: Difficulty): number {
  return XP_POSITIVE[d];
}

/** Higher = gentler decay (longer grace, longer interval, fewer levels per tick). */
export function decayEasePositive(d: Difficulty): number {
  return DECAY_EASE_POSITIVE[d];
}

export function penaltyMultiplierNegative(g: Gravity): number {
  return PENALTY_NEGATIVE[g];
}

/** Reward for the struggle: harder Habits earn more per completion. */
export function xpGainForPositiveCompletion(difficulty: Difficulty): number {
  return BASE_XP_PER_COMPLETION * xpMultiplierPositive(difficulty);
}

/** Punishment by harm, not effort: Gravity alone sets the damage. */
export function damageForNegativeCompletion(gravity: Gravity): number {
  return BASE_NEGATIVE_DAMAGE * penaltyMultiplierNegative(gravity);
}

/** Steeper levelling at higher difficulty is expressed as fewer XP per level. */
export function expPerLevelFromDifficulty(difficulty: Difficulty): number {
  return EXP_PER_LEVEL[difficulty] ?? BASE_EXP_PER_LEVEL;
}

export function effectiveDecayParams(
  difficulty: Difficulty,
  baseDecayAfterHours = BASE_DECAY_AFTER_HOURS,
  baseDecayIntervalHours = BASE_DECAY_INTERVAL_HOURS,
  baseDecayLevelsPerInterval = BASE_DECAY_LEVELS_PER_INTERVAL,
) {
  const ease = decayEasePositive(difficulty);
  const effectiveAfter = baseDecayAfterHours * ease;
  const effectiveInterval = baseDecayIntervalHours * ease;
  const rawLevels = baseDecayLevelsPerInterval / ease;
  const effectiveLevels = Math.max(1, Math.ceil(rawLevels));
  return {
    effectiveDecayAfterHours: effectiveAfter,
    effectiveDecayIntervalHours: effectiveInterval,
    effectiveDecayLevelsPerInterval: effectiveLevels,
  };
}
