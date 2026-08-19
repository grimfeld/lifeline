import type { LinkableProvider, LinkTarget } from "@lifeline/core";
import { useMedia } from "./data/repo";
import { useQuotes } from "./data/quotes";
import { mediaType } from "./domain/mediaTypes";
import { quoteName } from "./domain/quotes";

export const APP_ID = "media";
export const MEDIA_HREF = "/app/media";
export const QUOTES_HREF = "/app/media/quotes";
/** Quote targets carry this itemId prefix so backlinks can tell a quote from an item. */
export const QUOTE_ITEM_PREFIX = "quote:";

/**
 * Media items as wikilink targets (ADR 0009): every live item by title,
 * with "Book · Author" as the disambiguating subtitle. There is no per-item
 * route, so `href` is the App's main screen.
 */
export const mediaLinkable: LinkableProvider = {
  appId: APP_ID,
  useTargets() {
    const items = useMedia();
    const quotes = useQuotes();
    const out: LinkTarget[] = [];
    // Quotes are targets too (CONTEXT.md): named by their opening words, subtitled by the work.
    const byId = new Map(items.map((m) => [m.id, m]));
    for (const q of quotes) {
      const item = byId.get(q.mediaId);
      out.push({ appId: APP_ID, itemId: QUOTE_ITEM_PREFIX + q.id, name: `“${quoteName(q.text)}”`, subtitle: item ? `Quote · ${item.title}` : "Quote", href: QUOTES_HREF, tags: q.tags ?? [] });
    }
    for (const m of items) {
      const label = mediaType(m.type).label;
      out.push({
        appId: APP_ID,
        itemId: m.id,
        name: m.title,
        subtitle: `${label}${m.creator ? " · " + m.creator : ""}`,
        href: MEDIA_HREF,
        tags: m.tags ?? [],
      });
    }
    return out;
  },
};
