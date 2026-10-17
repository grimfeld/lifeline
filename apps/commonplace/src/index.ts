import type { AppManifest } from "@lifeline/core";
import { NotebookPen, Quote as QuoteIcon } from "lucide-react";
import { CommonplaceScreen } from "./screens/CommonplaceScreen";
import { ShelfScreen } from "./screens/ShelfScreen";
import { SourceScreen } from "./screens/SourceScreen";
import { NoteScreen } from "./screens/NoteScreen";
import { QuoteIntakeDialog } from "./components/QuoteIntakeDialog";
import { SourcePanel } from "./components/SourcePanel";
import { RandomQuoteCard } from "./cards/RandomQuoteCard";
import { QuoteOfDayCard } from "./cards/QuoteOfDayCard";
import { QuotesOfCard } from "./cards/QuotesOfCard";
import { RecentQuotesCard } from "./cards/RecentQuotesCard";
import { QuoteCaptureCard } from "./cards/QuoteCaptureCard";
import { familyField, quoteTagField, titleWithFamily, useQuotesOfTitle, useWorkOptions } from "./cards/quoteShared";
import { commonplaceCommands } from "./commands";
import { commonplaceDaylog } from "./daylog";
import { noteTypeDef, quoteTypeDef, sourceRole, sourceTypeDef } from "./types";
import { quoteReading } from "./domain/recallable";
import { QuoteFace } from "./components/QuoteFace";

/**
 * The Notes App (ADR 0070), born as the Commonplace book (ADR 0024): a shelf
 * of Sources, each holding my Notes on it and the Quotes taken from it. The id
 * stays `commonplace` — Card and Command ids live in synced Screen layouts and
 * agent tool names.
 */
export const commonplaceApp: AppManifest = {
  id: "commonplace",
  module: "notes",
  title: "Notes",
  icon: NotebookPen,
  color: "var(--chart-orange)",
  types: [sourceTypeDef, noteTypeDef, quoteTypeDef],
  roles: [sourceRole],
  screens: [
    { id: "commonplace.shelf", title: "Sources", path: "notes", icon: NotebookPen, component: ShelfScreen },
    { id: "commonplace.main", title: "Quotes", path: "quotes", icon: QuoteIcon, component: CommonplaceScreen },
    { id: "commonplace.source", title: "Source", path: "notes/s/:id", component: SourceScreen, hidden: true },
    { id: "commonplace.note", title: "Note", path: "notes/n/:id", component: NoteScreen, hidden: true },
  ],
  documentPanels: [{ id: "commonplace.source", component: SourcePanel }],
  // Intake (ADR 0050, ADR 0070): a text handed over from another App — a kept mail — becomes a Quote with its Source, reviewed first.
  intakes: [{ id: "quote", title: "Quote", icon: QuoteIcon, dialog: QuoteIntakeDialog }],
  // A kept Quote is practised by the Knowledge App (ADR 0073), which this App never names.
  recallable: [{ ...quoteReading, face: QuoteFace }],
  cards: [
    {
      id: "commonplace.quote-random",
      title: "Random quote",
      description: "One quote from your Sources — reroll for another",
      component: RandomQuoteCard,
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: { family: familyField, tag: quoteTagField },
      instanceTitle: (s) => titleWithFamily("Random quote", s.family),
    },
    {
      id: "commonplace.quote-day",
      title: "Quote of the day",
      description: "The same quote all day, another one tomorrow",
      component: QuoteOfDayCard,
      defaultSize: { w: 4, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: { family: familyField, tag: quoteTagField },
      instanceTitle: (s) => titleWithFamily("Quote of the day", s.family),
    },
    {
      id: "commonplace.quotes-of",
      title: "Quotes of…",
      description: "The quotes you kept from one Source",
      component: QuotesOfCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: {
        item: { kind: "entity", label: "Source", required: true, useOptions: useWorkOptions },
        count: { kind: "number", label: "Show at most", default: 5, min: 1, max: 50 },
      },
      instanceTitle: useQuotesOfTitle,
    },
    {
      id: "commonplace.quotes-recent",
      title: "Recent quotes",
      description: "The latest quotes you kept, with their Sources",
      component: RecentQuotesCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: { count: { kind: "number", label: "Show at most", default: 5, min: 1, max: 50 }, family: familyField },
      instanceTitle: (s) => titleWithFamily("Recent quotes", s.family),
    },
    {
      id: "commonplace.quote-capture",
      title: "Note or quote capture",
      description: "Take a note or a quote from what you're reading, watching or listening to now",
      component: QuoteCaptureCard,
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      settings: { family: familyField },
      instanceTitle: (s) => titleWithFamily("Note or quote", s.family),
    },
  ],
  commands: commonplaceCommands,
  daylog: commonplaceDaylog,
};

export { NOTE, QUOTES, SOURCE, SOURCE_ROLE, sourceHref, noteHref, type Note, type Quote, type OwnSource } from "./domain/types";
