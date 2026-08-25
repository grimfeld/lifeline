import type { DaylogItem, DaylogProvider } from "@lifeline/core";
import { useQuotes } from "./data/quotes";
import { useQuotedWorks } from "./data/works";
import { quoteName, quotesOn } from "./domain/quotes";
import { APP_HREF, APP_ID } from "./constants";

/** What happened in Quotes on a day: the quotes captured then. */
export const commonplaceDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const quotes = useQuotes();
    const works = useQuotedWorks();
    const byId = new Map(works.map((m) => [m.id, m]));
    return quotesOn(quotes, date).map<DaylogItem>((q) => ({
      key: `${APP_ID}/quote/${q.id}`,
      appId: APP_ID,
      itemId: q.mediaId,
      kind: "Quoted",
      title: quoteName(q.text),
      subtitle: byId.get(q.mediaId)?.title,
      time: null,
      href: APP_HREF,
      tags: q.tags ?? [],
    }));
  },
};
