import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { formatMonth } from "../domain/derive";
import { formatCents, formatSigned } from "../domain/money";
import { PAYEE_SORT_LABEL, balanceTrend, monthlyTotals, payeeReport, summarize, type PayeeSortKey } from "../domain/report";
import type { CategoryKind } from "../domain/types";
import {
  AXIS_TICK,
  ChartCard,
  ChartKey,
  Empty,
  GRID,
  INCOME_COLOR,
  MoneyTooltip,
  NET_COLOR,
  SPENT_COLOR,
  Segmented,
  StatTile,
  formatAxis,
  formatPercent,
  type ReportData,
} from "./reportChrome";

type FlowMode = "bars" | "lines" | "cumulative";

/**
 * The Overview tab: what the window did in five numbers, the flow of money
 * through it read three ways, where the balances ended up, and who the money
 * actually went to. Every chart reads the same filtered slice.
 */
export function ReportOverview({ data }: { data: ReportData }) {
  const { months, transactions, allTransactions, accounts, filter } = data;
  const [flow, setFlow] = useState<FlowMode>("bars");
  const [payeeKind, setPayeeKind] = useState<CategoryKind>("expense");
  const [payeeSort, setPayeeSort] = useState<PayeeSortKey>("total-desc");

  const totals = useMemo(() => monthlyTotals(transactions, months), [transactions, months]);
  const summary = useMemo(() => summarize(totals, transactions.length), [totals, transactions.length]);
  const balances = useMemo(() => balanceTrend(accounts, allTransactions, months, filter.accountIds), [accounts, allTransactions, months, filter.accountIds]);
  const payees = useMemo(() => payeeReport(transactions, payeeKind, payeeSort), [transactions, payeeKind, payeeSort]);

  const flowData = useMemo(
    () => totals.map((t) => ({ label: t.label, month: t.month, income: t.income / 100, spent: t.spent / 100, net: t.net / 100, cumulative: t.cumulative / 100 })),
    [totals],
  );
  const balanceData = useMemo(() => balances.map((b) => ({ label: b.label, balance: b.balance / 100 })), [balances]);
  const payeeData = useMemo(() => payees.slice(0, 10).map((p) => ({ payee: p.payee, value: p.total / 100, count: p.count })), [payees]);

  if (months.length === 0) return <Empty height={160}>That window has no months in it — the range starts after it ends.</Empty>;

  const balanceTitle = filter.accountIds.length > 0 ? `Balance · ${filter.accountIds.length} account${filter.accountIds.length === 1 ? "" : "s"}` : "Net worth";

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Income" value={formatCents(summary.income)} hint={`${formatCents(summary.averageIncome)} / month`} />
        <StatTile label="Spending" value={formatCents(summary.spent)} hint={`${formatCents(summary.averageSpent)} / month`} />
        <StatTile label="Net" value={formatSigned(summary.net)} tone={summary.net < 0 ? "bad" : "good"} hint={`over ${months.length} month${months.length === 1 ? "" : "s"}`} />
        <StatTile label="Savings rate" value={formatPercent(summary.savingsRate)} tone={summary.savingsRate < 0 ? "bad" : "plain"} hint={summary.income === 0 ? "no income in the window" : "of the income that came in"} />
        <StatTile
          label="Best month"
          value={summary.best ? formatSigned(summary.best.net) : "—"}
          hint={summary.best ? `${formatMonth(summary.best.month)} · worst ${summary.worst ? formatMonth(summary.worst.month) : "—"}` : undefined}
        />
      </div>

      <ChartCard
        title="Income vs spending"
        hint={flow === "cumulative" ? "What the window put by, running total" : "Per month, with the net on top"}
        right={
          <Segmented
            value={flow}
            onChange={setFlow}
            options={[
              { value: "bars", label: "Bars" },
              { value: "lines", label: "Lines" },
              { value: "cumulative", label: "Cumulative" },
            ]}
          />
        }
      >
        {flowData.length === 0 ? (
          <Empty>Nothing in this window.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            {flow === "bars" ? (
              <ComposedChart data={flowData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={formatAxis} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--chart-grid)", opacity: 0.3 }} />
                <ReferenceLine y={0} stroke="var(--chart-baseline)" />
                <Bar dataKey="income" name="Income" fill={INCOME_COLOR} radius={[2, 2, 0, 0]} />
                <Bar dataKey="spent" name="Spending" fill={SPENT_COLOR} radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="net" name="Net" stroke={NET_COLOR} dot={false} strokeWidth={2} />
              </ComposedChart>
            ) : flow === "lines" ? (
              <LineChart data={flowData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={formatAxis} />
                <Tooltip content={<MoneyTooltip />} />
                <Line type="monotone" dataKey="income" name="Income" stroke={INCOME_COLOR} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="spent" name="Spending" stroke={SPENT_COLOR} dot={false} strokeWidth={2} />
              </LineChart>
            ) : (
              <AreaChart data={flowData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={56} tickFormatter={formatAxis} />
                <Tooltip content={<MoneyTooltip />} />
                <ReferenceLine y={0} stroke="var(--chart-baseline)" />
                <Area type="monotone" dataKey="cumulative" name="Net, running" stroke={NET_COLOR} fill={NET_COLOR} fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        )}
        {flowData.length > 0 && (
          <ChartKey
            items={
              flow === "cumulative"
                ? [{ id: "cumulative", label: "Net, running total", color: NET_COLOR }]
                : [
                    { id: "income", label: "Income", color: INCOME_COLOR },
                    { id: "spent", label: "Spending", color: SPENT_COLOR },
                    ...(flow === "bars" ? [{ id: "net", label: "Net", color: NET_COLOR }] : []),
                  ]
            }
          />
        )}
      </ChartCard>

      <ChartCard title={balanceTitle} hint="Opening balances plus every movement, at each month's end — filters on categories say nothing here">
        {balanceData.length === 0 ? (
          <Empty>No accounts to weigh.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={balanceData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={64} domain={["auto", "auto"]} tickFormatter={formatAxis} />
              <Tooltip content={<MoneyTooltip />} />
              <ReferenceLine y={0} stroke="var(--chart-baseline)" />
              <Area type="monotone" dataKey="balance" name={balanceTitle} stroke={NET_COLOR} fill={NET_COLOR} fillOpacity={0.12} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard
        title="Top payees"
        hint={`Top ten, ranked by ${PAYEE_SORT_LABEL[payeeSort].toLowerCase()} — ${payees.length} payee${payees.length === 1 ? "" : "s"} in the window`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={payeeKind}
              onChange={setPayeeKind}
              options={[
                { value: "expense", label: "Spending" },
                { value: "income", label: "Income" },
              ]}
            />
            <Select value={payeeSort} onValueChange={(v) => setPayeeSort(v as PayeeSortKey)}>
       <SelectTrigger size="sm" aria-label="Sort payees by" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PAYEE_SORT_LABEL) as PayeeSortKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PAYEE_SORT_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {payeeData.length === 0 ? (
          <Empty>No payees in this window — imports and manual entries both carry one.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, payeeData.length * 28)}>
            <BarChart data={payeeData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatAxis} />
              <YAxis type="category" dataKey="payee" tick={AXIS_TICK} tickLine={false} axisLine={false} width={140} />
              <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--chart-grid)", opacity: 0.3 }} />
              <Bar dataKey="value" name={payeeKind === "expense" ? "Spent" : "Received"} fill={payeeKind === "expense" ? SPENT_COLOR : INCOME_COLOR} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
