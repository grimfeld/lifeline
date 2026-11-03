import { diffDays, matchesTagFilter, todayStr, useTagFilter, type CardProps, useOpenPeek } from "@lifeline/core";
import { Badge } from "@lifeline/ui";
import { workType } from "../domain/workTypes";
import { inProgress } from "../domain/cardQueries";
import { useWorks } from "../data/repo";
import { Cover } from "../components/Cover";
import { mediumOf } from "./shared";
import { NextPartButton } from "@lifeline/parts";
import { libraryParts } from "../parts";

function startedLabel(startedOn: string, today: string): string {
  const d = diffDays(startedOn, today);
  return d <= 0 ? "started today" : d === 1 ? "started 1 day ago" : `started ${d} days ago`;
}

/** Card: covers of everything currently being read, newest start first — with "+1" where Parts are tracked (ADR 0074). */
export function InProgressCard({ settings }: CardProps) {
  const filter = useTagFilter();
  const items = useWorks().filter((m) => matchesTagFilter(m.tags, filter));
  const medium = mediumOf(settings);
  // A work is peeked from a Card (ADR 0057); its Peek links through to its page.
  const peek = useOpenPeek();
  const { parts, groups } = libraryParts.useAllParts();
  const rows = inProgress(items, medium);
  const today = todayStr();
  if (rows.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Nothing in progress.</div>;
  }
  return (
    <>
      <ul className="grid content-start gap-3 overflow-y-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}>
        {rows.map((m) => (
          <li key={m.id} className="hover:bg-accent/50 flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-md p-1 text-center" onClick={() => peek(m.id)}>
            {/* The row opens on a click anywhere; this button is its face for the keyboard (Enter bubbles to the row). */}
            <button type="button" className="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none flex w-full min-w-0 flex-col items-center gap-1">
              <Cover item={m} className={workType(m.type).cover === "square" ? "size-24 text-xs" : "h-32 w-24 text-xs"} />
              <div className="line-clamp-2 w-full text-xs font-medium leading-tight">{m.title}</div>
              {m.startedOn && <div className="text-muted-foreground text-2xs">{startedLabel(m.startedOn, today)}</div>}
            </button>
            {m.partsTracked && <NextPartButton kit={libraryParts} work={m} parts={parts} groups={groups} />}
            {!medium && (
              <Badge variant="outline" className="text-2xs">
                {workType(m.type).label}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
