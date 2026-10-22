import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Measure, Shop } from "../domain/types";
import type { PricePoint } from "../domain/derive";
import { formatUnitPrice, unitPriceIn } from "../domain/measure";
import { shopColor } from "./PriceChart";

// The recharts half of PriceChart, loaded on first draw (PriceChart.tsx wraps it lazily).

const AXIS_TICK = { fill: "var(--chart-muted)", fontSize: 11 };
const GRID = { stroke: "var(--chart-grid)", vertical: false };

type Row = { ts: number; date: string } & Record<string, number | string | boolean | undefined>;

function tsOf(date: string): number {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function ChartTooltip({ active, payload, shops, measure }: { active?: boolean; payload?: { dataKey?: string | number; value?: number | string; payload?: Row }[]; shops: readonly Shop[]; measure: Measure }) {
  const row = payload?.[0]?.payload;
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-2 py-1 text-xs shadow-md">
      <div className="text-muted-foreground">{row?.date}</div>
      {payload
        .filter((p) => typeof p.value === "number")
        .map((p) => {
          const id = String(p.dataKey);
          const promo = row?.[`${id}__promo`] === true;
          return (
            <div key={id} className="flex items-center gap-1.5 font-medium">
              <span className="size-2 rounded-full" style={{ background: shopColor(id, shops) }} />
              {shops.find((s) => s.id === id)?.title ?? "?"} · {formatUnitPrice(Number(p.payload?.[`${id}__base`] ?? 0), measure)}
              {promo && <span className="text-muted-foreground font-normal">promo</span>}
            </div>
          );
        })}
    </div>
  );
}

/**
 * A Product's unit price over time, one series per Shop; promo points are
 * hollow so a one-off deal never reads as the usual price (ADR 0082). Plotted
 * per the Product's reading unit; the axis carries numbers only — the unit
 * ("€/100 g") is named by whatever heads the chart.
 */
export function PriceChart({ history, shops, measure, height = 240, compact }: { history: ReadonlyMap<string, PricePoint[]>; shops: readonly Shop[]; measure: Measure; height?: number; compact?: boolean }) {
  const { data, series } = useMemo(() => {
    const byDate = new Map<string, Row>();
    const series: string[] = [];
    for (const [shopId, points] of history) {
      series.push(shopId);
      for (const p of points) {
        const row = byDate.get(p.date) ?? { ts: tsOf(p.date), date: p.date };
        // Plotted in euros per the Product's reading unit; the base figure kept for the tooltip.
        row[shopId] = unitPriceIn(p.unit, measure) / 100;
        row[`${shopId}__base`] = p.unit;
        row[`${shopId}__promo`] = p.promo;
        byDate.set(p.date, row);
      }
    }
    return { data: [...byDate.values()].sort((a, b) => a.ts - b.ts), series };
  }, [history, measure]);

  if (data.length === 0) return <div className="text-muted-foreground flex items-center justify-center text-sm" style={{ height }}>No prices yet.</div>;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={compact ? { top: 4, right: 4, bottom: 2, left: 4 } : undefined}>
          {!compact && <CartesianGrid {...GRID} />}
          <XAxis dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]} hide={compact} tick={AXIS_TICK} tickFormatter={(t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
          <YAxis hide={compact} tick={AXIS_TICK} domain={["auto", "auto"]} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => (v < 0.1 ? String(Number(v.toPrecision(2))) : v.toFixed(2))} />
          <Tooltip content={<ChartTooltip shops={shops} measure={measure} />} />
          {series.map((id) => {
            const color = shopColor(id, shops);
            return (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                stroke={color}
                strokeWidth={2}
                connectNulls
                isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; payload?: Row }) => {
                  const { cx, cy, payload } = props;
                  if (cx === undefined || cy === undefined || payload?.[id] === undefined) return <g key={`${id}-${payload?.ts}`} />;
                  const promo = payload?.[`${id}__promo`] === true;
                  return <circle key={`${id}-${payload?.ts}`} cx={cx} cy={cy} r={compact ? 2.5 : 3.5} fill={promo ? "var(--background)" : color} stroke={color} strokeWidth={promo ? 1.5 : 0} />;
                }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
