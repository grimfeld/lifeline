import { useNavigate } from "react-router";
import { formatHuman, todayStr, type CardProps } from "@lifeline/core";
import { cn } from "@lifeline/ui";
import { useNotes } from "../data/repo";
import { avg, moodSeries } from "../domain/journalStats";
import { MOODS } from "../domain/noteTypes";
import { journalHref } from "../workspace/useOpenNote";

const MOOD_COLORS: Record<number, string> = {
  1: "var(--chart-red)",
  2: "var(--chart-orange)",
  3: "var(--chart-yellow)",
  4: "var(--chart-aqua)",
  5: "var(--chart-green)",
};

const moodLabel = (m: number) => MOODS.find((x) => x.value === String(m))?.label ?? String(m);
const emojiOf = (m: number | null) => (m === null ? "" : moodLabel(Math.round(m)).split(" ")[0]);

/** Card: mood over the last N days from daily notes' frontmatter (knob: days). */
export function MoodCard({ settings }: CardProps) {
  const days = Math.max(1, Number(settings.days ?? 30));
  const today = todayStr();
  const notes = useNotes();
  const navigate = useNavigate();
  const series = moodSeries(notes, days, today);
  const withMood = series.filter((p) => p.mood !== null);
  if (withMood.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center p-2 text-center text-sm">Set a mood on your daily notes to see it here.</div>;
  }
  const last14 = moodSeries(notes, 14, today);
  const thisWeek = avg(last14.slice(7).map((p) => p.mood));
  const lastWeek = avg(last14.slice(0, 7).map((p) => p.mood));
  const trend = thisWeek === null || lastWeek === null ? "" : thisWeek > lastWeek + 0.05 ? "↑" : thisWeek < lastWeek - 0.05 ? "↓" : "→";
  const overall = avg(series.map((p) => p.mood));
  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex items-baseline gap-2 text-sm">
        <span className="text-xl">{emojiOf(thisWeek ?? overall)}</span>
        <span className="text-muted-foreground text-xs">
          this week {thisWeek === null ? "—" : thisWeek.toFixed(1)}
          {trend && (
            <>
              {" "}
              <span className="text-foreground">{trend}</span> {emojiOf(lastWeek)} {lastWeek?.toFixed(1)} last week
            </>
          )}
        </span>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">avg {overall?.toFixed(1)}</span>
      </div>
      <div className="flex min-h-0 flex-1 items-end gap-px">
        {series.map((p) => (
          <button
            key={p.date}
            title={`${formatHuman(p.date)}${p.mood === null ? "" : ` · ${moodLabel(p.mood)}`}`}
            aria-label={formatHuman(p.date)}
            onClick={() => navigate(journalHref(p.date))}
            className={cn("min-w-0 flex-1 rounded-t-sm transition-opacity hover:opacity-70", p.mood === null && "bg-muted")}
            style={{ height: p.mood === null ? "6%" : `${(p.mood / 5) * 100}%`, background: p.mood === null ? undefined : MOOD_COLORS[p.mood] }}
          />
        ))}
      </div>
    </div>
  );
}
