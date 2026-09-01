import { useMemo, useState } from "react";
import { parts, todayStr, type DateStr } from "@lifeline/core";
import { Button, Tabs, TabsList, TabsTrigger } from "@lifeline/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MonthGrid, MoodLegend, YearGrid } from "../components/MoodGrid";
import { clearMood, setMood, useMoodsByDate } from "../data/repo";
import { MOOD_STEPS, moodLabel, type MoodLevel } from "../domain/types";
import { average, datesOf, monthTitle, monthWeeks, recordedCount, shiftMonth, weekOverWeek, yearColumns } from "../domain/grid";

type Layout = "month" | "year";
const LAYOUT_KEY = "mood.layout";

const readLayout = (): Layout => {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "year" ? "year" : "month";
  } catch {
    return "month";
  }
};

const ARROWS = { up: "↑", down: "↓", flat: "→", unknown: "" } as const;

/** The Mood screen (ADR 0044): one grid, a month or a whole year, and the way you set a day. */
export function MoodScreen() {
  const today = todayStr();
  const byDate = useMoodsByDate();
  const [layout, setLayout] = useState<Layout>(readLayout);
  const [cursor, setCursor] = useState(() => {
    const p = parts(today);
    return { y: p.y, m: p.m };
  });

  const chooseLayout = (next: Layout) => {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      /* device-local nicety only */
    }
  };

  const dates: DateStr[] = useMemo(
    () => (layout === "month" ? datesOf(monthWeeks(cursor.y, cursor.m)) : datesOf(yearColumns(cursor.y))),
    [layout, cursor.y, cursor.m],
  );
  const shown = dates.filter((d) => d <= today);
  const recorded = recordedCount(byDate, dates);
  const mean = average(shown.map((d) => byDate.get(d) ?? null));
  const trend = weekOverWeek(byDate, today);
  const todayLevel = byDate.get(today) ?? null;

  const step = (delta: number) => {
    if (layout === "month") setCursor(shiftMonth(cursor.y, cursor.m, delta));
    else setCursor({ ...cursor, y: cursor.y + delta });
  };
  const jumpToToday = () => {
    const p = parts(today);
    setCursor({ y: p.y, m: p.m });
  };

  const onSet = (date: DateStr, level: MoodLevel) => void setMood(date, level);
  const onClear = (date: DateStr) => void clearMood(date);

  return (
    <div className="grid gap-4 p-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Mood</h1>
        <Tabs value={layout} onValueChange={(v) => chooseLayout(v as Layout)}>
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous" onClick={() => step(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">{layout === "month" ? monthTitle(cursor.y, cursor.m) : cursor.y}</span>
          <Button variant="ghost" size="icon" aria-label="Next" onClick={() => step(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={jumpToToday}>
            Today
          </Button>
        </div>
        <div className="text-muted-foreground ml-auto flex items-center gap-3 text-xs tabular-nums">
          <span>
            {recorded}/{shown.length} days
          </span>
          <span>avg {mean === null ? "—" : mean.toFixed(1)}</span>
          {trend.direction !== "unknown" && (
            <span title={`${trend.thisWeek?.toFixed(1)} this week vs ${trend.lastWeek?.toFixed(1)} last week`}>
              week {ARROWS[trend.direction]} {trend.thisWeek?.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Today:</span>
        {MOOD_STEPS.map((s) => (
          <Button
            key={s.level}
            size="sm"
            variant={todayLevel === s.level ? "default" : "outline"}
            onClick={() => (todayLevel === s.level ? onClear(today) : onSet(today, s.level))}
            title={moodLabel(s.level)}
          >
            <span className="mr-1 size-2.5 rounded-[3px]" style={{ background: s.color }} />
            {s.emoji} {s.label}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto pb-1">
        {layout === "month" ? (
          <MonthGrid byDate={byDate} today={today} size={34} onSet={onSet} onClear={onClear} y={cursor.y} m={cursor.m} />
        ) : (
          <YearGrid byDate={byDate} today={today} size={18} onSet={onSet} onClear={onClear} y={cursor.y} />
        )}
      </div>

      <MoodLegend steps={MOOD_STEPS} />
    </div>
  );
}
