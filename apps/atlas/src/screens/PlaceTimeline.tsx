import { useMemo } from "react";
import { splitAtToday, timelineMonths, timelineOf, todayStr, type Document, type LinkIndex } from "@lifeline/core";
import { TimelineEntryStop, TimelineMonths, TimelineToday } from "@lifeline/editor";

/**
 * A Place's timeline (ADR 0119), as a Person's page has: the Events planned
 * there above the Today line, the nearest just above it; then what has been
 * (Events At it, Days and notes that name it) by month, newest first. Each
 * opens in a Peek.
 */
export function PlaceTimeline({ place, index }: { place: Document; index: LinkIndex }) {
  const today = todayStr();
  const { upcoming, months } = useMemo(() => {
    const { upcoming, past } = splitAtToday(timelineOf(index, place.id), today);
    return { upcoming, months: timelineMonths(past) };
  }, [index, place.id, today]);
  return (
    <section className="grid min-w-0 gap-2" aria-label="Timeline">
      <h2 className="text-muted-foreground text-sm font-medium">Timeline</h2>
      <ol className="min-w-0">
        {upcoming.map((e) => (
          <TimelineEntryStop key={e.sourceId} entry={e} index={index} strong />
        ))}
        <TimelineToday />
        <TimelineMonths months={months} index={index} />
      </ol>
      {upcoming.length === 0 && months.length === 0 && <p className="text-muted-foreground text-sm break-words">Nothing links here yet: set an Event's At to it, or write [[{place.title}]] in a Day.</p>}
    </section>
  );
}
