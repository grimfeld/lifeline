import { useEffect, useState } from "react";
import { Button, COLOR_SLOTS, DatePicker, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TagInput, cn, colorVar, toast, type ColorSlot } from "@lifeline/ui";
import { addDays, todayStr, useTagVocabulary } from "@lifeline/core";
import { EMOJI_PRESETS, PERIOD_KINDS, PERIOD_LABEL, faceColor, faceOf, firstGrapheme, type Allowance, type PeriodKind } from "../domain/types";
import { Jar } from "./Jar";
import { allowanceTitle, endOf, normalizeFrom } from "../domain/period";
import { editAmount, formatCents, parseAmount } from "../domain/money";
import { addAllowance, deleteAllowance, updateAllowance } from "../data/repo";

/**
 * New / edit Allowance (ADR 0081): a name, a period kind, a day inside the
 * wanted period (snapped to its first day), the granted amount. The derived
 * title is previewed live so the period reads back before saving. Plus the
 * face: an emoji (typed, or one of a dozen chips) and a colour slot.
 */
export function AllowanceEditorDialog({ open, onOpenChange, allowance, spendCount = 0 }: { open: boolean; onOpenChange: (open: boolean) => void; allowance?: Allowance; spendCount?: number }) {
  const suggestions = useTagVocabulary().map((v) => v.tag);
  const [name, setName] = useState("");
  const [period, setPeriod] = useState<PeriodKind>("month");
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [amount, setAmount] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState<ColorSlot | "">("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(allowance?.name ?? "");
    setPeriod(allowance?.period ?? "month");
    setFrom(allowance?.from ?? todayStr());
    setTo(allowance?.period === "custom" ? allowance.to || allowance.from : addDays(todayStr(), 6));
    setAmount(allowance ? editAmount(allowance.amount) : "");
    setTags(allowance?.tags ?? []);
    setEmoji(allowance?.emoji ?? "");
    setColor(allowance?.color ?? "");
    setConfirmDelete(false);
  }, [open, allowance]);

  const snapped = from ? normalizeFrom(period, from) : "";
  const end = snapped ? endOf(period, snapped, period === "custom" ? to : undefined) : "";
  const preview = snapped ? allowanceTitle({ name: name.trim() || "Allowance", period, from: snapped, to: period === "custom" ? end : "" }) : "";

  async function save() {
    const cents = parseAmount(amount);
    if (cents === null || cents <= 0) return void toast.error("Amount must be above zero");
    const input = { name, period, from, to: period === "custom" ? to : undefined, amount: Math.abs(cents), emoji, color, tags };
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
                <SelectTrigger aria-label="Period">
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
              <DatePicker
                id="al-from"
                required
                value={from}
                onChange={(v) => {
                  setFrom(v);
                  // "To" can't fall before "From": it follows a From moved past it.
                  if (to < v) setTo(v);
                }}
              />
            </div>
            {period === "custom" ? (
              <div className="grid gap-2">
                <Label htmlFor="al-to">To</Label>
                <DatePicker id="al-to" required value={to} min={from} onChange={setTo} />
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
            <Label htmlFor="al-emoji">Face</Label>
            <div className="flex items-start gap-3">
              <div className="relative shrink-0">
                <Jar level={1} over={false} color={faceColor({ color })} />
                <span className="pointer-events-none absolute inset-x-0 top-[39px] text-center text-2xl leading-none">{faceOf({ name, emoji })}</span>
              </div>
              <div className="grid min-w-0 flex-1 gap-2">
                <Input id="al-emoji" value={emoji} onChange={(e) => setEmoji(firstGrapheme(e.target.value))} placeholder="🍕 — or the name's first letter" />
                <div className="flex flex-wrap gap-1">
                  {EMOJI_PRESETS.map((e) => (
                    <button key={e} type="button" aria-label={e} aria-pressed={emoji === e} onClick={() => setEmoji(emoji === e ? "" : e)} className={cn("hover:bg-accent size-8 rounded-md text-lg leading-none", emoji === e && "bg-accent ring-foreground/40 ring-1")}>
                      {e}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" aria-label="No colour" aria-pressed={color === ""} onClick={() => setColor("")} className={cn("text-muted-foreground size-7 rounded-full border-2 border-dashed text-xs transition-transform", color === "" ? "border-foreground scale-110" : "border-muted-foreground/50")}>
                    —
                  </button>
                  {COLOR_SLOTS.map((c) => (
                    <button key={c} type="button" aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)} className={cn("size-7 rounded-full border-2 transition-transform", color === c ? "border-foreground scale-110" : "border-transparent")} style={{ background: colorVar(c) }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
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
