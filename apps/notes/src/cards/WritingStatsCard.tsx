import { startOfWeek, todayStr, type CardProps } from "@lifeline/core";
import { useNotes } from "../data/repo";
import { entriesPerMonth, wordsBetween } from "../domain/journalStats";

const monthLabel = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1)).toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });

/** Card: words this week / month, entries per month, total notes (knob: months). */
export function WritingStatsCard({ settings }: CardProps) {
  const months = Math.max(1, Number(settings.months ?? 6));
  const today = todayStr();
  const notes = useNotes();
  const weekWords = wordsBetween(notes, startOfWeek(today), today);
  const monthWords = wordsBetween(notes, `${today.slice(0, 7)}-01`, today);
  const perMonth = entriesPerMonth(notes, months, today);
  const max = Math.max(1, ...perMonth.map((m) => m.count));
  const dailyCount = notes.filter((n) => n.type === "daily").length;
  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="grid grid-cols-2 gap-2">
        <Stat value={weekWords} label="words this week" />
        <Stat value={monthWords} label="words this month" />
      </div>
      <div className="flex min-h-0 flex-1 items-end gap-1">
        {perMonth.map((m) => (
          <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-0.5" title={`${monthLabel(m.month)} ${m.month.slice(0, 4)} · ${m.count} entr${m.count === 1 ? "y" : "ies"}`}>
            <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">{m.count}</span>
            <div className="flex min-h-0 w-full flex-1 items-end">
              <div className="w-full rounded-t-sm bg-[var(--chart-green)]" style={{ height: `${Math.max(2, (m.count / max) * 100)}%` }} />
            </div>
            <span className="text-muted-foreground shrink-0 truncate text-[10px]">{monthLabel(m.month)}</span>
          </div>
        ))}
      </div>
      <div className="text-muted-foreground text-xs">
        {notes.length} note{notes.length === 1 ? "" : "s"} · {dailyCount} daily
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
