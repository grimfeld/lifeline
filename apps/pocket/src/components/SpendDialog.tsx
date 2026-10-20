import { useEffect, useMemo, useState } from "react";
import { Button, DatePicker, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import { initialNumber, initialText, todayStr } from "@lifeline/core";
import { faceOf, type Spend } from "../domain/types";
import { allowanceRows, sortRows } from "../domain/derive";
import { allowanceFor } from "../domain/spend";
import { editAmount, formatCents, parseAmount } from "../domain/money";
import { addSpend, deleteSpend, updateSpend, useAllowances, useSpends } from "../data/repo";

const BUCKET_TITLE = { current: "Current", upcoming: "Upcoming", past: "Past" } as const;

/**
 * The capture form (ADR 0081): pick an Allowance (current ones first),
 * type an amount, done. Day defaults to today and is free; the label is
 * optional. "Save & add another" keeps the Allowance and day.
 */
export function SpendDialog({ open, onOpenChange, spend, allowanceId, initial }: { open: boolean; onOpenChange: (open: boolean) => void; /** Present = edit mode. */ spend?: Spend; /** Preselect (a Card tap). */ allowanceId?: string; /** The palette's inline line (CommandDialogProps.initial). */ initial?: Record<string, unknown> }) {
  const allowances = useAllowances();
  const spends = useSpends();
  const today = todayStr();
  const rows = useMemo(() => sortRows(allowanceRows(allowances, spends, today)), [allowances, spends, today]);

  const [pick, setPick] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    // The line names an Allowance by id or by name (the one whose period covers the day, else the first of that name).
    const named = initialText(initial, "allowance");
    const day = initialText(initial, "date") || todayStr();
    let fromLine: string | undefined;
    if (named) {
      try {
        fromLine = allowanceFor(named, rows.map((r) => r.allowance), day).id;
      } catch {
        fromLine = undefined; // none, or several: the picker is left for the person to settle
      }
    }
    setPick(spend?.allowanceId ?? fromLine ?? allowanceId ?? rows.find((r) => r.bucket === "current")?.allowance.id ?? rows[0]?.allowance.id ?? "");
    const typed = initialNumber(initial, "amount");
    setAmount(spend ? editAmount(spend.amount) : typed === undefined ? "" : String(typed));
    setDate(spend?.date ?? day);
    setLabel(spend?.label ?? initialText(initial, "label"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, spend, allowanceId, initial, rows.length === 0]);

  const picked = rows.find((r) => r.allowance.id === pick);
  const cents = parseAmount(amount);
  const after = picked && cents !== null && cents > 0 ? picked.left - Math.abs(cents) + (spend && spend.allowanceId === pick ? spend.amount : 0) : null;

  async function save(addAnother: boolean) {
    if (cents === null || cents <= 0) return void toast.error("Amount must be above zero");
    const input = { allowanceId: pick, amount: Math.abs(cents), date, label };
    try {
      if (spend) {
        await updateSpend(spend, input);
        toast.success("Spend updated");
      } else {
        await addSpend(input);
        toast.success(after !== null && picked ? `${picked.allowance.name}: ${formatCents(after)} left` : "Spend added");
      }
    } catch (err) {
      return void toast.error((err as Error).message);
    }
    if (addAnother) {
      setAmount("");
      setLabel("");
    } else onOpenChange(false);
  }

  async function remove() {
    if (!spend) return;
    await deleteSpend(spend.id);
    toast.success("Spend deleted");
    onOpenChange(false);
  }

  const groups = (["current", "upcoming", "past"] as const).map((b) => ({ bucket: b, rows: rows.filter((r) => r.bucket === b) })).filter((g) => g.rows.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{spend ? "Edit spend" : "Spend"}</DialogTitle>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No allowances yet — make one in Pocket first.</p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Allowance</Label>
              <Select value={pick} onValueChange={setPick}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick an allowance" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectGroup key={g.bucket}>
                      <SelectLabel>{BUCKET_TITLE[g.bucket]}</SelectLabel>
                      {g.rows.map((r) => (
                        <SelectItem key={r.allowance.id} value={r.allowance.id}>
                          {faceOf(r.allowance)} {r.allowance.title} — {formatCents(r.left)} left
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="sp-amount">Amount</Label>
                <Input id="sp-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="12,50" inputMode="decimal" autoFocus onKeyDown={(e) => e.key === "Enter" && void save(false)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sp-date">Day</Label>
                <DatePicker id="sp-date" required value={date} onChange={setDate} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sp-label">Label</Label>
              <Input id="sp-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="lunch" onKeyDown={(e) => e.key === "Enter" && void save(false)} />
            </div>
            {picked && (
              <p className={`text-xs tabular-nums ${after !== null && after < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {formatCents(picked.left)} left{after !== null ? ` → ${formatCents(after)} after this` : ""}
              </p>
            )}
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {spend ? (
            <Button variant="ghost" onClick={() => void remove()}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {!spend && rows.length > 0 && (
              <Button variant="outline" onClick={() => void save(true)}>
                Save & add another
              </Button>
            )}
            <Button onClick={() => void save(false)} disabled={rows.length === 0}>
              {spend ? "Save" : "Spend"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
