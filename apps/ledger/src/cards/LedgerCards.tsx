import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@lifeline/ui";
import { todayStr, type CardProps } from "@lifeline/core";
import { Plus } from "lucide-react";
import { BUDGET_HREF } from "../domain/types";
import { balanceOf, budgetRows, netWorth, uncategorizedSpent, thisMonth } from "../domain/derive";
import { formatCents } from "../domain/money";
import { openDues } from "../domain/recur";
import { useAccounts, useAllocations, useCategories, useSeries, useTransactions } from "../data/repo";
import { TransactionEditorDialog } from "../components/TransactionEditorDialog";
import { DuesList } from "../screens/RegisterScreen";

/** Quick add (capture): the entry form one tap away — the phone's way in. */
export function QuickAddCard(_props: CardProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-full items-center justify-center p-3">
      <Button onClick={() => setOpen(true)}>
        <Plus /> Add transaction
      </Button>
      <TransactionEditorDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

/** Every non-archived Account's derived balance, net worth on top. */
export function BalancesCard(_props: CardProps) {
  const accounts = useAccounts().filter((a) => !a.archived);
  const transactions = useTransactions();
  const total = netWorth(accounts, transactions);
  if (accounts.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center p-3 text-sm">No accounts yet.</div>;
  return (
    <div className="grid content-start gap-1 overflow-y-auto p-3">
      <div className="mb-1 flex items-baseline justify-between border-b pb-1">
        <span className="text-sm font-medium">Net worth</span>
        <span className={`font-semibold tabular-nums ${total < 0 ? "text-destructive" : ""}`}>{formatCents(total)}</span>
      </div>
      {accounts.map((a) => {
        const b = balanceOf(a, transactions);
        return (
          <div key={a.id} className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground min-w-0 flex-1 truncate">{a.title}</span>
            <span className={`tabular-nums ${b < 0 ? "text-destructive" : ""}`}>{formatCents(b)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** This month's Budget, compact: available per category, worst first; the inbox loud on top. */
export function BudgetMonthCard(_props: CardProps) {
  const navigate = useNavigate();
  const categories = useCategories();
  const allocations = useAllocations();
  const transactions = useTransactions();
  const month = thisMonth(todayStr());
  const rows = useMemo(
    () => budgetRows(categories, allocations, transactions, month).filter((r) => r.target > 0 || r.spent > 0 || (r.pot ?? 0) !== 0).sort((a, b) => a.available - b.available),
    [categories, allocations, transactions, month],
  );
  const inbox = uncategorizedSpent(transactions, month);
  if (rows.length === 0 && inbox === 0) return <div className="text-muted-foreground flex h-full items-center justify-center p-3 text-sm">No budget activity this month.</div>;
  return (
    <div className="grid content-start gap-1 overflow-y-auto p-2">
      {inbox > 0 && (
        <button className="rounded-sm bg-amber-500/10 px-2 py-1 text-left text-xs text-amber-600" onClick={() => navigate(BUDGET_HREF)}>
          Uncategorized: {formatCents(inbox)}
        </button>
      )}
      {rows.map((r) => {
        const ratio = r.target > 0 ? Math.min(1, r.spent / r.target) : r.spent > 0 ? 1 : 0;
        return (
          <button key={r.category.id} className="hover:bg-accent/50 grid gap-0.5 rounded-sm px-2 py-1 text-left" onClick={() => navigate(BUDGET_HREF)}>
            <div className="flex items-baseline gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{r.category.title}</span>
              <span className={`text-xs tabular-nums ${r.available < 0 ? "text-destructive" : "text-muted-foreground"}`}>{formatCents(r.available)}</span>
            </div>
            <div className="bg-muted h-1 overflow-hidden rounded-full">
              <div className={`h-full ${r.available < 0 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${ratio * 100}%` }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Open Dues with confirm buttons — the forecast is this list (ADR 0033), read off the ledger (ADR 0034). */
export function DuesCard(_props: CardProps) {
  const series = useSeries();
  const today = todayStr();
  const dues = useMemo(() => openDues(series, today), [series, today]);
  return <DuesList dues={dues} today={today} compact />;
}
