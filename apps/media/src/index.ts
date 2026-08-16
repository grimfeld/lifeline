import type { AppManifest } from "@lifeline/core";
import { BookMarked } from "lucide-react";
import { MediaScreen } from "./screens/MediaScreen";
import { NightstandCard } from "./cards/NightstandCard";
import { ShoppingListCard } from "./cards/ShoppingListCard";
import { mediaCommands } from "./commands";
import { MEDIA } from "./domain/types";

/** Media App (Nightstand/readlist port, generalised to any medium). */
export const mediaApp: AppManifest = {
  id: "media",
  title: "Media",
  icon: BookMarked,
  color: "var(--chart-magenta)",
  collections: [{ name: MEDIA, indexes: ["type", "slot", "externalKey"] }],
  screens: [{ id: "media.main", title: "Media", path: "media", icon: BookMarked, component: MediaScreen }],
  cards: [
    { id: "media.nightstand", title: "Nightstand", description: "Everything holding a slot, across books, movies, games…", component: NightstandCard, defaultSize: { w: 3, h: 6 }, minSize: { w: 2, h: 3 } },
    { id: "media.shopping", title: "Shopping list", description: "Wanted items on the Nightstand — buy these", component: ShoppingListCard, defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 3 } },
  ],
  commands: mediaCommands,
};

export { MEDIA };
export { MEDIA_TYPES } from "./domain/mediaTypes";
export type { MediaItem, Acquisition, Engagement } from "./domain/types";
export type { MediaTypeDef, MediaTypeId } from "./domain/mediaTypes";
