import type { AppManifest } from "@lifeline/core";
import { BookMarked } from "lucide-react";
import { MediaScreen } from "./screens/MediaScreen";
import { NightstandCard } from "./cards/NightstandCard";
import { ShoppingListCard } from "./cards/ShoppingListCard";
import { InProgressCard } from "./cards/InProgressCard";
import { FinishedCard } from "./cards/FinishedCard";
import { SurpriseCard } from "./cards/SurpriseCard";
import { QuickAddCard } from "./cards/QuickAddCard";
import { WantCard } from "./cards/WantCard";
import { mediumField, requiredMediumField, slottedMediumField } from "./cards/shared";
import { shelfLabel } from "./domain/browse";
import type { MediaTypeId } from "./domain/mediaTypes";
import { titleWithMedium } from "./domain/cardQueries";
import { mediaCommands } from "./commands";
import { MEDIA } from "./domain/types";
import { mediaLinkable } from "./linkable";
import { mediaDaylog } from "./daylog";
import { mediaTaggable } from "./taggable";

/** Media App (Nightstand/readlist port, generalised to any medium). */
export const mediaApp: AppManifest = {
  id: "media",
  title: "Media",
  icon: BookMarked,
  color: "var(--chart-magenta)",
  collections: [{ name: MEDIA, indexes: ["type", "slot", "externalKey", "*tags"] }],
  screens: [{ id: "media.main", title: "Media", path: "media", icon: BookMarked, component: MediaScreen }],
  cards: [
    {
      id: "media.nightstand",
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
      id: "media.shopping",
      tagFilterable: true,
      title: "Shopping list",
      description: "Everything you want but don't own — slotted ones first",
      component: ShoppingListCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: { medium: mediumField },
      instanceTitle: (s) => titleWithMedium("Shopping list", s.medium),
    },
    {
      id: "media.in-progress",
      tagFilterable: true,
      title: "In progress",
      description: "What you're reading, watching, playing right now",
      component: InProgressCard,
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: { medium: mediumField },
      instanceTitle: (s) => titleWithMedium("In progress", s.medium),
    },
    {
      id: "media.finished",
      tagFilterable: true,
      title: "Finished",
      description: "How much you finished this year, with the latest covers",
      component: FinishedCard,
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: { year: { kind: "number", label: "Year", default: new Date().getFullYear(), min: 2000, max: 2100 }, medium: mediumField },
      instanceTitle: (s) => titleWithMedium(`Finished ${s.year}`, s.medium),
    },
    {
      id: "media.surprise",
      title: "Surprise me",
      description: "One random pick from the backlog — reroll or put it on the Nightstand",
      component: SurpriseCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 4 },
      settings: { medium: mediumField },
      instanceTitle: (s) => titleWithMedium("Surprise me", s.medium),
    },
    {
      id: "media.quick-add",
      title: "Media quick add",
      description: "One line — title, creator, Enter — straight onto the To… shelf",
      component: QuickAddCard,
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      settings: { medium: requiredMediumField },
      instanceTitle: (s) => titleWithMedium("Quick add", s.medium),
    },
    {
      id: "media.want",
      tagFilterable: true,
      title: "To read / watch / listen",
      description: "What's waiting on the shelf, with a one-tap start",
      component: WantCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      settings: {
        medium: mediumField,
        count: { kind: "number", label: "Show at most", default: 10, min: 1, max: 50 },
        sort: { kind: "select", label: "Order", default: "added", options: [{ value: "added", label: "Recently added" }, { value: "title", label: "Title" }] },
      },
      instanceTitle: (s) => shelfLabel("UNSTARTED", typeof s.medium === "string" && s.medium ? (s.medium as MediaTypeId) : "all"),
    },
  ],
  commands: mediaCommands,
  linkable: mediaLinkable,
  daylog: mediaDaylog,
  taggable: mediaTaggable,
};

export { MEDIA };
export { MEDIA_TYPES } from "./domain/mediaTypes";
export type { MediaItem, Acquisition, Engagement } from "./domain/types";
export type { MediaTypeDef, MediaTypeId } from "./domain/mediaTypes";
