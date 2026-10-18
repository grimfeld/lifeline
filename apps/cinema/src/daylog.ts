import type { DaylogItem, DaylogProvider } from "@lifeline/core";
import { useWorks } from "./data/repo";
import { daylogFacts } from "./domain/cardQueries";
import { workType } from "./domain/workTypes";
import { APP_ID, APP_HREF } from "./constants";
import { cinemaParts } from "./parts";

/**
 * What happened in Media on a day (ADR 0009): one fact per item whose
 * finished / started / acquired / added stamp is that day, in the medium's
 * words ("Read", "Watched", "Started", "Acquired", "Added"). Days carry no time.
 */
export const cinemaDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const items = useWorks();
    // One line per work for the Parts heard or watched that day (ADR 0067) — never a catch-up.
    const parts = cinemaParts.useDaylogItems(date, items);
    return [...parts, ...daylogFacts(items, date).map<DaylogItem>(({ item, kind }) => ({
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
