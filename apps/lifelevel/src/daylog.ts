import type { DaylogProvider } from "@lifeline/core";
import { daylogItems } from "./domain/daylog";
import { APP_ID } from "./domain/types";
import { useHabitCompletions, useHabits, useNegativeCompletions, useNegatives } from "./data/repo";

/** The Daylog Contract for Life Level: what was completed — and confessed — on a day. */
export const lifelevelDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const habits = useHabits();
    const negatives = useNegatives();
    const habitCompletions = useHabitCompletions();
    const negativeCompletions = useNegativeCompletions();
    return daylogItems(habits, negatives, habitCompletions, negativeCompletions, date);
  },
};
