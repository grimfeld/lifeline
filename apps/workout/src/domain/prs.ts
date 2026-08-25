import type { Exercise, Measure, MovementResult, Session } from "./types";

/** The rep counts a load PR table is kept for. */
export const REP_TABLE = [1, 3, 5, 10] as const;

export interface PR {
  exerciseId: string;
  measure: Measure;
  /** Best value in the Exercise's measure; null = never recorded. */
  best: number | null;
  bestSessionId: string | null;
  bestDate: string | null;
  /** load only: best load lifted for at least N reps. */
  repTable: { reps: number; load: number; sessionId: string; date: string }[];
}

/** The value a result carries in the Exercise's measure, or null when it wasn't recorded. */
export function valueOf(measure: Measure, r: MovementResult): number | null {
  switch (measure) {
    case "load":
      return r.load;
    case "reps":
      return r.reps;
    case "time":
      return r.seconds;
    case "distance":
      return r.distance;
    case "calories":
      return r.calories;
  }
}

/**
 * PRs are derived, never stored (ADR 0030): the best a Session ever reached
 * for an Exercise, plus for loads the best load at ≥ 1/3/5/10 reps.
 */
export function prOf(exercise: Pick<Exercise, "id" | "measure">, sessions: Session[]): PR {
  const pr: PR = { exerciseId: exercise.id, measure: exercise.measure, best: null, bestSessionId: null, bestDate: null, repTable: [] };
  const table = new Map<number, { load: number; sessionId: string; date: string }>();
  for (const s of sessions) {
    for (const b of s.results ?? []) {
      for (const m of b.movements ?? []) {
        if (m.exerciseId !== exercise.id) continue;
        const v = valueOf(exercise.measure, m);
        if (v !== null && Number.isFinite(v) && (pr.best === null || v > pr.best)) {
          pr.best = v;
          pr.bestSessionId = s.id;
          pr.bestDate = s.date;
        }
        if (exercise.measure === "load" && m.load !== null && m.reps !== null) {
          for (const n of REP_TABLE) {
            if (m.reps >= n) {
              const cur = table.get(n);
              if (!cur || m.load > cur.load) table.set(n, { load: m.load, sessionId: s.id, date: s.date });
            }
          }
        }
      }
    }
  }
  pr.repTable = REP_TABLE.filter((n) => table.has(n)).map((n) => ({ reps: n, ...table.get(n)! }));
  return pr;
}

/** True when `session` beats every earlier Session for this Exercise (the "PR!" badge on save). */
export function isNewPR(exercise: Pick<Exercise, "id" | "measure">, session: Session, earlier: Session[]): boolean {
  const before = prOf(exercise, earlier).best;
  const now = prOf(exercise, [session]).best;
  return now !== null && (before === null || now > before);
}

/** "120 kg", "45 reps", "2:30", "5000 m", "60 cal". */
export function formatMeasure(measure: Measure, v: number): string {
  switch (measure) {
    case "load":
      return `${v} kg`;
    case "reps":
      return `${v} reps`;
    case "time": {
      const m = Math.floor(v / 60);
      const s = Math.round(v % 60);
      return `${m}:${String(s).padStart(2, "0")}`;
    }
    case "distance":
      return `${v} m`;
    case "calories":
      return `${v} cal`;
  }
}
