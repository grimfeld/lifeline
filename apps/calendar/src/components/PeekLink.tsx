import type { ReactNode } from "react";
import { Button, cn } from "@lifeline/ui";
import { pushPeek } from "@lifeline/core";

/**
 * A Document named in running text, opening its Peek (an attached blocker's
 * Event, an Event's attached blockers): a link that wraps a title however long
 * it is (CODING_STANDARDS § Long content).
 */
export function PeekLink({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <Button variant="link" className={cn("h-auto min-w-0 shrink justify-start p-0 text-left whitespace-normal [overflow-wrap:anywhere]", className)} onClick={() => pushPeek(id)}>
      {children}
    </Button>
  );
}
