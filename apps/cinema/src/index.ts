import type { AppManifest } from "@lifeline/core";
import { Clapperboard } from "lucide-react";
import { CinemaScreen } from "./screens/CinemaScreen";
import { InProgressCard } from "./cards/InProgressCard";
import { FinishedCard } from "./cards/FinishedCard";
import { SurpriseCard } from "./cards/SurpriseCard";
import { QuickAddCard } from "./cards/QuickAddCard";
import { WantCard } from "./cards/WantCard";
import { mediumField } from "./cards/shared";
import { titleWithMedium } from "./domain/cardQueries";
import { cinemaCommands } from "./commands";
import { WORK_TYPE_IDS, type Work } from "./domain/types";
import type { WorkTypeId } from "./domain/workTypes";
import { patchWork } from "./data/repo";
import { abandon, finish, start } from "./domain/rules";
import { cinemaDaylog } from "./daylog";
import { playlistTypeDef, settingsTypeDef, workTypeDefs } from "./types";

/** Cinema App (ADR 0024): movies and series — streamed, never owned. */
export const cinemaApp: AppManifest = {
  id: "cinema",
  title: "Cinema",
  icon: Clapperboard,
  color: "var(--chart-red)",
  types: [...workTypeDefs, playlistTypeDef, settingsTypeDef],
  screens: [{ id: "cinema.main", title: "Cinema", path: "cinema", icon: Clapperboard, group: "culture", component: CinemaScreen }],
  cards: [
    {
      id: "cinema.in-progress",
      tagFilterable: true,
      title: "Watching now",
      description: "What you're watching right now",
      component: InProgressCard,
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: { medium: mediumField },
      instanceTitle: (s) => titleWithMedium("Watching", s.medium),
    },
    {
      id: "cinema.finished",
      tagFilterable: true,
      title: "Watched this year",
      description: "How much you watched this year, with the latest posters",
      component: FinishedCard,
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: { year: { kind: "number", label: "Year", default: new Date().getFullYear(), min: 2000, max: 2100 }, medium: mediumField },
      instanceTitle: (s) => titleWithMedium(`Watched in ${s.year}`, s.medium),
    },
    {
      id: "cinema.surprise",
      title: "Surprise me",
      description: "One random unwatched pick — reroll or start it",
      component: SurpriseCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 4 },
      settings: { medium: mediumField },
      instanceTitle: (s) => titleWithMedium("Surprise me", s.medium),
    },
    {
      id: "cinema.quick-add",
      title: "Cinema quick add",
      description: "One line — title, Enter — straight onto the To watch shelf",
      component: QuickAddCard,
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      settings: { medium: { kind: "select", label: "Medium", default: "movie", options: [{ value: "movie", label: "Movies" }, { value: "series", label: "Series" }] } },
      instanceTitle: (s) => titleWithMedium("Quick add", s.medium),
    },
    {
      id: "cinema.want",
      tagFilterable: true,
      title: "To watch",
      description: "What's waiting, with a one-tap start",
      component: WantCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      settings: {
        medium: mediumField,
        count: { kind: "number", label: "Show at most", default: 10, min: 1, max: 50 },
        sort: { kind: "select", label: "Order", default: "added", options: [{ value: "added", label: "Recently added" }, { value: "title", label: "Title" }] },
      },
      instanceTitle: (s) => titleWithMedium("To watch", s.medium),
    },
  ],
  commands: cinemaCommands,
  daylog: cinemaDaylog,
  // ADR 0020: a board drag on the guarded Shelf runs the real transition.
  requestFieldChange: async (doc, field, value) => {
    if (field !== "engagement" || !WORK_TYPE_IDS.includes(doc.type as WorkTypeId)) return false;
    const item = doc as Work;
    if (value === "IN_PROGRESS") await patchWork(item, start());
    else if (value === "DONE") await patchWork(item, finish());
    else if (value === "ABANDONED") await patchWork(item, abandon());
    else return false;
    return true;
  },
};

export type { Work } from "./domain/types";
