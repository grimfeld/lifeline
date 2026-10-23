import type { ReactNode } from "react";
import { Button, COLOR_SLOTS, Card, CardContent, colorVar, cn } from "@lifeline/ui";
import type { Allocation, LedgerAccount, LedgerCategory, MonthStr, Transaction } from "../domain/types";
import type { ReportFilter } from "../domain/report";
import { formatCents } from "../domain/money";

/**
 * The Reports screen's shared furniture: the one slice every tab reads, the
 * palette the charts paint with, and the small pieces (tiles, chart cards,
 * tooltips, sortable headers) each tab repeats. Chart data is in *units* —
 * cents / 100, because Recharts axes think in numbers — while every number
 * that comes out of the domain stays integer cents to the last moment.
 */

/** What the filter bar produced, handed to every tab whole. */
export interface ReportData {
  filter: ReportFilter;
  /** The window's months, oldest first. */
  months: MonthStr[];
  /** The filtered slice — what the charts read. */
  transactions: Transaction[];
  /** The unfiltered ledger — balances need every movement, whatever it was for. */
  allTransactions: Transaction[];
  accounts: LedgerAccount[];
  categories: LedgerCategory[];
  allocations: Allocation[];
}

export const AXIS_TICK = { fill: "var(--chart-muted)", fontSize: 11 };
export const GRID = { stroke: "var(--chart-grid)", vertical: false };

export const INCOME_COLOR = "var(--chart-green)";
export const SPENT_COLOR = "var(--chart-red)";
export const NET_COLOR = "var(--chart-blue)";
export const TARGET_COLOR = "var(--chart-violet)";

/** The eight theme slots, cycled — a Category takes the colour of its rank, so the pie and the stack agree. */
export function sliceColor(i: number): string {
  return colorVar(COLOR_SLOTS[i % COLOR_SLOTS.length]!);
}

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

/** Axis labels in units: "1.2K" beats "1234.56" on a 56px gutter. */
export function formatAxis(v: number): string {
  return compact.format(v);
}

/** Units (what the charts hold) back to the cents the ledger speaks. */
export function unitsToCents(v: number | string | undefined): number {
  return Math.round(Number(v ?? 0) * 100);
}

export function formatUnits(v: number | string | undefined): string {
  return formatCents(unitsToCents(v));
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** A Category as it reads on one line: "Living · Groceries". */
export function categoryLabel(c: { group?: string; title: string }): string {
  return c.group ? `${c.group} · ${c.title}` : c.title;
}

export function ChartCard({ title, hint, right, children }: { title: string; hint?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="grid gap-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium">{title}</h2>
            {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
          </div>
          {right}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** The small button group a chart wears to change how it reads the same numbers. */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <Button key={o.value} size="sm" variant={value === o.value ? "default" : "ghost"} className="h-7" onClick={() => onChange(o.value)} aria-pressed={value === o.value}>
          {o.label}
        </Button>
      ))}
    </div>
  );
}

export function Empty({ children, height = 220 }: { children: string; height?: number }) {
  return (
    <div className="text-muted-foreground flex items-center justify-center text-sm" style={{ height }}>
      {children}
    </div>
  );
}

/** One headline number over the window. */
export function StatTile({ label, value, hint, tone = "plain" }: { label: string; value: string; hint?: string; tone?: "plain" | "good" | "bad" }) {
  return (
    <Card className="py-0">
      <CardContent className="grid gap-0.5 px-3 py-2">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className={cn("text-lg font-semibold tabular-nums", tone === "good" && "text-green-600 dark:text-green-500", tone === "bad" && "text-destructive")}>{value}</span>
        {hint && <span className="text-muted-foreground truncate text-xs">{hint}</span>}
      </CardContent>
    </Card>
  );
}

export interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

/**
 * One tooltip for every chart on the screen: the point's label, then a line
 * per series in its own colour, values back in real money. Totals are shown
 * for stacks, where the sum is the question being asked.
 */
export function MoneyTooltip({ active, payload, label, total }: { active?: boolean; payload?: TooltipEntry[]; label?: string | number; total?: boolean }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => Number(p.value) !== 0);
  const sum = payload.reduce((s, p) => s + Number(p.value ?? 0), 0);
  return (
    <div className="bg-popover text-popover-foreground grid gap-0.5 rounded-md border px-2 py-1.5 text-xs shadow-md">
      <div className="text-muted-foreground">{label}</div>
      {(rows.length > 0 ? rows : payload.slice(0, 1)).map((p, i) => (
        <div key={`${p.dataKey}-${i}`} className="flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
          <span className="min-w-0 flex-1 truncate">{p.name}</span>
          <span className="font-medium tabular-nums">{formatUnits(p.value)}</span>
        </div>
      ))}
      {total && payload.length > 1 && (
        <div className="mt-0.5 flex items-center gap-3 border-t pt-0.5">
          <span className="text-muted-foreground min-w-0 flex-1">Total</span>
          <span className="font-medium tabular-nums">{formatUnits(sum)}</span>
        </div>
      )}
    </div>
  );
}

/** The flat key under a chart: which colour is which series. */
export function ChartKey({ items }: { items: { id: string; label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-1.5">
          <span className={cn("h-2.5 w-2.5 rounded-sm", it.dashed && "h-0.5 w-3 rounded-none")} style={{ background: it.color, opacity: it.dashed ? 0.8 : 1 }} />
          <span className="truncate">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** A legend that is also a reading: colour, name, amount, share. */
export function LegendList({ items, className }: { items: { id: string; title: string; color: string; value: number; share: number }[]; className?: string }) {
  return (
    <ul className={cn("grid gap-1 text-xs", className)}>
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-sm" style={{ background: it.color }} />
          <span className="min-w-0 flex-1 truncate">{it.title}</span>
          <span className="tabular-nums">{formatCents(it.value)}</span>
          <span className="text-muted-foreground w-9 text-right tabular-nums">{formatPercent(it.share)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A sortable table header: click to sort by this column, click again to turn
 * it round. The active column carries the arrow, so the table always says
 * what it is sorted by.
 */
export function SortHeader({
  label,
  active,
  direction,
  onSort,
  className,
  title,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onSort: () => void;
  className?: string;
  title?: string;
}) {
  return (
    <th className={cn("px-2 py-1 font-normal whitespace-nowrap", className)}>
      <button className={cn("hover:text-foreground inline-flex items-center gap-1", active && "text-foreground font-medium")} onClick={onSort} title={title ?? `Sort by ${label}`}>
        {label}
        <span className={cn("text-[10px]", active ? "opacity-100" : "opacity-0")}>{direction === "desc" ? "▼" : "▲"}</span>
      </button>
    </th>
  );
}

/** A cell that says "nothing here" quietly rather than printing €0.00 a hundred times. */
export function MoneyCell({ cents, className }: { cents: number; className?: string }) {
  return <td className={cn("px-2 py-1 text-right tabular-nums", cents === 0 && "text-muted-foreground/40", className)}>{cents === 0 ? "·" : formatCents(cents)}</td>;
}
