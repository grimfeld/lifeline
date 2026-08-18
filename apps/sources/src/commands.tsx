import type { CommandDef } from "@lifeline/core";
import { CalendarDays, Gauge, Globe, Rss } from "lucide-react";
import { SourceDialog } from "./components/SourceDialog";
import type { SourceKind } from "./domain/types";

const dialogFor = (kind: SourceKind) =>
  function NewSourceCommandDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
    return <SourceDialog {...props} kind={kind} />;
  };

export const sourcesCommands: CommandDef[] = [
  { id: "sources.new-embed", title: "New embed", keywords: ["url", "iframe", "web", "page", "source", "external"], icon: Globe, dialog: dialogFor("embed") },
  { id: "sources.new-feed", title: "New feed", keywords: ["rss", "atom", "blog", "news", "source"], icon: Rss, dialog: dialogFor("feed") },
  { id: "sources.new-ical", title: "New calendar subscription", keywords: ["ical", "ics", "google calendar", "subscribe", "source"], icon: CalendarDays, dialog: dialogFor("ical") },
  { id: "sources.new-value", title: "New live value", keywords: ["api", "json", "poll", "metric", "weather", "price", "source"], icon: Gauge, dialog: dialogFor("value") },
];
