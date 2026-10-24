import type { DateStr, Document, Tally, TimeStr } from "@lifeline/core";

export const APP_ID = "workout";
export const WORKOUT_HREF = "/app/workout";

export function runHref(workoutId: string): string {
  return `${WORKOUT_HREF}/run/${workoutId}`;
}

/** Document type ids (ADR 0030). */
export const WORKOUT = "workout";
export const EXERCISE = "exercise";
export const SESSION = "workout_session";

export const CATEGORIES = ["push", "pull", "legs", "core", "cardio", "full-body"] as const;
export type Category = (typeof CATEGORIES)[number];

/** The one number worth beating for an Exercise (CONTEXT.md "Exercise"). */
export const MEASURES = ["load", "reps", "time", "distance", "calories"] as const;
export type Measure = (typeof MEASURES)[number];

export const MEASURE_LABEL: Record<Measure, string> = {
  load: "Load (kg × reps)",
  reps: "Reps",
  time: "Time",
  distance: "Distance (m)",
  calories: "Calories",
};

/** A library entry, hand-curated (ADR 0030). */
export interface Exercise extends Document {
  type: typeof EXERCISE;
  category: Category;
  equipment: string;
  measure: Measure;
  notes: string;
}

export const MODES = ["emom", "amrap", "tabata", "fortime", "intervals"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABEL: Record<Mode, string> = {
  emom: "EMOM",
  amrap: "AMRAP",
  tabata: "Tabata",
  fortime: "For Time",
  intervals: "Intervals",
};

/**
 * An Exercise inside a Block with its dose (CONTEXT.md "Movement"). Only the
 * fields that make sense for the Exercise's measure are filled; the rest
 * stay null.
 */
export interface Movement {
  exerciseId: string;
  reps: number | null;
  /** kg */
  load: number | null;
  seconds: number | null;
  /** metres */
  distance: number | null;
  calories: number | null;
  cue: string;
}

/**
 * One timed part of a Workout (CONTEXT.md "Block"). One shape for every
 * mode; which fields matter depends on `mode`:
 *   emom      — `rounds` minutes, a Movement `every` seconds (60 by default)
 *   amrap     — `cap` seconds of as-many-rounds-as-possible
 *   tabata    — `rounds` × (`work` s on / `rest` s off), 8 × 20/10 by default
 *   fortime   — count up to `cap` seconds
 *   intervals — `rounds` × (`work` s on / `rest` s off)
 */
export interface Block {
  id: string;
  mode: Mode;
  label: string;
  rounds: number;
  /** emom: seconds per round. */
  every: number;
  work: number;
  rest: number;
  /** amrap / fortime: total seconds. */
  cap: number;
  movements: Movement[];
}

/** A plan for a training session (CONTEXT.md "Workout", ADR 0030). */
export interface Workout extends Document {
  type: typeof WORKOUT;
  notes: string;
  blocks: Block[];
  tallies: Tally[];
}

/** What a Movement actually got in a Session; null = as planned / not recorded. */
export interface MovementResult {
  exerciseId: string;
  reps: number | null;
  load: number | null;
  seconds: number | null;
  distance: number | null;
  calories: number | null;
}

/** One Block's result in its mode's own terms. */
export interface BlockResult {
  blockId: string;
  mode: Mode;
  /** emom / tabata / intervals / amrap: rounds completed. */
  rounds: number | null;
  /** amrap: reps into the unfinished round. */
  extraReps: number | null;
  /** fortime: the clock when done; null = hit the cap. */
  seconds: number | null;
  movements: MovementResult[];
}

/** One run of a Workout (CONTEXT.md "Session", ADR 0030). */
export interface Session extends Document {
  type: typeof SESSION;
  workoutId: string;
  /** ISO instants. */
  startedAt: string;
  endedAt: string;
  /** Local day and clock of `startedAt` / `endedAt`, for the Timed contract and Bases. */
  date: DateStr;
  start: TimeStr;
  end: TimeStr;
  /** Minutes, whole. */
  durationMin: number;
  results: BlockResult[];
  notes: string;
}

export function emptyMovement(exerciseId = ""): Movement {
  return { exerciseId, reps: null, load: null, seconds: null, distance: null, calories: null, cue: "" };
}

/** A Block in a mode with that mode's usual numbers. */
export function defaultBlock(id: string, mode: Mode): Block {
  const base: Block = { id, mode, label: "", rounds: 0, every: 60, work: 0, rest: 0, cap: 0, movements: [] };
  switch (mode) {
    case "emom":
      return { ...base, rounds: 10, every: 60 };
    case "amrap":
      return { ...base, cap: 12 * 60 };
    case "tabata":
      return { ...base, rounds: 8, work: 20, rest: 10 };
    case "fortime":
      return { ...base, cap: 20 * 60 };
    case "intervals":
      return { ...base, rounds: 5, work: 60, rest: 30 };
  }
}
