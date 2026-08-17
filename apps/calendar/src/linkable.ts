import { formatHuman, type LinkableProvider, type LinkTarget } from "@lifeline/core";
import { useEvents } from "./data/repo";
import { APP_ID } from "./timed";

export const EVENTS_HREF = "/app/events";

/** Every Event (past and future) is a wikilink target by title. */
export const calendarLinkable: LinkableProvider = {
  appId: APP_ID,
  useTargets(): LinkTarget[] {
    const events = useEvents();
    return events.map((ev) => ({
      appId: APP_ID,
      itemId: ev.id,
      name: ev.title,
      subtitle: formatHuman(ev.date),
      href: EVENTS_HREF,
    }));
  },
};
