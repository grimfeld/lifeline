import type { LinkableProvider, LinkTarget } from "@lifeline/core";
import { useChores } from "./data/repo";
import { APP_ID } from "./schedulable";

export const CHORES_HREF = "/app/chores";

/**
 * Chores as wikilink targets (ADR 0009): every active or paused chore by
 * name. Archived chores are not offered — a link typed today should point at
 * something the user still does. There is no per-chore route, so `href` is
 * the App's main screen.
 */
export const choresLinkable: LinkableProvider = {
  appId: APP_ID,
  useTargets() {
    const chores = useChores();
    const out: LinkTarget[] = [];
    for (const chore of chores) {
      if (chore.status === "archived") continue;
      out.push({
        appId: APP_ID,
        itemId: chore.id,
        name: chore.name,
        subtitle: chore.category ?? undefined,
        href: CHORES_HREF,
      });
    }
    return out;
  },
};
