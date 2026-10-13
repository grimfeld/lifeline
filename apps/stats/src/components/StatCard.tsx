import { useMemo, useState } from "react";
import { Button, Card, CardContent, cn, toast, TagChips } from "@lifeline/ui";
import { Check, Flame, Plus } from "lucide-react";
import type { Entry, Stat } from "../domain/types";
import { colorVar } from "../domain/types";
import {
  booleanHeadline,
  collectedItems,
  collectionSeries,
  currentStreak,
  dailySeries,
  dayKey,
  formatValue,
  headline,
  markedDays,
  readingSeries,
} from "../domain/aggregate";
import { addEntry } from "../data/repo";
import { AddEntryDialog } from "./AddEntryDialog";
import { DotStrip, Sparkline } from "./charts";

/** Headline + caption per kind, fixed period (year / latest / last 30 days / all-time). */
export function useSummary(stat: Stat, entries: Entry[]) {
  return useMemo(() => {
    const color = colorVar(stat.color);
    switch (stat.kind) {
      case "additive": {
        const v = headline("additive", entries, "year") ?? 0;
        return { big: formatValue(v), unit: stat.unit, caption: "this year", streak: 0, color, spark: dailySeries(entries, "month").map((p) => p.cumulative), days: null };
      }
      case "measurement": {
        const v = headline("measurement", entries, "all");
        return { big: v === null ? "—" : formatValue(v), unit: stat.unit, caption: "latest", streak: 0, color, spark: readingSeries(entries, "month").map((p) => p.value), days: null };
      }
      case "boolean": {
        const days = markedDays(entries);
        const h = booleanHeadline(days, "month");
        return { big: `${h.count} / ${h.denominator}`, unit: "", caption: "of last 30 days", streak: currentStreak(days), color, spark: null, days };
      }
      case "collection": {
        const items = collectedItems(entries);
        return { big: stat.universeSize ? `${items.length} / ${stat.universeSize}` : String(items.length), unit: "", caption: "collected", streak: 0, color, spark: collectionSeries(items).map((p) => p.value), days: null };
      }
    }
  }, [stat, entries]);
}

/** One-tap quick log: mark today (boolean) or add the default increment (additive); else open the dialog. */
export function QuickLogButton({ stat, entries, className }: { stat: Stat; entries: Entry[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const todayMarked = stat.kind === "boolean" && markedDays(entries).has(dayKey(new Date()));

  async function quick() {
    if (stat.kind === "boolean") {
      if (todayMarked) return;
      await addEntry({ statId: stat.id, value: 1, ts: new Date().toISOString() });
      toast.success(`${stat.title} marked today`);
      return;
    }
    if (stat.kind === "additive" && stat.defaultIncrement) {
      await addEntry({ statId: stat.id, value: stat.defaultIncrement, ts: new Date().toISOString() });
      toast.success(`+${formatValue(stat.defaultIncrement)} ${stat.title}`);
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <Button
        size="icon"
        variant="outline"
        className={cn("size-7 rounded-full", className)}
        aria-label={stat.kind === "boolean" ? `Mark ${stat.title} today` : `Log ${stat.title}`}
        aria-pressed={stat.kind === "boolean" ? todayMarked : undefined}
        disabled={todayMarked}
        onClick={(e) => {
          e.stopPropagation();
          void quick();
        }}
      >
        {todayMarked ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
      </Button>
      <AddEntryDialog open={open} onOpenChange={setOpen} stat={stat} />
    </>
  );
}

export function StatCard({ stat, entries, onOpen }: { stat: Stat; entries: Entry[]; onOpen: () => void }) {
  const s = useSummary(stat, entries);
  return (
    <Card className="cursor-pointer py-3 transition-colors hover:bg-accent/40" onClick={onOpen}>
      <CardContent className="grid gap-2 px-4">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: s.color }} />
          <span className="truncate text-sm font-medium">{stat.title}</span>
          {s.streak > 1 && (
            <span className="ml-1 flex items-center gap-0.5 text-xs" title="Current streak">
              <Flame className="size-3.5" style={{ color: s.color }} /> {s.streak}
            </span>
          )}
          <QuickLogButton stat={stat} entries={entries} className="ml-auto" />
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums">{s.big}</span>
          {s.unit && <span className="text-muted-foreground text-sm">{s.unit}</span>}
          <span className="text-muted-foreground ml-1 text-xs">{s.caption}</span>
        </div>
        {(stat.tags ?? []).length > 0 && <TagChips tags={stat.tags} size="xs" />}
        {s.days ? <DotStrip days={s.days} color={s.color} /> : <Sparkline values={s.spark ?? []} color={s.color} />}
      </CardContent>
    </Card>
  );
}
