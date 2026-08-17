import type { AppManifest } from "@lifeline/core";
import { LayoutDashboard, MapPin, NotebookPen, Sun } from "lucide-react";
import { TodayCard } from "./surfaces/TodayCard";
import { AgendaCard } from "./surfaces/AgendaCard";
import { lastLocation } from "./components/WorkspaceSwitcher";
import { MapCard, useLocatableAppOptions } from "./surfaces/MapCard";
import { TagsCard } from "./surfaces/TagsCard";

/**
 * The shell's own manifest: general Surfaces packaged like any App's cards,
 * so they appear in the card picker next to App cards.
 */
export const hubApp: AppManifest = {
  id: "hub",
  title: "Lifeline",
  color: "var(--chart-yellow)",
  collections: [],
  screens: [],
  cards: [
    {
      id: "hub.today",
      title: "Today",
      description: "Everything scheduled or due today, across all apps",
      component: TodayCard,
      defaultSize: { w: 4, h: 7 },
      minSize: { w: 2, h: 3 },
      tagFilterable: true,
    },
    {
      id: "hub.agenda",
      title: "Today's agenda",
      description: "Today's timed items on an hour scale, with a live now-line",
      component: AgendaCard,
      defaultSize: { w: 3, h: 8 },
      minSize: { w: 2, h: 4 },
      tagFilterable: true,
      settings: {
        startHour: { kind: "number", label: "From hour", default: 7, min: 0, max: 23 },
        endHour: { kind: "number", label: "To hour", default: 23, min: 1, max: 24 },
      },
      instanceTitle: (s) => (s.startHour === 7 && s.endHour === 23 ? "" : `Agenda · ${s.startHour}–${s.endHour}h`),
    },
    {
      id: "hub.map",
      title: "Map",
      description: "Every located thing, from every app, on an OpenStreetMap",
      component: MapCard,
      defaultSize: { w: 6, h: 8 },
      minSize: { w: 3, h: 4 },
      tagFilterable: true,
      settings: {
        app: { kind: "entity", label: "App", useOptions: useLocatableAppOptions, anyLabel: "All apps" },
      },
      instanceTitle: (s) => (s.app ? `Map · ${useLocatableAppOptions().find((o) => o.value === s.app)?.label ?? s.app}` : ""),
    },
    {
      id: "hub.tags",
      title: "Tags",
      description: "Every tag in use across apps — expand one to see what carries it",
      component: TagsCard,
      defaultSize: { w: 3, h: 7 },
      minSize: { w: 2, h: 3 },
    },
  ],
  commands: [
    {
      id: "hub.go-dashboard",
      title: "Go to Dashboard",
      keywords: ["workspace", "screens"],
      icon: LayoutDashboard,
      run: ({ navigate }) => navigate(lastLocation("dashboard")),
    },
    {
      id: "hub.go-notes",
      title: "Go to Notes",
      keywords: ["workspace", "journal", "editor"],
      icon: NotebookPen,
      run: ({ navigate }) => navigate(lastLocation("notes")),
    },
    {
      id: "hub.today-icon",
      title: "Go to Calendar",
      keywords: ["month", "schedule"],
      icon: Sun,
      run: ({ navigate }) => navigate("/calendar"),
    },
    {
      id: "hub.map-go",
      title: "Go to Map",
      keywords: ["places", "osm", "locations"],
      icon: MapPin,
      run: ({ navigate }) => navigate("/map"),
    },
  ],
};
