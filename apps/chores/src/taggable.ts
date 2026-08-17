import type { TaggableProvider, TaggedItem } from "@lifeline/core";
import { useChores } from "./data/repo";
import { describeSchedule } from "./domain/schedule";
import { CHORES_HREF } from "./linkable";
import { APP_ID } from "./schedulable";

/**
 * Chores as tagged entities (ADR 0014): every live chore — active, paused or
 * archived — carrying at least one tag. Completions inherit their chore's
 * tags on the other Contracts; they are not reported here.
 */
export const choresTaggable: TaggableProvider = {
  appId: APP_ID,
  useTagged() {
    const chores = useChores();
    const out: TaggedItem[] = [];
    for (const chore of chores) {
      const tags = chore.tags ?? [];
      if (tags.length === 0) continue;
      out.push({
        appId: APP_ID,
        itemId: chore.id,
        title: chore.name,
        subtitle: describeSchedule(chore.schedule),
        tags,
        href: CHORES_HREF,
      });
    }
    return out;
  },
};
