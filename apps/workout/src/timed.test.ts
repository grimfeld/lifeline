import { describe, expect, it } from "vitest";
import { sessionItems } from "./timed";
import type { Session, Workout } from "./domain/types";

const session = (id: string, date: string, workoutId: string) =>
  ({ id, type: "workout_session", title: "Run", date, start: "07:00", end: "07:40", durationMin: 40, workoutId, tags: [] }) as unknown as Session;

describe("sessionItems", () => {
  it("reports Sessions in range, titled by their Workout", () => {
    const workouts = [{ id: "w1", title: "Legs" }] as unknown as Workout[];
    const items = sessionItems([session("a", "2026-10-01", "w1"), session("b", "2026-10-09", "w1"), session("c", "2026-10-02", "gone")], workouts, {
      start: "2026-10-01",
      end: "2026-10-07",
    });
    expect(items.map((i) => [i.itemId, i.title, i.subtitle, i.start])).toEqual([
      ["a", "Legs", "40 min", "07:00"],
      ["c", "Run", "40 min", "07:00"],
    ]);
  });
});
