import { useState } from "react";
import { Button } from "@lifeline/ui";
import { Loader2, X } from "lucide-react";
import { ResetDemoButton, SourceLink } from "./DemoActions";
import { useDemoFilling } from "./filling";

/**
 * The Demo's banner (CONTEXT.md "Demo", ADR 0077). App.tsx places it only in
 * the Demo, behind `isDemo()`, so the real build drops it; the made-up life is
 * a chunk of its own (`./seed`).
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

/** A thin bar at the top of the shell, on a phone too (ADR 0064 keeps banners at the top, not in the Phone dock). */
export function DemoBanner() {
  const [dismissed, setDismissed] = useState(wasDismissed);
  if (dismissed) return null;
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

/**
 * A line under the banner while the rest of the made-up life is written after
 * the first screen. Shown whether or not the banner was dismissed: it is about
 * what the visitor is looking at, and goes by itself within seconds.
 */
export function DemoFilling() {
  const filling = useDemoFilling();
  if (!filling) return null;
  return (
    <p role="status" className="bg-muted text-muted-foreground flex shrink-0 items-center gap-2 border-b px-3 py-1 text-xs">
      <Loader2 className="size-3 shrink-0 animate-spin" />
      <span className="min-w-0 flex-1">Filling in the rest of the Demo…</span>
    </p>
  );
}
