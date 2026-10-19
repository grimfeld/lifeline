import { useMemo } from "react";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@lifeline/ui";
import { ChevronDown, FilterX, Inbox, Search } from "lucide-react";
import type { LedgerAccount, LedgerCategory, MonthStr } from "../domain/types";
import { formatMonth } from "../domain/derive";
import { formatCents } from "../domain/money";
import { RANGE_LABEL, REPORT_RANGES, activeFilterCount, type ReportFilter, type ReportRange } from "../domain/report";
import { categoryLabel } from "./reportChrome";

/** The noise floors the bar offers, in cents — a report of the big movements is a different report. */
const MIN_AMOUNTS = [0, 1_000, 2_500, 5_000, 10_000, 50_000];

interface MultiOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * A checkbox dropdown that stays open while you tick: nothing ticked means
 * everything, which is why the trigger says "All …" rather than "0 selected".
 */
function MultiSelect({ allLabel, options, selected, onChange, width = "w-44" }: { allLabel: string; options: MultiOption[]; selected: string[]; onChange: (next: string[]) => void; width?: string }) {
  const label = selected.length === 0 ? allLabel : selected.length === 1 ? (options.find((o) => o.value === selected[0])?.label ?? allLabel) : `${selected.length} selected`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn("justify-between font-normal", width, selected.length > 0 && "border-primary/50")}>
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
        <DropdownMenuLabel>{allLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.length === 0 && <DropdownMenuItem disabled>Nothing to filter by yet</DropdownMenuItem>}
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={selected.includes(o.value)}
            // Keep the menu open: picking three categories should not cost three trips.
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(on) => onChange(on ? [...selected, o.value] : selected.filter((v) => v !== o.value))}
          >
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.hint && <span className="text-muted-foreground ml-2 text-xs">{o.hint}</span>}
          </DropdownMenuCheckboxItem>
        ))}
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange([])}>Clear</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The one filter bar above every Reports tab (ADR 0033): a month window —
 * preset or hand-picked — and the slice inside it. Every chart on the screen
 * reads the same slice, so what a number means never depends on which tab
 * it is on.
 */
export function ReportFilterBar({
  filter,
  onChange,
  range,
  onRangeChange,
  accounts,
  categories,
  ledgerMonths,
  matched,
}: {
  filter: ReportFilter;
  onChange: (next: ReportFilter) => void;
  range: ReportRange;
  onRangeChange: (next: ReportRange, window?: { from: MonthStr; to: MonthStr }) => void;
  accounts: LedgerAccount[];
  categories: LedgerCategory[];
  ledgerMonths: MonthStr[];
  /** How many Transactions the slice holds — the bar's own receipt. */
  matched: number;
}) {
  const active = activeFilterCount(filter);
  const groups = useMemo(() => Array.from(new Set(categories.map((c) => c.group ?? ""))).sort(), [categories]);
  /** The custom window's month options: everything the ledger touches, plus the window's own ends. */
  const monthOptions = useMemo(() => Array.from(new Set([...ledgerMonths, filter.from, filter.to])).sort().reverse(), [ledgerMonths, filter.from, filter.to]);

  function set(patch: Partial<ReportFilter>) {
    onChange({ ...filter, ...patch });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 max-md:flex-col max-md:items-stretch max-md:*:w-full">
        <Select value={range} onValueChange={(v) => onRangeChange(v as ReportRange, { from: filter.from, to: filter.to })}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_RANGES.map((r) => (
              <SelectItem key={r} value={r}>
                {RANGE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {range === "custom" ? (
          <div className="flex items-center gap-1">
            <Select value={filter.from} onValueChange={(v) => set({ from: v })}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMonth(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground text-sm">→</span>
            <Select value={filter.to} onValueChange={(v) => set({ to: v })}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMonth(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">
            {formatMonth(filter.from)} → {formatMonth(filter.to)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 max-md:flex-col max-md:items-stretch max-md:*:w-full">
        <MultiSelect
          allLabel="All accounts"
          options={accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.title, hint: a.flavor }))}
          selected={filter.accountIds}
          onChange={(accountIds) => set({ accountIds })}
        />
        <MultiSelect allLabel="All groups" options={groups.map((g) => ({ value: g, label: g || "Ungrouped" }))} selected={filter.groups} onChange={(next) => set({ groups: next })} />
        <MultiSelect
          allLabel="All categories"
          options={categories.map((c) => ({ value: c.id, label: categoryLabel(c), hint: c.kind === "income" ? "income" : undefined }))}
          selected={filter.categoryIds}
          onChange={(categoryIds) => set({ categoryIds })}
          width="w-48"
        />
        <Select value={String(filter.minAmount)} onValueChange={(v) => set({ minAmount: Number(v) })}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MIN_AMOUNTS.map((cents) => (
              <SelectItem key={cents} value={String(cents)}>
                {cents === 0 ? "Any amount" : `From ${formatCents(cents)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={filter.includeUncategorized ? "outline" : "default"}
          onClick={() => set({ includeUncategorized: !filter.includeUncategorized })}
          aria-pressed={!filter.includeUncategorized}
          title="The import inbox counts in these charts unless you take it out"
        >
          <Inbox /> {filter.includeUncategorized ? "Inbox counted" : "Inbox excluded"}
        </Button>
        <div className="relative min-w-48 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input className="pl-8" placeholder="Payee or note…" value={filter.search} onChange={(e) => set({ search: e.target.value })} />
        </div>
        {active > 0 && (
          <Button variant="ghost" onClick={() => set({ accountIds: [], groups: [], categoryIds: [], includeUncategorized: true, minAmount: 0, search: "" })}>
            <FilterX /> Clear
            <Badge variant="secondary" className="ml-1 px-1.5">
              {active}
            </Badge>
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {matched} transaction{matched === 1 ? "" : "s"} in the window{active > 0 ? " after filters" : ""}.
      </p>
    </div>
  );
}
