import { useState } from "react";
import { allIntakes, type Handoff } from "@lifeline/core";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@lifeline/ui";
import { BookmarkPlus, ChevronDown } from "lucide-react";

/**
 * "Keep as…" (ADR 0050): every Intake Core knows, and the chosen App's own
 * dialog opened with the Handoff. Mail names no receiver.
 */
export function KeepMenu({ handoff, size = "sm" }: { handoff: () => Handoff; size?: "sm" | "default" }) {
  const intakes = allIntakes();
  const [open, setOpen] = useState<{ key: string; handoff: Handoff } | null>(null);
  const chosen = open ? intakes.find((i) => i.key === open.key) : undefined;
  if (intakes.length === 0) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size}>
            <BookmarkPlus className="size-4" /> Keep as <ChevronDown className="size-3 opacity-60" />
          </Button>
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
