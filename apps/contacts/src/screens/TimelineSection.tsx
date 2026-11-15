import { useMemo, type ReactNode } from "react";
import { documentType, formatHuman, linkFieldLabel, singularOf, todayStr, useLinkIndex, useOpenPeek } from "@lifeline/core";
import { cn } from "@lifeline/ui";
import type { Person } from "../domain/types";
import { upcomingOccasions, whenOf } from "../domain/occasions";
import { dotJoin } from "../domain/dots";
import { monthLabel } from "../components/format";
import { timelineOf, timelineSides, type TimelineMonth, type TimelineStop } from "../domain/timeline";
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

/** A month of stops under its name. */
function Month({ month, stops, render }: TimelineMonth & { render: (s: TimelineStop) => ReactNode }) {
  return (
    <li className="min-w-0">
      <h3 className="text-muted-foreground pb-2 pl-6 text-xs font-medium">{monthName(month)}</h3>
      <ol className="min-w-0">{stops.map(render)}</ol>
    </li>
  );
}

/**
 * A Person's timeline (#422): above a Today line, their Occasions in the year
 * ahead and what links to them from today on; below it, what links to them
 * (Events with them, Tasks for them, Days and notes that name them) from
 * before. Both by month, newest first. Each Document opens in a Peek.
 */
export function TimelineSection({ person }: { person: Person }) {
  const index = useLinkIndex();
  const openPeek = useOpenPeek();
  const today = todayStr();
  const entries = useMemo(() => timelineOf(index, person.id), [index, person.id]);
  const { ahead, past } = useMemo(() => timelineSides(entries, upcomingOccasions([person], today, 364), today), [entries, person, today]);

  const render = (s: TimelineStop) => {
    if (s.kind === "occasion") {
      const u = s.occasion;
      return (
        <Stop key={`${u.occasionId}@${u.date}`} strong>
          <p className="min-w-0 text-sm break-words">
            <span className="font-medium">{u.label}</span>
            {u.age !== null && <span className="text-muted-foreground"> · turns {u.age}</span>}
          </p>
          <p className="text-muted-foreground text-xs">
            {formatHuman(u.date)} · {whenOf(u.inDays)}
          </p>
        </Stop>
      );
    }
    const e = s.entry;
    const source = index.byId.get(e.sourceId);
    const def = documentType(e.type);
    const how = e.field ? `via ${linkFieldLabel(source, def, e.field)}` : "mentioned";
    return (
      <Stop key={e.sourceId}>
        <button type="button" onClick={() => void openPeek(e.sourceId)} className="hover:bg-accent focus-visible:ring-ring -mx-1 block w-full min-w-0 rounded-md px-1 text-left focus-visible:ring-2 focus-visible:outline-none">
          <span className="block min-w-0 truncate text-sm">{e.title || "Untitled"}</span>
          <span className="text-muted-foreground block min-w-0 truncate text-xs">
            {dotJoin([def && singularOf(def), e.day && formatHuman(e.day), s.inDays !== null && whenOf(s.inDays), how])}
          </span>
        </button>
      </Stop>
    );
  };

  return (
    <Section title="Timeline">
      <ol className="min-w-0">
        {ahead.map((m) => (
          <Month key={`ahead-${m.month}`} {...m} render={render} />
        ))}
        <li className="flex items-center gap-2 pb-3" aria-label="Today">
          <span aria-hidden className="bg-primary size-3.5 shrink-0 rounded-full" />
          <span className="text-primary text-xs font-medium">Today</span>
          <span aria-hidden className="bg-border h-px flex-1" />
        </li>
        {past.map((m) => (
          <Month key={`past-${m.month ?? "undated"}`} {...m} render={render} />
        ))}
      </ol>
      {entries.length === 0 && <p className="text-muted-foreground text-sm">Nothing links to them yet: add them to an Event's With, or write [[{person.title}]] anywhere.</p>}
    </Section>
  );
}
