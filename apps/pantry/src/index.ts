import { lazy } from "react";
import type { AppManifest } from "@lifeline/core";
import { ShoppingBasket } from "lucide-react";
import { RunningLowCard } from "./cards/RunningLowCard";
import { ExpiringCard } from "./cards/ExpiringCard";
import { StorageCard, useStorageCardTitle } from "./cards/StorageCard";
import { QuickAddCard } from "./cards/QuickAddCard";
import { useStorageOptions } from "./data/repo";
import { pantryCommands } from "./commands";
import { pantryTypeDefs } from "./types";
import { DEFAULT_EXPIRY_WINDOW_DAYS } from "./domain/rules";

// Screens load on first visit (ADR 0099); the rest of the manifest stays eager.
const PantryScreen = lazy(() => import("./screens/PantryScreen").then((m) => ({ default: m.PantryScreen })));

/** Pantry App (ADR 0043): the household's stocks — Provisions counted per Storage. */
export const pantryApp: AppManifest = {
  id: "pantry",
  module: "house",
  title: "Pantry",
  icon: ShoppingBasket,
  color: "var(--chart-green)",
  types: pantryTypeDefs,
  screens: [{ id: "pantry.main", title: "Pantry", path: "pantry", icon: ShoppingBasket, component: PantryScreen }],
  cards: [
    {
      id: "pantry.running-low",
      tagFilterable: true,
      title: "Running low",
      description: "Provisions under their minimum or out entirely — what the next shop should fix",
      component: RunningLowCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
    },
    {
      id: "pantry.expiring",
      tagFilterable: true,
      title: "Expiring soon",
      description: "Provisions to check by their expires hint, soonest first",
      component: ExpiringCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: { window: { kind: "number", label: "Window (days)", default: DEFAULT_EXPIRY_WINDOW_DAYS, min: 1, max: 90, step: 1 } },
    },
    {
      id: "pantry.storage",
      tagFilterable: true,
      title: "Storage",
      description: "One storage's contents with steppers — the chest freezer on the home screen",
      component: StorageCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      settings: { storage: { kind: "entity", label: "Storage", required: true, useOptions: useStorageOptions } },
      instanceTitle: useStorageCardTitle,
    },
    {
      id: "pantry.quick-add",
      title: "Pantry quick add",
      description: "Type a product, pick a storage, Enter — restocks instead of duplicating",
      component: QuickAddCard,
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      settings: { storage: { kind: "entity", label: "Default storage", anyLabel: "First storage", useOptions: useStorageOptions, default: "" } },
    },
  ],
  commands: pantryCommands,
};

export type { Provision, Storage, StorageKind } from "./domain/types";
