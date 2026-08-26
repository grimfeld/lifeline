import { useState } from "react";
import { matchesTagFilter, useTagFilter, type CardProps } from "@lifeline/core";
import { finishedIn, mediumBreakdown } from "../domain/cardQueries";
import { useWorks } from "../data/repo";
import { Cover } from "../components/Cover";
import { MarksGlance } from "../components/Marks";
import { EditWorkDialog } from "../components/WorkRow";
import type { Work } from "../domain/types";
import { mediumOf } from "./shared";

/** Card: how much I finished in a year, with the latest covers. */
export function FinishedCard({ settings }: CardProps) {
  const filter = useTagFilter();
  const items = useWorks().filter((m) => matchesTagFilter(m.tags, filter));
  const medium = mediumOf(settings);
  const year = typeof settings.year === "number" ? settings.year : new Date().getFullYear();
  const [editing, setEditing] = useState<Work | null>(null);
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
            <li key={m.id} className="flex cursor-pointer flex-col items-center gap-0.5" title={`${m.title}${m.creator ? ` — ${m.creator}` : ""} · ${m.finishedOn}${m.rating ? ` · ${m.rating}★` : ""}${m.liked ? " · liked" : ""}`} onClick={() => setEditing(m)}>
              <Cover item={m} className="h-16 w-12" />
              <MarksGlance item={m} className="h-3 text-[10px] leading-none" />
            </li>
          ))}
        </ul>
      )}
      <EditWorkDialog item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
