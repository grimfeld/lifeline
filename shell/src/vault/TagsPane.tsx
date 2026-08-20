import { useState } from "react";
import { useNavigate } from "react-router";
import { cn } from "@lifeline/ui";
import { displayTitle, docHref, formatHuman, useLinkIndex } from "@lifeline/core";
import { Hash } from "lucide-react";

/** Every Tag in use across Documents: tag → Documents. */
export function TagsPane() {
  const index = useLinkIndex();
  const navigate = useNavigate();
  const [openTag, setOpenTag] = useState<string | null>(null);
  const tags = Array.from(index.tags.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="text-muted-foreground px-2 py-1 text-xs font-medium">Tags · {tags.length}</div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-1 pb-4">
        {tags.length === 0 && <li className="text-muted-foreground px-2 py-3 text-xs">No #tags yet.</li>}
        {tags.map(([tag, ids]) => (
          <li key={tag}>
            <button className={cn("flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm hover:bg-accent/60", openTag === tag && "bg-accent/40")} onClick={() => setOpenTag((t) => (t === tag ? null : tag))}>
              <Hash className="text-muted-foreground size-3.5" />
              <span className="truncate">{tag}</span>
              <span className="text-muted-foreground ml-auto text-xs">{ids.length}</span>
            </button>
            {openTag === tag && (
              <ul className="ml-4">
                {ids.map((id) => {
                  const n = index.byId.get(id);
                  if (!n) return null;
                  return (
                    <li key={id}>
                      <button className="hover:bg-accent/60 w-full truncate rounded-md px-2 py-0.5 text-left text-xs" onClick={() => navigate(docHref(n))}>
                        {n.type === "daily" ? formatHuman(n.title) : displayTitle(n)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
