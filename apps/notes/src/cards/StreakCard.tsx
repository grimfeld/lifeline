import { useNavigate } from "react-router";
import { formatHuman, todayStr, type CardProps } from "@lifeline/core";
import { cn } from "@lifeline/ui";
import { Flame } from "lucide-react";
import { useNotes } from "../data/repo";
import { currentStreak, lastDays, longestStreak } from "../domain/journalStats";
import { writtenDates } from "../domain/written";
import { journalHref } from "../domain/types";

/** Card: journal streak — dot strip of the last N days, current and longest streak (knob: days). */
export function StreakCard({ settings }: CardProps) {
  const days = Math.max(1, Number(settings.days ?? 30));
  const today = todayStr();
  const notes = useNotes();
  const navigate = useNavigate();
  const written = writtenDates(notes);
  const strip = lastDays(today, days);
  const inStrip = strip.filter((d) => written.has(d)).length;
  const current = currentStreak(written, today);
  const longest = longestStreak(written);
  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex items-baseline gap-2">
        <span className={cn("flex items-center gap-1 text-2xl font-semibold tabular-nums", current > 0 && "text-[var(--chart-orange)]")}>
          <Flame className="size-5" />
          {current}
        </span>
        <span className="text-muted-foreground text-xs">
          day{current === 1 ? "" : "s"} · longest {longest}
        </span>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {inStrip} of last {days}
        </span>
      </div>
      <div className="flex flex-wrap content-start gap-1 overflow-y-auto">
        {strip.map((d) => {
          const on = written.has(d);
          return (
            <button
              key={d}
              title={`${formatHuman(d)}${on ? " · written" : ""}`}
              aria-label={formatHuman(d)}
              onClick={() => navigate(journalHref(d))}
              className={cn(
                "size-3 rounded-full transition-colors hover:ring-2 hover:ring-[var(--ring)]",
                on ? "bg-[var(--chart-orange)]" : "bg-muted",
                d === today && "ring-1 ring-[var(--foreground)]/40",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
