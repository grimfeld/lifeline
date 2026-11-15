import type { ReactNode } from "react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, toast } from "@lifeline/ui";
import { formatDuration, durationOf } from "../domain/templates";
import { BLOCKER_SIDES, SIDE_LABELS } from "../domain/attached";
import type { BlockerSide, BlockerTemplate } from "../domain/types";
import { useBlockerTemplates } from "../data/blockerTemplates";
import { attachBlocker } from "../data/attached";

/**
 * Before… and After… on a timed Event (CONTEXT.md "Attached blocker"): each
 * lists the Blocker templates, and picking one hands it to `onPick` with its
 * side. What is already picked (`children`) sits beneath. Not shown on an
 * all-day Event — the caller leaves it out.
 */
export function AttachMenus({ onPick, children }: { onPick: (template: BlockerTemplate, side: BlockerSide) => void; children?: ReactNode }) {
  const templates = useBlockerTemplates();
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Attach a blocker</h3>
      <div className="flex flex-wrap gap-2">
        {BLOCKER_SIDES.map((side) => (
          <DropdownMenu key={side}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {SIDE_LABELS[side]}…
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-w-xs">
              {templates.length === 0 && <DropdownMenuItem disabled>No Blocker templates yet</DropdownMenuItem>}
              {templates.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => onPick(t, side)}>
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatDuration(durationOf(t))}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>
      {children}
    </div>
  );
}

/** Before… and After… on a saved timed Event (its Peek): a pick attaches a band to it at once. */
export function AttachBlocker({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const attach = (t: BlockerTemplate, side: BlockerSide) =>
    void attachBlocker(eventId, t.id, side).then(
      () => toast.success(`${t.title} attached ${side} ${eventTitle}`),
      (e: Error) => toast.error(`Couldn't attach ${t.title}: ${e.message}`),
    );
  return <AttachMenus onPick={attach} />;
}
