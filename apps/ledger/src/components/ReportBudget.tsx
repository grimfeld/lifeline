import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@lifeline/ui";
import { formatCents, formatSigned } from "../domain/money";
import { budgetTrend, categoryReport, potTrend, type CategoryReportRow } from "../domain/report";
import type { LedgerCategory } from "../domain/types";
import {
  AXIS_TICK,
  ChartCard,
  ChartKey,
  Empty,
  GRID,
  INCOME_COLOR,
  MoneyTooltip,
  SPENT_COLOR,
  Segmented,
  SortHeader,
  StatTile,
  TARGET_COLOR,
  formatAxis,
  formatPercent,
  sliceColor,
  type ReportData,
} from "./reportChrome";

/** How many categories the target-vs-spent bars hold before the chart stops being readable. */
const TOP_BARS = 10;

type BudgetSort = "name" | "target" | "spent" | "left" | "used";
type BarsMode = "target" | "spent";

/**
 * The Budget tab: the Budget screen's question — Target against spending —
 * asked across the whole window instead of one month at a time. Targets come
 * from each month's Allocation override where there is one, so December's
 * bigger Groceries counts as December's (ADR 0033). Accumulating pots get
 * their own line, read from full history: a pot is not a window.
 */
export function ReportBudget({ data }: { data: ReportData }) {
  const { months, transactions, allTransactions, categories, allocations, filter } = data;
  const [sort, setSort] = useState<BudgetSort>("left");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [barsMode, setBarsMode] = useState<BarsMode>("target");

  /** Targets are expense policy — the Budget ignores an income Category's own target (CONTEXT: Target). */
  const rows = useMemo(() => categoryReport(transactions, categories, allocations, months, "expense").filter((r) => r.target > 0 || r.total > 0), [transactions, categories, allocations, months]);
  const budgeted = useMemo(() => rows.filter((r) => r.target > 0), [rows]);
  const untargeted = useMemo(() => rows.filter((r) => r.target === 0), [rows]);
  const trend = useMemo(() => budgetTrend(rows, categories, allocations, months), [rows, categories, allocations, months]);

  /** Pots belong to the Categories the filters left in, but their balance is read from the whole ledger. */
  const potCategories = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.accumulating &&
          c.kind === "expense" &&
          (filter.categoryIds.length === 0 || filter.categoryIds.includes(c.id)) &&
          (filter.groups.length === 0 || filter.groups.includes(c.group ?? "")),
      ),
    [categories, filter.categoryIds, filter.groups],
  );
  const pots = useMemo(() => potTrend(potCategories, allocations, allTransactions, months), [potCategories, allocations, allTransactions, months]);

  const totalTarget = budgeted.reduce((s, r) => s + r.target, 0);
  const totalSpent = rows.reduce((s, r) => s + r.total, 0);
  const over = budgeted.filter((r) => r.budgetDelta < 0);
  const unbudgetedSpend = untargeted.reduce((s, r) => s + r.total, 0);

  const barData = useMemo(
    () =>
      [...budgeted]
        .sort((a, b) => (barsMode === "target" ? b.target - a.target : b.total - a.total))
        .slice(0, TOP_BARS)
        .map((r) => ({ title: r.title, target: r.target / 100, spent: r.total / 100 })),
    [budgeted, barsMode],
  );

  const sorted = useMemo(() => {
    const sign = direction === "asc" ? 1 : -1;
    const by: Record<BudgetSort, (a: CategoryReportRow, b: CategoryReportRow) => number> = {
      name: (a, b) => a.title.localeCompare(b.title),
      target: (a, b) => a.target - b.target,
      spent: (a, b) => a.total - b.total,
      left: (a, b) => a.budgetDelta - b.budgetDelta,
      used: (a, b) => (a.budgetRatio ?? 0) - (b.budgetRatio ?? 0),
    };
    return [...rows].sort((a, b) => {
      // A Category with no Target has no headroom and no ratio: those rows sit at the end, whichever way the column runs.
      if (sort === "left" || sort === "used") {
        const na = a.budgetRatio === null;
        const nb = b.budgetRatio === null;
        if (na !== nb) return na ? 1 : -1;
      }
      return sign * by[sort](a, b) || a.title.localeCompare(b.title);
    });
  }, [rows, sort, direction]);

  function sortBy(next: BudgetSort) {
    if (next === sort) return setDirection((d) => (d === "asc" ? "desc" : "asc"));
    setSort(next);
    // Money left and % used read worst-first ascending; a name reads A–Z; totals read big-first.
    setDirection(next === "target" || next === "spent" ? "desc" : "asc");
  }

  if (months.length === 0) return <Empty height={160}>That window has no months in it — the range starts after it ends.</Empty>;
  if (rows.length === 0) return <Empty height={160}>No Targets and no spending in this window — the Budget screen is where Targets are set.</Empty>;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Targets" value={formatCents(totalTarget)} hint={`${budgeted.length} categor${budgeted.length === 1 ? "y" : "ies"} over ${months.length} month${months.length === 1 ? "" : "s"}`} />
        <StatTile label="Spent" value={formatCents(totalSpent)} hint={totalTarget > 0 ? `${formatPercent(totalSpent / totalTarget)} of targets` : "no targets in the window"} />
        <StatTile label="Left" value={formatSigned(totalTarget - totalSpent)} tone={totalTarget - totalSpent < 0 ? "bad" : "good"} hint="targets minus everything spent" />
        <StatTile
          label="Over target"
          value={String(over.length)}
          tone={over.length > 0 ? "bad" : "good"}
          hint={unbudgetedSpend > 0 ? `${formatCents(unbudgetedSpend)} spent with no target` : "every category inside its target"}
        />
      </div>

      <ChartCard
        title="Target vs spent"
        hint={`The ${TOP_BARS} biggest by ${barsMode === "target" ? "target" : "spending"} — a bar past its target is a category that ran over`}
        right={
          <Segmented
            value={barsMode}
            onChange={setBarsMode}
            options={[
              { value: "target", label: "By target" },
              { value: "spent", label: "By spending" },
            ]}
          />
        }
      >
        {barData.length === 0 ? (
          <Empty>No Targets in this window — set them on the Budget screen.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, barData.length * 34)}>
            <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatAxis} />
              <YAxis type="category" dataKey="title" tick={AXIS_TICK} tickLine={false} axisLine={false} width={140} />
              <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--chart-grid)", opacity: 0.3 }} />
              <Bar dataKey="target" name="Target" fill={TARGET_COLOR} radius={[0, 2, 2, 0]} />
              <Bar dataKey="spent" name="Spent" fill={SPENT_COLOR} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {barData.length > 0 && (
          <ChartKey
            items={[
              { id: "target", label: "Target", color: TARGET_COLOR },
              { id: "spent", label: "Spent", color: SPENT_COLOR },
            ]}
          />
        )}
      </ChartCard>

      <ChartCard title="Month against target" hint="Each month's Targets — this month's Allocation override where there is one — against what was actually spent">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={trend.map((p) => ({ label: p.label, target: p.target / 100, spent: p.spent / 100, left: p.left / 100 }))} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={formatAxis} />
            <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--chart-grid)", opacity: 0.3 }} />
            <ReferenceLine y={0} stroke="var(--chart-baseline)" />
            <Bar dataKey="spent" name="Spent" fill={SPENT_COLOR} radius={[2, 2, 0, 0]} />
            <Line type="stepAfter" dataKey="target" name="Target" stroke={TARGET_COLOR} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="left" name="Left" stroke={INCOME_COLOR} dot={false} strokeWidth={1.5} strokeDasharray="4 3" />
          </ComposedChart>
        </ResponsiveContainer>
        <ChartKey
          items={[
            { id: "spent", label: "Spent", color: SPENT_COLOR },
            { id: "target", label: "Target", color: TARGET_COLOR },
            { id: "left", label: "Left (target − spent)", color: INCOME_COLOR, dashed: true },
          ]}
        />
      </ChartCard>

      {pots.pots.length > 0 && (
        <ChartCard title="Pots" hint="Accumulating categories: allocations since the category's first month minus everything ever spent on it — the window only decides what is drawn">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={pots.data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={formatAxis} domain={["auto", "auto"]} />
              <Tooltip content={<MoneyTooltip />} />
              <ReferenceLine y={0} stroke="var(--chart-baseline)" />
              {pots.pots.map((c: LedgerCategory, i: number) => (
                <Line key={c.id} type="monotone" dataKey={c.id} name={c.title} stroke={sliceColor(i)} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <ChartKey items={pots.pots.map((c: LedgerCategory, i: number) => ({ id: c.id, label: c.title, color: sliceColor(i) }))} />
        </ChartCard>
      )}

      <ChartCard title="Every category against its target" hint="Click a column to sort — most over target first is the default">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs">
                <SortHeader label="Category" active={sort === "name"} direction={direction} onSort={() => sortBy("name")} className="pr-2 pl-0 text-left" />
                <SortHeader label="Target" active={sort === "target"} direction={direction} onSort={() => sortBy("target")} className="text-right" />
                <SortHeader label="Spent" active={sort === "spent"} direction={direction} onSort={() => sortBy("spent")} className="text-right" />
                <SortHeader label="Left" active={sort === "left"} direction={direction} onSort={() => sortBy("left")} className="text-right" />
                <SortHeader label="Used" active={sort === "used"} direction={direction} onSort={() => sortBy("used")} className="text-right" />
                <th className="w-32 px-2 py-1 font-normal" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <BudgetTableRow key={row.categoryId || "__uncategorized"} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

function BudgetTableRow({ row }: { row: CategoryReportRow }) {
  const over = row.budgetRatio !== null && row.budgetDelta < 0;
  const ratio = row.budgetRatio ?? 0;
  return (
    <tr className={cn("border-t", row.categoryId === "" && "text-amber-600")}>
      <td className="max-w-48 truncate py-1 pr-2" title={row.title}>
        {row.title}
        {row.accumulating && <span className="text-muted-foreground ml-1.5 text-xs">(pot)</span>}
      </td>
      <td className="px-2 py-1 text-right tabular-nums">{row.target === 0 ? <span className="text-muted-foreground/40">no target</span> : formatCents(row.target)}</td>
      <td className="px-2 py-1 text-right tabular-nums">{formatCents(row.total)}</td>
      <td className={cn("px-2 py-1 text-right tabular-nums", row.budgetRatio === null ? "text-muted-foreground/40" : over ? "text-destructive" : "text-green-600 dark:text-green-500")}>
        {row.budgetRatio === null ? "·" : formatSigned(row.budgetDelta)}
      </td>
      <td className="text-muted-foreground px-2 py-1 text-right tabular-nums">{row.budgetRatio === null ? "·" : formatPercent(ratio)}</td>
      <td className="px-2 py-1">
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-primary")} style={{ width: `${Math.min(1, ratio) * 100}%` }} />
        </div>
      </td>
    </tr>
  );
}
