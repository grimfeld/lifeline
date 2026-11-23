import type { AppManifest } from "@lifeline/core";
import { lazyChunk } from "@lifeline/ui";
import { Images } from "lucide-react";
import { memoriesCommands } from "./commands";
import { memoryTypeDef } from "./types";

// Screens load on first visit (ADR 0099); the rest of the manifest stays eager.
const MemoryScreen = lazyChunk(() => import("./screens/MemoryScreen").then((m) => ({ default: m.MemoryScreen })));

/**
 * Memories App (ADR 0136): moments worth keeping, as the built-in Memory —
 * words and photos, a date of its own, and what it is about. Beside the
 * Journal App in the Journal Module; it imports no other App.
 */
export const memoriesApp: AppManifest = {
  id: "memories",
  module: "journal",
  title: "Memories",
  icon: Images,
  color: "var(--chart-orange)",
  types: [{ ...memoryTypeDef, icon: Images }],
  screens: [
    // The Memory's page: routed, never listed — reached from its Peek's "Open", a Backlink or a link.
    { id: "memories.memory", title: "Memory", path: "journal/memories/:id", component: MemoryScreen, hidden: true },
  ],
  cards: [],
  commands: memoriesCommands,
};
