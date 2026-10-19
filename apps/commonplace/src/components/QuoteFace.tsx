import { useDocument, type RecallFaceProps } from "@lifeline/core";
import type { Quote } from "../domain/types";
import { locatorLabel } from "./QuoteBlock";

/**
 * A kept Quote's Prompt in a Practice (CONTEXT.md "Quote"): its Source and
 * locator, then — revealed — the passage, with the comment beside it. Held to
 * the card's width (ADR 0065).
 */
export function QuoteFace({ doc, revealed }: RecallFaceProps) {
  const q = doc as Quote;
  const source = useDocument(q.source || undefined);
  const where = [source?.title, locatorLabel(q.locator ?? "")].filter(Boolean).join(" · ");
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">Recall the passage</span>
      <span className="max-w-full text-2xl font-semibold break-words">{where || "A kept quote"}</span>
      <div className="min-h-16 max-w-full">
        {revealed && (
          <div className="grid gap-2">
            <blockquote className="text-primary font-serif text-lg whitespace-pre-line break-words italic">{q.body}</blockquote>
            {q.comment && <span className="text-muted-foreground text-sm whitespace-pre-wrap break-words">{q.comment}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
