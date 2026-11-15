import { Button } from "@lifeline/ui";
import { formatTime, pushPeek } from "@lifeline/core";
import { useAttachedBlockers } from "../data/attached";
import type { TimeBlocker } from "../domain/types";

/**
 * An Event's attached blockers, listed in its Peek (CONTEXT.md "Attached
 * blocker"): each opens its own Peek, where Detach is. Nothing when it has none.
 */
export function AttachedBlockers({ eventId }: { eventId: string }) {
  const bands = useAttachedBlockers(eventId);
  if (bands.length === 0) return null;
  return (
    <section aria-label="Attached blockers" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Attached blockers</h3>
      <ul className="flex flex-col gap-1">
        {bands.map((b: TimeBlocker) => (
          <li key={b.id} className="flex min-w-0 items-baseline gap-2 text-sm">
            <span className="text-muted-foreground shrink-0 text-xs">{b.side === "before" ? "Before" : "After"}</span>
            <Button variant="link" className="h-auto min-w-0 shrink justify-start p-0 text-left whitespace-normal [overflow-wrap:anywhere]" onClick={() => pushPeek(b.id)}>
              {b.title}
            </Button>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {formatTime(b.start)}–{formatTime(b.end)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

