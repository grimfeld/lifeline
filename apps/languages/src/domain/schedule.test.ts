import { describe, expect, it } from "vitest";
import { replay } from "./schedule";

const day = (n: number, h = 9) => new Date(Date.UTC(2026, 8, 1 + n, h)).toISOString();

describe("replay", () => {
  it("reads a Prompt with no Recalls as new", () => {
    expect(replay([])).toMatchObject({ state: "new", due: null, reps: 0 });
  });

  it("is deterministic — the same Recalls always give the same schedule", () => {
    const rs = [
      { grade: "pass" as const, at: day(0) },
      { grade: "pass" as const, at: day(1) },
      { grade: "fail" as const, at: day(5) },
      { grade: "pass" as const, at: day(5, 10) },
    ];
    expect(replay(rs)).toEqual(replay([...rs].reverse()));
  });

  it("spaces a Prompt further out with each pass", () => {
    const one = replay([{ grade: "pass", at: day(0) }]);
    const three = replay([
      { grade: "pass", at: day(0) },
      { grade: "pass", at: day(3) },
      { grade: "pass", at: day(12) },
    ]);
    expect(three.stability).toBeGreaterThan(one.stability);
    expect(three.due!.getTime() - new Date(day(12)).getTime()).toBeGreaterThan(one.due!.getTime() - new Date(day(0)).getTime());
  });

  it("brings a failed Prompt back soon and counts the lapse", () => {
    const held = replay([
      { grade: "pass", at: day(0) },
      { grade: "pass", at: day(3) },
      { grade: "fail", at: day(12) },
    ]);
    expect(held.lapses).toBe(1);
    expect(held.state).toBe("relearning");
    expect(held.due!.getTime() - new Date(day(12)).getTime()).toBeLessThan(60 * 60 * 1000);
  });
});
