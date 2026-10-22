import { useEffect, useState } from "react";
import { documentsOf, getDocument, normalizeTags, putDocument, removeDocument, useLiveQuery } from "@lifeline/core";
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

/** Honest quitting (ADR 0026): the Habit's `onDelete` takes its Completions with it, from wherever it is deleted. */
export async function deleteHabit(habitId: string): Promise<void> {
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

/** Deleting a Negative takes its own Completions with it (ADR 0026) — its `onDelete`, so every delete path does. */
export async function deleteNegative(negativeId: string): Promise<void> {
  await removeDocument(negativeId);
}

export interface CompletionReward {
  /** The ledger row just written — what an "Undo" strikes out again. */
  completionId: string;
  habit: Habit;
  xpAmount: number;
  previousLevel: number;
  nextLevel: number;
  levelDelta: number;
}

export async function allHabits(): Promise<Habit[]> {
  return (await documentsOf<Habit>(HABIT)).map(normalizeHabit);
}

export async function allNegatives(): Promise<Negative[]> {
  return (await documentsOf<Negative>(NEGATIVE)).map(normalizeNegative);
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
    completionId: row.id,
    habit: normalizeHabit(habit),
    xpAmount: xpGainForPositiveCompletion(habit.difficulty),
    previousLevel: d?.previousLevel ?? prev.find((s) => s.habitId === habitId)?.level ?? 1,
    nextLevel: d?.nextLevel ?? next.find((s) => s.habitId === habitId)?.level ?? 1,
    levelDelta: d?.levelDelta ?? 0,
  };
}

export type LogNegativeResult =
  | { ok: true; completionId: string; negative: Negative; victim: Habit; damage: number }
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
  const row = await putDocument<NegativeCompletion>({
    type: NEGATIVE_COMPLETION,
    title: `Logged ${occurredAt.slice(0, 10)}`,
    negativeId,
    affectedHabitId: victim.id,
    occurredAt,
    note: opts?.note?.trim() ?? "",
  });
  return { ok: true, completionId: row.id, negative: normalizeNegative(negative), victim, damage: damageForNegativeCompletion(negative.gravity) };
}

/**
 * Strike one row from the ledger — a mis-tap undone, or a log deleted from a
 * Habit's ledger. The facts are the only thing stored, so removing one is all
 * it takes: XP, Level and debt re-derive without it (ADR 0026).
 */
export async function deleteCompletion(id: string): Promise<void> {
  await removeDocument(id);
}

let editing: Promise<unknown> = Promise.resolve();
/** One edit after another, each over the Document as stored when it runs: two changes made in quick succession never write back each other's old value. */
function inTurn(run: () => Promise<void>): Promise<void> {
  const next = editing.then(run);
  editing = next.catch(() => {});
  return next;
}

/** Change a Habit's Difficulty from its Peek (ADR 0085) — through `updateHabit`, so the ledger re-values as it does from the editor. */
export function editHabit(id: string, patch: Pick<HabitInput, "difficulty">): Promise<void> {
  return inTurn(async () => {
    const h = await getDocument<Habit>(id);
    if (!h || h.type !== HABIT) return;
    const habit = normalizeHabit(h);
    await updateHabit(habit, { title: habit.title, tags: habit.tags ?? [], difficulty: patch.difficulty });
  });
}

/** Change a Negative's Gravity or Rival habit from its Peek (ADR 0085) — through `updateNegative`. */
export function editNegative(id: string, patch: Partial<Pick<NegativeInput, "gravity" | "affectsHabitId">>): Promise<void> {
  return inTurn(async () => {
    const n = await getDocument<Negative>(id);
    if (!n || n.type !== NEGATIVE) return;
    const negative = normalizeNegative(n);
    await updateNegative(negative, { title: negative.title, gravity: negative.gravity, affectsHabitId: negative.affectsHabitId, tags: negative.tags ?? [], ...patch });
  });
}
