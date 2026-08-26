import { useMemo, useState } from "react";
import { Button, Card, CardContent, Input, toast } from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import { ChevronLeft, ChevronRight, PiggyBank, Plus } from "lucide-react";
import type { LedgerCategory, MonthStr } from "../domain/types";
import { budgetRows, formatMonth, incomeByCategory, monthAdd, targetFor, thisMonth, uncategorizedSpent, type BudgetRow } from "../domain/derive";
import { editAmount, formatCents, parseAmount } from "../domain/money";
import { setAllocation, useAllocations, useCategories, useTransactions } from "../data/repo";
import { CategoryEditorDialog } from "../components/CategoryEditorDialog";

/**
 * The Budget (ADR 0033): one month of policy over the fact ledger — target /
 * spent / available per expense Category, accumulating pots with their
 * balance, the uncategorized inbox loud, income summarised below. Editing a
 * number here writes an Allocation override for this month only.
 */
export function BudgetScreen() {
  const categories = useCategories();
  const allocations = useAllocations();
  const transactions = useTransactions();
  const [month, setMonth] = useState<MonthStr>(thisMonth(todayStr()));
  const [editing, setEditing] = useState<LedgerCategory | undefined>();
  const [addOpen, setAddOpen] = useState(false);

  const rows = useMemo(() => budgetRows(categories, allocations, transactions, month), [categories, allocations, transactions, month]);
  const inbox = uncategorizedSpent(transactions, month);
  const income = useMemo(() => incomeByCategory(transactions, month), [transactions, month]);
  const incomeCategories = categories.filter((c) => c.kind === "income");

  const groups = useMemo(() => {
    const out = new Map<string, BudgetRow[]>();
    for (const row of rows) {
      const g = row.category.group || "";
      out.set(g, [...(out.get(g) ?? []), row]);
    }
    return Array.from(out.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const totalTarget = rows.reduce((s, r) => s + r.target, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0) + inbox;
  const totalIncome = Array.from(income.values()).reduce((s, v) => s + v, 0);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4">
      <div className="flex items-center gap-2">
        <PiggyBank className="size-5" />
        <h1 className="flex-1 text-lg font-semibold">Budget</h1>
        <Button size="icon" variant="outline" className="size-8" onClick={() => setMonth((m) => monthAdd(m, -1))}>
          <ChevronLeft />
        </Button>
        <span className="w-40 text-center font-medium">{formatMonth(month)}</span>
        <Button size="icon" variant="outline" className="size-8" onClick={() => setMonth((m) => monthAdd(m, 1))}>
          <ChevronRight />
        </Button>
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          Income <span className="text-foreground font-medium tabular-nums">{formatCents(totalIncome)}</span>
        </span>
        <span>
          Spent <span className="text-foreground font-medium tabular-nums">{formatCents(totalSpent)}</span>
        </span>
        <span>
          Targets <span className="text-foreground font-medium tabular-nums">{formatCents(totalTarget)}</span>
        </span>
      </div>

      {inbox > 0 && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
          Uncategorized spending this month: <span className="font-medium tabular-nums">{formatCents(inbox)}</span> — categorize it in the Register, it counts nowhere yet.
        </div>
      )}

      {groups.map(([group, groupRows]) => (
        <div key={group} className="grid gap-1.5">
          {group && <h2 className="text-muted-foreground mt-1 text-xs font-semibold tracking-wide uppercase">{group}</h2>}
          {groupRows.map((row) => (
            <BudgetRowLine key={row.category.id} row={row} month={month} onEdit={() => setEditing(row.category)} />
          ))}
        </div>
      ))}
      {rows.length === 0 && <p className="text-muted-foreground text-sm">No expense categories yet — the Budget is a lens over them.</p>}

      <div>
        <Button variant="outline" onClick={() => setAddOpen(true)}>
          <Plus /> New category
        </Button>
      </div>

      {incomeCategories.length > 0 && (
        <div className="grid gap-1.5">
          <h2 className="text-muted-foreground mt-1 text-xs font-semibold tracking-wide uppercase">Income</h2>
          {incomeCategories.map((c) => (
            <button key={c.id} className="hover:bg-accent/50 flex items-center gap-3 rounded-md border px-3 py-2 text-left text-sm" onClick={() => setEditing(c)}>
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <span className="tabular-nums">{formatCents(income.get(c.id) ?? 0)}</span>
              {c.target > 0 && <span className="text-muted-foreground text-xs tabular-nums">expected {formatCents(c.target)}</span>}
            </button>
          ))}
        </div>
      )}

      <CategoryEditorDialog open={addOpen} onOpenChange={setAddOpen} />
      <CategoryEditorDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} category={editing} />
    </div>
  );
}

function BudgetRowLine({ row, month, onEdit }: { row: BudgetRow; month: MonthStr; onEdit: () => void }) {
  const allocations = useAllocations();
  const categories = useCategories();
  const [editingTarget, setEditingTarget] = useState(false);
  const [draft, setDraft] = useState("");
  const category = categories.find((c) => c.id === row.category.id) ?? row.category;
  const hasOverride = allocations.some((a) => a.categoryId === category.id && a.month === month);
  const over = row.available < 0;
  const ratio = row.target > 0 ? Math.min(1, row.spent / row.target) : row.spent > 0 ? 1 : 0;

  async function saveTarget() {
    setEditingTarget(false);
    const text = draft.trim();
    if (text === "") {
      // Cleared: drop this month's override, back to the standing target.
      await setAllocation(category.id, month, null, allocations);
      return;
    }
    const cents = parseAmount(text);
    if (cents === null || cents < 0) return void toast.error("Target must be a number");
    if (cents === targetFor(category, [], month) && !hasOverride) return; // same as standing — no override needed
    await setAllocation(category.id, month, cents, allocations);
    toast.success(`${category.title}: ${formatCents(cents)} for ${formatMonth(month)} only`);
  }

  return (
    <Card className="py-0">
      <CardContent className="grid gap-1 px-3 py-2">
        <div className="flex items-center gap-3 text-sm">
          <button className="min-w-0 flex-1 truncate text-left font-medium hover:underline" onClick={onEdit}>
            {category.title}
            {category.accumulating && <span className="text-muted-foreground ml-1.5 text-xs">(pot)</span>}
            {hasOverride && <span className="text-muted-foreground ml-1.5 text-xs">· this month only</span>}
          </button>
          <span className="text-muted-foreground text-xs tabular-nums">{formatCents(row.spent)} spent</span>
          {editingTarget ? (
            <Input
              className="h-7 w-24 text-right"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void saveTarget()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveTarget();
                if (e.key === "Escape") setEditingTarget(false);
              }}
              inputMode="decimal"
            />
          ) : (
            <button
              className="text-muted-foreground w-24 text-right text-xs tabular-nums hover:underline"
              onClick={() => {
                setDraft(row.target ? editAmount(row.target) : "");
                setEditingTarget(true);
              }}
            >
              of {formatCents(row.target)}
            </button>
          )}
          <span className={`w-24 shrink-0 text-right font-medium tabular-nums ${over ? "text-destructive" : "text-green-600 dark:text-green-500"}`}>{formatCents(row.available)}</span>
        </div>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div className={`h-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`} style={{ width: `${ratio * 100}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}
