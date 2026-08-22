import type { CardProps } from "@lifeline/core";
import { newestFirst, QuoteBlock } from "../components/QuoteBlock";
import { countOf, useQuotePool } from "./quoteShared";

/** Card: the most recently captured quotes, with their item. */
export function RecentQuotesCard({ settings }: CardProps) {
  const { pool, byId } = useQuotePool(settings);
  const recent = newestFirst(pool).slice(0, countOf(settings, 5));
  if (recent.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No quotes yet.</div>;
  return (
    <div className="grid h-full content-start gap-2 overflow-y-auto">
      {recent.map((q) => (
        <QuoteBlock key={q.id} quote={q} item={byId.get(q.mediaId)} showItem />
      ))}
    </div>
  );
}
