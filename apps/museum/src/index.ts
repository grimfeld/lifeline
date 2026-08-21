import type { AppManifest } from "@lifeline/core";
import { Landmark } from "lucide-react";
import { MuseumScreen } from "./screens/MuseumScreen";
import { ExhibitionScreen } from "./screens/ExhibitionScreen";
import { OnDisplayCard, useHangingExhibitionOptions, useOnDisplayTitle } from "./cards/OnDisplayCard";
import { museumCommands } from "./commands";
import { museumTypeDefs } from "./types";
import { EXHIBITION, type Exhibition } from "./domain/types";
import { hangExhibition, reopenExhibition, takeDownExhibition } from "./data/repo";

/** Museum App (ADR 0022): classical art, curated as exhibitions of rooms. */
export const museumApp: AppManifest = {
  id: "museum",
  title: "Museum",
  icon: Landmark,
  color: "var(--chart-yellow)",
  types: museumTypeDefs,
  screens: [
    { id: "museum.main", title: "Museum", path: "museum", icon: Landmark, component: MuseumScreen },
    { id: "museum.exhibition", title: "Exhibition", path: "museum/e/:id", component: ExhibitionScreen, hidden: true },
  ],
  cards: [
    {
      id: "museum.on-display",
      title: "On display",
      description: "One artwork from the hanging exhibitions — a different one every day",
      component: OnDisplayCard,
      defaultSize: { w: 3, h: 7 },
      minSize: { w: 2, h: 4 },
      settings: {
        exhibition: { kind: "entity", label: "Exhibition", anyLabel: "Any hanging exhibition", useOptions: useHangingExhibitionOptions, default: "" },
      },
      instanceTitle: useOnDisplayTitle,
    },
  ],
  commands: museumCommands,
  // ADR 0020: a board drag on the guarded exhibition state runs the real
  // verbs (hang / take down / reopen stamp their days and obey the
  // lifecycle); an illegal transition is declined.
  requestFieldChange: async (doc, field, value) => {
    if (doc.type !== EXHIBITION || field !== "state") return false;
    const e = doc as Exhibition;
    if (value === "HANGING") return hangExhibition(e.id);
    if (value === "ARCHIVED") return takeDownExhibition(e.id);
    if (value === "PREP") return reopenExhibition(e.id);
    return false;
  },
};

export { ART_FORMS, ART_FORM_IDS } from "./domain/artForms";
export type { ArtFormDef, ArtFormId } from "./domain/artForms";
export type { Artist, Artwork, Exhibition, ExhibitionState, Room } from "./domain/types";
