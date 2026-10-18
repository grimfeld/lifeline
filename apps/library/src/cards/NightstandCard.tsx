import { useState } from "react";
import { matchesTagFilter, useTagFilter, type CardProps } from "@lifeline/core";
import { cn } from "@lifeline/ui";
import { AlertTriangle, ShoppingCart } from "lucide-react";
import { workType, SLOTTED_TYPES } from "../domain/workTypes";
import { isBuySignal, isStale, nightstand, slotAge } from "../domain/rules";
import { useWorks } from "../data/repo";
import { Cover } from "../components/Cover";
import { EditWorkDialog } from "../components/WorkRow";
import type { Work } from "../domain/types";
import { mediumOf } from "./shared";
import { NextPartButton } from "@lifeline/parts";
import { libraryParts } from "../parts";

/** Card: everything currently holding a slot (ADR 0006 amendment) — with stale and buy signals, and "+1" for a work whose Parts are tracked (ADR 0067). */
export function NightstandCard({ settings }: CardProps) {
  const filter = useTagFilter();
  const items = useWorks().filter((m) => matchesTagFilter(m.tags, filter));
  const medium = mediumOf(settings);
  const [editing, setEditing] = useState<Work | null>(null);
  const { parts, groups } = libraryParts.useAllParts();
  const rows = SLOTTED_TYPES.filter((t) => !medium || t === medium).flatMap((t) => nightstand(items, t));
  if (rows.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Nightstand is empty.</div>;
  }
  return (
    <>
      <ul className="grid content-start gap-1 overflow-y-auto">
        {rows.map((m) => {
          const stale = isStale(m);
          return (
            <li key={m.id} className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5" onClick={() => setEditing(m)}>
              <Cover item={m} className="h-8 w-6" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{m.title}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {workType(m.type).label} · {m.engagement === "IN_PROGRESS" ? workType(m.type).engagement.IN_PROGRESS.toLowerCase() : "queued"}
                </div>
              </div>
              {m.partsTracked && <NextPartButton kit={libraryParts} work={m} parts={parts} groups={groups} />}
              {isBuySignal(m) && <ShoppingCart className="text-primary size-3.5 shrink-0" />}
              <span className={cn("shrink-0 text-xs", stale ? "text-destructive flex items-center gap-1" : "text-muted-foreground")}>
                {stale && <AlertTriangle className="size-3" />}
                {slotAge(m)}d
              </span>
            </li>
          );
        })}
      </ul>
      <EditWorkDialog item={editing} onClose={() => setEditing(null)} />
    </>
  );
}
