import { useMemo } from "react";
import { Link } from "react-router";
import { matchesTagFilter, useTagFilter, type CardProps } from "@lifeline/core";
import { entriesByStat, useEntries, useStats } from "../data/repo";
import { colorVar } from "../domain/types";
import { sortCollections, type CollectionSort } from "../domain/rank";

/** Card: every collection's progress toward its universe. */
export function CollectionsCard({ settings }: CardProps) {
  const sort = settings.sort as CollectionSort;
  const filter = useTagFilter();
  const stats = useStats();
  const entries = useEntries();
  // Filter inside the memo: a filtered array is new every render and would never hit.
  const rows = useMemo(
    () => sortCollections(stats.filter((s) => matchesTagFilter(s.tags, filter)), entriesByStat(entries), sort),
    [stats, filter, entries, sort],
  );
  if (rows.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No collections yet.</div>;
  }
  return (
    <ul className="grid content-start gap-1.5 overflow-y-auto">
      {rows.map((r) => {
        const color = colorVar(r.stat.color);
        return (
          <li key={r.stat.id}>
            <Link
              to={`/app/stats/${r.stat.id}`}
              draggable={false}
              className="focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none grid gap-1 rounded-md px-1 py-1 transition-colors hover:bg-accent/40"
            >
              <div className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                <span className="truncate text-sm">{r.stat.title}</span>
                <span className="ml-auto shrink-0 text-sm font-medium tabular-nums">
                  {r.universe > 0 ? `${r.count} / ${r.universe}` : r.count}
                </span>
              </div>
              {r.percent !== null && (
                <div className="flex items-center gap-2">
                  <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                    <div className="h-full rounded-full" style={{ width: `${r.percent}%`, background: color }} />
                  </div>
                  <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">{Math.round(r.percent)}%</span>
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
