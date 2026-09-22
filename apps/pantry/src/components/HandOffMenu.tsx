import { useState } from "react";
import { allIntakes, type Handoff } from "@lifeline/core";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@lifeline/ui";
import { Send } from "lucide-react";

/**
 * "Hand off to…" (ADR 0050): every Intake Core knows, and the chosen App's
 * own dialog opened with the Handoff — how a running-low Provision reaches
 * the Shopping list (ADR 0055). Pantry names no receiver.
 */
export function HandOffMenu({ handoff }: { handoff: () => Handoff }) {
  const intakes = allIntakes();
  const [open, setOpen] = useState<{ key: string; handoff: Handoff } | null>(null);
  const chosen = open ? intakes.find((i) => i.key === open.key) : undefined;
  if (intakes.length === 0) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="text-muted-foreground hover:text-foreground flex size-6 shrink-0 items-center justify-center" title="Hand off to…">
            <Send className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {intakes.map((i) => (
            <DropdownMenuItem key={i.key} onSelect={() => setOpen({ key: i.key, handoff: handoff() })}>
              {i.icon && <i.icon className="size-4" />}
              {i.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {chosen && open && <chosen.dialog open onOpenChange={(o) => !o && setOpen(null)} handoff={open.handoff} />}
    </>
  );
}
