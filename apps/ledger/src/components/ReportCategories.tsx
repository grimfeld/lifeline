import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCents } from "../domain/money";
import { CATEGORY_SORTS, categoryReport, groupReport, sortByMonth, stackedByMonth, topSlices, type CategoryReportRow } from "../domain/report";
import type { CategoryKind } from "../domain/types";
import { AXIS_TICK, ChartCard, ChartKey, Empty, GRID, LegendList, MoneyCell, MoneyTooltip, Segmented, SortHeader, formatAxis, formatPercent, sliceColor, type ReportData } from "./reportChrome";

/** How many bands the stack and the pie keep before the tail becomes "Other". */
const TOP_SLICES = 7;
const TOP_BANDS = 6;

type Breakdown = "category" | "group";
type StackMode = "amount" | "share";
type TableMode = "money" | "share";

/** Which column the matrix is sorted by: a named one, or `m:<index>` for a month. */
type TableSort = "name" | "group" | "total" | "average" | "share" | "change" | `m:${number}`;

/**
 * The Categories tab: where the window's money went. The same rows read four
 * ways — a share pie, a month-by-month stack, and a matrix that sorts by any
 * column, month columns included. The uncategorized inbox is a row like any
 * other, never quietly folded away.
 */
export function ReportCategories({ data }: { data: ReportData }) {
  const { months, transactions, categories, allocations } = data;
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [breakdown, setBreakdown] = useState<Breakdown>("category");
  const [stackMode, setStackMode] = useState<StackMode>("amount");
  const [tableMode, setTableMode] = useState<TableMode>("money");
  const [sort, setSort] = useState<TableSort>("total");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => categoryReport(transactions, categories, allocations, months, kind), [transactions, categories, allocations, months, kind]);
  const groups = useMemo(() => groupReport(rows, months), [rows, months]);
  const slices = useMemo(() => topSlices(breakdown === "category" ? rows : groups, TOP_SLICES), [breakdown, rows, groups]);
  const stack = useMemo(() => stackedByMonth(rows, months, TOP_BANDS), [rows, months]);
  const monthTotals = useMemo(() => months.map((_, i) => rows.reduce((s, r) => s + (r.perMonth[i] ?? 0), 0)), [rows, months]);
  const grand = monthTotals.reduce((s, v) => s + v, 0);

  const sorted = useMemo(() => {
    if (sort.startsWith("m:")) return sortByMonth(rows, Number(sort.slice(2)), direction);
    const sign = direction === "desc" ? 1 : -1;
    const key = sort === "name" ? "name" : sort === "group" ? "group" : sort === "average" ? "average-desc" : sort === "share" ? "share-desc" : sort === "change" ? "change-desc" : "total-desc";
    const cmp = CATEGORY_SORTS[key];
    // Name and group read A–Z ascending; the money columns read big-first descending.
    const alphabetical = sort === "name" || sort === "group";
    return [...rows].sort((a, b) => (alphabetical ? -sign : sign) * cmp(a, b));
  }, [rows, sort, direction]);

  function sortBy(next: TableSort) {
    if (next === sort) return setDirection((d) => (d === "desc" ? "asc" : "desc"));
    setSort(next);
    setDirection(next === "name" || next === "group" ? "asc" : "desc");
  }

  const kindToggle = (
    <Segmented
      value={kind}
      onChange={(k) => setKind(k)}
      options={[
        { value: "expense", label: "Spending" },
        { value: "income", label: "Income" },
      ]}
    />
  );

  if (months.length === 0) return <Empty height={160}>That window has no months in it — the range starts after it ends.</Empty>;

  return (
    <div className="grid gap-4">
      <ChartCard
        title={`${kind === "expense" ? "Spending" : "Income"} by ${breakdown}`}
        hint={grand > 0 ? `${formatCents(grand)} over ${months.length} month${months.length === 1 ? "" : "s"}` : undefined}
        right={
          <div className="flex flex-wrap items-center gap-2">
            {kindToggle}
            <Segmented
              value={breakdown}
              onChange={setBreakdown}
              options={[
                { value: "category", label: "Category" },
                { value: "group", label: "Group" },
              ]}
            />
          </div>
        }
      >
        {slices.length === 0 ? (
          <Empty>{kind === "expense" ? "No spending in this window." : "No income in this window."}</Empty>
        ) : (
          <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={slices.map((s) => ({ ...s, value: s.value / 100 }))} dataKey="value" nameKey="title" innerRadius="55%" outerRadius="85%" paddingAngle={1} stroke="var(--background)" strokeWidth={2}>
                  {slices.map((s, i) => (
                    <Cell key={s.id} fill={sliceColor(i)} />
                  ))}
                </Pie>
                <Tooltip content={<MoneyTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <LegendList className="max-w-md" items={slices.map((s, i) => ({ id: s.id, title: s.title, color: sliceColor(i), value: s.value, share: s.share }))} />
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="Month by month"
        hint={stackMode === "share" ? "Each month as 100% — what changed in the mix" : `The ${TOP_BANDS} biggest categories, everything else banded as Other`}
        right={
          <Segmented
            value={stackMode}
            onChange={setStackMode}
            options={[
              { value: "amount", label: "Amounts" },
              { value: "share", label: "Share" },
            ]}
          />
        }
      >
        {stack.keys.length === 0 ? (
          <Empty>Nothing to stack in this window.</Empty>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stack.data} stackOffset={stackMode === "share" ? "expand" : "none"} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={stackMode === "share" ? (v: number) => formatPercent(v) : formatAxis} />
                <Tooltip content={<MoneyTooltip total />} cursor={{ fill: "var(--chart-grid)", opacity: 0.3 }} />
                {stack.keys.map((k, i) => (
                  <Bar key={k.id} dataKey={k.id} name={k.title} stackId="a" fill={sliceColor(i)} radius={i === stack.keys.length - 1 ? [2, 2, 0, 0] : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <ChartKey items={stack.keys.map((k, i) => ({ id: k.id, label: k.title, color: sliceColor(i) }))} />
          </>
        )}
      </ChartCard>

      <ChartCard
        title="Category × month"
        hint="Click any column — a month included — to sort by it"
        right={
          <div className="flex flex-wrap items-center gap-2">
            {kindToggle}
            <Segmented
              value={tableMode}
              onChange={setTableMode}
              options={[
                { value: "money", label: "Amounts" },
                { value: "share", label: "% of month" },
              ]}
            />
          </div>
        }
      >
        {sorted.length === 0 ? (
          <Empty height={120}>Nothing recorded in this window.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs">
                  <SortHeader label="Category" active={sort === "name"} direction={direction} onSort={() => sortBy("name")} className="pr-2 pl-0 text-left" />
                  <SortHeader label="Group" active={sort === "group"} direction={direction} onSort={() => sortBy("group")} className="text-left" />
                  {months.map((m, i) => (
                    <SortHeader key={m} label={m.slice(2)} active={sort === `m:${i}`} direction={direction} onSort={() => sortBy(`m:${i}`)} className="text-right" title={`Sort by ${m}`} />
                  ))}
                  <SortHeader label="Total" active={sort === "total"} direction={direction} onSort={() => sortBy("total")} className="text-right" />
                  <SortHeader label="Avg" active={sort === "average"} direction={direction} onSort={() => sortBy("average")} className="text-right" title="Average per month of the window" />
                  <SortHeader label="Share" active={sort === "share"} direction={direction} onSort={() => sortBy("share")} className="text-right" />
                  <SortHeader label="Trend" active={sort === "change"} direction={direction} onSort={() => sortBy("change")} className="text-right" title="Latest active month against the monthly average" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <CategoryRow key={row.categoryId || "__uncategorized"} row={row} months={months} monthTotals={monthTotals} mode={tableMode} />
                ))}
                <tr className="border-t font-medium">
                  <td className="py-1 pr-2">Total</td>
                  <td />
                  {monthTotals.map((v, i) => (
                    <MoneyCell key={months[i]} cents={v} />
                  ))}
                  <td className="px-2 py-1 text-right tabular-nums">{formatCents(grand)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{formatCents(Math.round(grand / Math.max(1, months.length)))}</td>
                  <td className="px-2 py-1 text-right tabular-nums">100%</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function CategoryRow({ row, months, monthTotals, mode }: { row: CategoryReportRow; months: string[]; monthTotals: number[]; mode: TableMode }) {
  const uncategorized = row.categoryId === "";
  return (
    <tr className={`border-t ${uncategorized ? "text-amber-600" : ""}`}>
      <td className="max-w-48 truncate py-1 pr-2" title={row.title}>
        {row.title}
        {row.accumulating && <span className="text-muted-foreground ml-1.5 text-xs">(pot)</span>}
      </td>
      <td className="text-muted-foreground max-w-28 truncate px-2 py-1 text-xs">{row.group || "—"}</td>
      {months.map((m, i) => {
        const v = row.perMonth[i] ?? 0;
        if (mode === "money") return <MoneyCell key={m} cents={v} />;
        const share = monthTotals[i] > 0 ? v / monthTotals[i] : 0;
        return (
          <td key={m} className={`px-2 py-1 text-right tabular-nums ${v === 0 ? "text-muted-foreground/40" : ""}`}>
            {v === 0 ? "·" : formatPercent(share)}
          </td>
        );
      })}
      <td className="px-2 py-1 text-right font-medium tabular-nums">{formatCents(row.total)}</td>
      <td className="text-muted-foreground px-2 py-1 text-right tabular-nums">{formatCents(row.average)}</td>
      <td className="text-muted-foreground px-2 py-1 text-right tabular-nums">{formatPercent(row.share)}</td>
      <td className={`px-2 py-1 text-right tabular-nums ${row.change > 0 ? "text-destructive" : row.change < 0 ? "text-green-600 dark:text-green-500" : "text-muted-foreground/40"}`}>
        {row.change === 0 ? "·" : `${row.change > 0 ? "▲" : "▼"} ${formatCents(Math.abs(row.change))}`}
      </td>
    </tr>
  );
}
