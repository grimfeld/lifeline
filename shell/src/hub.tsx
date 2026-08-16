import type { AppManifest } from "@lifeline/core";
import { Sun } from "lucide-react";
import { TodayCard } from "./surfaces/TodayCard";
import { AgendaCard } from "./surfaces/AgendaCard";

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
    },
    {
      id: "hub.agenda",
      title: "Today's agenda",
      description: "Today's timed items on an hour scale, with a live now-line",
      component: AgendaCard,
      defaultSize: { w: 3, h: 8 },
      minSize: { w: 2, h: 4 },
      settings: {
        startHour: { kind: "number", label: "From hour", default: 7, min: 0, max: 23 },
        endHour: { kind: "number", label: "To hour", default: 23, min: 1, max: 24 },
      },
      instanceTitle: (s) => (s.startHour === 7 && s.endHour === 23 ? "" : `Agenda · ${s.startHour}–${s.endHour}h`),
    },
  ],
  commands: [
    {
      id: "hub.today-icon",
      title: "Go to Calendar",
      keywords: ["month", "schedule"],
      icon: Sun,
      run: ({ navigate }) => navigate("/calendar"),
    },
  ],
};
