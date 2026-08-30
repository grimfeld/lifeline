import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TagInput, toast } from "@lifeline/ui";
import { addDays, todayStr, useTagVocabulary } from "@lifeline/core";
import { PERIOD_KINDS, PERIOD_LABEL, type Allowance, type PeriodKind } from "../domain/types";
import { allowanceTitle, endOf, normalizeFrom } from "../domain/period";
import { editAmount, formatCents, parseAmount } from "../domain/money";
import { addAllowance, deleteAllowance, updateAllowance } from "../data/repo";

/**
 * New / edit Allowance (ADR 0037): a name, a period kind, a day inside the
 * wanted period (snapped to its first day), the granted amount. The derived
 * title is previewed live so the period reads back before saving.
 */
export function AllowanceEditorDialog({ open, onOpenChange, allowance, spendCount = 0 }: { open: boolean; onOpenChange: (open: boolean) => void; allowance?: Allowance; spendCount?: number }) {
  const suggestions = useTagVocabulary().map((v) => v.tag);
  const [name, setName] = useState("");
  const [period, setPeriod] = useState<PeriodKind>("month");
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [amount, setAmount] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(allowance?.name ?? "");
    setPeriod(allowance?.period ?? "month");
    setFrom(allowance?.from ?? todayStr());
    setTo(allowance?.period === "custom" ? allowance.to || allowance.from : addDays(todayStr(), 6));
    setAmount(allowance ? editAmount(allowance.amount) : "");
    setTags(allowance?.tags ?? []);
    setConfirmDelete(false);
  }, [open, allowance]);

  const snapped = from ? normalizeFrom(period, from) : "";
  const end = snapped ? endOf(period, snapped, period === "custom" ? to : undefined) : "";
  const preview = snapped ? allowanceTitle({ name: name.trim() || "Allowance", period, from: snapped, to: period === "custom" ? end : "" }) : "";

  async function save() {
    const cents = parseAmount(amount);
    if (cents === null || cents <= 0) return void toast.error("Amount must be above zero");
    const input = { name, period, from, to: period === "custom" ? to : undefined, amount: Math.abs(cents), tags };
    try {
      if (allowance) {
        await updateAllowance(allowance, input);
        toast.success("Allowance updated");
      } else {
        await addAllowance(input);
        toast.success(`${preview} · ${formatCents(Math.abs(cents))}`);
      }
    } catch (err) {
      return void toast.error((err as Error).message);
    }
    onOpenChange(false);
  }

  async function remove() {
    if (!allowance) return;
    if (!confirmDelete) return void setConfirmDelete(true);
    await deleteAllowance(allowance.id);
    toast.success(spendCount > 0 ? `Allowance and its ${spendCount} spend${spendCount === 1 ? "" : "s"} deleted` : "Allowance deleted");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{allowance ? "Edit allowance" : "New allowance"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="al-name">Name</Label>
            <Input id="al-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Eating out" autoFocus onKeyDown={(e) => e.key === "Enter" && void save()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="al-amount">Amount</Label>
              <Input id="al-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="300" inputMode="decimal" onKeyDown={(e) => e.key === "Enter" && void save()} />
            </div>
            <div className="grid gap-2">
              <Label>Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {PERIOD_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="al-from">{period === "custom" ? "From" : "A day in the period"}</Label>
              <Input id="al-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            {period === "custom" ? (
              <div className="grid gap-2">
                <Label htmlFor="al-to">To</Label>
                <Input id="al-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label>Runs</Label>
                <p className="text-muted-foreground pt-2 text-sm tabular-nums">
                  {snapped} → {end}
                </p>
              </div>
            )}
          </div>
          {preview && <p className="text-muted-foreground text-xs">Will be called “{preview}”.</p>}
          <div className="grid gap-2">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {allowance ? (
            <Button variant={confirmDelete ? "destructive" : "ghost"} onClick={() => void remove()}>
              {confirmDelete ? (spendCount > 0 ? `Delete with ${spendCount} spend${spendCount === 1 ? "" : "s"}` : "Really delete") : "Delete"}
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => void save()}>{allowance ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
