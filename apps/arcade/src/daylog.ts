import type { DaylogItem, DaylogProvider } from "@lifeline/core";
import { useWorks } from "./data/repo";
import { daylogFacts } from "./domain/cardQueries";
import { workType } from "./domain/workTypes";
import { APP_ID, APP_HREF } from "./constants";

/**
 * What happened in Media on a day (ADR 0009): one fact per item whose
 * finished / started / acquired / added stamp is that day, in the medium's
 * words ("Read", "Watched", "Started", "Acquired", "Added"). Days carry no time.
 */
export const arcadeDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const items = useWorks();
    return [...daylogFacts(items, date).map<DaylogItem>(({ item, kind }) => ({
      key: `${APP_ID}/${item.id}`,
      appId: APP_ID,
      itemId: item.id,
      kind,
      title: item.title,
      subtitle: workType(item.type).label,
      time: null,
      href: APP_HREF,
      tags: item.tags ?? [],
    }))];
  },
};
