import type { TaggableProvider, TaggedItem } from "@lifeline/core";
import { formatHuman } from "@lifeline/core";
import { useEvents } from "./data/repo";
import { EVENTS_HREF } from "./linkable";
import { APP_ID } from "./timed";

/** Every live Event carrying at least one Tag (ADR 0014). */
export const calendarTaggable: TaggableProvider = {
  appId: APP_ID,
  useTagged(): TaggedItem[] {
    const events = useEvents();
    const out: TaggedItem[] = [];
    for (const ev of events) {
      const tags = ev.tags ?? [];
      if (tags.length === 0) continue;
      out.push({ appId: APP_ID, itemId: ev.id, title: ev.title, subtitle: formatHuman(ev.date), tags, href: EVENTS_HREF });
    }
    return out;
  },
};
