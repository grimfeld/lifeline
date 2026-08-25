import type { LoggableProvider, LoggableTarget } from "@lifeline/core";
import { completeHabit, useHabits } from "./data/repo";
import { APP_ID } from "./domain/types";

/** Loggable (ADR 0031): every Habit is a target wanting nothing but the moment — a Completion. Negatives are not. */
export const lifelevelLoggable: LoggableProvider = {
  appId: APP_ID,
  useTargets(): LoggableTarget[] {
    return useHabits().map((h) => ({ key: `${APP_ID}/${h.id}`, appId: APP_ID, id: h.id, title: h.title, subtitle: `Habit · ${h.difficulty}`, wants: "none" }));
  },
  async log(habitId, { at, note }) {
    await completeHabit(habitId, { occurredAt: at, note });
  },
};
