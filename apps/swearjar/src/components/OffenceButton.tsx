import { useRef } from "react";
import { cn, toast } from "@lifeline/ui";
import { faceColor, faceOf, type Offence } from "../domain/types";
import { formatCents } from "../domain/money";
import { deleteFine, logFine } from "../data/repo";

const HOLD_MS = 500;

/** Log one Fine right now, with an Undo for the mis-tap. */
export async function fineNow(o: Offence): Promise<void> {
  try {
    const id = await logFine(o);
    toast.success(`${formatCents(o.price)} in the jar`, { description: o.name, action: { label: "Undo", onClick: () => void deleteFine(id) } });
  } catch (err) {
    toast.error((err as Error).message);
  }
}

/**
 * One Offence as a one-tap button (ADR 0083): a tap drops its price in the
 * jar now; holding it (or a right-click) opens the form for backdating and a
 * note — logging has to be quick at the moment it happens or it won't be.
 */
export function OffenceButton({ offence, onDetails, compact = false }: { offence: Offence; onDetails: () => void; compact?: boolean }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);

  function start() {
    held.current = false;
    timer.current = setTimeout(() => {
      held.current = true;
      onDetails();
    }, HOLD_MS);
  }

  function cancel() {
    clearTimeout(timer.current);
  }

  return (
    <button
      type="button"
      className={cn("hover:bg-accent/60 flex min-w-0 items-center gap-2 rounded-md border text-left select-none active:scale-[0.98] motion-safe:transition-transform", compact ? "px-2 py-1" : "px-3 py-2")}
      title="Tap to fine yourself — hold for the details"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        cancel();
        if (!held.current) onDetails();
        held.current = true;
      }}
      onClick={() => {
        if (held.current) return void (held.current = false);
        void fineNow(offence);
      }}
    >
      <span className={cn("grid shrink-0 place-items-center rounded-full leading-none text-white", compact ? "size-6 text-sm" : "size-8 text-lg")} style={{ background: faceColor(offence) }}>
        {faceOf(offence)}
      </span>
      <span className={cn("min-w-0 flex-1 truncate", compact ? "text-xs" : "text-sm")}>{offence.name}</span>
      <span className={cn("text-muted-foreground shrink-0 tabular-nums", compact ? "text-[10px]" : "text-xs")}>{formatCents(offence.price)}</span>
    </button>
  );
}
