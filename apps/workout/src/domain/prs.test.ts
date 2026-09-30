import { describe, expect, it } from "vitest";
import { formatMeasure, isNewPR, prOf } from "./prs";
import type { MovementResult, Session } from "./types";

function result(exerciseId: string, over: Partial<MovementResult>): MovementResult {
  return { exerciseId, reps: null, load: null, seconds: null, distance: null, calories: null, ...over };
}
function session(id: string, date: string, movements: MovementResult[]): Session {
  return {
    id,
    type: "workout_session",
    title: "",
    tags: [],
    folder: "",
    createdAt: date,
    updatedAt: "",
    deleted: 0,
    workoutId: "w",
    startedAt: "",
    endedAt: "",
    date,
    start: "09:00",
    end: "09:30",
    durationMin: 30,
    results: [{ blockId: "b", mode: "emom", rounds: null, extraReps: null, seconds: null, movements }],
    notes: "",
  };
}
const deadlift = { id: "dl", measure: "load" as const };
const plank = { id: "pl", measure: "time" as const };

describe("prOf", () => {
  const s1 = session("s1", "2026-08-01", [result("dl", { load: 100, reps: 5 }), result("pl", { seconds: 60 })]);
  const s2 = session("s2", "2026-08-10", [result("dl", { load: 120, reps: 1 }), result("dl", { load: 90, reps: 10 })]);
  it("takes the best in the exercise's measure", () => {
    const pr = prOf(deadlift, [s1, s2]);
    expect(pr.best).toBe(120);
    expect(pr.bestSessionId).toBe("s2");
    expect(prOf(plank, [s1, s2]).best).toBe(60);
  });
  it("keeps a rep table of best load at ≥ N reps", () => {
    const pr = prOf(deadlift, [s1, s2]);
    expect(pr.repTable).toEqual([
      { reps: 1, load: 120, sessionId: "s2", date: "2026-08-10" },
      { reps: 3, load: 100, sessionId: "s1", date: "2026-08-01" },
      { reps: 5, load: 100, sessionId: "s1", date: "2026-08-01" },
      { reps: 10, load: 90, sessionId: "s2", date: "2026-08-10" },
    ]);
  });
  it("is empty when nothing was recorded", () => {
    expect(prOf(deadlift, []).best).toBeNull();
    expect(prOf(deadlift, [session("x", "2026-08-02", [result("dl", {})])]).best).toBeNull();
  });
  it("flags a new PR against earlier sessions", () => {
    expect(isNewPR(deadlift, s2, [s1])).toBe(true);
    expect(isNewPR(deadlift, s1, [s2])).toBe(false);
    expect(isNewPR(deadlift, s1, [])).toBe(true);
  });
  it("formats measures", () => {
    expect(formatMeasure("load", 120)).toBe("120 kg");
    expect(formatMeasure("time", 90)).toBe("1:30");
  });
});
