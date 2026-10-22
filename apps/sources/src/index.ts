import { lazy } from "react";
import type { AppManifest, DocumentTypeDef } from "@lifeline/core";
import { Globe } from "lucide-react";
import { EmbedCard, embedCardSettings, useEmbedCardTitle } from "./cards/EmbedCard";
import { FeedCard, feedCardSettings, useFeedCardTitle } from "./cards/FeedCard";
import { LiveValueCard, liveValueCardSettings, useLiveValueCardTitle } from "./cards/LiveValueCard";
import { sourcesCommands } from "./commands";
import { sourcesTimed } from "./timed";
import { APP_ID, sourceHref } from "./hrefs";
import { COLOR_SLOTS, SOURCE_CACHE, SOURCE_TYPE, SOURCES } from "./domain/types";
import { hostOf } from "./domain/url";

// Screens load on first visit (ADR 0099); the rest of the manifest stays eager.
const SourcesScreen = lazy(() => import("./screens/SourcesScreen").then((m) => ({ default: m.SourcesScreen })));
const SourcePage = lazy(() => import("./screens/SourcePage").then((m) => ({ default: m.SourcePage })));

/** The `window` Document type (ADR 0019, ADR 0070): one type for every kind; `kind` discriminates. */
const sourceType: DocumentTypeDef = {
  id: SOURCE_TYPE,
  label: "Windows",
  icon: Globe,
  titleRule: "name",
  body: "none",
  fields: [
    {
      key: "kind",
      label: "Kind",
      kind: "select",
      guarded: true,
      column: true,
      options: [
        { value: "embed", label: "Embed" },
        { value: "feed", label: "Feed" },
        { value: "ical", label: "Calendar subscription" },
        { value: "value", label: "Live value" },
      ],
    },
    { key: "url", label: "URL", kind: "url", column: true },
    { key: "refreshMinutes", label: "Refresh (min)", kind: "number" },
    { key: "headers", label: "Headers", kind: "text", hidden: true },
    { key: "seenUpTo", label: "Seen up to", kind: "datetime", guarded: true },
    { key: "color", label: "Colour", kind: "select", options: COLOR_SLOTS.map((c) => ({ value: c, label: c })) },
    { key: "mode", label: "Read mode", kind: "select", options: [{ value: "json", label: "JSON path" }, { value: "regex", label: "Regex" }] },
    { key: "path", label: "Path / pattern", kind: "text" },
    { key: "unit", label: "Unit", kind: "text" },
    { key: "prefix", label: "Prefix", kind: "text" },
    { key: "decimals", label: "Decimals", kind: "number" },
  ],
  indexes: ["kind"],
  linkable: { subtitle: (d) => hostOf(String(d.url ?? "")) },
  href: (d) => sourceHref(d.id),
  order: 70,
  builtIn: true,
};

/**
 * The Sources App (ADR 0016/0017) owns Sources — things outside Lifeline shown
 * inside it: Embeds (a page in a frame), Feeds (RSS/Atom), Calendar
 * subscriptions (iCal → read-only Timed items) and Live values (one polled number).
 */
export const sourcesApp: AppManifest = {
  id: APP_ID,
  module: "notes",
  title: "Windows",
  icon: Globe,
  color: "var(--chart-red)",
  types: [sourceType],
  // Local-only fetch cache (never synced — leading underscore, ADR 0017).
  localTables: [{ name: SOURCE_CACHE, indexes: ["fetchedAt"] }],
  screens: [
    { id: "sources.main", title: "Windows", path: "sources", icon: Globe, component: SourcesScreen },
    { id: "sources.detail", title: "Window", path: "sources/:id", component: SourcePage, hidden: true },
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
  timed: sourcesTimed,
};

export { SOURCES, SOURCE_TYPE };
export type { Embed, Feed, CalendarSub, LiveValue, Source } from "./domain/types";
