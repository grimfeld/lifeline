import { describe, expect, it } from "vitest";
import { daylogItems, dayKeyOf } from "./daylog";
import { HABIT, HABIT_COMPLETION, NEGATIVE, NEGATIVE_COMPLETION, type Habit, type HabitCompletion, type Negative, type NegativeCompletion } from "./types";

const common = { tags: [] as string[], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: 0 };
const h: Habit = { id: "h1", type: HABIT, title: "Run", difficulty: "hard", ...common } as Habit;
const n: Negative = { id: "n1", type: NEGATIVE, title: "Junk food", gravity: "severe", affectsHabitId: "h1", ...common } as Negative;

// Noon UTC is the same local day in any timezone within ±11h.
const at = (day: string) => `${day}T12:00:00.000Z`;
const localDay = dayKeyOf(at("2026-08-20"));

const hc: HabitCompletion = { id: "c1", type: HABIT_COMPLETION, title: "", habitId: "h1", occurredAt: at("2026-08-20"), note: "", ...common } as HabitCompletion;
const nc: NegativeCompletion = { id: "c2", type: NEGATIVE_COMPLETION, title: "", negativeId: "n1", affectedHabitId: "h1", occurredAt: at("2026-08-20"), note: "", ...common } as NegativeCompletion;

describe("daylogItems", () => {
  it("reports completions and hits on their occurred day with XP amounts", () => {
    const items = daylogItems([h], [n], [hc], [nc], localDay);
    expect(items).toHaveLength(2);
    const done = items.find((i) => i.kind === "Completed");
    const hit = items.find((i) => i.kind === "Logged");
    expect(done?.title).toBe("Run");
    expect(done?.subtitle).toBe("+15 XP"); // hard = 10 × 1.5
    expect(hit?.title).toBe("Junk food");
    expect(hit?.subtitle).toContain("Run");
    expect(hit?.subtitle).toContain("−31 XP"); // severe = 18 × 1.7 ≈ 30.6
  });

  it("keys on occurredAt, not the day of logging", () => {
    const backlogged = { ...hc, occurredAt: at("2026-08-18") };
    expect(daylogItems([h], [], [backlogged], [], localDay)).toHaveLength(0);
    expect(daylogItems([h], [], [backlogged], [], dayKeyOf(at("2026-08-18")))).toHaveLength(1);
  });
});
