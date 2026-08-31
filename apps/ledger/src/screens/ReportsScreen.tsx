import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import { ChartLine } from "lucide-react";
import type { MonthStr } from "../domain/types";
import { emptyFilter, filterTransactions, ledgerMonths, monthRange, resolveRange, type ReportFilter, type ReportRange } from "../domain/report";
import { useAccounts, useAllocations, useCategories, useTransactions } from "../data/repo";
import { ReportFilterBar } from "../components/ReportFilterBar";
import { ReportOverview } from "../components/ReportOverview";
import { ReportCategories } from "../components/ReportCategories";
import { ReportBudget } from "../components/ReportBudget";
import type { ReportData } from "../components/reportChrome";

/** What the screen opens on, and the window a "custom" range falls back to before it has ends of its own. */
const DEFAULT_RANGE: Exclude<ReportRange, "custom"> = "12m";

/**
 * Money reports (ADR 0033): one window over the fact ledger, one filter bar
 * that every tab reads, and three readings of the same slice — the flow of
 * the window (Overview), where it went (Categories), and how it held up
 * against the Budget's Targets (Budget). Every number is derived on the spot;
 * nothing on this screen is stored, and nothing here writes.
 */
export function ReportsScreen() {
  const transactions = useTransactions();
  const accounts = useAccounts();
  const categories = useCategories();
  const allocations = useAllocations();
  const today = todayStr();

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "overview";

  const [range, setRange] = useState<ReportRange>(DEFAULT_RANGE);
  /** Only used while the range is "custom" — a preset always recomputes from today. */
  const [customWindow, setCustomWindow] = useState<{ from: MonthStr; to: MonthStr } | null>(null);
  const [slice, setSlice] = useState<Omit<ReportFilter, "from" | "to">>(() => {
    const { from: _from, to: _to, ...rest } = emptyFilter("", "");
    return rest;
  });

  /** Every month the ledger touches — what "All time" spans and what the custom range picks from. */
  const availableMonths = useMemo(() => ledgerMonths(transactions), [transactions]);

  const window = useMemo(() => {
    if (range === "custom" && customWindow) return customWindow;
    // A preset is resolved on every read, so "All time" widens as the ledger loads and grows.
    const preset = range === "custom" ? DEFAULT_RANGE : range;
    return resolveRange(preset, today, availableMonths);
  }, [range, customWindow, today, availableMonths]);

  const filter = useMemo<ReportFilter>(() => ({ ...slice, ...window }), [slice, window]);
  const months = useMemo(() => monthRange(filter.from, filter.to), [filter.from, filter.to]);
  const filtered = useMemo(() => filterTransactions(transactions, filter, categories), [transactions, filter, categories]);

  const data: ReportData = useMemo(
    () => ({ filter, months, transactions: filtered, allTransactions: transactions, accounts, categories, allocations }),
    [filter, months, filtered, transactions, accounts, categories, allocations],
  );

  /** The bar edits the slice; the window's two ends belong to the range, which switches to custom when they are touched. */
  function onFilterChange(next: ReportFilter) {
    const { from, to, ...rest } = next;
    setSlice(rest);
    if (from !== filter.from || to !== filter.to) {
      setRange("custom");
      setCustomWindow({ from, to });
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 p-4">
      <div className="flex items-center gap-2">
        <ChartLine className="size-5" />
        <h1 className="text-lg font-semibold">Money reports</h1>
      </div>

      <ReportFilterBar
        filter={filter}
        onChange={onFilterChange}
        range={range}
        onRangeChange={(next, current) => {
          setRange(next);
          // Switching to custom keeps the window you were looking at, so nothing jumps.
          if (next === "custom") setCustomWindow(current ?? customWindow ?? null);
        }}
        accounts={accounts}
        categories={categories}
        ledgerMonths={availableMonths}
        matched={filtered.length}
      />

      <Tabs value={tab} onValueChange={(v) => setSearchParams(v === "overview" ? {} : { tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ReportOverview data={data} />
        </TabsContent>
        <TabsContent value="categories">
          <ReportCategories data={data} />
        </TabsContent>
        <TabsContent value="budget">
          <ReportBudget data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
