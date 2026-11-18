import { useMemo } from "react";
import { PERSON_TYPE, formatHuman, timelineOf, timelineSides, todayStr, useLinkIndex, type AheadStop, type Document, type TimelineStop as Stop } from "@lifeline/core";
import { TimelineEntryStop, TimelineMonths, TimelineStop, TimelineToday } from "@lifeline/editor";
import type { Person } from "../domain/types";
import { upcomingOccasions, whenOf, type UpcomingOccasion } from "../domain/occasions";
import { Section } from "../components/Section";

/** An Occasion ahead: its label, the age it brings, and how soon it is (the stop's, as a Document's is). */
function OccasionStop({ stop }: { stop: Extract<AheadStop<UpcomingOccasion>, { kind: "occasion" }> }) {
  const u = stop.occasion;
  return (
    <TimelineStop strong>
      <p className="min-w-0 text-sm break-words">
        <span className="font-medium">{u.label}</span>
        {u.age !== null && <span className="text-muted-foreground"> · turns {u.age}</span>}
      </p>
      <p className="text-muted-foreground text-xs">
        {formatHuman(stop.day)} · {whenOf(stop.inDays)}
      </p>
    </TimelineStop>
  );
}

/**
 * A Person's timeline (#422): above a Today line, their Occasions in the year
 * ahead and what links to them from today on; below it, what links to them
 * (Events with them, Tasks for them, Days and notes that name them, and "via
 * the Smiths" what links to their Household then) from before. Both by month,
 * newest first. Each Document opens in a Peek. A Household's (ADR 0117) is
 * what links to it, with no Occasions. The rail is the editor's, shared with
 * a Place's page (ADR 0128).
 */
export function TimelineSection({ doc }: { doc: Document }) {
  const index = useLinkIndex();
  const today = todayStr();
  const entries = useMemo(() => timelineOf(index, doc.id), [index, doc.id]);
  const occasions = useMemo(() => (doc.type === PERSON_TYPE ? upcomingOccasions([doc as Person], today, 364) : []), [doc, today]);
  const { ahead, past } = useMemo(() => timelineSides(entries, occasions, today), [entries, occasions, today]);

  const render = (s: Stop<UpcomingOccasion>) =>
    s.kind === "occasion" ? (
      <OccasionStop key={`${s.occasion.occasionId}@${s.occasion.date}`} stop={s} />
    ) : (
      <TimelineEntryStop key={s.entry.sourceId} entry={s.entry} index={index} when={s.inDays !== null ? whenOf(s.inDays) : undefined} />
    );

  return (
    <Section title="Timeline">
      <ol className="min-w-0">
        <TimelineMonths months={ahead} render={render} />
        <TimelineToday />
        <TimelineMonths months={past} render={render} />
      </ol>
      {entries.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {doc.type === PERSON_TYPE ? "Nothing links to them yet: add them to an Event's With, or write" : "Nothing links to it yet: write"} [[{doc.title}]] anywhere.
        </p>
      )}
    </Section>
  );
}
