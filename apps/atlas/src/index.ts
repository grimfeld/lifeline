import type { AppManifest } from "@lifeline/core";
import { lazyChunk } from "@lifeline/ui";
import { MapPin, Map as MapIcon } from "lucide-react";
import { atlasCommands } from "./commands";
import { placeTypeDef } from "./types";
import { PlacePeek } from "./components/PlaceFields";

// Screens load on first visit (ADR 0099); the rest of the manifest stays eager.
const PlacesScreen = lazyChunk(() => import("./screens/PlacesScreen").then((m) => ({ default: m.PlacesScreen })));
const PlaceScreen = lazyChunk(() => import("./screens/PlaceScreen").then((m) => ({ default: m.PlaceScreen })));

/**
 * Atlas App (ADR 0119): the places I go, as the built-in Place. Beside
 * Contacts in the World Module (Core's `people`). Its domain is `src/domain`,
 * its writes `src/data/repo.ts`, and the Place page `src/screens/PlaceScreen.tsx`.
 * It imports no other App: other Apps reach Places through Core's `PLACE_TYPE`.
 */
export const atlasApp: AppManifest = {
  id: "atlas",
  module: "people",
  title: "Atlas",
  icon: MapIcon,
  // Not Contacts' aqua: on the World map a Place never looks like a friend's home.
  color: "var(--chart-magenta)",
  types: [{ ...placeTypeDef, icon: MapPin, peekEdit: PlacePeek }],
  screens: [
    { id: "atlas.places", title: "Places", path: "places", icon: MapPin, component: PlacesScreen },
    // The Place page: routed, never listed — reached from the Peek's "Open", a Base or a link.
    { id: "atlas.place", title: "Place", path: "places/place/:id", component: PlaceScreen, hidden: true },
  ],
  cards: [],
  commands: atlasCommands,
};

export { PLACES_FOLDER, type Place } from "./domain/types";
