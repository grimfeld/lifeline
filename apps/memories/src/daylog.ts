import { useDocuments, type DaylogProvider } from "@lifeline/core";
import { daylogMemories, APP_ID } from "./domain/daylog";
import { MEMORY, type Memory } from "./domain/types";

/** The Daylog Contract for Memories: the Memories dated that day. */
export const memoriesDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    return daylogMemories(useDocuments<Memory>(MEMORY), date);
  },
};
