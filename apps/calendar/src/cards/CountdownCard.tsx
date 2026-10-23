import { formatHuman, nowClock, todayStr, type CardOption, type CardProps, type CardSettings, type CardSettingsSchema } from "@lifeline/core";
import { CardUnavailable } from "@lifeline/ui";
import { countdownWord, daysUntil, futureEvents, isOver } from "../domain/countdown";
import { describeTime } from "../domain/events";
import { useEvents } from "../data/repo";

function shortDate(d: string): string {
  const [y = 0, m = 1, day = 1] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function useFutureEventOptions(): CardOption[] {
  const events = useEvents();
  const future = futureEvents(events, { date: todayStr(), time: nowClock() });
  return future.map((e) => ({ value: e.id, label: `${e.title} · ${shortDate(e.date)}` }));
}

export const countdownSettings: CardSettingsSchema = {
  event: { kind: "entity", label: "Event", required: true, useOptions: useFutureEventOptions },
};

/** Instance title (a hook, per CardDef.instanceTitle): the chosen event's title. */
export function useCountdownTitle(settings: CardSettings): string {
  const events = useEvents();
  return events.find((e) => e.id === settings.event)?.title ?? "";
}

/** Card: big number of days until one chosen event. */
export function CountdownCard({ settings, configure }: CardProps) {
  const events = useEvents();
  const id = settings.event as string;
  const ev = events.find((e) => e.id === id);

  if (!ev) {
    return <CardUnavailable message="That event no longer exists." onConfigure={configure} />;
  }

  const today = todayStr();
  const days = daysUntil(ev, today);
  const passed = isOver(ev, { date: today, time: nowClock() });
  const word = countdownWord(days);
  const when = `${formatHuman(ev.date)}${ev.start ? ` · ${describeTime(ev)}` : ""}`;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
      <div
        className={`text-5xl font-semibold tabular-nums leading-none ${passed ? "text-muted-foreground" : ""}`}
        style={passed ? undefined : { color: "var(--chart-violet)" }}
      >
        {word ?? Math.abs(days)}
      </div>
      <div className="text-muted-foreground text-xs">{word ? (passed ? "ended" : " ") : passed ? "days ago" : "days"}</div>
      <div className="mt-1 w-full truncate px-2 text-sm font-medium">{ev.title}</div>
      <div className="text-muted-foreground w-full truncate px-2 text-xs">{when}</div>
    </div>
  );
}
