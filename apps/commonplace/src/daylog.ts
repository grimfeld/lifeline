import type { DaylogItem, DaylogProvider } from "@lifeline/core";
import { useQuotes } from "./data/quotes";
import { useNotes } from "./data/notes";
import { useSources } from "./data/works";
import { quoteName, quotesOn } from "./domain/quotes";
import { APP_ID, noteHref, quoteHref } from "./domain/types";

/** What happened in Notes on a day: the Quotes kept and the Notes taken then, each with its Source. */
export const commonplaceDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const quotes = useQuotes();
    const notes = useNotes();
    const sources = useSources();
    const byId = new Map(sources.map((m) => [m.id, m]));
    const quoted = quotesOn(quotes, date).map<DaylogItem>((q) => ({
      key: `${APP_ID}/quote/${q.id}`,
      appId: APP_ID,
      itemId: q.source,
      kind: "Quoted",
      title: quoteName(q.body),
      subtitle: byId.get(q.source)?.title,
      time: null,
      href: quoteHref(q),
      tags: q.tags ?? [],
    }));
    const noted = notes
      .filter((n) => n.createdAt === date)
      .map<DaylogItem>((n) => ({
        key: `${APP_ID}/note/${n.id}`,
        appId: APP_ID,
        itemId: n.id,
        kind: "Noted",
        title: n.title,
        subtitle: byId.get(n.source)?.title,
        time: null,
        href: noteHref(n.id),
        tags: n.tags ?? [],
      }));
    return [...noted, ...quoted];
  },
};
