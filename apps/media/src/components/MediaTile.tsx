import { cn } from "@lifeline/ui";
import { Check, Play } from "lucide-react";
import { mediaType } from "../domain/mediaTypes";
import { Cover } from "./Cover";
import type { MediaItem } from "../domain/types";

/**
 * One Gallery tile: cover (or the titled fallback) with a two-line caption.
 * Carries only the glanceable marks — engagement (in progress / done /
 * abandoned-dimmed) and the slot number. Everything else lives in the filter.
 */
export function MediaTile({ item, onOpen }: { item: MediaItem; onOpen: (m: MediaItem) => void }) {
  const def = mediaType(item.type);
  const abandoned = item.engagement === "ABANDONED";
  const reading = item.engagement === "IN_PROGRESS";
  const done = item.engagement === "DONE";
  const status = reading ? def.engagement.IN_PROGRESS : done ? def.engagement.DONE : abandoned ? def.engagement.ABANDONED : "";
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group focus-visible:ring-ring flex w-full flex-col gap-1.5 rounded-lg text-left focus-visible:ring-2 focus-visible:outline-none"
      title={status ? `${item.title} — ${status}` : item.title}
    >
      <div className={cn("relative w-full overflow-hidden rounded-md border shadow-sm transition-shadow group-hover:shadow-md", abandoned && "opacity-50")}>
        <Cover item={item} size="fill" className="rounded-none border-0" />
        {item.slot > 0 && <span className="bg-primary text-primary-foreground absolute top-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shadow">#{item.slot}</span>}
        {reading && (
          <span className="bg-primary text-primary-foreground absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full shadow" aria-label={status}>
            <Play className="size-3" />
          </span>
        )}
        {done && (
          <span className="bg-background/90 text-foreground absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full border shadow" aria-label={status}>
            <Check className="size-3" />
          </span>
        )}
      </div>
      <div className="min-w-0 px-0.5">
        <div className={cn("truncate text-xs font-medium", abandoned && "text-muted-foreground line-through")}>{item.title}</div>
        <div className="text-muted-foreground truncate text-[11px]">
          {item.creator}
          {item.creator && item.year ? " · " : ""}
          {item.year || ""}
        </div>
      </div>
    </button>
  );
}
