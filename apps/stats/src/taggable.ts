import type { TaggableProvider, TaggedItem } from "@lifeline/core";
import { useStats } from "./data/repo";
import { APP_ID, statHref } from "./domain/daylog";

/**
 * The Taggable Contract for Stats (ADR 0014): every live Stat carrying at
 * least one tag. Tags live on the Stat only — Entries inherit them and are
 * not reported separately.
 */
export const statsTaggable: TaggableProvider = {
  appId: APP_ID,
  useTagged() {
    const stats = useStats();
    return stats
      .filter((s) => (s.tags ?? []).length > 0)
      .map(
        (s): TaggedItem => ({
          appId: APP_ID,
          itemId: s.id,
          title: s.name,
          subtitle: s.kind,
          tags: s.tags ?? [],
          href: statHref(s.id),
        }),
      );
  },
};
