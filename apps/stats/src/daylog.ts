import type { DaylogProvider } from "@lifeline/core";
import { useEntries, useStats } from "./data/repo";
import { APP_ID, daylogEntries } from "./domain/daylog";

/** The Daylog Contract for Stats: what was logged, measured, marked or collected on a day. */
export const statsDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const stats = useStats();
    const entries = useEntries();
    return daylogEntries(stats, entries, date);
  },
};
