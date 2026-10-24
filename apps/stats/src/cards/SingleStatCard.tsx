import { useMemo } from "react";
import { Link } from "react-router";
import { Flame } from "lucide-react";
import { CardUnavailable, cn } from "@lifeline/ui";
import type { CardOption, CardProps, CardSettings } from "@lifeline/core";
import { entriesByStat, useEntries, useStats } from "../data/repo";
import { QuickLogButton } from "../components/StatCard";
import { DotGrid, Sparkline } from "../components/charts";
import { colorVar, type Entry, type Period, type Stat } from "../domain/types";
import {
  booleanHeadline,
  collectedItems,
  collectionUniverse,
  currentStreak,
  dailySeries,
  formatValue,
  headline,
  markedDays,
  previousPeriodHeadline,
  readingSeries,
} from "../domain/aggregate";

/** Options hook for the `stat` setting: every stat by name. */
export function useSingleStatOptions(): CardOption[] {
  const stats = useStats();
  return [...stats].sort((a, b) => a.title.localeCompare(b.title)).map((s) => ({ value: s.id, label: s.title }));
}

/** Instance title (a hook, per CardDef.instanceTitle): the chosen stat's name. */
export function useSingleStatTitle(settings: CardSettings): string {
  const stats = useStats();
  return stats.find((s) => s.id === settings.stat)?.title ?? "";
}

export const PERIOD_OPTIONS: CardOption[] = [
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

const PERIOD_CAPTION: Record<Period, string> = { week: "last 7 days", month: "last 30 days", year: "this year", all: "all time" };

function Delta({ current, previous, unit }: { current: number; previous: number | null; unit: string }) {
  if (previous === null) return null;
  const diff = current - previous;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  return (
    <span className={cn("text-muted-foreground text-xs tabular-nums", diff > 0 && "text-emerald-600/80", diff < 0 && "text-rose-600/80")}>
      {sign}
      {formatValue(Math.abs(diff))}
      {unit ? ` ${unit}` : ""} vs previous
    </span>
  );
}

function Body({ stat, entries, period }: { stat: Stat; entries: Entry[]; period: Period }) {
  const color = colorVar(stat.color);
  const view = useMemo(() => {
    switch (stat.kind) {
      case "additive": {
        const sum = headline("additive", entries, period) ?? 0;
        return { kind: stat.kind, sum, prev: previousPeriodHeadline(entries, period), spark: dailySeries(entries, period).map((p) => p.cumulative) };
      }
      case "measurement": {
        const v = headline("measurement", entries, period);
        return { kind: stat.kind, latest: v, spark: readingSeries(entries, period).map((p) => p.value) };
      }
      case "boolean": {
        const days = markedDays(entries);
        return { kind: stat.kind, days, streak: currentStreak(days), head: booleanHeadline(days, period) };
      }
      case "collection": {
        const n = collectedItems(entries).length;
        const universe = collectionUniverse(stat);
        return { kind: stat.kind, n, universe, pct: universe > 0 ? Math.min(100, (n / universe) * 100) : null };
      }
    }
  }, [stat, entries, period]);

  switch (view.kind) {
    case "additive":
      return (
        <>
          <div className="flex flex-wrap items-baseline gap-x-1">
            <span className="text-3xl font-semibold tabular-nums">{formatValue(view.sum)}</span>
            {stat.unit && <span className="text-muted-foreground text-sm">{stat.unit}</span>}
            <span className="text-muted-foreground ml-1 text-xs">{PERIOD_CAPTION[period]}</span>
          </div>
          <Delta current={view.sum} previous={view.prev} unit={stat.unit} />
          <div className="mt-auto">
            <Sparkline values={view.spark} color={color} />
          </div>
        </>
      );
    case "measurement":
      return (
        <>
          <div className="flex flex-wrap items-baseline gap-x-1">
            <span className="text-3xl font-semibold tabular-nums">{view.latest === null ? "—" : formatValue(view.latest)}</span>
            {stat.unit && <span className="text-muted-foreground text-sm">{stat.unit}</span>}
            <span className="text-muted-foreground ml-1 text-xs">latest</span>
          </div>
          {view.spark.length === 0 && <span className="text-muted-foreground text-xs">No readings {PERIOD_CAPTION[period]}.</span>}
          <div className="mt-auto">
            <Sparkline values={view.spark} color={color} />
          </div>
        </>
      );
    case "boolean":
      return (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="flex items-center gap-1 text-3xl font-semibold tabular-nums">
              {view.streak > 0 && <Flame className="size-6" style={{ color }} />}
              {view.streak} d
            </span>
            <span className="text-muted-foreground text-xs">
              {view.head.count}
              {view.head.denominator !== null ? ` / ${view.head.denominator}` : ""} days {PERIOD_CAPTION[period]}
            </span>
          </div>
          <div className="mt-auto min-h-0 overflow-y-auto">
            <DotGrid days={view.days} period={period} color={color} />
          </div>
        </>
      );
    case "collection":
      return (
        <>
          <div className="flex flex-wrap items-baseline gap-x-1">
            <span className="text-3xl font-semibold tabular-nums">{view.universe > 0 ? `${view.n} / ${view.universe}` : view.n}</span>
            <span className="text-muted-foreground ml-1 text-xs">collected</span>
          </div>
          {view.pct !== null && (
            <div className="mt-auto grid gap-1">
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div className="h-full rounded-full" style={{ width: `${view.pct}%`, background: color }} />
              </div>
              <span className="text-muted-foreground text-xs tabular-nums">{Math.round(view.pct)}%</span>
            </div>
          )}
        </>
      );
  }
}

/** Card: one stat as a dashboard tile — headline, trend and one-tap logging. */
export function SingleStatCard({ settings, configure }: CardProps) {
  const statId = settings.stat as string;
  const period = settings.period as Period;
  const stats = useStats();
  const entries = useEntries();
  const stat = stats.find((s) => s.id === statId);
  const own = useMemo(() => entriesByStat(entries).get(statId) ?? [], [entries, statId]);
  if (!stat) return <CardUnavailable message="That stat no longer exists." onConfigure={configure} />;
  return (
    <div className="relative flex h-full flex-col gap-1 rounded-md transition-colors hover:bg-accent/40">
      {/* The Screen header already carries the stat's name (instanceTitle); the body is just the numbers. */}
      <Link
        to={`/app/stats/${stat.id}`}
        draggable={false}
        className="focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none flex min-h-0 flex-1 flex-col gap-1 rounded-md [&>*:nth-child(2)]:pr-8"
      >
        <span className="sr-only">{stat.title}</span>
        <Body stat={stat} entries={own} period={period} />
      </Link>
      <QuickLogButton stat={stat} entries={own} className="absolute top-0 right-0" />
    </div>
  );
}
