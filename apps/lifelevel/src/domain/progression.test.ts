import { describe, expect, it } from "vitest";
import { computeProgression } from "./progression";
import type { Habit, HabitCompletion, Negative, NegativeCompletion } from "./types";
import { HABIT, HABIT_COMPLETION, NEGATIVE, NEGATIVE_COMPLETION } from "./types";

const common = { tags: [] as string[], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: 0 };

const habit = (over: Partial<Habit>): Habit =>
  ({ id: "a1", type: HABIT, title: "Run", difficulty: "easy", ...common, ...over }) as Habit;

const negative = (over: Partial<Negative>): Negative =>
  ({ id: "n1", type: NEGATIVE, title: "Slip", gravity: "minor", affectsHabitId: "a1", ...common, ...over }) as Negative;

const habitCompletion = (over: Partial<HabitCompletion>): HabitCompletion =>
  ({ id: "c1", type: HABIT_COMPLETION, title: "", habitId: "a1", occurredAt: new Date().toISOString(), note: "", ...common, ...over }) as HabitCompletion;

const negativeCompletion = (over: Partial<NegativeCompletion>): NegativeCompletion =>
  ({ id: "nc1", type: NEGATIVE_COMPLETION, title: "", negativeId: "n1", affectedHabitId: "a1", occurredAt: new Date().toISOString(), note: "", ...common, ...over }) as NegativeCompletion;

