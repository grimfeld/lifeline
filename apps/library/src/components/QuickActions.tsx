import { Button, cn, toast } from "@lifeline/ui";
import { BookOpenCheck, Heart, ShoppingCart } from "lucide-react";
import { LikeButton, Stars } from "@lifeline/parts";
import { workType } from "../domain/workTypes";
import type { Work } from "../domain/types";
import { toggleDone, toggleOwned } from "../domain/rules";
import { patchWork } from "../data/repo";

/**
 * The Library's one-click gestures (CONTEXT.md: Shelf, Wanted list), shared
 * by the Gallery tile overlay and the detail dialog so every place offers
 * exactly the same gestures. Read toggles the Shelf — finishing frees the
 * Nightstand slot, undoing never takes it back. Bought toggles Wanted ⇄ Owned
 * and hides for Borrowed / Gone (those stay deliberate menu moves). Liked and
 * the stars are Marks (ADR 0067, as the Cinema's): neither moves the Shelf.
 */

const ICON = { sm: "size-3.5", md: "size-4" } as const;

/** Done ⇄ undone, from any shelf. */
export function ReadToggle({ item, size = "sm", className }: { item: Work; size?: keyof typeof ICON; className?: string }) {
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
      <BookOpenCheck className={cn(ICON[size])} />
    </button>
  );
}

/** The heart. */
export function LikeToggle({ item, size = "sm", className }: { item: Work; size?: keyof typeof ICON; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={item.liked}
      title={item.liked ? "Liked — click to unlike" : "Like"}
      className={cn("flex items-center justify-center rounded-full transition-colors", item.liked ? "text-rose-400" : "text-white/80 hover:text-white", className)}
      onClick={(e) => {
        e.stopPropagation();
        void patchWork(item, { liked: !item.liked });
      }}
    >
      <Heart className={cn(ICON[size], item.liked && "fill-current")} />
    </button>
  );
}

/** Wanted ⇄ Owned in one click; nothing at all for Borrowed / Gone. */
export function BoughtToggle({ item, size = "sm", className }: { item: Work; size?: keyof typeof ICON; className?: string }) {
  if (item.acquisition !== "WANTED" && item.acquisition !== "OWNED") return null;
  const owned = item.acquisition === "OWNED";
  return (
    <button
      type="button"
      aria-pressed={owned}
      title={owned ? "Owned — click to undo" : "Bought it"}
      className={cn("flex items-center justify-center rounded-full transition-colors", owned ? "text-amber-400" : "text-white/80 hover:text-white", className)}
      onClick={(e) => {
        e.stopPropagation();
        void patchWork(item, toggleOwned(item));
        toast.success(owned ? `${item.title} — back on the wish list` : `${item.title} — owned.`);
      }}
    >
      <ShoppingCart className={cn(ICON[size])} />
    </button>
  );
}

/** The detail dialog's row: Read / Bought / Liked / stars — the same gestures as the tile, at reading size. */
export function QuickActionsRow({ item }: { item: Work }) {
  const def = workType(item.type);
  const done = item.engagement === "DONE";
  const owned = item.acquisition === "OWNED";
  const buyable = item.acquisition === "WANTED" || item.acquisition === "OWNED";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={done ? "default" : "outline"}
        className="h-7 gap-1.5 px-2 text-xs"
        aria-pressed={done}
        onClick={() => {
          void patchWork(item, toggleDone(item));
        }}
      >
        <BookOpenCheck className="size-3.5" /> {done ? def.engagement.DONE : `Mark ${def.engagement.DONE.toLowerCase()}`}
      </Button>
      {buyable && (
        <Button
          size="sm"
          variant={owned ? "default" : "outline"}
          className={cn("h-7 gap-1.5 px-2 text-xs", owned && "bg-amber-500 hover:bg-amber-500/90")}
          aria-pressed={owned}
          onClick={() => {
            void patchWork(item, toggleOwned(item));
          }}
        >
          <ShoppingCart className="size-3.5" /> {owned ? "Owned" : "Bought it"}
        </Button>
      )}
      <LikeButton liked={item.liked} onToggle={() => void patchWork(item, { liked: !item.liked })} />
      <Stars rating={item.rating} onRate={(rating) => void patchWork(item, { rating })} />
    </div>
  );
}
