import { useEffect, useState } from "react";
import { documentsOf, documentsWhere, getDocument, normalizeTags, putDocument, removeDocument, useLiveQuery } from "@lifeline/core";
import { damageForNegativeCompletion, xpGainForPositiveCompletion } from "../domain/difficulty";
import { computeProgression } from "../domain/progression";
import { diffHabit } from "../domain/progressionDiff";
import {
  HABIT,
  HABIT_COMPLETION,
  NEGATIVE,
  NEGATIVE_COMPLETION,
  type Difficulty,
  type Gravity,
  type Habit,
  type HabitCompletion,
  type Negative,
  type NegativeCompletion,
} from "../domain/types";

/** PocketBase stores an absent text as "" — re-establish domain defaults on read. */
function normalizeHabit(h: Habit): Habit {
  return { ...h, tags: h.tags ?? [] };
}
function normalizeNegative(n: Negative): Negative {
  return { ...n, affectsHabitId: n.affectsHabitId ?? "", tags: n.tags ?? [] };
}
function normalizeCompletion<T extends HabitCompletion | NegativeCompletion>(c: T): T {
  return { ...c, note: c.note ?? "", tags: c.tags ?? [] };
}

/** Habits in creation order, like Stats. */
export function useHabits(): Habit[] {
  return useLiveQuery(
    async () =>
      (await documentsOf<Habit>(HABIT))
        .map(normalizeHabit)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.updatedAt.localeCompare(b.updatedAt)),
    [],
    [] as Habit[],
  );
}

export function useNegatives(): Negative[] {
  return useLiveQuery(
    async () =>
      (await documentsOf<Negative>(NEGATIVE))
        .map(normalizeNegative)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.updatedAt.localeCompare(b.updatedAt)),
    [],
    [] as Negative[],
  );
}

/** All completions, all-time: the ledger is the whole product and personal scale is small. */
export function useHabitCompletions(): HabitCompletion[] {
  return useLiveQuery(async () => (await documentsOf<HabitCompletion>(HABIT_COMPLETION)).map(normalizeCompletion), [], [] as HabitCompletion[]);
}

export function useNegativeCompletions(): NegativeCompletion[] {
  return useLiveQuery(async () => (await documentsOf<NegativeCompletion>(NEGATIVE_COMPLETION)).map(normalizeCompletion), [], [] as NegativeCompletion[]);
}

export function useHabit(id: string | undefined): Habit | undefined {
  return useLiveQuery(
    async () => {
      if (!id) return undefined;
      const h = await getDocument<Habit>(id);
      return h && h.type === HABIT ? normalizeHabit(h) : undefined;
    },
    [id],
    undefined,
  );
}

/**
 * A ticking `now` for progression (ADR 0026): Levels move with the wall
 * clock alone, so anything showing one recomputes on a timer.
 */
export function useProgressionNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

export interface HabitInput {
  title: string;
  difficulty: Difficulty;
  tags: string[];
}

export async function addHabit(input: HabitInput): Promise<string> {
  const row = await putDocument<Habit>({ type: HABIT, title: input.title.trim(), difficulty: input.difficulty, tags: normalizeTags(input.tags) });
  return row.id;
}

/** Difficulty edits are retroactive by design (ADR 0026): the ledger re-values. */
export async function updateHabit(habit: Habit, input: HabitInput): Promise<void> {
  await putDocument<Habit>({ ...habit, title: input.title.trim(), difficulty: input.difficulty, tags: normalizeTags(input.tags) });
}

/**
 * Honest quitting (ADR 0026): the Habit's own completions die with it, and so
 * do the Negative completions that hit it — earned levels and debt together.
 */
export async function deleteHabit(habitId: string): Promise<void> {
  const own = await documentsWhere<HabitCompletion>(HABIT_COMPLETION, "habitId", habitId);
  for (const c of own) await removeDocument(c.id);
  const hits = await documentsWhere<NegativeCompletion>(NEGATIVE_COMPLETION, "affectedHabitId", habitId);
  for (const c of hits) await removeDocument(c.id);
  await removeDocument(habitId);
}

export interface NegativeInput {
  title: string;
  gravity: Gravity;
  /** "" = random targeting. */
  affectsHabitId: string;
  tags: string[];
}

export async function addNegative(input: NegativeInput): Promise<string> {
  const row = await putDocument<Negative>({
    type: NEGATIVE,
    title: input.title.trim(),
    gravity: input.gravity,
    affectsHabitId: input.affectsHabitId,
    tags: normalizeTags(input.tags),
  });
  return row.id;
}

