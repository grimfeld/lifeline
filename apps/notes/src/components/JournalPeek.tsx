import type { PeekProps } from "@lifeline/core";
import { TagsField } from "@lifeline/editor";
import { DAILY } from "../domain/types";
import { periodKey, periodLabel } from "../domain/periods";

/**
 * The Journal's part of a Day's or a period's Peek (ADR 0085). A Day and a
 * period have no Fields of their own — they are their body, which the Peek's
 * frame writes — so the part is where the page sits in time and its Tags.
 */
export function JournalPeek({ doc }: PeekProps) {
  const within = doc.type === DAILY && /^\d{4}-\d{2}-\d{2}$/.test(doc.title) ? [periodLabel(periodKey("week", doc.title)), periodLabel(periodKey("month", doc.title))] : [];
  return (
    <div className="grid gap-3">
      {within.length > 0 && <p className="text-muted-foreground text-xs">In {within.join(" · ")}</p>}
      <TagsField doc={doc} />
    </div>
  );
}
