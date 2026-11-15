import type { DateStr } from "@lifeline/core";
import { describeBeside, SIDE_LABELS } from "../domain/attached";
import { blockerSpan } from "../domain/blockers";
import { useAttachedBlockers } from "../data/attached";
import { PeekLink } from "./PeekLink";

/**
 * An Event's attached blockers, listed in its Peek (CONTEXT.md "Attached
 * blocker"): each opens its own Peek, where Detach is, and gives its day when
 * that is not the Event's. Nothing when it has none.
 */
export function AttachedBlockers({ eventId, eventDay }: { eventId: string; eventDay: DateStr }) {
  const bands = useAttachedBlockers(eventId);
  if (bands.length === 0) return null;
  return (
    <section aria-label="Attached blockers" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Attached blockers</h3>
      <ul className="flex flex-col gap-1">
        {bands.map((b) => {
          const span = blockerSpan(b);
          return (
            <li key={b.id} className="flex min-w-0 items-baseline gap-2 text-sm">
              <span className="text-muted-foreground shrink-0 text-xs">{b.side && SIDE_LABELS[b.side]}</span>
              <PeekLink id={b.id}>{b.title}</PeekLink>
              {span && <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{describeBeside(span, eventDay)}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
