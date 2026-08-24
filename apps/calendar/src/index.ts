import { formatHuman, type AppManifest, type DocumentTypeDef } from "@lifeline/core";
import { Ban, CalendarClock, LayoutTemplate } from "lucide-react";
import { EventsScreen } from "./screens/EventsScreen";
import { TemplatesScreen } from "./screens/TemplatesScreen";
import { UpcomingEventsCard } from "./cards/UpcomingEventsCard";
import { NextEventsCard, nextEventsSettings, nextEventsTitle } from "./cards/NextEventsCard";
import { CountdownCard, countdownSettings, useCountdownTitle } from "./cards/CountdownCard";
import { calendarCommands, useTemplateCommands } from "./commands";
import { calendarTimed, APP_ID } from "./timed";
import { calendarDaylog } from "./daylog";
import { describeBlocker } from "./domain/blockers";
import { describeTemplate, durationOf, formatDuration } from "./domain/templates";
import {
  BLOCKER_TEMPLATE_TYPE,
  EVENT_TEMPLATE_TYPE,
  EVENT_TYPE,
  EVENTS,
  EVENTS_HREF,
  TEMPLATES_HREF,
  TIME_BLOCKER_TYPE,
  type BlockerTemplate,
  type Event,
  type EventTemplate,
  type TimeBlocker,
} from "./domain/types";

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

/** The `event_template` Document type (ADR 0027): the shape of an Event, on no day of its own. */
const eventTemplateType: DocumentTypeDef = {
  id: EVENT_TEMPLATE_TYPE,
  label: "Event templates",
  icon: LayoutTemplate,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "allDay", label: "All day", kind: "boolean", column: true },
    { key: "durationMin", label: "Length (min)", kind: "number", column: true },
    { key: "defaultStart", label: "Usual start", kind: "text", column: true },
    { key: "notes", label: "Notes", kind: "longtext" },
  ],
  linkable: { subtitle: (d) => describeTemplate(d as EventTemplate) },
  href: () => TEMPLATES_HREF,
  order: 31,
  builtIn: true,
};

/** The `time_blocker` Document type (ADR 0027/0029): a weekly rule or a one-off band, guarded because the App owns what a band means. */
const timeBlockerType: DocumentTypeDef = {
  id: TIME_BLOCKER_TYPE,
  label: "Time blockers",
  icon: Ban,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "date", label: "Day (one-off)", kind: "date", guarded: true, column: true },
    { key: "weekdays", label: "Weekdays", kind: "list", guarded: true },
    { key: "start", label: "From", kind: "text", guarded: true, column: true },
    { key: "end", label: "To", kind: "text", guarded: true, column: true },
    { key: "active", label: "On", kind: "boolean", column: true },
    { key: "color", label: "Colour", kind: "text" },
  ],
  indexes: ["date"],
  linkable: { subtitle: (d) => describeBlocker(d as TimeBlocker) },
  href: () => TEMPLATES_HREF,
  order: 32,
  builtIn: true,
};

/** The `blocker_template` Document type (ADR 0029): the shape of a one-off blocker, on no day. */
const blockerTemplateType: DocumentTypeDef = {
  id: BLOCKER_TEMPLATE_TYPE,
  label: "Blocker templates",
  icon: Ban,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "durationMin", label: "Length (min)", kind: "number", column: true },
    { key: "color", label: "Colour", kind: "text" },
  ],
  linkable: { subtitle: (d) => formatDuration(durationOf(d as BlockerTemplate)) },
  href: () => TEMPLATES_HREF,
  order: 33,
  builtIn: true,
};

/** The Calendar App owns Events (CONTEXT.md). The month/week grids are Core Surfaces. */
export const calendarApp: AppManifest = {
  id: APP_ID,
  title: "Calendar",
  icon: CalendarClock,
  color: "var(--chart-violet)",
  types: [eventType, eventTemplateType, timeBlockerType, blockerTemplateType],
  screens: [
    {
      id: "calendar.events",
      title: "Events",
      path: "events",
      icon: CalendarClock,
      component: EventsScreen,
    },
    {
      id: "calendar.templates",
      title: "Templates & blockers",
      path: "event-templates",
      icon: LayoutTemplate,
      component: TemplatesScreen,
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
  useCommands: useTemplateCommands,
  timed: calendarTimed,
  daylog: calendarDaylog,
};

export { EVENTS, EVENT_TYPE, EVENT_TEMPLATE_TYPE, TIME_BLOCKER_TYPE, BLOCKER_TEMPLATE_TYPE };
export type { BlockerTemplate, Event, EventTemplate, TimeBlocker } from "./domain/types";
