import { lazy, Suspense, type ComponentProps } from "react";
import { cn } from "@lifeline/ui";
import type { Period } from "../domain/types";
import { dayKey, dotGridWeeks, periodStart, shiftDay } from "../domain/aggregate";

// recharts stays out of the first load (it rides with the Cards otherwise): the
// line and bar charts load on first draw, behind a placeholder of their size.
const Impl = {
  AdditiveChart: lazy(() => import("./chartsImpl").then((m) => ({ default: m.AdditiveChart }))),
  MeasurementChart: lazy(() => import("./chartsImpl").then((m) => ({ default: m.MeasurementChart }))),
  CollectionChart: lazy(() => import("./chartsImpl").then((m) => ({ default: m.CollectionChart }))),
  Sparkline: lazy(() => import("./chartsImpl").then((m) => ({ default: m.Sparkline }))),
};

export function Empty({ children }: { children: string }) {
  return <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">{children}</div>;
}

/** Daily bars or a cumulative line, with its toggle. */
export function AdditiveChart(props: ComponentProps<typeof Impl.AdditiveChart>) {
  return (
    <Suspense fallback={<div className="h-69" />}>
      <Impl.AdditiveChart {...props} />
    </Suspense>
  );
}

export function MeasurementChart(props: ComponentProps<typeof Impl.MeasurementChart>) {
  return (
    <Suspense fallback={<div className="h-60" />}>
      <Impl.MeasurementChart {...props} />
    </Suspense>
  );
}

export function CollectionChart(props: ComponentProps<typeof Impl.CollectionChart>) {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <Impl.CollectionChart {...props} />
    </Suspense>
  );
}

/** GitHub-style grid: one column per week (Monday first), 7 rows. */
export function DotGrid({ days, period, color, now = new Date() }: { days: Set<string>; period: Period; color: string; now?: Date }) {
  const start = periodStart(period, now);
  const first = start ? dayKey(start) : [...days].sort()[0];
  if (!first) return <Empty>No days marked yet.</Empty>;
  const weeks = dotGridWeeks(days, first, dayKey(now));
  return (
    <div className="overflow-x-auto py-2">
      <div className="flex gap-1">
        {weeks.map((col, i) => (
          <div key={i} className="grid gap-1">
            {col.map((c) => (
              <div
                key={c.day}
                title={c.day}
                className={cn("size-3 rounded-[3px]", c.state === "empty" && "bg-muted", c.state === "pad" && "opacity-0")}
                style={c.state === "marked" ? { background: color } : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Trailing N-day strip for cards. */
export function DotStrip({ days, n = 14, color, now = new Date() }: { days: Set<string>; n?: number; color: string; now?: Date }) {
  const today = dayKey(now);
  const cells = Array.from({ length: n }, (_, i) => shiftDay(today, i - (n - 1)));
  return (
    <div className="flex gap-1">
      {cells.map((d) => (
        <div key={d} title={d} className={cn("h-3 flex-1 rounded-[3px]", !days.has(d) && "bg-muted")} style={days.has(d) ? { background: color } : undefined} />
      ))}
    </div>
  );
}

export function Sparkline(props: ComponentProps<typeof Impl.Sparkline>) {
  return (
    <Suspense fallback={<div className="h-9" />}>
      <Impl.Sparkline {...props} />
    </Suspense>
  );
}
