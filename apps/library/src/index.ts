import type { AppManifest } from "@lifeline/core";
import { Library as LibraryIcon } from "lucide-react";
import { LibraryScreen } from "./screens/LibraryScreen";
import { NightstandCard } from "./cards/NightstandCard";
import { ShoppingListCard } from "./cards/ShoppingListCard";
import { InProgressCard } from "./cards/InProgressCard";
import { FinishedCard } from "./cards/FinishedCard";
import { SurpriseCard } from "./cards/SurpriseCard";
import { QuickAddCard } from "./cards/QuickAddCard";
import { WantCard } from "./cards/WantCard";
import { mediumField, requiredMediumField, slottedMediumField } from "./cards/shared";
import { shelfLabel } from "./domain/browse";
import type { WorkTypeId } from "./domain/workTypes";
import { titleWithMedium } from "./domain/cardQueries";
import { libraryCommands } from "./commands";
import { WORK_TYPE_IDS, type Work } from "./domain/types";
import { patchWork } from "./data/repo";
import { abandon, finish, start } from "./domain/rules";
import { libraryDaylog } from "./daylog";
import { settingsTypeDef, workTypeDefs } from "./types";

/** Library App (ADR 0024): the reading family — books and comics, Nightstand and all. */
export const libraryApp: AppManifest = {
  id: "library",
  title: "Library",
  icon: LibraryIcon,
  color: "var(--chart-magenta)",
  types: [...workTypeDefs, settingsTypeDef],
  screens: [{ id: "library.main", title: "Library", path: "library", icon: LibraryIcon, component: LibraryScreen }],
  cards: [
    {
      id: "library.nightstand",
      tagFilterable: true,
      title: "Nightstand",
      description: "Books and comics holding a Nightstand slot — in progress and next up",
      component: NightstandCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: { medium: slottedMediumField },
      instanceTitle: (s) => titleWithMedium("Nightstand", s.medium),
    },
    {
      id: "library.shopping",
      tagFilterable: true,
      title: "Book shopping list",
      description: "Books and comics you want but don't own — slotted ones first",
      component: ShoppingListCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: { medium: mediumField },
      instanceTitle: (s) => titleWithMedium("Shopping list", s.medium),
    },
    {
      id: "library.in-progress",
      tagFilterable: true,
      title: "Reading now",
      description: "What you're reading right now",
      component: InProgressCard,
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: { medium: mediumField },
      instanceTitle: (s) => titleWithMedium("Reading", s.medium),
    },
    {
      id: "library.finished",
      tagFilterable: true,
      title: "Finished reading",
      description: "How much you read this year, with the latest covers",
      component: FinishedCard,
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: { year: { kind: "number", label: "Year", default: new Date().getFullYear(), min: 2000, max: 2100 }, medium: mediumField },
      instanceTitle: (s) => titleWithMedium(`Read in ${s.year}`, s.medium),
    },
    {
      id: "library.surprise",
      title: "Surprise me",
      description: "One random unread pick from the shelves — reroll or slot it",
      component: SurpriseCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 4 },
      settings: { medium: mediumField },
      instanceTitle: (s) => titleWithMedium("Surprise me", s.medium),
    },
    {
      id: "library.quick-add",
      title: "Library quick add",
      description: "One line — title, author, Enter — straight onto the To read shelf",
      component: QuickAddCard,
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      settings: { medium: requiredMediumField },
      instanceTitle: (s) => titleWithMedium("Quick add", s.medium),
    },
    {
      id: "library.want",
      tagFilterable: true,
      title: "To read",
      description: "What's waiting on the shelf, with a one-tap start",
      component: WantCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      settings: {
        medium: mediumField,
        count: { kind: "number", label: "Show at most", default: 10, min: 1, max: 50 },
        sort: { kind: "select", label: "Order", default: "added", options: [{ value: "added", label: "Recently added" }, { value: "title", label: "Title" }] },
      },
      instanceTitle: (s) => shelfLabel("UNSTARTED", typeof s.medium === "string" && s.medium ? (s.medium as WorkTypeId) : "all"),
    },
  ],
  commands: libraryCommands,
  daylog: libraryDaylog,
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
