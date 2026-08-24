import { useState } from "react";
import { Button, cn } from "@lifeline/ui";
import { Tag, X } from "lucide-react";
import { useTagVocabulary } from "@lifeline/core";
import { TagPicker } from "./TagPicker";

/**
 * Session-only Tag filter for a Surface page (Week, Calendar): a "Tags" toggle
 * that opens a picker plus the chosen chips. The page wraps its content in a
 * TagFilterProvider with `value` so read-side hooks narrow automatically.
 */
export function TagFilterBar({ value, onChange, className }: { value: string[]; onChange: (tags: string[]) => void; className?: string }) {
  const [open, setOpen] = useState(value.length > 0);
  const vocab = useTagVocabulary();
  if (vocab.length === 0 && value.length === 0) return null;
  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      {open ? (
        <>
          {/* The picker gives way on a phone header rather than running off the edge. */}
          <TagPicker value={value} onChange={onChange} placeholder="Filter by tag…" className="w-56 max-md:w-full max-md:min-w-0" autoFocus={value.length === 0} />
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label="Clear tag filter"
            onClick={() => {
              onChange([]);
              setOpen(false);
            }}
          >
            <X />
          </Button>
        </>
      ) : (
        <Button variant="outline" className="h-8" onClick={() => setOpen(true)}>
          <Tag /> Tags
        </Button>
      )}
    </div>
  );
}
