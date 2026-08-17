import type { DaylogItem, DaylogProvider } from "@lifeline/core";
import { useMedia } from "./data/repo";
import { daylogFacts } from "./domain/cardQueries";
import { mediaType } from "./domain/mediaTypes";
import { APP_ID, MEDIA_HREF } from "./linkable";

/**
 * What happened in Media on a day (ADR 0009): one fact per item whose
 * finished / started / acquired / added stamp is that day, in the medium's
 * words ("Read", "Watched", "Started", "Acquired", "Added"). Days carry no time.
 */
export const mediaDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const items = useMedia();
    return daylogFacts(items, date).map<DaylogItem>(({ item, kind }) => ({
      key: `${APP_ID}/${item.id}`,
      appId: APP_ID,
      itemId: item.id,
      kind,
      title: item.title,
      subtitle: mediaType(item.type).label,
      time: null,
      href: MEDIA_HREF,
      tags: item.tags ?? [],
    }));
  },
};
