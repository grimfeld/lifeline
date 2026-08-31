import type { AppManifest } from "@lifeline/core";
import { Gamepad2 } from "lucide-react";
import { ArcadeScreen } from "./screens/ArcadeScreen";
import { ShoppingListCard } from "./cards/ShoppingListCard";
import { InProgressCard } from "./cards/InProgressCard";
import { FinishedCard } from "./cards/FinishedCard";
import { SurpriseCard } from "./cards/SurpriseCard";
import { QuickAddCard } from "./cards/QuickAddCard";
import { WantCard } from "./cards/WantCard";
import { arcadeCommands } from "./commands";
import { WORK_TYPE_IDS, type Work } from "./domain/types";
import type { WorkTypeId } from "./domain/workTypes";
import { patchWork } from "./data/repo";
import { abandon, finish, start } from "./domain/rules";
import { arcadeDaylog } from "./daylog";
import { settingsTypeDef, workTypeDefs } from "./types";

/** Arcade App (ADR 0024): games — bought, played, finished. No slots, no medium knob. */
export const arcadeApp: AppManifest = {
  id: "arcade",
  title: "Arcade",
  icon: Gamepad2,
  color: "var(--chart-green)",
  types: [...workTypeDefs, settingsTypeDef],
  screens: [{ id: "arcade.main", title: "Arcade", path: "arcade", icon: Gamepad2, group: "culture", component: ArcadeScreen }],
  cards: [
    {
      id: "arcade.shopping",
      tagFilterable: true,
      title: "Game shopping list",
      description: "Games you want but don't own, oldest wish first",
      component: ShoppingListCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
    },
    {
      id: "arcade.in-progress",
      tagFilterable: true,
      title: "Playing now",
      description: "What you're playing right now",
      component: InProgressCard,
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 2, h: 3 },
    },
    {
      id: "arcade.finished",
      tagFilterable: true,
      title: "Played this year",
      description: "How much you played this year, with the latest covers",
      component: FinishedCard,
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: { year: { kind: "number", label: "Year", default: new Date().getFullYear(), min: 2000, max: 2100 } },
      instanceTitle: (s) => `Played in ${s.year}`,
    },
    {
      id: "arcade.surprise",
      title: "Surprise me",
      description: "One random unplayed pick from the shelves — reroll or start it",
      component: SurpriseCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 4 },
    },
    {
      id: "arcade.quick-add",
      title: "Arcade quick add",
      description: "One line — title, developer, Enter — straight onto the To play shelf",
      component: QuickAddCard,
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
    },
    {
      id: "arcade.want",
      tagFilterable: true,
      title: "To play",
      description: "What's waiting on the shelf, with a one-tap start",
      component: WantCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      settings: {
        count: { kind: "number", label: "Show at most", default: 10, min: 1, max: 50 },
        sort: { kind: "select", label: "Order", default: "added", options: [{ value: "added", label: "Recently added" }, { value: "title", label: "Title" }] },
      },
    },
  ],
  commands: arcadeCommands,
  daylog: arcadeDaylog,
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
