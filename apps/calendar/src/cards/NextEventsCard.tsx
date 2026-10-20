import { formatHuman, matchesTagFilter, nowClock, todayStr, useTagFilter, type CardProps, type CardSettingsSchema } from "@lifeline/core";
import { countdownWord, daysUntil, nextEvents } from "../domain/countdown";
import { describeTime } from "../domain/events";
import { useEvents } from "../data/repo";

export const nextEventsSettings: CardSettingsSchema = {
  n: { kind: "number", label: "How many", default: 5, min: 1, max: 20 },
};

export function nextEventsTitle(settings: { n?: string | number }): string {
  const n = Number(settings.n ?? 5);
  return n === 1 ? "Next event" : `Next ${n} events`;
}

/** Card: the next N events with a day countdown. */
export function NextEventsCard({ settings }: CardProps) {
  const events = useEvents();
  const filter = useTagFilter();
  const today = todayStr();
  const list = nextEvents(
    events.filter((e) => matchesTagFilter(e.tags ?? [], filter)),
    { date: today, time: nowClock() },
    settings.n as number,
  );

  if (list.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Nothing coming up.
      </div>
    );
  }
  return (
    <ul className="grid h-full content-start gap-1 overflow-y-auto">
      {list.map((e) => {
        const days = daysUntil(e, today);
        const word = countdownWord(days);
        return (
          <li key={e.id} className="flex items-center gap-3 rounded-md px-1 py-1">
            <span className="flex w-16 shrink-0 items-baseline justify-end gap-1 text-right">
              {word ? (
                <span className="text-sm font-semibold" style={{ color: "var(--chart-violet)" }}>
                  {word}
                </span>
              ) : (
                <>
                  <span className="text-2xl font-semibold tabular-nums leading-none">{days}</span>
                  <span className="text-muted-foreground text-[10px]">days</span>
                </>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{e.title}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {formatHuman(e.date)}
                {e.start ? ` · ${describeTime(e)}` : ""}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
