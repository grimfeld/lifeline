import { addDays, formatHuman, todayStr } from "@lifeline/core";
import { compareEvents, describeTime, isMultiDay } from "../domain/events";
import { useEvents } from "../data/repo";

/** Card: the next 14 days of events. */
export function UpcomingEventsCard() {
  const events = useEvents();
  const today = todayStr();
  const horizon = addDays(today, 14);
  const upcoming = events
    .filter((e) => (isMultiDay(e) ? e.endDate! : e.date) >= today && e.date <= horizon)
    .sort(compareEvents);

  if (upcoming.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Nothing in the next two weeks.
      </div>
    );
  }
  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {upcoming.map((e) => (
        <li key={e.id} className="flex items-baseline gap-2 rounded-md px-1 py-0.5 text-sm">
          <span className="text-muted-foreground w-16 shrink-0 text-xs">
            {e.date === today ? "Today" : formatHuman(e.date)}
          </span>
          <span className="truncate">{e.title}</span>
          <span className="text-muted-foreground ml-auto shrink-0 text-xs">{describeTime(e)}</span>
        </li>
      ))}
    </ul>
  );
}
