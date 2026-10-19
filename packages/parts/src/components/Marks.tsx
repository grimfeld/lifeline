import { Button, cn, Textarea, toast } from "@lifeline/ui";
import { Heart, Pencil, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { RATING_MAX } from "../domain";

/**
 * Marks and the Review (CONTEXT.md) as plain controls over values, so a
 * work, a Part and a Group all offer exactly the same gestures: the heart,
 * whole stars (the current star again clears) and the body written in place.
 */

const ICON = { sm: "size-3.5", md: "size-4" } as const;

export function LikeButton({ liked, onToggle, className }: { liked: boolean; onToggle: () => void; className?: string }) {
  return (
    <Button size="sm" variant={liked ? "default" : "outline"} className={cn("h-7 gap-1.5 px-2 text-xs", liked && "bg-rose-500 hover:bg-rose-500/90", className)} aria-pressed={liked} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
      <Heart className={cn("size-3.5", liked && "fill-current")} /> {liked ? "Liked" : "Like"}
    </Button>
  );
}

export function Stars({ rating, onRate, size = "md", className }: { rating: number; onRate: (n: number) => void; size?: keyof typeof ICON; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Rating" className={cn("flex shrink-0 items-center gap-0.5", className)}>
      {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => {
        const on = n <= rating;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            title={n === rating ? "Clear rating" : `${n} star${n > 1 ? "s" : ""}`}
            className={cn("rounded transition-colors", on ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-300")}
            onClick={(e) => {
              e.stopPropagation();
              onRate(n === rating ? 0 : n);
            }}
          >
            <Star className={cn(ICON[size], on && "fill-current")} />
          </button>
        );
      })}
    </div>
  );
}

/** The heart and the stars side by side, at reading size. */
export function MarksControls({ liked, rating, onChange }: { liked: boolean; rating: number; onChange: (patch: { liked?: boolean; rating?: number }) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <LikeButton liked={liked} onToggle={() => onChange({ liked: !liked })} />
      <Stars rating={rating} onRate={(n) => onChange({ rating: n })} />
    </div>
  );
}

/** Read-only glance: "★4" and/or a heart. Nothing when unmarked. */
export function MarksGlance({ liked, rating, className }: { liked: boolean; rating: number; className?: string }) {
  if (!rating && !liked) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      {rating > 0 && (
        <span className="inline-flex items-center gap-0.5 text-amber-500" title={`${rating} star${rating > 1 ? "s" : ""}`}>
          <Star className="size-3 fill-current" />
          <span className="tabular-nums">{rating}</span>
        </span>
      )}
      {liked && <Heart className="size-3 fill-current text-rose-500" aria-label="Liked" />}
    </span>
  );
}

/** "Average of its parts ★3.7" — a reading beside the Rating, never stored (Marks never roll up). */
export function AverageNote({ average, of }: { average: number; of: string }) {
  if (!average) return null;
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      <Star className="size-3 fill-current text-amber-500/70" />
      <span className="tabular-nums">{average.toFixed(1)}</span> average of its {of}
    </span>
  );
}

/** The Review: the body, read as written; "Write" / "Edit" opens it in place. */
export function ReviewEditor({ body, onSave, label = "Review" }: { body: string; onSave: (body: string) => Promise<void> | void; label?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  useEffect(() => setDraft(body), [body]);
  const text = body.trim();

  if (editing) {
    return (
      <div className="grid gap-2">
        <Textarea autoFocus rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What did you make of it? Markdown, [[links]] and #tags all count." />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setDraft(body); setEditing(false); }}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              void Promise.resolve(onSave(draft)).then(() => toast.success(draft.trim() ? "Review saved" : "Review cleared"));
              setEditing(false);
            }}
          >
            Save
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="text-muted-foreground min-w-0 truncate text-[11px] tracking-wide uppercase">{label}</div>
        <Button size="sm" variant="ghost" className="h-6 shrink-0 px-2 text-xs" onClick={() => setEditing(true)}>
          <Pencil className="size-3" /> {text ? "Edit" : "Write"}
        </Button>
      </div>
      {text ? <p className="text-sm whitespace-pre-wrap">{text}</p> : <p className="text-muted-foreground text-sm italic">Nothing written yet.</p>}
    </div>
  );
}
