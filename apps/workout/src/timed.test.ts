import { describe, expect, it } from "vitest";
import { sessionItems } from "./timed";
import { sessionClock } from "./data/repo";
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

  it("ends a Session that ran past midnight at 24:00 on its start day", () => {
    // Saved before the clamp: the end is the next day's clock.
    const late = { ...session("d", "2026-10-01", "w1"), start: "23:30", end: "00:20" } as Session;
    const [item] = sessionItems([late], [], { start: "2026-10-01", end: "2026-10-01" });
    expect([item?.start, item?.end]).toEqual(["23:30", "24:00"]);
  });
});

describe("sessionClock", () => {
  it("is the local day and clock of the run", () => {
    expect(sessionClock(local(2026, 10, 1, 7, 0), local(2026, 10, 1, 7, 40))).toEqual({ date: "2026-10-01", start: "07:00", end: "07:40" });
  });

  it("clamps a run past midnight to 24:00 on the start day, so end never precedes start", () => {
    expect(sessionClock(local(2026, 10, 1, 23, 30), local(2026, 10, 2, 0, 20))).toEqual({ date: "2026-10-01", start: "23:30", end: "24:00" });
  });
});

function local(y: number, m: number, d: number, h: number, min: number): string {
  return new Date(y, m - 1, d, h, min).toISOString();
}
