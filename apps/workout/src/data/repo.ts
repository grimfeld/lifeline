import { useMemo } from "react";
import { documentsOf, documentsWhere, fireTallies, getDocument, newId, talliesOf, normalizeTags, patchDocument, putDocument, removeDocument, useDocuments } from "@lifeline/core";
import { EXERCISE, SESSION, WORKOUT, type Block, type BlockResult, type Category, type Exercise, type Measure, type Movement, type Session, type Workout } from "../domain/types";
import type { Tally } from "@lifeline/core";

/** PocketBase returns absent fields as "" / undefined; re-establish shapes on read. */
function normalizeExercise(e: Exercise): Exercise {
  return { ...e, category: e.category || "full-body", equipment: e.equipment ?? "", measure: e.measure || "reps", notes: e.notes ?? "", tags: e.tags ?? [] };
}

function normalizeMovement(m: Partial<Movement>): Movement {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return { exerciseId: m.exerciseId ?? "", reps: num(m.reps), load: num(m.load), seconds: num(m.seconds), distance: num(m.distance), calories: num(m.calories), cue: m.cue ?? "" };
}

function normalizeBlock(b: Partial<Block>): Block {
  const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    id: b.id || newId(),
    mode: b.mode || "intervals",
    label: b.label ?? "",
    rounds: n(b.rounds, 0),
    every: n(b.every, 60),
    work: n(b.work, 0),
    rest: n(b.rest, 0),
    cap: n(b.cap, 0),
    movements: Array.isArray(b.movements) ? b.movements.map(normalizeMovement) : [],
  };
}

function normalizeWorkout(w: Workout): Workout {
  return {
    ...w,
    notes: w.notes ?? "",
    blocks: Array.isArray(w.blocks) ? w.blocks.map(normalizeBlock) : [],
    tallies: talliesOf(w),
    tags: w.tags ?? [],
  };
}

function normalizeSession(s: Session): Session {
  return { ...s, results: Array.isArray(s.results) ? s.results : [], notes: s.notes ?? "", durationMin: Number(s.durationMin) || 0, tags: s.tags ?? [] };
}

function byTitle<T extends { title: string }>(a: T, b: T): number {
  return a.title.localeCompare(b.title);
}

// ---- Exercises ----

export function useExercises(): Exercise[] {
  const rows = useDocuments<Exercise>(EXERCISE);
  return useMemo(() => rows.map(normalizeExercise).sort(byTitle), [rows]);
}

export async function allExercises(): Promise<Exercise[]> {
  return (await documentsOf<Exercise>(EXERCISE)).map(normalizeExercise);
}

export interface ExerciseInput {
  title: string;
  category: Category;
  equipment?: string;
  measure: Measure;
  notes?: string;
  tags?: string[];
}

export async function addExercise(input: ExerciseInput): Promise<string> {
  const row = await putDocument<Exercise>({
    type: EXERCISE,
    title: input.title.trim(),
    category: input.category,
    equipment: input.equipment?.trim() ?? "",
    measure: input.measure,
    notes: input.notes?.trim() ?? "",
    tags: normalizeTags(input.tags ?? []),
  });
  return row.id;
}

export async function updateExercise(e: Exercise, input: ExerciseInput): Promise<void> {
  await putDocument<Exercise>({ ...e, ...input, title: input.title.trim(), equipment: input.equipment?.trim() ?? "", notes: input.notes?.trim() ?? "", tags: normalizeTags(input.tags ?? []) });
}

/** Refused while any Workout or Session still points at it (ADR 0030). */
export async function deleteExercise(id: string): Promise<void> {
  const workouts = (await documentsOf<Workout>(WORKOUT)).map(normalizeWorkout);
  const used = workouts.find((w) => w.blocks.some((b) => b.movements.some((m) => m.exerciseId === id)));
  if (used) throw new Error(`Still used by "${used.title}"`);
  const sessions = (await documentsOf<Session>(SESSION)).map(normalizeSession);
  if (sessions.some((s) => s.results.some((r) => r.movements.some((m) => m.exerciseId === id)))) throw new Error("Still in a past session");
  await removeDocument(id);
}

// ---- Workouts ----

