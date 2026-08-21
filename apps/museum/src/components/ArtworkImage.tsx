import { cn } from "@lifeline/ui";
import type { Artwork } from "../domain/types";

/**
 * The exhibit itself. `size="tile"` is the square Holdings-grid crop;
 * `size="wall"` keeps the work's own aspect ratio — a painting is never
 * cropped on a wall.
 */
export function ArtworkImage({ artwork, className, size = "tile" }: { artwork: Pick<Artwork, "title" | "imageUrl">; className?: string; size?: "tile" | "wall" }) {
  if (artwork.imageUrl) {
    return size === "wall" ? (
      <img src={artwork.imageUrl} alt={artwork.title} className={cn("max-h-full max-w-full rounded object-contain", className)} loading="lazy" />
    ) : (
      <img src={artwork.imageUrl} alt="" className={cn("aspect-square w-full rounded object-cover", className)} loading="lazy" />
    );
  }
  return (
    <div className={cn(size === "wall" ? "flex h-40 w-56 p-3 text-sm" : "aspect-square w-full p-2 text-xs", "bg-muted text-muted-foreground items-center justify-center overflow-hidden rounded border text-center leading-snug", size === "tile" && "flex", className)}>
      <span className="line-clamp-4 self-center w-full">{artwork.title}</span>
    </div>
  );
}
