import { Button, cn, toast, Tip } from "@lifeline/ui";
import { Eye, Heart, Star } from "lucide-react";
import { workType } from "../domain/workTypes";
import type { Work } from "../domain/types";
import { RATING_MAX } from "../domain/types";
import { rate, toggleDone, toggleLiked } from "../domain/rules";
import { patchWork } from "../data/repo";

/**
 * The Marks (CONTEXT.md, ADR 0035) as one-click controls, shared by the
 * Gallery tile overlay, the detail dialog and the "Mark listened…" sheet so
 * every place offers exactly the same gestures. Listened toggles the Shelf;
 * Liked and the stars are marks — none implies another.
 */

const ICON = { sm: "size-3.5", md: "size-4" } as const;

/** Done ⇄ undone, from any shelf. */
export function WatchedToggle({ item, size = "sm", className }: { item: Work; size?: keyof typeof ICON; className?: string }) {
  const def = workType(item.type);
  const done = item.engagement === "DONE";
  return (
    <button
      type="button"
      aria-pressed={done}
      title={done ? `${def.engagement.DONE} — click to undo` : `Mark ${def.engagement.DONE.toLowerCase()}`}
      className={cn("flex items-center justify-center rounded-full transition-colors", done ? "text-emerald-400" : "text-white/80 hover:text-white", className)}
      onClick={(e) => {
        e.stopPropagation();
        void patchWork(item, toggleDone(item));
        toast.success(done ? `${item.title} — back on the shelf` : `${item.title} — ${def.engagement.DONE.toLowerCase()}.`);
      }}
    >
      <Eye className={cn(ICON[size], done && "fill-current")} />
    </button>
  );
}

/** The heart. */
export function LikeToggle({ item, size = "sm", className }: { item: Work; size?: keyof typeof ICON; className?: string }) {
  return (
    <Tip label={item.liked ? "Liked — click to unlike" : "Like"}>
      <button
        type="button"
        aria-pressed={item.liked}
        // ui-allow: raw-colour — the heart and the stars keep their rose and amber
        className={cn("flex items-center justify-center rounded-full transition-colors", item.liked ? "text-rose-400" : "text-white/80 hover:text-white", className)}
        onClick={(e) => {
          e.stopPropagation();
          void patchWork(item, toggleLiked(item));
        }}
      >
        <Heart className={cn(ICON[size], item.liked && "fill-current")} />
      </button>
    </Tip>
  );
}

/** Whole stars, one click each; the current star again clears. */
export function StarRating({ item, size = "md", className }: { item: Work; size?: keyof typeof ICON; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Rating" className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => {
        const on = n <= item.rating;
        return (
          <Tip key={n} label={n === item.rating ? "Clear rating" : `${n} star${n > 1 ? "s" : ""}`}>
            <button
              type="button"
              role="radio"
              aria-checked={item.rating === n}
              // ui-allow: raw-colour — the heart and the stars keep their rose and amber
              className={cn("rounded transition-colors", on ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-300")}
              onClick={(e) => {
                e.stopPropagation();
                void patchWork(item, rate(item, n));
              }}
            >
              <Star className={cn(ICON[size], on && "fill-current")} />
            </button>
          </Tip>
        );
      })}
    </div>
  );
}

/** Read-only glance: "★4" and/or a heart, for captions and cards. Nothing when unmarked. */
export function MarksGlance({ item, className }: { item: Work; className?: string }) {
  if (!item.rating && !item.liked) return null;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {item.rating > 0 && (
        <span className="inline-flex items-center gap-0.5 text-amber-500" title={`${item.rating} star${item.rating > 1 ? "s" : ""}`}>
          <Star className="size-3 fill-current" />
          <span className="tabular-nums">{item.rating}</span>
        </span>
      )}
      {item.liked && <Heart className="size-3 fill-current text-rose-500" aria-label="Liked" />}
    </span>
  );
}

/** The detail dialog's row: Listened / Liked / stars — the same gestures as the tile, at reading size. */
export function MarksRow({ item }: { item: Work }) {
  const def = workType(item.type);
  const done = item.engagement === "DONE";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant={done ? "default" : "outline"} className="h-7 gap-1.5 px-2 text-xs" aria-pressed={done} onClick={() => { void patchWork(item, toggleDone(item)); }}>
        <Eye className={cn("size-3.5", done && "fill-current")} /> {done ? def.engagement.DONE : `Mark ${def.engagement.DONE.toLowerCase()}`}
      </Button>
      <Button size="sm" variant={item.liked ? "default" : "outline"} className={cn("h-7 gap-1.5 px-2 text-xs", item.liked && "bg-rose-500 hover:bg-rose-500/90")} aria-pressed={item.liked} onClick={() => { void patchWork(item, toggleLiked(item)); }}>
        <Heart className={cn("size-3.5", item.liked && "fill-current")} /> {item.liked ? "Liked" : "Like"}
      </Button>
      <StarRating item={item} />
    </div>
  );
}
