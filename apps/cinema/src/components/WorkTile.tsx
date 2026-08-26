import { useState } from "react";
import { cn } from "@lifeline/ui";
import { Check, MoreHorizontal, Play } from "lucide-react";
import { workType } from "../domain/workTypes";
import { Cover } from "./Cover";
import type { Work } from "../domain/types";
import { LikeToggle, MarksGlance, WatchedToggle } from "./Marks";
import { WorkActionsMenu } from "./WorkActions";

/**
 * One Gallery tile: cover (or the titled fallback) with a two-line caption.
 * Carries the glanceable marks — engagement (in progress / done /
 * abandoned-dimmed), ★n and ♥ — and, Letterboxd-style (ADR 0035), a
 * one-click strip along the cover's foot: Watched, Liked, ⋯. The strip
 * appears on hover where there is a pointer and is always there on touch.
 */
export function WorkTile({ item, onOpen, onEdit }: { item: Work; onOpen: (m: Work) => void; onEdit?: (m: Work) => void }) {
  const def = workType(item.type);
  const abandoned = item.engagement === "ABANDONED";
  const reading = item.engagement === "IN_PROGRESS";
  const done = item.engagement === "DONE";
  const status = reading ? def.engagement.IN_PROGRESS : done ? def.engagement.DONE : abandoned ? def.engagement.ABANDONED : "";
  // The ⋯ menu is open: keep the strip shown so it does not vanish under the cursor.
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="group flex w-full flex-col gap-1.5 rounded-lg" title={status ? `${item.title} — ${status}` : item.title}>
      <div className={cn("relative w-full overflow-hidden rounded-md border shadow-sm transition-shadow group-hover:shadow-md", abandoned && "opacity-50")}>
        <button type="button" onClick={() => onOpen(item)} className="focus-visible:ring-ring block w-full text-left focus-visible:ring-2 focus-visible:outline-none" aria-label={`Open ${item.title}`}>
          <Cover item={item} size="fill" className="rounded-none border-0" />
        </button>
        {reading && (
          <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex size-5 items-center justify-center rounded-full shadow" aria-label={status}>
            <Play className="size-3" />
          </span>
        )}
        {done && (
          <span className="bg-background/90 text-foreground absolute top-1 right-1 flex size-5 items-center justify-center rounded-full border shadow" aria-label={status}>
            <Check className="size-3" />
          </span>
        )}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/75 to-transparent px-1 pt-4 pb-1 transition-opacity",
            "opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100",
            menuOpen && "opacity-100",
          )}
        >
          <WatchedToggle item={item} />
          <LikeToggle item={item} />
          <WorkActionsMenu
            item={item}
            onEdit={(m) => onEdit?.(m)}
            onOpenChange={setMenuOpen}
            trigger={
              <button type="button" className="flex items-center justify-center rounded-full text-white/80 hover:text-white" aria-label="More">
                <MoreHorizontal className="size-3.5" />
              </button>
            }
          />
        </div>
      </div>
      <button type="button" onClick={() => onOpen(item)} className="focus-visible:ring-ring min-w-0 rounded px-0.5 text-left focus-visible:ring-2 focus-visible:outline-none">
        <div className={cn("truncate text-xs font-medium", abandoned && "text-muted-foreground line-through")}>{item.title}</div>
        <div className="text-muted-foreground flex items-center gap-1.5 truncate text-[11px]">
          <span className="truncate">
            {item.creator}
            {item.creator && item.year ? " · " : ""}
            {item.year || ""}
          </span>
          <MarksGlance item={item} className="shrink-0" />
        </div>
      </button>
    </div>
  );
}
