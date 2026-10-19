import { useMemo } from "react";
import { Link } from "react-router";
import { matchesTagFilter, useTagFilter, type CardProps } from "@lifeline/core";
import { useEssays } from "../data";
import { STATUSES, essayHref, wordCount } from "../types";

/** Essays in progress (not done), most recently edited first — pick up where you left off. */
export function DraftsCard({ settings }: CardProps) {
  const writings = useEssays();
  const filter = useTagFilter();
  const n = Number(settings.count ?? 6);
  const rows = useMemo(
    () =>
      writings
        .filter((w) => (w.status || "draft") !== "done" && matchesTagFilter(w.tags, filter))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, n),
    [writings, filter, n],
  );
  if (rows.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center text-xs">No drafts in progress.</div>;
  return (
    <ul className="h-full space-y-1 overflow-y-auto text-sm">
      {rows.map((w) => (
        <li key={w.id} className="flex items-baseline gap-2">
          <Link to={essayHref(w.id)} className="min-w-0 flex-1 truncate font-medium hover:underline">
            {w.title}
          </Link>
          <span className="text-muted-foreground shrink-0 text-xs">
            {STATUSES.find((s) => s.value === (w.status || "draft"))?.label} · {wordCount(w.body)} w
          </span>
        </li>
      ))}
    </ul>
  );
}
