import type { AppManifest } from "@lifeline/core";
import { CalendarClock } from "lucide-react";
import { EventsScreen } from "./screens/EventsScreen";
import { UpcomingEventsCard } from "./cards/UpcomingEventsCard";
import { NextEventsCard, nextEventsSettings, nextEventsTitle } from "./cards/NextEventsCard";
import { CountdownCard, countdownSettings, useCountdownTitle } from "./cards/CountdownCard";
import { calendarCommands } from "./commands";
import { calendarTimed, APP_ID } from "./timed";
import { calendarLinkable } from "./linkable";
import { calendarDaylog } from "./daylog";
import { EVENTS } from "./domain/types";

/** The Calendar App owns Events (CONTEXT.md). The month/week grids are Core Surfaces. */
export const calendarApp: AppManifest = {
  id: APP_ID,
  title: "Calendar",
  icon: CalendarClock,
  color: "var(--chart-violet)",
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
    {
      id: "calendar.next",
      title: "Next events",
      description: "The next few events with a day countdown",
      component: NextEventsCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: nextEventsSettings,
      instanceTitle: nextEventsTitle,
    },
    {
      id: "calendar.countdown",
      title: "Countdown",
      description: "Big number of days until one chosen event",
      component: CountdownCard,
      defaultSize: { w: 2, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: countdownSettings,
      instanceTitle: useCountdownTitle,
    },
  ],
  commands: calendarCommands,
  timed: calendarTimed,
  linkable: calendarLinkable,
  daylog: calendarDaylog,
};

export { EVENTS };
export type { Event } from "./domain/types";
