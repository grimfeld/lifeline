import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, toast } from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import type { LedgerAccount } from "../domain/types";
import { formatCents, formatSigned, parseAmount } from "../domain/money";
import { reconcile } from "../data/repo";

/**
 * Reconcile (ADR 0033): type the real bank balance; the gap becomes an
 * adjustment Transaction — drift recorded, never hidden. A visible pile of
 * adjustments tells you how leaky the tracking is.
 */
export function ReconcileDialog({ open, onOpenChange, account, currentBalance }: { open: boolean; onOpenChange: (open: boolean) => void; account: LedgerAccount; currentBalance: number }) {
  const [actual, setActual] = useState("");

  useEffect(() => {
    if (open) setActual("");
  }, [open]);

  const parsed = parseAmount(actual);
  const gap = parsed === null ? null : parsed - currentBalance;

  async function submit() {
    if (parsed === null) return void toast.error("Balance must be a number");
    const id = await reconcile(account, parsed, currentBalance, todayStr());
    toast.success(id ? `Adjusted by ${formatSigned(gap!)}` : "Nothing to adjust — balances agree");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reconcile {account.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <p className="text-muted-foreground text-sm">
            The ledger says <span className="text-foreground font-medium tabular-nums">{formatCents(currentBalance)}</span>. What does the bank say?
          </p>
          <div className="grid gap-2">
            <Label htmlFor="rec-actual">Actual balance</Label>
            <Input id="rec-actual" value={actual} onChange={(e) => setActual(e.target.value)} inputMode="decimal" autoFocus onKeyDown={(e) => e.key === "Enter" && void submit()} />
          </div>
          {gap !== null && gap !== 0 && (
            <p className="text-sm">
              Writes an adjustment of <span className="font-medium tabular-nums">{formatSigned(gap)}</span> — category-less, excluded from reports.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>Reconcile</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
