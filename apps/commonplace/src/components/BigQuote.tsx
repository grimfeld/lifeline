import { useNavigate } from "react-router";
import { cn } from "@lifeline/ui";
import { APP_HREF } from "../constants";
import type { Quote } from "../domain/types";
import type { QuotedWork } from "../domain/works";
import { locatorLabel } from "./QuoteBlock";

/** Card-sized rendering of one quote: large serif blockquote, attribution links to the Quotes page. */
export function BigQuote({ quote, item, className }: { quote: Quote; item: QuotedWork | undefined; className?: string }) {
  const navigate = useNavigate();
  const loc = locatorLabel(quote.locator);
  const who = item ? `${item.title}${item.creator ? `, ${item.creator}` : ""}` : "";
  const attribution = [who, loc].filter(Boolean).join(" · ");
  return (
    <figure className={cn("flex h-full min-h-0 flex-col justify-center gap-2 overflow-y-auto", className)}>
      <blockquote className="font-serif text-lg leading-snug whitespace-pre-line italic sm:text-xl">{quote.text}</blockquote>
      {attribution && (
        <figcaption className="text-muted-foreground text-xs">
          <button type="button" className="underline-offset-2 hover:underline" onClick={() => navigate(APP_HREF)}>
            — {attribution}
          </button>
        </figcaption>
      )}
      {quote.comment && <div className="text-muted-foreground text-xs italic">{quote.comment}</div>}
    </figure>
  );
}
