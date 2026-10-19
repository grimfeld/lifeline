import type { AppManifest } from "@lifeline/core";
import { Feather } from "lucide-react";
import { ResearchScreen } from "./screens/ResearchScreen";
import { EssayScreen } from "./screens/EssayScreen";
import { DraftsCard } from "./cards/DraftsCard";
import { VersionsPanel } from "./VersionsPanel";
import { APP_ID, RESEARCH_HREF, essayType, versionType } from "./types";

/**
 * The Research App (ADR 0068), born the Writer's pad — its id stays `writer`:
 * Essays argued from material, and the Versions an Essay or a Chapter keeps.
 */
export const writerApp: AppManifest = {
  id: APP_ID,
  module: "research",
  title: "Research",
  icon: Feather,
  color: "var(--chart-violet)",
  types: [{ ...essayType, icon: Feather }, versionType],
  screens: [
    { id: "writer.desk", title: "Essays", path: "research", icon: Feather, component: ResearchScreen },
    { id: "writer.essay", title: "Essay", path: "research/e/:id", component: EssayScreen, hidden: true },
  ],
  cards: [
    {
      id: "writer.drafts",
      title: "Drafts",
      description: "Essays in progress, most recently edited first",
      component: DraftsCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      tagFilterable: true,
      settings: { count: { kind: "number", label: "How many", default: 6, min: 1, max: 30 } },
    },
  ],
  /** Versions ride along with an Essay or a Chapter wherever it is open (ADR 0045). */
  documentPanels: [{ id: "writer.versions", component: VersionsPanel }],
  commands: [{ id: "writer.go", title: "Go to Research", keywords: ["research", "essay", "essays", "draft", "thesis", "writer"], icon: Feather, run: ({ navigate }) => navigate(RESEARCH_HREF) }],
};

export { ESSAY, VERSION, VERSIONED, essayHref, wordCount, type Essay, type Version } from "./types";
export { snapshot, useVersions } from "./data";
export { VersionsPanel } from "./VersionsPanel";
