import type { LinkableProvider, LinkTarget } from "@lifeline/core";
import { useStats } from "./data/repo";
import { APP_ID, statHref } from "./domain/daylog";

/** The Linkable Contract for Stats: every live Stat is a `[[Name]]` target, opening its detail screen. */
export const statsLinkable: LinkableProvider = {
  appId: APP_ID,
  useTargets() {
    const stats = useStats();
    return stats.map(
      (s): LinkTarget => ({
        appId: APP_ID,
        itemId: s.id,
        name: s.name,
        subtitle: s.kind,
        href: statHref(s.id),
      }),
    );
  },
};
