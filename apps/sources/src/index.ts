import type { AppManifest } from "@lifeline/core";
import { Globe } from "lucide-react";
import { SourcesScreen } from "./screens/SourcesScreen";
import { EmbedPage } from "./screens/EmbedPage";
import { EmbedCard, embedCardSettings, useEmbedCardTitle } from "./cards/EmbedCard";
import { sourcesCommands } from "./commands";
import { sourcesLinkable } from "./linkable";
import { sourcesTaggable } from "./taggable";
import { APP_ID } from "./hrefs";
import { SOURCES } from "./domain/types";

/**
 * The Sources App (ADR 0016) owns Sources — things outside Lifeline shown
 * inside it. First kind: the Embed, a web page in a frame.
 */
export const sourcesApp: AppManifest = {
  id: APP_ID,
  title: "Sources",
  icon: Globe,
  color: "var(--chart-red)",
  collections: [{ name: SOURCES, indexes: ["kind", "*tags"] }],
  screens: [
    { id: "sources.main", title: "Sources", path: "sources", icon: Globe, component: SourcesScreen },
    { id: "sources.embed", title: "Embed", path: "sources/:id", component: EmbedPage, hidden: true },
  ],
  cards: [
    {
      id: "sources.embed",
      title: "Embed",
      description: "A web page shown as-is — a dashboard, a doc, a video",
      component: EmbedCard,
      defaultSize: { w: 6, h: 8 },
      minSize: { w: 2, h: 3 },
      settings: embedCardSettings,
      instanceTitle: useEmbedCardTitle,
    },
  ],
  commands: sourcesCommands,
  linkable: sourcesLinkable,
  taggable: sourcesTaggable,
};

export { SOURCES };
export type { Embed, Source } from "./domain/types";
