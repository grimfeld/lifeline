import { useEffect, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import { todayStr, type Weekday } from "@lifeline/core";
import type { RecurRule, Recurring } from "../domain/types";
import { editAmount, parseAmount } from "../domain/money";
import { addRecurring, deleteRecurring, updateRecurring, useAccounts, useCategories } from "../data/repo";

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

/** A Recurring transaction (ADR 0033): a standing definition whose Dues are confirmed, never auto-posted. */
export function RecurringEditorDialog({ open, onOpenChange, recurring }: { open: boolean; onOpenChange: (open: boolean) => void; recurring?: Recurring }) {
  const accounts = useAccounts().filter((a) => !a.archived);
  const categories = useCategories();
  const [payee, setPayee] = useState("");
  const [kind, setKind] = useState<Recurring["kind"]>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [ruleKind, setRuleKind] = useState<RecurRule["kind"]>("monthly");
  const [monthDay, setMonthDay] = useState("1");
  const [weekdays, setWeekdays] = useState<Weekday[]>([1]);
  const [yearMonth, setYearMonth] = useState("1");
  const [yearDay, setYearDay] = useState("1");
  const [startDate, setStartDate] = useState(todayStr());
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPayee(recurring?.payee ?? "");
    setKind(recurring?.kind ?? "expense");
    setAmount(recurring ? editAmount(recurring.amount) : "");
    setAccountId(recurring?.accountId ?? accounts[0]?.id ?? "");
    setCategoryId(recurring?.categoryId ?? "");
    const rule = recurring?.rule;
    setRuleKind(rule?.kind ?? "monthly");
    setMonthDay(rule?.kind === "monthly" ? String(rule.days[0] ?? 1) : "1");
    setWeekdays(rule?.kind === "weekly" ? rule.weekdays : [1]);
    setYearMonth(rule?.kind === "yearly" ? String(rule.dates[0]?.month ?? 1) : "1");
    setYearDay(rule?.kind === "yearly" ? String(rule.dates[0]?.day ?? 1) : "1");
    setStartDate(recurring?.startDate ?? todayStr());
    setPaused(recurring?.paused ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recurring]);

  async function submit() {
    if (!payee.trim()) return void toast.error("Payee required");
    const cents = parseAmount(amount);
    if (cents === null || cents <= 0) return void toast.error("Amount must be above zero");
    if (!accountId) return void toast.error("Pick an account");
    if (!categoryId) return void toast.error("Pick a category");
    let rule: RecurRule;
    if (ruleKind === "monthly") {
      const day = Math.min(31, Math.max(1, Number(monthDay) || 1));
      rule = { kind: "monthly", days: [day] };
    } else if (ruleKind === "weekly") {
      if (weekdays.length === 0) return void toast.error("Pick at least one weekday");
      rule = { kind: "weekly", weekdays };
    } else {
      rule = { kind: "yearly", dates: [{ month: Math.min(12, Math.max(1, Number(yearMonth) || 1)), day: Math.min(31, Math.max(1, Number(yearDay) || 1)) }] };
    }
    const input = { payee, kind, amount: cents, accountId, categoryId, rule, startDate, paused };
    if (recurring) {
      await updateRecurring(recurring, input);
      toast.success("Recurring updated");
    } else {
      await addRecurring(input);
      toast.success("Recurring added");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{recurring ? "Edit recurring" : "New recurring transaction"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="rec-payee">Payee</Label>
              <Input id="rec-payee" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="Landlord" autoFocus />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rec-amount">Amount</Label>
              <Input id="rec-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="900" inputMode="decimal" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Recurring["kind"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter((c) => c.kind === kind)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.group ? `${c.group} · ${c.title}` : c.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Repeats</Label>
              <Select value={ruleKind} onValueChange={(v) => setRuleKind(v as RecurRule["kind"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {ruleKind === "monthly" && (
              <div className="grid gap-2">
                <Label htmlFor="rec-day">Day of month</Label>
                <Input id="rec-day" type="number" min={1} max={31} value={monthDay} onChange={(e) => setMonthDay(e.target.value)} />
              </div>
            )}
            {ruleKind === "yearly" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="rec-ym">Month</Label>
                  <Input id="rec-ym" type="number" min={1} max={12} value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rec-yd">Day</Label>
                  <Input id="rec-yd" type="number" min={1} max={31} value={yearDay} onChange={(e) => setYearDay(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          {ruleKind === "weekly" && (
            <div className="flex flex-wrap gap-1">
              {WEEKDAYS.map((w) => (
                <Button key={w.value} size="sm" variant={weekdays.includes(w.value) ? "default" : "outline"} onClick={() => setWeekdays((cur) => (cur.includes(w.value) ? cur.filter((x) => x !== w.value) : [...cur, w.value]))}>
                  {w.label}
                </Button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="rec-start">From</Label>
              <Input id="rec-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Checkbox checked={paused} onCheckedChange={(v) => setPaused(v === true)} />
              Paused
            </label>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {recurring ? (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() =>
                void deleteRecurring(recurring.id).then(() => {
                  toast.success("Recurring deleted — posted transactions stay");
                  onOpenChange(false);
                })
              }
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()}>{recurring ? "Save" : "Add"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
