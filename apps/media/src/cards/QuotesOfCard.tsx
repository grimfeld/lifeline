import { useMemo } from "react";
import type { CardProps } from "@lifeline/core";
import { CardUnavailable } from "@lifeline/ui";
import { useMedia } from "../data/repo";
import { useQuotes } from "../data/quotes";
import { newestFirst, QuoteBlock } from "../components/QuoteBlock";
import { countOf } from "./quoteShared";

/** Card: the quotes of one chosen item, newest first. */
export function QuotesOfCard({ settings, configure }: CardProps) {
  const itemId = typeof settings.item === "string" ? settings.item : "";
  const items = useMedia();
  const quotes = useQuotes();
  const item = items.find((m) => m.id === itemId);
  const own = useMemo(() => newestFirst(quotes.filter((q) => q.mediaId === itemId)).slice(0, countOf(settings, 5)), [quotes, itemId, settings]);
  if (!item) return <CardUnavailable message="That item no longer exists." onConfigure={configure} />;
  if (own.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No quotes from {item.title} yet.</div>;
  return (
    <div className="grid h-full content-start gap-2 overflow-y-auto">
      {own.map((q) => (
        <QuoteBlock key={q.id} quote={q} item={item} />
      ))}
    </div>
  );
}
