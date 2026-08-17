import type { TaggableProvider, TaggedItem } from "@lifeline/core";
import { useMedia } from "./data/repo";
import { mediaType } from "./domain/mediaTypes";
import { APP_ID, MEDIA_HREF } from "./linkable";

/**
 * The Taggable Contract for Media (ADR 0014): every live item carrying at
 * least one tag, with "Book · Author" as subtitle (same as the wikilink target).
 */
export const mediaTaggable: TaggableProvider = {
  appId: APP_ID,
  useTagged() {
    const items = useMedia();
    return items
      .filter((m) => (m.tags ?? []).length > 0)
      .map((m): TaggedItem => {
        const label = mediaType(m.type).label;
        return {
          appId: APP_ID,
          itemId: m.id,
          title: m.title,
          subtitle: `${label}${m.creator ? " · " + m.creator : ""}`,
          tags: m.tags ?? [],
          href: MEDIA_HREF,
        };
      });
  },
};
