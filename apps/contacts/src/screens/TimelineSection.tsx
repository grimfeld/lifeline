import { useMemo } from "react";
import { formatHuman, timelineMonths, timelineOf, todayStr, useLinkIndex } from "@lifeline/core";
import { TimelineMonths, TimelineStop, TimelineToday } from "@lifeline/editor";
import type { Person } from "../domain/types";
import { upcomingOccasions, whenOf } from "../domain/occasions";
import { Section } from "../components/Section";

/**
 * A Person's timeline (#422): their Occasions in the year ahead above a
 * Today line, then what links to them (Events with them, Tasks for them,
 * Days and notes that name them) by month, newest first. Each opens in a Peek.
 */
export function TimelineSection({ person }: { person: Person }) {
  const index = useLinkIndex();
  const today = todayStr();
  const ahead = useMemo(() => upcomingOccasions([person], today, 364).reverse(), [person, today]);
  const months = useMemo(() => timelineMonths(timelineOf(index, person.id)), [index, person.id]);

  return (
    <Section title="Timeline">
      <ol className="min-w-0">
        {ahead.map((u) => (
          <TimelineStop key={`${u.occasionId}@${u.date}`} strong>
            <p className="min-w-0 text-sm break-words">
              <span className="font-medium">{u.label}</span>
              {u.age !== null && <span className="text-muted-foreground"> · turns {u.age}</span>}
            </p>
            <p className="text-muted-foreground text-xs">
              {formatHuman(u.date)} · {whenOf(u.inDays)}
            </p>
          </TimelineStop>
        ))}
        <TimelineToday />
        <TimelineMonths months={months} index={index} />
      </ol>
      {months.length === 0 && <p className="text-muted-foreground text-sm">Nothing links to them yet: add them to an Event's With, or write [[{person.title}]] anywhere.</p>}
    </Section>
  );
}
