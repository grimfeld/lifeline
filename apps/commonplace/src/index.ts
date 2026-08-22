import type { AppManifest } from "@lifeline/core";
import { NotebookPen } from "lucide-react";
import { CommonplaceScreen } from "./screens/CommonplaceScreen";
import { RandomQuoteCard } from "./cards/RandomQuoteCard";
import { QuoteOfDayCard } from "./cards/QuoteOfDayCard";
import { QuotesOfCard } from "./cards/QuotesOfCard";
import { RecentQuotesCard } from "./cards/RecentQuotesCard";
import { QuoteCaptureCard } from "./cards/QuoteCaptureCard";
import { familyField, quoteTagField, titleWithFamily, useQuotesOfTitle, useWorkOptions } from "./cards/quoteShared";
import { commonplaceCommands } from "./commands";
import { commonplaceDaylog } from "./daylog";
import { quoteTypeDef } from "./types";

/** Commonplace book App (ADR 0024): passages from a work of any family. */
export const commonplaceApp: AppManifest = {
  id: "commonplace",
  title: "Commonplace book",
  icon: NotebookPen,
  color: "var(--chart-orange)",
  types: [quoteTypeDef],
  screens: [{ id: "commonplace.main", title: "Commonplace book", path: "commonplace", icon: NotebookPen, component: CommonplaceScreen }],
  cards: [
    {
      id: "commonplace.quote-random",
      title: "Random quote",
      description: "One quote from your books, films and albums — reroll for another",
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
      description: "The quotes you kept from one book, film or album",
      component: QuotesOfCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: {
        item: { kind: "entity", label: "Work", required: true, useOptions: useWorkOptions },
        count: { kind: "number", label: "Show at most", default: 5, min: 1, max: 50 },
      },
      instanceTitle: useQuotesOfTitle,
    },
    {
      id: "commonplace.quotes-recent",
      title: "Recent quotes",
      description: "The latest quotes you captured, with their works",
      component: RecentQuotesCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: { count: { kind: "number", label: "Show at most", default: 5, min: 1, max: 50 }, family: familyField },
      instanceTitle: (s) => titleWithFamily("Recent quotes", s.family),
    },
    {
      id: "commonplace.quote-capture",
      title: "Quote capture",
      description: "Jot a passage into what you're reading right now",
      component: QuoteCaptureCard,
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      settings: { family: familyField },
      instanceTitle: (s) => titleWithFamily("Quote capture", s.family),
    },
  ],
  commands: commonplaceCommands,
  daylog: commonplaceDaylog,
};

export type { Quote } from "./domain/types";
