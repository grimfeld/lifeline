import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, toast } from "@lifeline/ui";
import { formatDuration, durationOf } from "../domain/templates";
import type { BlockerSide } from "../domain/types";
import { useBlockerTemplates } from "../data/blockerTemplates";
import { attachBlocker } from "../data/attached";

const SIDES: { side: BlockerSide; label: string }[] = [
  { side: "before", label: "Before…" },
  { side: "after", label: "After…" },
];

/**
 * Before… and After… on a timed Event (CONTEXT.md "Attached blocker"): each
 * lists the Blocker templates, and picking one makes a band flush against that
 * edge of the Event, attached to it. Not shown on an all-day Event — the
 * caller leaves it out.
 */
export function AttachBlocker({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const templates = useBlockerTemplates();
  const attach = (templateId: string, title: string, side: BlockerSide) =>
    void attachBlocker(eventId, templateId, side).then(
      () => toast.success(`${title} attached ${side} ${eventTitle}`),
      (e: Error) => toast.error(`Couldn't attach ${title}: ${e.message}`),
    );

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Attach a blocker</h3>
      <div className="flex flex-wrap gap-2">
        {SIDES.map(({ side, label }) => (
          <DropdownMenu key={side}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-w-xs">
              {templates.length === 0 && <DropdownMenuItem disabled>No Blocker templates yet</DropdownMenuItem>}
              {templates.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => attach(t.id, t.title, side)}>
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatDuration(durationOf(t))}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>
    </div>
  );
}
