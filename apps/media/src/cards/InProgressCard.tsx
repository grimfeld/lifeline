import { useState } from "react";
import { diffDays, matchesTagFilter, todayStr, useTagFilter, type CardProps } from "@lifeline/core";
import { Badge } from "@lifeline/ui";
import { mediaType } from "../domain/mediaTypes";
import { inProgress } from "../domain/cardQueries";
import { useMedia } from "../data/repo";
import { Cover } from "../components/Cover";
import { EditMediaDialog } from "../components/MediaRow";
import type { MediaItem } from "../domain/types";
import { mediumOf } from "./shared";

function startedLabel(startedOn: string, today: string): string {
  const d = diffDays(startedOn, today);
  return d <= 0 ? "started today" : d === 1 ? "started 1 day ago" : `started ${d} days ago`;
}

/** Card: covers of everything currently being read/watched/played, newest start first. */
export function InProgressCard({ settings }: CardProps) {
  const filter = useTagFilter();
  const items = useMedia().filter((m) => matchesTagFilter(m.tags, filter));
  const medium = mediumOf(settings);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const rows = inProgress(items, medium);
  const today = todayStr();
  if (rows.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Nothing in progress.</div>;
  }
  return (
    <>
      <ul className="grid content-start gap-3 overflow-y-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}>
        {rows.map((m) => (
          <li key={m.id} className="hover:bg-accent/50 flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-md p-1 text-center" onClick={() => setEditing(m)}>
            <Cover item={m} className={mediaType(m.type).cover === "square" ? "size-24 text-xs" : "h-32 w-24 text-xs"} />
            <div className="line-clamp-2 w-full text-xs font-medium leading-tight">{m.title}</div>
            {m.startedOn && <div className="text-muted-foreground text-[11px]">{startedLabel(m.startedOn, today)}</div>}
            {!medium && (
              <Badge variant="outline" className="text-[10px]">
                {mediaType(m.type).label}
              </Badge>
            )}
          </li>
        ))}
      </ul>
      <EditMediaDialog item={editing} onClose={() => setEditing(null)} />
    </>
  );
}
