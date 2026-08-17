import type { LinkableProvider, LinkTarget } from "@lifeline/core";
import { useMedia } from "./data/repo";
import { mediaType } from "./domain/mediaTypes";

export const APP_ID = "media";
export const MEDIA_HREF = "/app/media";

/**
 * Media items as wikilink targets (ADR 0009): every live item by title,
 * with "Book · Author" as the disambiguating subtitle. There is no per-item
 * route, so `href` is the App's main screen.
 */
export const mediaLinkable: LinkableProvider = {
  appId: APP_ID,
  useTargets() {
    const items = useMedia();
    const out: LinkTarget[] = [];
    for (const m of items) {
      const label = mediaType(m.type).label;
      out.push({
        appId: APP_ID,
        itemId: m.id,
        name: m.title,
        subtitle: `${label}${m.creator ? " · " + m.creator : ""}`,
        href: MEDIA_HREF,
      });
    }
    return out;
  },
};
