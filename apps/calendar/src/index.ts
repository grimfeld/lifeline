import { formatHuman, type AppManifest, type DocumentTypeDef } from "@lifeline/core";
import { CalendarClock } from "lucide-react";
import { EventsScreen } from "./screens/EventsScreen";
import { UpcomingEventsCard } from "./cards/UpcomingEventsCard";
import { NextEventsCard, nextEventsSettings, nextEventsTitle } from "./cards/NextEventsCard";
import { CountdownCard, countdownSettings, useCountdownTitle } from "./cards/CountdownCard";
import { calendarCommands } from "./commands";
import { calendarTimed, APP_ID } from "./timed";
import { calendarDaylog } from "./daylog";
import { EVENT_TYPE, EVENTS, EVENTS_HREF, type Event } from "./domain/types";

/** The `event` Document type (ADR 0019): structured, no body; time fields are guarded (moves go through the Timed hooks). */
const eventType: DocumentTypeDef = {
  id: EVENT_TYPE,
  label: "Events",
  icon: CalendarClock,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "date", label: "Day", kind: "date", required: true, guarded: true, column: true },
    { key: "endDate", label: "Last day", kind: "date", guarded: true },
    { key: "start", label: "Start", kind: "text", guarded: true, column: true },
    { key: "end", label: "End", kind: "text", guarded: true, column: true },
    { key: "notes", label: "Notes", kind: "longtext" },
  ],
  indexes: ["date"],
  linkable: { subtitle: (d) => formatHuman((d as Event).date) },
  href: () => EVENTS_HREF,
  order: 30,
  builtIn: true,
};

/** The Calendar App owns Events (CONTEXT.md). The month/week grids are Core Surfaces. */
export const calendarApp: AppManifest = {
  id: APP_ID,
  title: "Calendar",
  icon: CalendarClock,
  color: "var(--chart-violet)",
  types: [eventType],
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
      tagFilterable: true,
    },
    {
      id: "calendar.next",
      title: "Next events",
      description: "The next few events with a day countdown",
      component: NextEventsCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      tagFilterable: true,
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
  daylog: calendarDaylog,
};

export { EVENTS, EVENT_TYPE };
export type { Event } from "./domain/types";