export async function updateNegative(negative: Negative, input: NegativeInput): Promise<void> {
  await putDocument<Negative>({ ...negative, title: input.title.trim(), gravity: input.gravity, affectsHabitId: input.affectsHabitId, tags: normalizeTags(input.tags) });
}

export async function deleteNegative(negativeId: string): Promise<void> {
  const own = await documentsWhere<NegativeCompletion>(NEGATIVE_COMPLETION, "negativeId", negativeId);
  for (const c of own) await removeDocument(c.id);
  await removeDocument(negativeId);
}

export interface CompletionReward {
  habit: Habit;
  xpAmount: number;
  previousLevel: number;
  nextLevel: number;
  levelDelta: number;
}

/**
 * Complete a Habit: append to the ledger and report what changed (for the
 * ding / level-up burst). `occurredAt` defaults to now; back-logging allowed.
 */
export async function completeHabit(habitId: string, opts?: { occurredAt?: string; note?: string }): Promise<CompletionReward | null> {
  const habit = await getDocument<Habit>(habitId);
  if (!habit || habit.type !== HABIT) return null;
  const [habits, negatives, habitCompletions, negativeCompletions] = await Promise.all([
    documentsOf<Habit>(HABIT),
    documentsOf<Negative>(NEGATIVE),
    documentsOf<HabitCompletion>(HABIT_COMPLETION),
    documentsOf<NegativeCompletion>(NEGATIVE_COMPLETION),
  ]);
  const now = new Date();
  const occurredAt = opts?.occurredAt ?? now.toISOString();
  const prev = computeProgression(habits, negatives, habitCompletions, negativeCompletions, now).habits;
  const row = await putDocument<HabitCompletion>({
    type: HABIT_COMPLETION,
    title: `Done ${occurredAt.slice(0, 10)}`,
    habitId,
    occurredAt,
    note: opts?.note?.trim() ?? "",
  });
  const next = computeProgression(habits, negatives, [...habitCompletions, row], negativeCompletions, now).habits;
  const d = diffHabit(prev, next, habitId);
  return {
    habit: normalizeHabit(habit),
    xpAmount: xpGainForPositiveCompletion(habit.difficulty),
    previousLevel: d?.previousLevel ?? prev.find((s) => s.habitId === habitId)?.level ?? 1,
    nextLevel: d?.nextLevel ?? next.find((s) => s.habitId === habitId)?.level ?? 1,
    levelDelta: d?.levelDelta ?? 0,
  };
}

export type LogNegativeResult =
  | { ok: true; negative: Negative; victim: Habit; damage: number }
  | { ok: false; reason: "no-habits" | "unpaired" };

/**
 * Log a Negative activity. The victim is resolved *now* and persisted on the
 * completion (ADR 0026): the fixed rival, or a fresh uniform roll over every
 * Habit. Blocked — never a whiff — when there is no Habit to hit, or when a
 * fixed Negative's rival is gone (re-pair first, ADR 0026).
 */
export async function logNegative(negativeId: string, opts?: { occurredAt?: string; note?: string }): Promise<LogNegativeResult | null> {
  const negative = await getDocument<Negative>(negativeId);
  if (!negative || negative.type !== NEGATIVE) return null;
  const habits = (await documentsOf<Habit>(HABIT)).map(normalizeHabit);
  if (habits.length === 0) return { ok: false, reason: "no-habits" };
  let victim: Habit | undefined;
  if (negative.affectsHabitId) {
    victim = habits.find((h) => h.id === negative.affectsHabitId);
    if (!victim) return { ok: false, reason: "unpaired" };
  } else {
    victim = habits[Math.floor(Math.random() * habits.length)];
  }
  const occurredAt = opts?.occurredAt ?? new Date().toISOString();
  await putDocument<NegativeCompletion>({
    type: NEGATIVE_COMPLETION,
    title: `Logged ${occurredAt.slice(0, 10)}`,
    negativeId,
    affectedHabitId: victim.id,
    occurredAt,
    note: opts?.note?.trim() ?? "",
  });
  return { ok: true, negative: normalizeNegative(negative), victim, damage: damageForNegativeCompletion(negative.gravity) };
}

export async function deleteCompletion(id: string): Promise<void> {
  await removeDocument(id);
}
