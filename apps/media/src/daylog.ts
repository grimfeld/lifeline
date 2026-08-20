import type { DaylogItem, DaylogProvider } from "@lifeline/core";
import { useMedia } from "./data/repo";
import { useQuotes } from "./data/quotes";
import { quoteName, quotesOn } from "./domain/quotes";
import { daylogFacts } from "./domain/cardQueries";
import { mediaType } from "./domain/mediaTypes";
import { APP_ID, MEDIA_HREF, QUOTES_HREF } from "./constants";

/**
 * What happened in Media on a day (ADR 0009): one fact per item whose
 * finished / started / acquired / added stamp is that day, in the medium's
 * words ("Read", "Watched", "Started", "Acquired", "Added"). Days carry no time.
 */
export const mediaDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const items = useMedia();
    const quotes = useQuotes();
    const byId = new Map(items.map((m) => [m.id, m]));
    const quoted = quotesOn(quotes, date).map<DaylogItem>((q) => ({
      key: `${APP_ID}/quote/${q.id}`,
      appId: APP_ID,
      itemId: q.mediaId,
      kind: "Quoted",
      title: quoteName(q.text),
      subtitle: byId.get(q.mediaId)?.title,
      time: null,
      href: QUOTES_HREF,
      tags: q.tags ?? [],
    }));
    return [...quoted, ...daylogFacts(items, date).map<DaylogItem>(({ item, kind }) => ({
      key: `${APP_ID}/${item.id}`,
      appId: APP_ID,
      itemId: item.id,
      kind,
      title: item.title,
      subtitle: mediaType(item.type).label,
      time: null,
      href: MEDIA_HREF,
      tags: item.tags ?? [],
    }))];
  },
};
