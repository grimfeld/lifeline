import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, cn } from "@lifeline/ui";
import { formatHuman } from "@lifeline/core";
import { formatCents } from "../domain/money";
import { describeCadence } from "../domain/series";
import { fixedSplit, seriesReport, type SeriesReportRow } from "../domain/recurring-report";
import type { Series } from "../domain/types";
import { AXIS_TICK, ChartCard, ChartKey, Empty, GRID, MoneyTooltip, SPENT_COLOR, SortHeader, StatTile, TARGET_COLOR, formatAxis, formatPercent, type ReportData } from "./reportChrome";

type RecurringSort = "name" | "cadence" | "amount" | "annual" | "total" | "last";

/**
 * The Recurring tab (ADR 0042): the ledger's own bills, read — never posted.
 * Fixed against variable per month, and every series the window shows, with
 * what a year of each costs. Muted series count as fixed (mute means "don't
 * forecast me"); a dormant one keeps its historical months and wears a badge.
 */
export function ReportRecurring({ data, series }: { data: ReportData; series: Series[] }) {
  const { months, transactions } = data;
  const [sort, setSort] = useState<RecurringSort>("total");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const split = useMemo(() => fixedSplit(transactions, series, months), [transactions, series, months]);
  const rows = useMemo(() => seriesReport(transactions, series, months), [transactions, series, months]);

  const fixedTotal = split.reduce((s, p) => s + p.fixed, 0);
  const variableTotal = split.reduce((s, p) => s + p.variable, 0);
  const spendTotal = fixedTotal + variableTotal;
  const dormant = rows.filter((r) => r.series.dormant).length;
  const muted = rows.filter((r) => r.series.muted).length;

  const sorted = useMemo(() => {
    const sign = direction === "asc" ? 1 : -1;
    const by: Record<RecurringSort, (a: SeriesReportRow, b: SeriesReportRow) => number> = {
      name: (a, b) => a.series.payee.localeCompare(b.series.payee),
      cadence: (a, b) => a.series.period - b.series.period,
      amount: (a, b) => a.series.amount - b.series.amount,
      annual: (a, b) => a.annual - b.annual,
      total: (a, b) => a.total - b.total,
      last: (a, b) => a.series.lastDate.localeCompare(b.series.lastDate),
    };
    return [...rows].sort((a, b) => sign * by[sort](a, b) || a.series.payee.localeCompare(b.series.payee));
  }, [rows, sort, direction]);

  function sortBy(next: RecurringSort) {
    if (next === sort) return setDirection((d) => (d === "asc" ? "desc" : "asc"));
    setSort(next);
    setDirection(next === "name" || next === "cadence" ? "asc" : "desc");
  }

  if (months.length === 0) return <Empty height={160}>That window has no months in it — the range starts after it ends.</Empty>;
  if (rows.length === 0) return <Empty height={160}>No recurring series in this window — three regular payments to one payee and rent, salary or Netflix appears here on its own.</Empty>;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Fixed spend" value={formatCents(fixedTotal)} hint={`${formatCents(Math.round(fixedTotal / Math.max(1, months.length)))} a month on the window's bills`} />
        <StatTile label="Variable spend" value={formatCents(variableTotal)} hint="everything that is not a series" />
        <StatTile label="Fixed share" value={spendTotal > 0 ? formatPercent(fixedTotal / spendTotal) : "–"} hint="of the window's spending" />
        <StatTile label="Series" value={String(rows.length)} hint={[dormant > 0 ? `${dormant} over` : "", muted > 0 ? `${muted} muted` : ""].filter(Boolean).join(" · ") || "all still running"} />
      </div>

      <ChartCard title="Fixed against variable" hint="Each month's spending split: rows that belong to a Recurring series against everything else">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={split.map((p) => ({ label: p.label, fixed: p.fixed / 100, variable: p.variable / 100 }))} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={formatAxis} />
            <Tooltip content={<MoneyTooltip total />} cursor={{ fill: "var(--chart-grid)", opacity: 0.3 }} />
            <Bar dataKey="fixed" name="Fixed" stackId="split" fill={TARGET_COLOR} />
            <Bar dataKey="variable" name="Variable" stackId="split" fill={SPENT_COLOR} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <ChartKey
          items={[
            { id: "fixed", label: "Fixed (recurring series)", color: TARGET_COLOR },
            { id: "variable", label: "Variable", color: SPENT_COLOR },
          ]}
        />
      </ChartCard>

      <ChartCard title="Every series in the window" hint="Click a column to sort — biggest window total first is the default">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs">
                <SortHeader label="Series" active={sort === "name"} direction={direction} onSort={() => sortBy("name")} className="pr-2 pl-0 text-left" />
                <SortHeader label="Cadence" active={sort === "cadence"} direction={direction} onSort={() => sortBy("cadence")} className="text-left" />
                <SortHeader label="Amount" active={sort === "amount"} direction={direction} onSort={() => sortBy("amount")} className="text-right" title="The run's median — a suggestion, never a promise" />
                <SortHeader label="Per year" active={sort === "annual"} direction={direction} onSort={() => sortBy("annual")} className="text-right" title="The median times the cadence's turns per year" />
                <SortHeader label="In window" active={sort === "total"} direction={direction} onSort={() => sortBy("total")} className="text-right" />
                <SortHeader label="Last seen" active={sort === "last"} direction={direction} onSort={() => sortBy("last")} className="text-right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <SeriesTableRow key={row.series.key} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

function SeriesTableRow({ row }: { row: SeriesReportRow }) {
  const s = row.series;
  return (
    <tr className={cn("border-t", (s.dormant || s.muted) && "opacity-60")}>
      <td className="max-w-56 truncate py-1 pr-2" title={s.payee}>
        {s.payee}
        {s.kind === "income" && (
          <Badge variant="outline" className="ml-1.5">
            income
          </Badge>
        )}
        {s.muted && (
          <Badge variant="outline" className="ml-1.5">
            muted
          </Badge>
        )}
        {s.dormant && (
          <Badge variant="outline" className="ml-1.5">
            over
          </Badge>
        )}
      </td>
      <td className="text-muted-foreground px-2 py-1 whitespace-nowrap">{describeCadence(s)}</td>
      <td className="px-2 py-1 text-right tabular-nums">{formatCents(s.amount)}</td>
      <td className="px-2 py-1 text-right tabular-nums">{formatCents(row.annual)}</td>
      <td className="px-2 py-1 text-right tabular-nums" title={`${row.count} row${row.count === 1 ? "" : "s"} in the window`}>
        {formatCents(row.total)}
      </td>
      <td className="text-muted-foreground px-2 py-1 text-right whitespace-nowrap">{formatHuman(s.lastDate)}</td>
    </tr>
  );
}
