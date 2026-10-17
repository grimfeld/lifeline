import { useState } from "react";
import { useNavigate } from "react-router";
import { Button, cn, TagChips } from "@lifeline/ui";
import { ClipboardCopy, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { deleteQuote } from "../data/quotes";
import type { Quote } from "../domain/types";
import type { SourceItem } from "../domain/works";
import { QuoteEditor } from "./QuoteEditor";
import { copyQuote, insertQuoteIntoJournal } from "./quoteActions";
import { KeepMenu, useTopicNames } from "./KeepMenu";

/** "— p. 12" style locator. */
export const locatorLabel = (loc: string) => (loc.trim() ? (/^\d+$/.test(loc.trim()) ? `p. ${loc.trim()}` : loc.trim()) : "");

/**
 * One quote as a blockquote with hover actions (edit inline, delete, insert
 * into today's note, copy). `item` may be undefined when the work is gone.
 */
export function QuoteBlock({ quote, item, showItem = false, className }: { quote: Quote; item: SourceItem | undefined; showItem?: boolean; className?: string }) {
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const keptIn = useTopicNames().find((t) => t.id === quote.topic)?.name;
  if (editing) {
    return (
      <div className={cn("rounded-md border p-2", className)}>
        <QuoteEditor source={quote.source} quote={quote} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </div>
    );
  }
  const loc = locatorLabel(quote.locator);
  return (
    <div className={cn("group relative grid gap-1 rounded-md py-1 pr-1 pl-3", "border-muted-foreground/30 border-l-2", className)}>
      <blockquote className="font-serif text-sm whitespace-pre-line italic" data-origin={quote.id}>
        {quote.body}
      </blockquote>
      {(loc || showItem) && (
        <div className="text-muted-foreground text-xs">
          — {showItem && item ? `${item.title}${item.creator ? `, ${item.creator}` : ""}` : ""}
          {showItem && item && loc ? " · " : ""}
          {loc}
        </div>
      )}
      {quote.comment && <div className="text-muted-foreground text-xs italic">{quote.comment}</div>}
      {quote.kept && <div className="text-primary min-w-0 truncate text-xs">kept · {keptIn ?? "a topic"}</div>}
      {(quote.tags ?? []).length > 0 && <TagChips tags={quote.tags} size="xs" />}
      <div className="bg-background/90 absolute top-0 right-0 hidden items-center gap-0.5 rounded-md border p-0.5 shadow-sm group-focus-within:flex group-hover:flex">
        <Button size="icon" variant="ghost" className="size-6" title="Edit" aria-label="Edit quote" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" />
        </Button>
        <KeepMenu quote={quote} className="size-6" />
        <Button size="icon" variant="ghost" className="size-6" title="Insert into today's note" aria-label="Insert into today's note" onClick={() => insertQuoteIntoJournal(quote, item, navigate)}>
          <NotebookPen className="size-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="size-6" title="Copy as blockquote" aria-label="Copy as blockquote" onClick={() => void copyQuote(quote, item)}>
          <ClipboardCopy className="size-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="text-destructive size-6" title="Delete" aria-label="Delete quote" onClick={() => void deleteQuote(quote.id)}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

/** Quotes newest-captured first (ties by updatedAt desc). */
export const newestFirst = (qs: Quote[]) => [...qs].sort((a, b) => b.capturedOn.localeCompare(a.capturedOn) || b.updatedAt.localeCompare(a.updatedAt));
