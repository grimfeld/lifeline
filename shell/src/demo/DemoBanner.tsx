import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, toast } from "@lifeline/ui";
import { demoSourceUrl, eraseDevice, isDemo } from "@lifeline/core";
import { ExternalLink, Loader2, RotateCcw, X } from "lucide-react";

/**
 * The Demo's banner, Reset and Source link (CONTEXT.md "Demo", ADR 0077).
 *
 * Kept out of `./seed` on purpose: this file is in the main bundle (App.tsx
 * places the banner), the made-up life is a chunk only the Demo loads.
 */

/** Remembered per browser; a storage failure just shows the banner again. */
const DISMISSED = "lifeline:demo:banner-dismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed(): void {
  try {
    localStorage.setItem(DISMISSED, "1");
  } catch {
    // Not remembered: the banner comes back on the next open, which is harmless.
  }
}

/**
 * A thin bar at the top of the shell, on a phone too (ADR 0064 keeps banners
 * at the top, not in the Phone dock). Renders nothing outside the Demo.
 */
export function DemoBanner() {
  const [dismissed, setDismissed] = useState(wasDismissed);
  if (!isDemo() || dismissed) return null;
  return (
    <section
      aria-label="Demo"
      className="bg-muted text-muted-foreground flex shrink-0 items-center gap-x-2 border-b px-3 py-1 text-xs"
    >
      <p className="min-w-0 flex-1">
        <strong className="text-foreground font-medium">Demo</strong> — your changes stay in this browser
      </p>
      <ResetDemoButton size="xs" variant="ghost" className="shrink-0" />
      <SourceLink size="xs" variant="ghost" className="shrink-0" />
      <Button
        variant="ghost"
        size="icon-xs"
        className="shrink-0"
        title="Dismiss"
        aria-label="Dismiss"
        onClick={() => {
          rememberDismissed();
          setDismissed(true);
        }}
      >
        <X />
      </Button>
    </section>
  );
}

/** Small and quiet in the banner, outlined in Settings. */
interface Look {
  size?: "xs" | "sm";
  variant?: "ghost" | "outline";
  className?: string;
}

/** Reset: erase this browser's store and seed the made-up life again, dated around today. Asks first. */
export function ResetDemoButton({ size = "sm", variant = "outline", className }: Look) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    try {
      // The reload finds no "seeded" marker and seeds again with today as the visit day.
      await eraseDevice();
    } catch (err) {
      setBusy(false);
      toast.error(`Could not reset the demo: ${(err as Error).message}`);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setAsking(true)}>
        <RotateCcw /> Reset
      </Button>
      <Dialog open={asking} onOpenChange={(o) => !busy && setAsking(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset the demo?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Everything you added, changed or deleted in this browser is erased, and the made-up life comes back, dated around
            today.
          </p>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void reset()}>
              {busy && <Loader2 className="animate-spin" />} Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The link to the source; not shown when the build sets no URL. */
export function SourceLink({ size = "sm", variant = "outline", className }: Look) {
  const url = demoSourceUrl();
  if (!url) return null;
  return (
    <Button variant={variant} size={size} className={className} asChild>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <ExternalLink /> Source
      </a>
    </Button>
  );
}
