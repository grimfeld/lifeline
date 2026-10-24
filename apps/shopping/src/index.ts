import type { AppManifest } from "@lifeline/core";
import { lazyChunk } from "@lifeline/ui";
import { ShoppingCart } from "lucide-react";
import { ShoppingListCard } from "./cards/ShoppingListCard";
import { AddNeedDialog } from "./components/AddNeedDialog";
import { shoppingCommands } from "./commands";
import { shoppingTypeDefs } from "./types";

// Screens load on first visit (ADR 0099); the rest of the manifest stays eager.
const ShoppingScreen = lazyChunk(() => import("./screens/ShoppingScreen").then((m) => ({ default: m.ShoppingScreen })));

/** Shopping list App (ADR 0055): anything to buy at the next chance, written in seconds. */
export const shoppingApp: AppManifest = {
  id: "shopping",
  module: "house",
  title: "Shopping list",
  icon: ShoppingCart,
  color: "var(--chart-orange)",
  types: shoppingTypeDefs,
  screens: [{ id: "shopping.main", title: "Shopping list", path: "shopping", icon: ShoppingCart, component: ShoppingScreen }],
  cards: [
    {
      id: "shopping.list",
      tagFilterable: true,
      title: "Shopping list",
      description: "The needs to buy, by aisle, tickable in the shop",
      component: ShoppingListCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
    },
  ],
  commands: shoppingCommands,
  // Intake (ADR 0050): anything handed over — a running-low Provision, a selected line — becomes a Need.
  intakes: [{ id: "need", title: "Need", icon: ShoppingCart, dialog: AddNeedDialog }],
};

export type { Need, Aisle } from "./domain/types";
