import { useState } from "react";
import { cn } from "@lifeline/ui";
import { AlertTriangle, ShoppingCart } from "lucide-react";
import { MEDIA_TYPES, mediaType } from "../domain/mediaTypes";
import { isBuySignal, isStale, nightstand, slotAge } from "../domain/rules";
import { useMedia } from "../data/repo";
import { Cover } from "../components/Cover";
import { EditMediaDialog } from "../components/MediaRow";
import type { MediaItem } from "../domain/types";

/** Card: everything currently holding a slot, across media, with stale and buy signals. */
export function NightstandCard() {
  const items = useMedia();
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const rows = MEDIA_TYPES.flatMap((t) => nightstand(items, t.id));
  if (rows.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Nightstand is empty.</div>;
  }
  return (
    <>
      <ul className="grid content-start gap-1 overflow-y-auto">
        {rows.map((m) => {
          const stale = isStale(m);
          return (
            <li key={m.id} className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5" onClick={() => setEditing(m)}>
              <Cover item={m} className="h-8 w-6" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{m.title}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {mediaType(m.type).label} · {m.engagement === "IN_PROGRESS" ? mediaType(m.type).engagement.IN_PROGRESS.toLowerCase() : "queued"}
                </div>
              </div>
              {isBuySignal(m) && <ShoppingCart className="text-primary size-3.5 shrink-0" />}
              <span className={cn("shrink-0 text-xs", stale ? "text-destructive flex items-center gap-1" : "text-muted-foreground")}>
                {stale && <AlertTriangle className="size-3" />}
                {slotAge(m)}d
              </span>
            </li>
          );
        })}
      </ul>
      <EditMediaDialog item={editing} onClose={() => setEditing(null)} />
    </>
  );
}
