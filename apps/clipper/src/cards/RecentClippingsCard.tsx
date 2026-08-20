import { useMemo } from "react";
import { Link } from "react-router";
import { docHref, excerpt, matchesTagFilter, useTagFilter, type CardProps } from "@lifeline/core";
import { useClippings } from "../data";
import { hostOf } from "../types";

/** The latest clippings, newest first. */
export function RecentClippingsCard({ settings }: CardProps) {
  const clippings = useClippings();
  const filter = useTagFilter();
  const n = Number(settings.count ?? 8);
  const rows = useMemo(
    () =>
      [...clippings]
        .filter((c) => matchesTagFilter(c.tags, filter))
        .sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)))
        .slice(0, n),
    [clippings, filter, n],
  );
  if (rows.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center text-xs">No clippings yet.</div>;
  return (
    <ul className="h-full space-y-1 overflow-y-auto text-sm">
      {rows.map((c) => (
        <li key={c.id}>
          <Link to={docHref(c)} className="block truncate font-medium hover:underline">
            {c.title}
          </Link>
          <div className="text-muted-foreground truncate text-xs">
            {hostOf(String(c.source)) || String(c.source) || "—"} · {excerpt(c.body, 80)}
          </div>
        </li>
      ))}
    </ul>
  );
}
