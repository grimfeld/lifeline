import { cn } from "@lifeline/ui";
import { workType } from "../domain/workTypes";
import type { Work } from "../domain/types";

/**
 * Cover art with a titled fallback tile; shape follows the medium.
 * `size="thumb"` (default) is the fixed row thumbnail; `size="fill"` takes the
 * container's width and keeps the medium's aspect ratio.
 */
export function Cover({ item, className, size = "thumb" }: { item: Pick<Work, "title" | "coverUrl" | "type">; className?: string; size?: "thumb" | "fill" }) {
  const square = workType(item.type).cover === "square";
  const shape = size === "fill" ? (square ? "w-full aspect-square" : "w-full aspect-[2/3]") : square ? "size-12" : "h-14 w-10";
  const text = size === "fill" ? "p-2 text-xs leading-snug" : "p-0.5 text-[9px] leading-tight";
  if (item.coverUrl) {
    return <img src={item.coverUrl} alt="" className={cn(shape, "shrink-0 rounded object-cover", className)} loading="lazy" />;
  }
  return (
    <div className={cn(shape, text, "bg-muted text-muted-foreground flex shrink-0 items-center justify-center overflow-hidden rounded border text-center", className)}>
      <span className={size === "fill" ? "line-clamp-4" : "line-clamp-3"}>{item.title}</span>
    </div>
  );
}
