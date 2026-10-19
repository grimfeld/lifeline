import { useDocument, useOpenPeek } from "@lifeline/core";
import { cn } from "@lifeline/ui";

/**
 * Where something was met: the Document it came from, followed through its
 * link and opened in a Peek — else the words or URL the user wrote. A link
 * whose Document is gone (or locked away) falls back to those words.
 */
export function OriginLine({ originId, origin, className }: { originId?: string; origin?: string; className?: string }) {
  const doc = useDocument(originId || undefined);
  // Inside a Peek (an Item's own) the origin replaces what it shows, with a way back (ADR 0085).
  const peek = useOpenPeek();
  if (!doc && !origin) return null;
  return (
    <span className={cn("text-muted-foreground min-w-0 text-xs", className)}>
      from{" "}
      {doc ? (
        <button type="button" className="hover:text-foreground underline underline-offset-2 [overflow-wrap:anywhere]" onClick={() => peek(doc.id)}>
          {doc.title || "Untitled"}
        </button>
      ) : (
        <span className="[overflow-wrap:anywhere]">{origin}</span>
      )}
    </span>
  );
}
