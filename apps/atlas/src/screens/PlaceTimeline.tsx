import { useMemo } from "react";
import { timelineOf, timelineSides, todayStr, type Document, type LinkIndex, type TimelineOccasion, type TimelineStop } from "@lifeline/core";
import { TimelineEntryStop, TimelineMonths, TimelineToday } from "@lifeline/editor";

/** A Place has no Occasions: only what links to it stands on its line. */
const NO_OCCASIONS: readonly TimelineOccasion[] = [];

/**
 * A Place's timeline (ADR 0119), as a Person's page has: the Events planned
 * there, today's included, above the Today line, the nearest just above it;
 * then what has been (Events At it, Days and notes that name it) by month,
 * newest first. Each opens in a Peek.
 */
export function PlaceTimeline({ place, index }: { place: Document; index: LinkIndex }) {
  const today = todayStr();
  const { ahead, past } = useMemo(() => timelineSides(timelineOf(index, place.id), NO_OCCASIONS, today), [index, place.id, today]);
  const render = (strong: boolean) => (s: TimelineStop) => (s.kind === "entry" ? <TimelineEntryStop key={s.entry.sourceId} entry={s.entry} index={index} strong={strong} /> : null);
  return (
    <section className="grid min-w-0 gap-2" aria-label="Timeline">
      <h2 className="text-muted-foreground text-sm font-medium">Timeline</h2>
      <ol className="min-w-0">
        <TimelineMonths months={ahead} render={render(true)} />
        <TimelineToday />
        <TimelineMonths months={past} render={render(false)} />
      </ol>
      {ahead.length === 0 && past.length === 0 && <p className="text-muted-foreground text-sm break-words">Nothing links here yet: set an Event's At to it, or write [[{place.title}]] in a Day.</p>}
    </section>
  );
}
