import { useState } from "react";
import type { CardProps } from "@lifeline/core";
import { finishedIn, mediumBreakdown } from "../domain/cardQueries";
import { useMedia } from "../data/repo";
import { Cover } from "../components/Cover";
import { EditMediaDialog } from "../components/MediaRow";
import type { MediaItem } from "../domain/types";
import { mediumOf } from "./shared";

/** Card: how much I finished in a year, with the latest covers. */
export function FinishedCard({ settings }: CardProps) {
  const items = useMedia();
  const medium = mediumOf(settings);
  const year = typeof settings.year === "number" ? settings.year : new Date().getFullYear();
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const done = finishedIn(items, year, medium);
  const breakdown = medium ? "" : mediumBreakdown(done);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums" style={{ color: "var(--chart-magenta)" }}>
          {done.length}
        </span>
        <span className="text-muted-foreground text-sm">finished in {year}</span>
        {breakdown && <span className="text-muted-foreground ml-auto truncate text-xs">{breakdown}</span>}
      </div>
      {done.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">Nothing finished in {year} yet.</div>
      ) : (
        <ul className="grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))" }}>
          {done.map((m) => (
            <li key={m.id} className="flex cursor-pointer justify-center" title={`${m.title}${m.creator ? ` — ${m.creator}` : ""} · ${m.finishedOn}`} onClick={() => setEditing(m)}>
              <Cover item={m} className="h-16 w-12" />
            </li>
          ))}
        </ul>
      )}
      <EditMediaDialog item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
