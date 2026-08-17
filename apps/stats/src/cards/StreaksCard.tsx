import { useMemo } from "react";
import { Flame } from "lucide-react";
import { cn } from "@lifeline/ui";
import { matchesTagFilter, useTagFilter, type CardProps, type CardSettings } from "@lifeline/core";
import { entriesByStat, useEntries, useStats } from "../data/repo";
import { QuickLogButton } from "../components/StatCard";
import { rankByStreak } from "../domain/rank";

export function streaksInstanceTitle(settings: CardSettings): string {
  return settings.show === "active" ? "Active streaks" : "Streaks";
}

/** Card: boolean stats ranked by current streak, longest-ever muted, mark today inline. */
export function StreaksCard({ settings }: CardProps) {
  const activeOnly = settings.show === "active";
  const filter = useTagFilter();
  const stats = useStats().filter((s) => matchesTagFilter(s.tags, filter));
  const entries = useEntries();
  const rows = useMemo(() => rankByStreak(stats, entriesByStat(entries), activeOnly), [stats, entries, activeOnly]);
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {activeOnly ? "No active streaks." : "No boolean stats yet."}
      </div>
    );
  }
  return (
    <ol className="grid content-start gap-1 overflow-y-auto">
      {rows.map((r, i) => (
        <li key={r.stat.id} className="flex items-center gap-2 rounded-md px-1 py-0.5">
          <span className="text-muted-foreground w-5 shrink-0 text-right text-xs tabular-nums">{i + 1}</span>
          <span className="truncate text-sm">{r.stat.name}</span>
          <span
            className={cn(
              "ml-auto flex shrink-0 items-center gap-0.5 text-sm tabular-nums",
              r.current === 0 && "text-muted-foreground",
              r.current >= 7 && "font-medium",
              r.current >= 30 && "font-semibold",
            )}
            title="Current streak"
          >
            <Flame
              className={cn("size-3.5", r.current === 0 && "opacity-30", r.current >= 7 && "opacity-90", r.current >= 30 && "opacity-100")}
              style={r.current > 0 ? { color: `var(--chart-${r.stat.color})` } : undefined}
              strokeWidth={r.current >= 30 ? 2.5 : 2}
            />
            {r.current}
          </span>
          <span className="text-muted-foreground w-12 shrink-0 text-right text-xs tabular-nums" title="Longest streak">
            best {r.longest}
          </span>
          <QuickLogButton stat={r.stat} entries={r.entries} className="size-6" />
        </li>
      ))}
    </ol>
  );
}
