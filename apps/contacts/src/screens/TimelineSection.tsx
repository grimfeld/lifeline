import { useMemo, type ReactNode } from "react";
import { PERSON_TYPE, documentType, formatHuman, linkFieldLabel, singularOf, todayStr, useLinkIndex, useOpenPeek, type Document, type LinkIndex } from "@lifeline/core";
import { cn } from "@lifeline/ui";
import type { Person } from "../domain/types";
import { upcomingOccasions, whenOf } from "../domain/occasions";
import { dotJoin } from "../domain/dots";
import { monthLabel } from "../components/format";
import { timelineMonths, timelineOf, type TimelineEntry } from "../domain/timeline";
import { Section } from "../components/Section";

/** One stop on the line: a dot on the rail, its text beside it. */
function Stop({ strong, children }: { strong?: boolean; children: ReactNode }) {
  return (
    <li className="relative min-w-0 pb-3 pl-6">
      <span aria-hidden className="bg-border absolute top-0 bottom-0 left-1.5 w-px" />
      <span aria-hidden className={cn("ring-background absolute top-1.5 left-0.5 size-2.5 rounded-full ring-4", strong ? "bg-primary" : "bg-muted-foreground")} />
      {children}
    </li>
  );
}

const monthName = (month: string | null) => (month !== null ? monthLabel(month, { month: "long", year: "numeric" }) : "Undated");

/** How an entry links: through a Household, through a Link field, or by name in its text. */
function howItLinks(e: TimelineEntry, index: LinkIndex): string {
  if (e.via) return `via ${index.byId.get(e.via)?.title || "a Household"}`;
  if (e.field) return `via ${linkFieldLabel(index.byId.get(e.sourceId), documentType(e.type), e.field)}`;
  return "mentioned";
}

/**
 * A Person's timeline (#422): their Occasions in the year ahead above a
 * Today line, then what links to them (Events with them, Tasks for them,
 * Days and notes that name them, and "via the Smiths" what links to their
 * Household then) by month, newest first. Each opens in a Peek. A
 * Household's (ADR 0117) is what links to it, with no Occasions.
 */
export function TimelineSection({ doc }: { doc: Document }) {
  const index = useLinkIndex();
  const openPeek = useOpenPeek();
  const today = todayStr();
  const ahead = useMemo(() => (doc.type === PERSON_TYPE ? upcomingOccasions([doc as Person], today, 364).reverse() : []), [doc, today]);
  const months = useMemo(() => timelineMonths(timelineOf(index, doc.id)), [index, doc.id]);

  return (
    <Section title="Timeline">
      <ol className="min-w-0">
        {ahead.map((u) => (
          <Stop key={`${u.occasionId}@${u.date}`} strong>
            <p className="min-w-0 text-sm break-words">
              <span className="font-medium">{u.label}</span>
              {u.age !== null && <span className="text-muted-foreground"> · turns {u.age}</span>}
            </p>
            <p className="text-muted-foreground text-xs">
              {formatHuman(u.date)} · {whenOf(u.inDays)}
            </p>
          </Stop>
        ))}
        <li className="flex items-center gap-2 pb-3" aria-label="Today">
          <span aria-hidden className="bg-primary size-3.5 shrink-0 rounded-full" />
          <span className="text-primary text-xs font-medium">Today</span>
          <span aria-hidden className="bg-border h-px flex-1" />
        </li>
        {months.map(({ month, entries }) => (
          <li key={month ?? "undated"} className="min-w-0">
            <h3 className="text-muted-foreground pb-2 pl-6 text-xs font-medium">{monthName(month)}</h3>
            <ol className="min-w-0">
              {entries.map((e) => {
                const def = documentType(e.type);
                return (
                  <Stop key={e.sourceId}>
                    <button type="button" onClick={() => void openPeek(e.sourceId)} className="hover:bg-accent focus-visible:ring-ring -mx-1 block w-full min-w-0 rounded-md px-1 text-left focus-visible:ring-2 focus-visible:outline-none">
                      <span className="block min-w-0 truncate text-sm">{e.title || "Untitled"}</span>
                      <span className="text-muted-foreground block min-w-0 truncate text-xs">
                        {dotJoin([def && singularOf(def), e.day && formatHuman(e.day), howItLinks(e, index)])}
                      </span>
                    </button>
                  </Stop>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
      {months.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {doc.type === PERSON_TYPE ? "Nothing links to them yet: add them to an Event's With, or write" : "Nothing links to it yet: write"} [[{doc.title}]] anywhere.
        </p>
      )}
    </Section>
  );
}
