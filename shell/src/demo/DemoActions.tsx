import { useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, toast } from "@lifeline/ui";
import { demoSourceUrl, eraseDevice } from "@lifeline/core";
import { ExternalLink, Loader2, RotateCcw } from "lucide-react";

/**
 * The Demo's two actions (CONTEXT.md "Demo", ADR 0077), in the banner and in
 * Settings, so both stay reachable once the banner is dismissed.
 */

/** How a Demo action's button looks where it sits: small and quiet in the banner, outlined in Settings. */
export interface DemoActionLook {
  size?: "xs" | "sm";
  variant?: "ghost" | "outline";
  className?: string;
}

/** Reset: erase this browser's store and seed the made-up life again, dated around today. Asks first. */
export function ResetDemoButton({ size = "sm", variant = "outline", className }: DemoActionLook) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    try {
      forgetPlaces();
      // Reloaded at `/`, which lands where a stranger does: the reload finds no
      // "seeded" marker, seeds again with today as the visit day, and Home is
      // the place it remembers.
      history.replaceState(null, "", "/");
      await eraseDevice();
    } catch (err) {
      setBusy(false);
      toast.error(`Could not reset the Demo: ${(err as Error).message}`);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setAsking(true)}>
        <RotateCcw /> Reset
      </Button>
      <Dialog open={asking} onOpenChange={(o) => !busy && setAsking(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset the Demo?</DialogTitle>
            <DialogDescription>
              Everything you added, changed or deleted in this browser is erased, and the made-up life comes back, dated
              around today.
            </DialogDescription>
          </DialogHeader>
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

/**
 * What this browser remembers outside the store — the last place per
 * Workspace, the current Workspace, view and tab choices — goes with a Reset.
 * The Demo's own keys (the dismissed banner) stay.
 */
function forgetPlaces(): void {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? "");
    for (const k of keys) if (k.startsWith("lifeline") && !k.startsWith("lifeline:demo:")) localStorage.removeItem(k);
  } catch {
    // Storage blocked: nothing was remembered either.
  }
}

/** The link to the source; not shown when the build sets no URL. */
export function SourceLink({ size = "sm", variant = "outline", className }: DemoActionLook) {
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
