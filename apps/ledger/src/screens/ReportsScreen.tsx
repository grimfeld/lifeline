import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import { ChartLine } from "lucide-react";
import { incomeByCategory, monthAdd, netWorth, spentByCategory, thisMonth } from "../domain/derive";
import { formatCents } from "../domain/money";
import { useAccounts, useCategories, useTransactions } from "../data/repo";

const MONTHS_SHOWN = 12;

/**
 * Thin Reports (ADR 0033): a category × month table over the last year, an
 * income vs spending line per month, and net worth over time — every number
 * derived from the ledger on the spot.
 */
export function ReportsScreen() {
  const transactions = useTransactions();
  const accounts = useAccounts();
  const categories = useCategories();

  const months = useMemo(() => {
    const end = thisMonth(todayStr());
    const out: string[] = [];
    for (let i = MONTHS_SHOWN - 1; i >= 0; i--) out.push(monthAdd(end, -i));
    return out;
  }, []);

  const spentPerMonth = useMemo(() => months.map((m) => spentByCategory(transactions, m)), [months, transactions]);
  const incomePerMonth = useMemo(() => months.map((m) => incomeByCategory(transactions, m)), [months, transactions]);

  const trend = useMemo(
    () =>
      months.map((m, i) => ({
        label: m.slice(2),
        income: Array.from(incomePerMonth[i].values()).reduce((s, v) => s + v, 0) / 100,
        spent: Array.from(spentPerMonth[i].values()).reduce((s, v) => s + v, 0) / 100,
        // Net worth as of the month's end — the last day covered by any month is fine as month+1's day 0.
        netWorth: netWorth(accounts, transactions, `${m}-31`) / 100,
      })),
    [months, incomePerMonth, spentPerMonth, accounts, transactions],
  );

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === "expense" && spentPerMonth.some((sp) => (sp.get(c.id) ?? 0) > 0)),
    [categories, spentPerMonth],
  );
  const hasUncategorized = spentPerMonth.some((sp) => (sp.get("") ?? 0) > 0);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 p-4">
      <div className="flex items-center gap-2">
        <ChartLine className="size-5" />
        <h1 className="text-lg font-semibold">Reports</h1>
      </div>

      <Card>
        <CardContent className="px-4 py-3">
          <h2 className="mb-2 text-sm font-medium">Income vs spending</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--chart-muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "var(--chart-muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
              <Tooltip formatter={(v) => formatCents(Math.round(Number(v) * 100))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
              <Line type="monotone" dataKey="income" stroke="var(--chart-green)" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="spent" stroke="var(--chart-red, #e5484d)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-4 py-3">
          <h2 className="mb-2 text-sm font-medium">Net worth</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--chart-muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "var(--chart-muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={64} domain={["auto", "auto"]} />
              <Tooltip formatter={(v) => formatCents(Math.round(Number(v) * 100))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
              <Line type="monotone" dataKey="netWorth" stroke="var(--chart-blue, #3b82f6)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-4 py-3">
          <h2 className="mb-2 text-sm font-medium">Spending by category</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs">
                  <th className="py-1 pr-2 text-left font-normal">Category</th>
                  {months.map((m) => (
                    <th key={m} className="px-2 py-1 text-right font-normal whitespace-nowrap">
                      {m.slice(2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenseCategories.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="max-w-40 truncate py-1 pr-2">{c.group ? `${c.group} · ${c.title}` : c.title}</td>
                    {spentPerMonth.map((sp, i) => {
                      const v = sp.get(c.id) ?? 0;
                      return (
                        <td key={months[i]} className={`px-2 py-1 text-right tabular-nums ${v === 0 ? "text-muted-foreground/40" : ""}`}>
                          {v === 0 ? "·" : formatCents(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {hasUncategorized && (
                  <tr className="border-t text-amber-600">
                    <td className="py-1 pr-2">Uncategorized</td>
                    {spentPerMonth.map((sp, i) => {
                      const v = sp.get("") ?? 0;
                      return (
                        <td key={months[i]} className="px-2 py-1 text-right tabular-nums">
                          {v === 0 ? "·" : formatCents(v)}
                        </td>
                      );
                    })}
                  </tr>
                )}
                {expenseCategories.length === 0 && !hasUncategorized && (
                  <tr>
                    <td colSpan={months.length + 1} className="text-muted-foreground py-4 text-center">
                      No spending recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
