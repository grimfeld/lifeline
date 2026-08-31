import type { AppManifest } from "@lifeline/core";
import { Disc3 } from "lucide-react";
import { DiscothequeScreen } from "./screens/DiscothequeScreen";
import { InProgressCard } from "./cards/InProgressCard";
import { FinishedCard } from "./cards/FinishedCard";
import { SurpriseCard } from "./cards/SurpriseCard";
import { QuickAddCard } from "./cards/QuickAddCard";
import { WantCard } from "./cards/WantCard";
import { discothequeCommands } from "./commands";
import { WORK_TYPE_IDS, type Work } from "./domain/types";
import type { WorkTypeId } from "./domain/workTypes";
import { patchWork } from "./data/repo";
import { abandon, finish, start } from "./domain/rules";
import { discothequeDaylog } from "./daylog";
import { playlistTypeDef, workTypeDefs } from "./types";

/** Discotheque App (ADR 0024): albums — streamed, keyless lookup, no settings. */
export const discothequeApp: AppManifest = {
  id: "discotheque",
  title: "Discotheque",
  icon: Disc3,
  color: "var(--chart-violet)",
  types: [...workTypeDefs, playlistTypeDef],
  screens: [{ id: "discotheque.main", title: "Discotheque", path: "discotheque", icon: Disc3, group: "culture", component: DiscothequeScreen }],
  cards: [
    {
      id: "discotheque.in-progress",
      tagFilterable: true,
      title: "Listening now",
      description: "What you're listening to right now",
      component: InProgressCard,
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 2, h: 3 },
    },
    {
      id: "discotheque.finished",
      tagFilterable: true,
      title: "Listened this year",
      description: "How much you listened this year, with the latest covers",
      component: FinishedCard,
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: { year: { kind: "number", label: "Year", default: new Date().getFullYear(), min: 2000, max: 2100 } },
      instanceTitle: (s) => `Listened in ${s.year}`,
    },
    {
      id: "discotheque.surprise",
      title: "Surprise me",
      description: "One random unheard pick — reroll or start it",
      component: SurpriseCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 4 },
    },
    {
      id: "discotheque.quick-add",
      title: "Discotheque quick add",
      description: "One line — album, artist, Enter — straight onto the To listen shelf",
      component: QuickAddCard,
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
    },
    {
      id: "discotheque.want",
      tagFilterable: true,
      title: "To listen",
      description: "What's waiting, with a one-tap start",
      component: WantCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      settings: {
        count: { kind: "number", label: "Show at most", default: 10, min: 1, max: 50 },
        sort: { kind: "select", label: "Order", default: "added", options: [{ value: "added", label: "Recently added" }, { value: "title", label: "Title" }] },
      },
    },
  ],
  commands: discothequeCommands,
  daylog: discothequeDaylog,
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
