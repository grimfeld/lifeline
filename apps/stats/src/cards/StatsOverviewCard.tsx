import { useMemo } from "react";
import { Flame } from "lucide-react";
import { matchesTagFilter, useTagFilter } from "@lifeline/core";
import { entriesByStat, useEntries, useStats } from "../data/repo";
import { QuickLogButton, useSummary } from "../components/StatCard";
import type { Entry, Stat } from "../domain/types";

function Row({ stat, entries }: { stat: Stat; entries: Entry[] }) {
  const s = useSummary(stat, entries);
  return (
    <li className="flex items-center gap-2 rounded-md px-1 py-0.5">
      <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
      <span className="truncate text-sm">{stat.title}</span>
      {s.streak > 1 && (
        <span className="flex items-center gap-0.5 text-xs">
          <Flame className="size-3" style={{ color: s.color }} /> {s.streak}
        </span>
      )}
      <span className="ml-auto flex max-w-1/2 shrink-0 items-baseline text-sm font-medium tabular-nums">
        {s.big}
        {s.unit && <span className="text-muted-foreground ml-1 min-w-0 truncate text-xs font-normal">{s.unit}</span>}
      </span>
      <QuickLogButton stat={stat} entries={entries} className="size-6" />
    </li>
  );
}

/** Card: every stat's headline with one-tap logging. */
export function StatsOverviewCard() {
  const filter = useTagFilter();
  const stats = useStats().filter((s) => matchesTagFilter(s.tags, filter));
  const entries = useEntries();
  const byStat = useMemo(() => entriesByStat(entries), [entries]);
  if (stats.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No stats yet.</div>;
  }
  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {stats.map((s) => (
        <Row key={s.id} stat={s} entries={byStat.get(s.id) ?? []} />
      ))}
    </ul>
  );
}
