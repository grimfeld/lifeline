import { useMemo } from "react";
import { Link } from "react-router";
import { personHref } from "../constants";
import { formatHuman, todayStr, type CardProps } from "@lifeline/core";
import { usePeople } from "../data/repo";
import { upcomingOccasions, whenOf, type UpcomingOccasion } from "../domain/occasions";
import { PersonRowLink } from "./PersonRow";
import { Section } from "./Section";

export const UPCOMING_DAYS = 30;

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

const monthOf = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: "short" });

/**
 * Upcoming on the People home (#422): the same Occasions as a strip of days,
 * each the day's number over its month and when, the name and the Occasion.
 * It scrolls sideways when there are more than fit.
 */
export function UpcomingStrip({ days = UPCOMING_DAYS }: { days?: number }) {
  const rows = usePeople();
  const today = todayStr();
  const items = useMemo(() => upcomingOccasions(rows, today, days), [rows, today, days]);
  return (
    <Section title="Upcoming">
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing in the next {days} days.</p>
      ) : (
        <ol className="flex min-w-0 snap-x gap-2 overflow-x-auto pb-1">
          {items.map((u) => (
            <li key={`${u.personId}:${u.occasionId}@${u.date}`} className="w-32 shrink-0 snap-start">
              <Link
                to={personHref(u.personId)}
                aria-label={`${u.name} · ${u.label}${u.age !== null ? ` · turns ${u.age}` : ""}, ${formatHuman(u.date)}`}
                className="hover:bg-accent focus-visible:ring-ring grid min-w-0 gap-0.5 rounded-lg p-2 focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="text-3xl leading-none font-light tabular-nums">{Number(u.date.slice(8, 10))}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {monthOf(u.date)} · {whenOf(u.inDays)}
                </span>
                <span className="truncate text-sm font-medium">{u.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {u.label}
                  {u.age !== null && ` · turns ${u.age}`}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

/** The Upcoming Card: the same report, over a number of days of its own. */
export function UpcomingCard({ settings }: CardProps) {
  const days = Number(settings.days) || UPCOMING_DAYS;
  return <UpcomingReport days={days} />;
}
