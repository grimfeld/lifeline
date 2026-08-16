import type { AppManifest } from "@lifeline/core";
import { CalendarClock } from "lucide-react";
import { EventsScreen } from "./screens/EventsScreen";
import { UpcomingEventsCard } from "./cards/UpcomingEventsCard";
import { calendarCommands } from "./commands";
import { calendarTimed, APP_ID } from "./timed";
import { EVENTS } from "./domain/types";

/** The Calendar App owns Events (CONTEXT.md). The month/week grids are Core Surfaces. */
export const calendarApp: AppManifest = {
  id: APP_ID,
  title: "Calendar",
  icon: CalendarClock,
  color: "var(--chart-4)",
  collections: [{ name: EVENTS, indexes: ["date"] }],
  screens: [
    {
      id: "calendar.events",
      title: "Events",
      path: "events",
      icon: CalendarClock,
      component: EventsScreen,
    },
  ],
  cards: [
    {
      id: "calendar.upcoming",
      title: "Upcoming events",
      description: "The next two weeks of events",
      component: UpcomingEventsCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
    },
  ],
  commands: calendarCommands,
  timed: calendarTimed,
};

export { EVENTS };
export type { Event } from "./domain/types";
