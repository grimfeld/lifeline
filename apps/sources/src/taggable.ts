import type { TaggableProvider, TaggedItem } from "@lifeline/core";
import { useSources } from "./data/repo";
import { hostOf } from "./domain/url";
import { APP_ID, embedHref } from "./hrefs";

/** Every Source carrying at least one Tag (ADR 0014). */
export const sourcesTaggable: TaggableProvider = {
  appId: APP_ID,
  useTagged(): TaggedItem[] {
    const out: TaggedItem[] = [];
    for (const s of useSources()) {
      const tags = s.tags ?? [];
      if (tags.length === 0) continue;
      out.push({ appId: APP_ID, itemId: s.id, title: s.name, subtitle: hostOf(s.url), tags, href: embedHref(s.id) });
    }
    return out;
  },
};
