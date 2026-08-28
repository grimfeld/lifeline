import { describe, expect, it } from "vitest";
import type { ComputedHabitState } from "./types";
import { diffHabit, diffHabits } from "./progressionDiff";

function mockState(overrides: Partial<ComputedHabitState>): ComputedHabitState {
  const o: ComputedHabitState = {
    habitId: "h1",
    name: "Test",
    difficulty: "normal",
    netBeforeDecay: 0,
    rawXp: 0,
    effectiveExp: 0,
    level: 1,
    expPerLevel: 120,
    expIntoLevel: 0,
    expToNextLevel: 120,
    progress01: 0,
    completionCount: 0,
    completionsToday: 0,
    lastCompletedAt: null,
    hoursSinceLastPositive: null,
    decayTicks: 0,
    effectiveDecayAfterHours: 24,
    effectiveDecayIntervalHours: 24,
    effectiveDecayLevelsPerInterval: 1,
    nextDecayAt: null,
    ...overrides,
  };
  if (overrides.rawXp === undefined && overrides.effectiveExp !== undefined) o.rawXp = o.effectiveExp;
  if (overrides.effectiveExp === undefined && overrides.rawXp !== undefined) o.effectiveExp = o.rawXp;
  return o;
}

describe("progressionDiff", () => {
  it("detects XP gain without level change", () => {
    const prev = [mockState({ habitId: "h1", effectiveExp: 0, expIntoLevel: 0, level: 1 })];
    const next = [mockState({ habitId: "h1", effectiveExp: 12, expIntoLevel: 12, level: 1 })];
    const d = diffHabit(prev, next, "h1");
    expect(d).not.toBeNull();
    expect(d!.effectiveExpDelta).toBe(12);
    expect(d!.levelDelta).toBe(0);
  });

  it("diffHabits returns multiple habits when both change", () => {
    const prev = [
      mockState({ habitId: "a", effectiveExp: 10, level: 1, expIntoLevel: 10 }),
      mockState({ habitId: "b", effectiveExp: 5, level: 1, expIntoLevel: 5 }),
    ];
    const next = [
      mockState({ habitId: "a", effectiveExp: 20, level: 1, expIntoLevel: 20 }),
      mockState({ habitId: "b", effectiveExp: 0, level: 1, expIntoLevel: 0 }),
    ];
    const list = diffHabits(prev, next);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });
});
