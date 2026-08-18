import type { AppManifest } from "@lifeline/core";
import { Globe } from "lucide-react";
import { SourcesScreen } from "./screens/SourcesScreen";
import { SourcePage } from "./screens/SourcePage";
import { EmbedCard, embedCardSettings, useEmbedCardTitle } from "./cards/EmbedCard";
import { FeedCard, feedCardSettings, useFeedCardTitle } from "./cards/FeedCard";
import { LiveValueCard, liveValueCardSettings, useLiveValueCardTitle } from "./cards/LiveValueCard";
import { sourcesCommands } from "./commands";
import { sourcesLinkable } from "./linkable";
import { sourcesTaggable } from "./taggable";
import { sourcesTimed } from "./timed";
import { APP_ID } from "./hrefs";
import { SOURCES, SOURCE_CACHE } from "./domain/types";

/**
 * The Sources App (ADR 0016/0017) owns Sources — things outside Lifeline shown
 * inside it: Embeds (a page in a frame), Feeds (RSS/Atom), Calendar
 * subscriptions (iCal → read-only Timed items) and Live values (one polled number).
 */
export const sourcesApp: AppManifest = {
  id: APP_ID,
  title: "Sources",
  icon: Globe,
  color: "var(--chart-red)",
  collections: [
    { name: SOURCES, indexes: ["kind", "*tags"] },
    // Local-only fetch cache (never synced — leading underscore).
    { name: SOURCE_CACHE, indexes: ["fetchedAt"] },
  ],
  screens: [
    { id: "sources.main", title: "Sources", path: "sources", icon: Globe, component: SourcesScreen },
    { id: "sources.detail", title: "Source", path: "sources/:id", component: SourcePage, hidden: true },
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
    {
      id: "sources.feed",
      title: "Feed",
      description: "Latest items of an RSS/Atom feed; new ones are marked",
      component: FeedCard,
      defaultSize: { w: 3, h: 7 },
      minSize: { w: 2, h: 3 },
      settings: feedCardSettings,
      instanceTitle: useFeedCardTitle,
    },
    {
      id: "sources.value",
      title: "Live value",
      description: "One number read from a URL on a period — weather, a price, a count",
      component: LiveValueCard,
      defaultSize: { w: 2, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: liveValueCardSettings,
      instanceTitle: useLiveValueCardTitle,
    },
  ],
  commands: sourcesCommands,
  linkable: sourcesLinkable,
  taggable: sourcesTaggable,
  timed: sourcesTimed,
};

export { SOURCES };
export type { Embed, Feed, CalendarSub, LiveValue, Source } from "./domain/types";
