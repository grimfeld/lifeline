import type { ReactNode } from "react";
import { documentType, formatHuman, linkFieldLabel, singularOf, useOpenPeek, type LinkIndex, type TimelineEntry, type TimelineMonth, type TimelineOccasion, type TimelineStop as Stop } from "@lifeline/core";
import { cn } from "@lifeline/ui";

/*
 * A timeline's pieces (#422, ADR 0128): what links to a Document on a rail,
 * upcoming above a Today line, the rest by month below. A Person's page and a
 * Place's page draw theirs from these; the stops come from Core's
 * `timelineOf` and `timelineSides`.
 */

/** One stop on the line: a dot on the rail, its text beside it. `strong` for what is ahead. */
export function TimelineStop({ strong, children }: { strong?: boolean; children: ReactNode }) {
  return (
    <li className="relative min-w-0 pb-3 pl-6">
      <span aria-hidden className="bg-border absolute top-0 bottom-0 left-1.5 w-px" />
      <span aria-hidden className={cn("ring-background absolute top-1.5 left-0.5 size-2.5 rounded-full ring-4", strong ? "bg-primary" : "bg-muted-foreground")} />
      {children}
    </li>
  );
}

/** The Today line, between what is ahead and what has been. */
export function TimelineToday() {
  return (
    <li className="flex items-center gap-2 pb-3" aria-label="Today">
      <span aria-hidden className="bg-primary size-3.5 shrink-0 rounded-full" />
      <span className="text-primary text-xs font-medium">Today</span>
      <span aria-hidden className="bg-border h-px flex-1" />
    </li>
  );
}

const dotJoin = (parts: readonly (string | false | null | undefined)[]) => parts.filter(Boolean).join(" · ");

/** How an entry links: through a Household (ADR 0117), through a Link field, or by name in its text. */
function howItLinks(entry: TimelineEntry, index: LinkIndex): string {
  if (entry.via) return `via ${index.byId.get(entry.via)?.title || "a Household"}`;
  if (entry.field) return `via ${linkFieldLabel(index.byId.get(entry.sourceId), documentType(entry.type), entry.field)}`;
  return "mentioned";
}

/**
 * One linking Document as a stop: its title, then its type, day, how soon
 * (`when`, for what is ahead) and how it links; it opens in a Peek.
 */
export function TimelineEntryStop({ entry, index, strong, when }: { entry: TimelineEntry; index: LinkIndex; strong?: boolean; when?: string }) {
  const openPeek = useOpenPeek();
  const def = documentType(entry.type);
  const how = howItLinks(entry, index);
  return (
    <TimelineStop strong={strong}>
      <button type="button" onClick={() => void openPeek(entry.sourceId)} className="hover:bg-accent focus-visible:ring-ring -mx-1 block w-full min-w-0 rounded-md px-1 text-left focus-visible:ring-2 focus-visible:outline-none">
        <span className="block min-w-0 truncate text-sm">{entry.title || "Untitled"}</span>
        <span className="text-muted-foreground block min-w-0 truncate text-xs">{dotJoin([def && singularOf(def), entry.day && formatHuman(entry.day), when, how])}</span>
      </button>
    </TimelineStop>
  );
}

const monthName = (month: string | null) => (month !== null ? new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "Undated");

/** Stops by month ("2026-11"; null for the undated), each month headed by its name; `render` draws each stop. */
export function TimelineMonths<O extends TimelineOccasion>({ months, render }: { months: readonly TimelineMonth<O>[]; render: (stop: Stop<O>) => ReactNode }) {
  return months.map(({ month, stops }) => (
    <li key={month ?? "undated"} className="min-w-0">
      <h3 className="text-muted-foreground pb-2 pl-6 text-xs font-medium">{monthName(month)}</h3>
      <ol className="min-w-0">{stops.map(render)}</ol>
    </li>
  ));
}
