import { cn } from "@lifeline/ui";
import { mediaType } from "../domain/mediaTypes";
import type { MediaItem } from "../domain/types";

/** Cover art with a titled fallback tile; shape follows the medium. */
export function Cover({ item, className }: { item: Pick<MediaItem, "title" | "coverUrl" | "type">; className?: string }) {
  const square = mediaType(item.type).cover === "square";
  const shape = square ? "size-12" : "h-14 w-10";
  if (item.coverUrl) {
    return <img src={item.coverUrl} alt="" className={cn(shape, "shrink-0 rounded object-cover", className)} loading="lazy" />;
  }
  return (
    <div className={cn(shape, "bg-muted text-muted-foreground flex shrink-0 items-center justify-center overflow-hidden rounded border p-0.5 text-center text-[9px] leading-tight", className)}>
      <span className="line-clamp-3">{item.title}</span>
    </div>
  );
}
