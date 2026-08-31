import type { AppManifest } from "@lifeline/core";
import { Feather } from "lucide-react";
import { WritingsScreen } from "./screens/WritingsScreen";
import { WritePage } from "./screens/WritePage";
import { DraftsCard } from "./cards/DraftsCard";
import { APP_ID, versionType, WRITINGS_HREF, writingType } from "./types";

/** The Writer's pad (ADR 0019): owns `writing` (my own prose) and its internal `writing_version` snapshots. */
export const writerApp: AppManifest = {
  id: APP_ID,
  title: "Writer's pad",
  icon: Feather,
  color: "var(--chart-violet)",
  types: [writingType, versionType],
  screens: [
    { id: "writer.desk", title: "Writings", path: "writings", icon: Feather, group: "study", component: WritingsScreen },
    { id: "writer.pad", title: "Writing", path: "write/:id", component: WritePage, hidden: true },
  ],
  cards: [
    {
      id: "writer.drafts",
      title: "Drafts",
      description: "Writings in progress, most recently edited first",
      component: DraftsCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      tagFilterable: true,
      settings: { count: { kind: "number", label: "How many", default: 6, min: 1, max: 30 } },
    },
  ],
  commands: [{ id: "writer.go", title: "Go to Writings", keywords: ["writer", "draft", "pad"], icon: Feather, run: ({ navigate }) => navigate(WRITINGS_HREF) }],
};
