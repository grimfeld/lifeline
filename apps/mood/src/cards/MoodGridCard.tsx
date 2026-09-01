import { useNavigate } from "react-router";
import { parts, todayStr, type CardProps, type DateStr } from "@lifeline/core";
import { MonthGrid, YearGrid } from "../components/MoodGrid";
import { clearMood, setMood, useMoodsByDate } from "../data/repo";
import { MOOD_HREF, type MoodLevel } from "../domain/types";
import { average, datesOf, monthTitle, monthWeeks, recordedCount, weekOverWeek, yearColumns } from "../domain/grid";

const ARROWS = { up: "↑", down: "↓", flat: "→", unknown: "" } as const;

/**
 * Card: the Mood grid in miniature — this month or this year — carrying the
 * window's average and its week-over-week direction (ADR 0044). Cells are
 * live: clicking one sets that day, exactly as on the screen.
 */
export function MoodGridCard({ settings }: CardProps) {
  const today = todayStr();
  const byDate = useMoodsByDate();
  const navigate = useNavigate();
  const year = settings.layout === "year";
  const { y, m } = parts(today);

  const dates: DateStr[] = year ? datesOf(yearColumns(y)) : datesOf(monthWeeks(y, m));
  const shown = dates.filter((d) => d <= today);
  const mean = average(shown.map((d) => byDate.get(d) ?? null));
  const trend = weekOverWeek(byDate, today);
  const onSet = (date: DateStr, level: MoodLevel) => void setMood(date, level);
  const onClear = (date: DateStr) => void clearMood(date);

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="text-muted-foreground flex items-baseline gap-2 text-xs">
        <button type="button" className="hover:text-foreground font-medium" onClick={() => navigate(MOOD_HREF)}>
          {year ? y : monthTitle(y, m)}
        </button>
        <span className="tabular-nums">
          {recordedCount(byDate, dates)}/{shown.length}
        </span>
        <span className="ml-auto tabular-nums">
          avg {mean === null ? "—" : mean.toFixed(1)} {ARROWS[trend.direction]}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {year ? (
          <YearGrid byDate={byDate} today={today} size={11} onSet={onSet} onClear={onClear} y={y} />
        ) : (
          <MonthGrid byDate={byDate} today={today} size={22} onSet={onSet} onClear={onClear} y={y} m={m} />
        )}
      </div>
    </div>
  );
}
