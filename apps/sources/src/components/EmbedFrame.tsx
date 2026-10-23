import { useEffect, useState } from "react";
import { cn } from "@lifeline/ui";
import type { Embed } from "../domain/types";

/**
 * The frame that shows an Embed (ADR 0016): a plain iframe, CSS-scaled when
 * `scale` < 1 (dense dashboards in small cards), reloaded every
 * `refreshMinutes`. A page that refuses framing simply stays blank — the
 * caller offers "Open ↗" beside it.
 *
 * Sandboxed: an embedded page runs its scripts, forms and popups as itself but
 * cannot navigate Lifeline away, and may write the clipboard but never read it.
 */
export function EmbedFrame({ embed, scale = 1, className }: { embed: Embed; scale?: number; className?: string }) {
  const [gen, setGen] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [embed.url, gen]);

  useEffect(() => {
    if (!embed.refreshMinutes) return;
    const t = setInterval(() => setGen((g) => g + 1), embed.refreshMinutes * 60_000);
    return () => clearInterval(t);
  }, [embed.refreshMinutes]);

  const pct = `${100 / scale}%`;
  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-md bg-background", className)}>
      {!loaded && (
        <div className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-xs">
          Loading…
        </div>
      )}
      <iframe
        key={`${embed.url}#${gen}`}
        title={embed.title}
        src={embed.url}
        onLoad={() => setLoaded(true)}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="fullscreen; clipboard-write"
        referrerPolicy="no-referrer-when-downgrade"
        className="border-0"
        style={{
          width: pct,
          height: pct,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      />
    </div>
  );
}