describe("computeProgression", () => {
  it("computes level from completions", () => {
    const habits = [habit({ id: "a1", difficulty: "easy" })];
    const completions = Array.from({ length: 10 }, (_, i) =>
      habitCompletion({ id: `c${i}`, habitId: "a1", occurredAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString() }),
    );
    const now = new Date(Date.UTC(2026, 0, 20));
    const { habits: out } = computeProgression(habits, [], completions, [], now);
    expect(out[0]?.level).toBeGreaterThanOrEqual(1);
    expect(out[0]?.completionCount).toBe(10);
  });

  it("applies harsher negative damage for catastrophic vs minor", () => {
    const good = habit({ id: "good", title: "Good" });
    const negMinor = negative({ id: "ne", title: "BadE", gravity: "minor", affectsHabitId: "good" });
    const negCatastrophic = negative({ id: "nx", title: "BadX", gravity: "catastrophic", affectsHabitId: "good" });
    const positives = Array.from({ length: 15 }, (_, i) =>
      habitCompletion({ id: `p${i}`, habitId: "good", occurredAt: new Date(Date.UTC(2026, 1, 1, i)).toISOString() }),
    );
    const hitMinor = [negativeCompletion({ id: "n", negativeId: "ne", affectedHabitId: "good", occurredAt: new Date(Date.UTC(2026, 1, 2)).toISOString() })];
    const hitCatastrophic = [negativeCompletion({ id: "n2", negativeId: "nx", affectedHabitId: "good", occurredAt: new Date(Date.UTC(2026, 1, 2)).toISOString() })];
    const now = new Date(Date.UTC(2026, 1, 3));
    const minorRes = computeProgression([good], [negMinor], positives, hitMinor, now).habits[0];
    const catastrophicRes = computeProgression([good], [negCatastrophic], positives, hitCatastrophic, now).habits[0];
    expect(minorRes?.rawXp ?? 0).toBeGreaterThan(catastrophicRes?.rawXp ?? 0);
  });

  it("gentler decay for higher positive difficulty", () => {
    const t0 = new Date(Date.UTC(2026, 0, 1)).toISOString();
    const easy = habit({ id: "e", difficulty: "easy" });
    const master = habit({ id: "m", difficulty: "master" });
    const cEasy = [habitCompletion({ habitId: "e", occurredAt: t0 })];
    const cMaster = [habitCompletion({ habitId: "m", occurredAt: t0 })];
    const now = new Date(Date.UTC(2026, 0, 10));
    const easyDecay = computeProgression([easy], [], cEasy, [], now).habits[0]?.decayTicks ?? 0;
    const masterDecay = computeProgression([master], [], cMaster, [], now).habits[0]?.decayTicks ?? 0;
    expect(masterDecay).toBeLessThanOrEqual(easyDecay);
  });

  it("accumulates decay across gaps between completions (not reset by the next log)", () => {
    const easy = habit({ id: "e", difficulty: "easy" });
    const t1 = new Date(Date.UTC(2026, 0, 1, 12)).toISOString();
    const t2 = new Date(Date.UTC(2026, 0, 10, 12)).toISOString();
    const completions = [
      habitCompletion({ id: "c1", habitId: "e", occurredAt: t1 }),
      habitCompletion({ id: "c2", habitId: "e", occurredAt: t2 }),
    ];
    const now = new Date(Date.UTC(2026, 0, 10, 12));
    const p = computeProgression([easy], [], completions, [], now).habits[0];
    // 9d gap Jan 1 → Jan 10 fully decays the first completion's 10 XP to 0 (floored,
    // no negative debt). The second completion lands at `now` with no idle tail, so its
    // fresh 10 XP survives: rawXp = 10, not the full 20 (decay is not reset by the log).
    expect(p?.netBeforeDecay).toBe(20);
    expect(p?.rawXp).toBe(10);
    expect(p?.effectiveExp).toBe(10);
    expect(p?.decayTicks).toBe(0);
    expect(p?.nextDecayAt).toBeNull();
  });

  it("a freshly logged completion always adds its XP, even after a long lapse", () => {
    const easy = habit({ id: "e", difficulty: "easy" });
    const longAgo = new Date(Date.UTC(2026, 0, 1)).toISOString();
    const now = new Date(Date.UTC(2026, 2, 1)); // ~59 days later: old XP fully decayed
    const stale = [habitCompletion({ id: "c1", habitId: "e", occurredAt: longAgo })];
    const before = computeProgression([easy], [], stale, [], now).habits[0];
    // The lapsed habit has decayed to a 0 floor (decay cannot go negative — ADR 0025).
    expect(before?.rawXp).toBe(0);

    // Logging a new completion at `now` must lift rawXp by exactly one completion's XP,
    // proving the decay debt no longer swallows the new log.
    const afterLog = [...stale, habitCompletion({ id: "c2", habitId: "e", occurredAt: now.toISOString() })];
    const after = computeProgression([easy], [], afterLog, [], now).habits[0];
    expect(after?.rawXp).toBe(10);
  });

  it("allows negative raw XP when penalties exceed decayed completion XP", () => {
    const good = habit({ id: "good", difficulty: "easy" });
    const neg = negative({ id: "nx", gravity: "catastrophic", affectsHabitId: "good" });
    const completions = [habitCompletion({ id: "c1", habitId: "good", occurredAt: new Date(Date.UTC(2026, 2, 1, 12)).toISOString() })];
    const hits = [negativeCompletion({ id: "n1", negativeId: "nx", affectedHabitId: "good", occurredAt: new Date(Date.UTC(2026, 2, 1, 14)).toISOString() })];
    const now = new Date(Date.UTC(2026, 2, 1, 15));
    const p = computeProgression([good], [neg], completions, hits, now).habits[0];
    // 10 gross, decay 0, catastrophic damage ~46.8 → debt (ADR 0025)
    expect(p?.rawXp ?? 0).toBeLessThan(0);
    expect(p?.netBeforeDecay ?? 0).toBeLessThan(0);
    expect(p?.level).toBe(1);
  });

  it("damage lands on the persisted victim, not the Negative's current pairing", () => {
    // The roll (or pairing at log time) is a fact on the completion (ADR 0026):
    // re-derivation must charge the habit recorded there even after re-pairing.
    const a = habit({ id: "a", title: "A" });
    const b = habit({ id: "b", title: "B" });
    const neg = negative({ id: "n", affectsHabitId: "b", gravity: "minor" }); // now paired to b…
    const t = new Date(Date.UTC(2026, 3, 1, 10)).toISOString();
    const cs = [
      habitCompletion({ id: "ca", habitId: "a", occurredAt: t }),
      habitCompletion({ id: "cb", habitId: "b", occurredAt: t }),
    ];
    const hits = [negativeCompletion({ id: "h", negativeId: "n", affectedHabitId: "a", occurredAt: t })]; // …but it hit a
    const now = new Date(Date.UTC(2026, 3, 1, 12));
    const { habits: out } = computeProgression([a, b], [neg], cs, hits, now);
    const stateA = out.find((s) => s.habitId === "a");
    const stateB = out.find((s) => s.habitId === "b");
    expect(stateA?.rawXp).toBe(10 - 18);
    expect(stateB?.rawXp).toBe(10);
  });

  it("counts today's completions on the local calendar day, not the last 24 hours", () => {
    // Local constructors on purpose: "today" is the day the user is living in.
    const e = habit({ id: "e" });
    const now = new Date(2026, 4, 20, 9, 30);
    const completions = [
      habitCompletion({ id: "y", habitId: "e", occurredAt: new Date(2026, 4, 19, 23, 30).toISOString() }),
      habitCompletion({ id: "t1", habitId: "e", occurredAt: new Date(2026, 4, 20, 0, 5).toISOString() }),
      habitCompletion({ id: "t2", habitId: "e", occurredAt: new Date(2026, 4, 20, 8, 0).toISOString() }),
    ];
    const p = computeProgression([e], [], completions, [], now).habits[0];
    // The 23:30 log is ten hours old but belongs to yesterday; both of today's count.
    expect(p?.completionsToday).toBe(2);
    expect(p?.completionCount).toBe(3);
  });

  it("an empty today reads as 0, whatever the habit has banked", () => {
    const e = habit({ id: "e" });
    const now = new Date(2026, 4, 20, 9, 30);
    const completions = Array.from({ length: 5 }, (_, i) =>
      habitCompletion({ id: `c${i}`, habitId: "e", occurredAt: new Date(2026, 4, 14 + i, 12).toISOString() }),
    );
    const p = computeProgression([e], [], completions, [], now).habits[0];
    expect(p?.completionsToday).toBe(0);
  });

  it("a completion back-logged to yesterday leaves today empty", () => {
    const e = habit({ id: "e" });
    const now = new Date(2026, 4, 20, 9, 30);
    // Recorded this morning, but it happened yesterday — the ledger's occurredAt decides.
    const completions = [habitCompletion({ id: "b", habitId: "e", occurredAt: new Date(2026, 4, 19, 18).toISOString() })];
    const p = computeProgression([e], [], completions, [], now).habits[0];
    expect(p?.completionsToday).toBe(0);
  });

  it("a Negative hit never counts as today's completion", () => {
    const good = habit({ id: "good" });
    const neg = negative({ id: "n", affectsHabitId: "good" });
    const now = new Date(2026, 4, 20, 9, 30);
    const hits = [negativeCompletion({ id: "h", negativeId: "n", affectedHabitId: "good", occurredAt: new Date(2026, 4, 20, 8).toISOString() })];
    const p = computeProgression([good], [neg], [], hits, now).habits[0];
    expect(p?.completionsToday).toBe(0);
  });
});
