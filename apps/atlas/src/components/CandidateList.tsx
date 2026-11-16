import type { ReactNode } from "react";
import { Button, cn } from "@lifeline/ui";

/**
 * The bordered "which one?" list Here and Locate both offer. The caption is
 * also spoken: a `status` region that stays mounted (a live region mounted
 * with its text is not reliably announced), empty while the list is closed.
 * An empty `caption` closes the list.
 */
export function CandidateList({ label, caption, children }: { label: string; caption: string; children?: ReactNode }) {
  return (
    <>
      <p role="status" className="sr-only">
        {caption}
      </p>
      {caption && (
        <div className="grid min-w-0 gap-0.5 rounded-lg border p-1" role="group" aria-label={label}>
          <p className="text-muted-foreground px-1 text-xs" aria-hidden>
            {caption}
          </p>
          {children}
        </div>
      )}
    </>
  );
}

/** One candidate in a CandidateList: wraps long text rather than clipping it. */
export function Candidate({ onPick, className = "", children }: { onPick: () => void; className?: string; children: ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="sm" className={cn("h-auto min-w-0 justify-start py-1 text-left font-normal whitespace-normal", className)} onClick={onPick}>
      {children}
    </Button>
  );
}
