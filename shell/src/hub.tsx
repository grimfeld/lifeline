import type { AppManifest } from "@lifeline/core";
import { Sun } from "lucide-react";
import { TodayCard } from "./surfaces/TodayCard";

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
