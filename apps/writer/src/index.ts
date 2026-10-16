import type { AppManifest } from "@lifeline/core";
import { Feather } from "lucide-react";
import { WritingsScreen } from "./screens/WritingsScreen";
import { DraftsCard } from "./cards/DraftsCard";
import { VersionsPanel } from "./VersionsPanel";
import { APP_ID, versionType, WRITINGS_HREF, writingType } from "./types";
import { useFoldProjects } from "./data";

/** The Writer's pad (ADR 0019): owns `writing` (my own prose) and its internal `writing_version` snapshots. */
export const writerApp: AppManifest = {
  id: APP_ID,
  module: "journal",
  title: "Writer's pad",
  icon: Feather,
  color: "var(--chart-violet)",
  types: [writingType, versionType],
  // One screen: the desk lists and starts Writings, the Vault writes them (ADR 0045).
  screens: [{ id: "writer.desk", title: "Writings", path: "writings", icon: Feather, component: WritingsScreen }],
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
  /** Versions ride along with a Writing wherever it is open (ADR 0045). */
  documentPanels: [{ id: "writer.versions", component: VersionsPanel }],
  // ADR 0060: the old `project` field becomes a Folder, once, on every device.
  useBackground: useFoldProjects,
  commands: [{ id: "writer.go", title: "Go to Writings", keywords: ["writer", "draft", "pad"], icon: Feather, run: ({ navigate }) => navigate(WRITINGS_HREF) }],
};
