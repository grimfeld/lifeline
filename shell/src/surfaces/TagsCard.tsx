import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { appById, useTaggedItems, type CardProps } from "@lifeline/core";
import { cn } from "@lifeline/ui";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * Hub card (ADR 0014): every Tag in use across Apps with counts; expand a
 * tag to see (and open) the tagged items. Read live from the Taggable
 * Contract — nothing stored.
 */
export function TagsCard(_: CardProps) {
  const navigate = useNavigate();
  const items = useTaggedItems();
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const it of items) for (const t of it.tags) (map.get(t) ?? map.set(t, []).get(t)!).push(it);
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [items]);

  if (groups.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-xs">No tags yet — add some to a task, event, note…</div>;
  }
  return (
    <ul className="h-full space-y-0.5 overflow-y-auto text-sm">
      {groups.map(([tag, list]) => {
        const expanded = open === tag;
        return (
          <li key={tag}>
            <button
              type="button"
              className={cn("hover:bg-accent/60 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left", expanded && "bg-accent/40")}
              onClick={() => setOpen(expanded ? null : tag)}
            >
              {expanded ? <ChevronDown className="text-muted-foreground size-3.5" /> : <ChevronRight className="text-muted-foreground size-3.5" />}
              <span className="truncate">#{tag}</span>
              <span className="text-muted-foreground ml-auto text-xs tabular-nums">{list.length}</span>
            </button>
            {expanded && (
              <ul className="ml-5 space-y-0.5 py-0.5">
                {list.map((it) => (
                  <li key={it.key}>
                    <button
                      type="button"
                      className="hover:bg-accent/60 flex w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-xs"
                      disabled={!it.href}
                      onClick={() => it.href && navigate(it.href)}
                    >
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: it.color ?? "var(--muted-foreground)" }} />
                      <span className="truncate">{it.title}</span>
                      <span className="text-muted-foreground ml-auto truncate">{it.subtitle ?? appById(it.appId)?.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
