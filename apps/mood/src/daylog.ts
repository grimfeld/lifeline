import type { DaylogProvider } from "@lifeline/core";
import { useMoods } from "./data/repo";
import { APP_ID } from "./domain/types";
import { daylogMood } from "./domain/daylog";

/** The Daylog Contract for Mood: how the day felt (ADR 0044). */
export const moodDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    return daylogMood(useMoods(), date);
  },
};
