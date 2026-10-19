import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, cn } from "@lifeline/ui";
import type { Entry, Period, Stat } from "../domain/types";
import { colorVar } from "../domain/types";
import {
  collectionSeries,
  dailySeries,
  dayKey,
  dotGridWeeks,
  formatValue,
  periodStart,
  readingSeries,
  shiftDay,
  type CollectedItem,
  type ReadingPoint,
} from "../domain/aggregate";

const AXIS_TICK = { fill: "var(--chart-muted)", fontSize: 11 };
const GRID = { stroke: "var(--chart-grid)", vertical: false };

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  color,
}: {
  active?: boolean;
  payload?: { value?: number | string; payload?: { label?: string } }[];
  label?: string | number;
  unit: string;
  color: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  const lbl = payload[0].payload?.label ?? label;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-2 py-1 text-xs shadow-md">
      <div className="text-muted-foreground">{lbl}</div>
      <div className="flex items-center gap-1.5 font-medium">
        <span className="size-2 rounded-full" style={{ background: color }} />
        {typeof v === "number" ? formatValue(v) : v}
        {unit ? <span className="text-muted-foreground font-normal">{unit}</span> : null}
      </div>
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">{children}</div>;
}

export function AdditiveChart({ stat, entries, period }: { stat: Stat; entries: Entry[]; period: Period }) {
  const [mode, setMode] = useState<"daily" | "cumulative">("daily");
  const data = useMemo(() => dailySeries(entries, period), [entries, period]);
  const color = colorVar(stat.color);
  if (data.length === 0 || data.every((p) => p.sum === 0)) return <Empty>No entries in this period.</Empty>;
  const interval = Math.max(0, Math.ceil(data.length / 8) - 1);
  return (
    <div className="grid gap-2">
      <div className="flex justify-end gap-1">
        {(["daily", "cumulative"] as const).map((m) => (
          <Button key={m} size="sm" variant={mode === m ? "default" : "ghost"} className="h-7 capitalize" onClick={() => setMode(m)}>
            {m}
          </Button>
        ))}
      </div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          {mode === "daily" ? (
            <BarChart data={data} barCategoryGap="25%">
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" tick={AXIS_TICK} interval={interval} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<ChartTooltip unit={stat.unit} color={color} />} cursor={{ fill: "var(--chart-grid)", opacity: 0.4 }} />
              <Bar dataKey="sum" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            </BarChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" tick={AXIS_TICK} interval={interval} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<ChartTooltip unit={stat.unit} color={color} />} />
              <Line type="monotone" dataKey="cumulative" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TimeLine({ data, color, unit, step, height = 240 }: { data: ReadingPoint[]; color: string; unit: string; step?: boolean; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid {...GRID} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tick={AXIS_TICK}
            tickFormatter={(t: number) => new Date(t).toLocaleDateString(undefined, step ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" })}
            axisLine={{ stroke: "var(--chart-baseline)" }}
            tickLine={false}
          />
          <YAxis tick={AXIS_TICK} domain={["auto", "auto"]} axisLine={false} tickLine={false} width={36} allowDecimals={!step} />
          <Tooltip content={<ChartTooltip unit={unit} color={color} />} />
          <Line type={step ? "stepAfter" : "monotone"} dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color, strokeWidth: 0 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MeasurementChart({ stat, entries, period }: { stat: Stat; entries: Entry[]; period: Period }) {
  const data = useMemo(() => readingSeries(entries, period), [entries, period]);
  if (data.length === 0) return <Empty>No readings in this period.</Empty>;
  return <TimeLine data={data} color={colorVar(stat.color)} unit={stat.unit} />;
}

export function CollectionChart({ stat, items }: { stat: Stat; items: CollectedItem[] }) {
  const data = useMemo(() => collectionSeries(items), [items]);
  if (items.length === 0) return <Empty>Nothing collected yet.</Empty>;
  if (items.length === 1) return <Empty>One item collected — the graph starts at two.</Empty>;
  return <TimeLine data={data} color={colorVar(stat.color)} unit="" step height={160} />;
}

/** GitHub-style grid: one column per week (Monday first), 7 rows. */
export function DotGrid({ days, period, color, now = new Date() }: { days: Set<string>; period: Period; color: string; now?: Date }) {
  const start = periodStart(period, now);
  let first: string;
  if (start) first = dayKey(start);
  else if (days.size) first = [...days].sort()[0];
  else return <Empty>No days marked yet.</Empty>;
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

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-9" />;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="h-9">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
