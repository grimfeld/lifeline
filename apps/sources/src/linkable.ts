import type { LinkableProvider, LinkTarget } from "@lifeline/core";
import { useSources } from "./data/repo";
import { hostOf } from "./domain/url";
import { APP_ID, embedHref } from "./hrefs";

/** Every Source is a wikilink target by name. */
export const sourcesLinkable: LinkableProvider = {
  appId: APP_ID,
  useTargets(): LinkTarget[] {
    return useSources().map((s) => ({
      appId: APP_ID,
      itemId: s.id,
      name: s.name,
      subtitle: hostOf(s.url),
      href: embedHref(s.id),
      tags: s.tags ?? [],
    }));
  },
};
