import { todayStr } from "@lifeline/core";
import { cn } from "@lifeline/ui";
import { toggleMood, useMoodsByDate } from "../data/repo";
import { MOOD_STEPS, moodLabel } from "../domain/types";

/**
 * Card: today's mood in one tap — the capture surface for the Dashboard and
 * the phone home (ADR 0021). Tapping the mood already set clears the day.
 */
export function TodayMoodCard() {
  const today = todayStr();
  const byDate = useMoodsByDate();
  const current = byDate.get(today) ?? null;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="text-muted-foreground flex items-baseline gap-2 text-xs">
        <span>How was today?</span>
        {current !== null && <span className="text-foreground ml-auto">{moodLabel(current)}</span>}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-5 gap-1.5">
        {MOOD_STEPS.map((s) => (
          <button
            key={s.level}
            type="button"
            title={`${s.emoji} ${s.label}`}
            aria-label={`${s.emoji} ${s.label}`}
            aria-pressed={current === s.level}
            onClick={() => void toggleMood(today, s.level, current)}
            className={cn(
              "flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-md border-2 text-lg transition-all",
              current === s.level ? "border-foreground" : "border-transparent hover:opacity-80",
            )}
            style={{ background: s.color }}
          >
            <span>{s.emoji}</span>
            <span className="text-[9px] leading-none text-white/90">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
