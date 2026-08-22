import { useMemo } from "react";
import { matchesTagFilter, useTagFilter } from "@lifeline/core";
import { entriesByStat, useEntries, useStats } from "../data/repo";
import { QuickLogButton } from "../components/StatCard";
import { DotStrip } from "../components/charts";
import { colorVar } from "../domain/types";
import { currentStreak, markedDays } from "../domain/aggregate";

/** Card: boolean stats with their trailing two weeks and streak — mark today inline. ("Habit" is Life Level's term.) */
export function HabitsCard() {
  const filter = useTagFilter();
  const stats = useStats().filter((s) => s.kind === "boolean" && matchesTagFilter(s.tags, filter));
  const entries = useEntries();
  const byStat = useMemo(() => entriesByStat(entries), [entries]);
  if (stats.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No boolean stats yet.</div>;
  }
  return (
    <ul className="grid content-start gap-2 overflow-y-auto">
      {stats.map((s) => {
        const es = byStat.get(s.id) ?? [];
        const days = markedDays(es);
        const streak = currentStreak(days);
        return (
          <li key={s.id} className="grid gap-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm">{s.title}</span>
              {streak > 0 && <span className="text-muted-foreground text-xs">{streak}d</span>}
              <QuickLogButton stat={s} entries={es} className="ml-auto size-6" />
            </div>
            <DotStrip days={days} color={colorVar(s.color)} />
          </li>
        );
      })}
    </ul>
  );
}
