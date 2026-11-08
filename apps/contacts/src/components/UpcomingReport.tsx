import { useMemo } from "react";
import { formatHuman, todayStr, type CardProps } from "@lifeline/core";
import { usePeople } from "../data/repo";
import { upcomingOccasions, type UpcomingOccasion } from "../domain/occasions";
import { PersonRowLink } from "./PersonRow";
import { Section } from "./Section";

export const UPCOMING_DAYS = 30;

/** "today", "tomorrow", "in 5 days". */
const whenOf = (inDays: number) => (inDays === 0 ? "today" : inDays === 1 ? "tomorrow" : `in ${inDays} days`);

function Row({ u }: { u: UpcomingOccasion }) {
  return (
    <li>
      <PersonRowLink personId={u.personId}>
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium">{u.name}</span>
          <span className="text-muted-foreground"> · {u.label}</span>
          {u.age !== null && <span className="text-muted-foreground"> · turns {u.age}</span>}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {formatHuman(u.date)} · {whenOf(u.inDays)}
        </span>
      </PersonRowLink>
    </li>
  );
}

/**
 * Upcoming (#416): the Occasions in the next days, soonest first. A
 * heads-up, never a reminder. Heads the People home and is a Card.
 */
export function UpcomingReport({ days = UPCOMING_DAYS }: { days?: number }) {
  const rows = usePeople();
  const today = todayStr();
  const items = useMemo(() => upcomingOccasions(rows, today, days), [rows, today, days]);
  return (
    <Section title="Upcoming">
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing in the next {days} days.</p>
      ) : (
        <ul className="grid min-w-0 gap-2">
          {items.map((u) => (
            <Row key={`${u.personId}:${u.occasionId}@${u.date}`} u={u} />
          ))}
        </ul>
      )}
    </Section>
  );
}

/** The Upcoming Card: the same report, over a number of days of its own. */
export function UpcomingCard({ settings }: CardProps) {
  const days = Number(settings.days) || UPCOMING_DAYS;
  return <UpcomingReport days={days} />;
}