export function useWorkouts(): Workout[] {
  const rows = useDocuments<Workout>(WORKOUT);
  return useMemo(() => rows.map(normalizeWorkout).sort(byTitle), [rows]);
}

export async function allWorkouts(): Promise<Workout[]> {
  return (await documentsOf<Workout>(WORKOUT)).map(normalizeWorkout).sort(byTitle);
}

export function useWorkout(id: string | undefined): Workout | undefined {
  const workouts = useWorkouts();
  return id ? workouts.find((w) => w.id === id) : undefined;
}

export async function getWorkout(id: string): Promise<Workout | undefined> {
  const row = await getDocument<Workout>(id);
  return row && row.type === WORKOUT ? normalizeWorkout(row) : undefined;
}

export interface WorkoutInput {
  title: string;
  notes?: string;
  blocks: Block[];
  tallies: Tally[];
  tags?: string[];
}

export async function addWorkout(input: WorkoutInput): Promise<string> {
  const row = await putDocument<Workout>({
    type: WORKOUT,
    title: input.title.trim(),
    notes: input.notes?.trim() ?? "",
    blocks: input.blocks.map(normalizeBlock),
    tallies: input.tallies,
    tags: normalizeTags(input.tags ?? []),
  });
  return row.id;
}

export async function updateWorkout(w: Workout, input: WorkoutInput): Promise<void> {
  await putDocument<Workout>({ ...w, ...input, title: input.title.trim(), notes: input.notes?.trim() ?? "", blocks: input.blocks.map(normalizeBlock), tags: normalizeTags(input.tags ?? []) });
}

/** Deleting a Workout keeps its Sessions — they are what happened (ADR 0030). */
export async function deleteWorkout(id: string): Promise<void> {
  await removeDocument(id);
}

// ---- Sessions ----

export function useSessions(): Session[] {
  const rows = useDocuments<Session>(SESSION);
  return useMemo(() => rows.map(normalizeSession).sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [rows]);
}

export async function allSessions(): Promise<Session[]> {
  return (await documentsOf<Session>(SESSION)).map(normalizeSession);
}

export async function sessionsOfWorkout(workoutId: string): Promise<Session[]> {
  return (await documentsWhere<Session>(SESSION, "workoutId", workoutId)).map(normalizeSession);
}

/** Local "YYYY-MM-DD" and "HH:MM" of an ISO instant. */
export function localParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
}

/**
 * A Session's local day and clock for the Timed contract: its start day, and
 * an end that never precedes the start — a run past midnight ends at "24:00"
 * on the day it started, the way a Time blocker band stops at midnight.
 */
export function sessionClock(startedAt: string, endedAt: string): { date: string; start: string; end: string } {
  const { date, time: start } = localParts(startedAt);
  const last = localParts(endedAt);
  return { date, start, end: last.date > date ? "24:00" : last.time };
}

export interface SessionInput {
  workout: Workout;
  startedAt: string;
  endedAt: string;
  results: BlockResult[];
  notes?: string;
}

/**
 * Save a run of a Workout (ADR 0030) and report it as the Workout's
 * occurrence (ADR 0059): Core fires the Workout's Tallies, once per Session.
 * The Session is written first, so a failing target never loses it.
 */
export async function saveSession(input: SessionInput): Promise<Session> {
  const { date, start, end } = sessionClock(input.startedAt, input.endedAt);
  const durationMin = Math.max(1, Math.round((new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime()) / 60_000));
  const row = await putDocument<Session>({
    type: SESSION,
    title: `${input.workout.title} · ${date}`,
    workoutId: input.workout.id,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    date,
    start,
    end,
    durationMin,
    results: input.results,
    notes: input.notes?.trim() ?? "",
    tags: input.workout.tags ?? [],
  });
  try {
    await fireTallies(input.workout, { key: row.id, at: input.endedAt, values: { duration: durationMin }, note: `Workout · ${input.workout.title}` });
  } catch (err) {
    throw new Error(`Session saved; ${(err as Error).message}`);
  }
  return normalizeSession(row);
}

export async function updateSessionNotes(id: string, notes: string, results?: BlockResult[]): Promise<void> {
  await patchDocument(id, results ? { notes, results } : { notes });
}

export async function deleteSession(id: string): Promise<void> {
  await removeDocument(id);
}
