import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/** How long a screen may stay blank before the spinner shows: a cached chunk never flashes it. */
const DELAY_MS = 300;

/**
 * The Suspense fallback of a lazy App screen (ADR 0099): blank at first, then a
 * centred spinner once the chunk has taken longer than {@link DELAY_MS}. It
 * fills the content area only, so the Rail and the Module's sidebar stay put.
 */
export function ScreenLoading() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  if (!shown) return null;
  return (
    <div role="status" aria-label="Loading" className="text-muted-foreground flex h-full min-h-40 w-full items-center justify-center">
      <Loader2 className="size-6 motion-safe:animate-spin" />
    </div>
  );
}
