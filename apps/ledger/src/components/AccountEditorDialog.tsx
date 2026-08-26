import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import { ACCOUNT_FLAVORS, type AccountFlavor, type LedgerAccount } from "../domain/types";
import { editAmount, parseAmount } from "../domain/money";
import { addAccount, deleteAccount, setAccountArchived, updateAccount } from "../data/repo";

/** An Account (ADR 0033): balance derives from opening + Transactions; archive is the way out for a used one. */
export function AccountEditorDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (open: boolean) => void; account?: LedgerAccount }) {
  const [title, setTitle] = useState("");
  const [flavor, setFlavor] = useState<AccountFlavor>("checking");
  const [opening, setOpening] = useState("0");

  useEffect(() => {
    if (!open) return;
    setTitle(account?.title ?? "");
    setFlavor(account?.flavor ?? "checking");
    setOpening(account ? editAmount(account.openingBalance) : "0");
  }, [open, account]);

  async function submit() {
    if (!title.trim()) return void toast.error("Name required");
    const openingBalance = parseAmount(opening);
    if (openingBalance === null) return void toast.error("Opening balance must be a number");
    const input = { title, flavor, openingBalance };
    if (account) {
      await updateAccount(account, input);
      toast.success("Account updated");
    } else {
      await addAccount(input);
      toast.success("Account added");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "New account"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="acc-title">Name</Label>
            <Input id="acc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Checking" autoFocus onKeyDown={(e) => e.key === "Enter" && void submit()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Kind</Label>
              <Select value={flavor} onValueChange={(v) => setFlavor(v as AccountFlavor)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_FLAVORS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc-opening">Opening balance</Label>
              <Input id="acc-opening" value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="decimal" />
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {account ? (
            <div className="flex gap-1">
              <Button variant="ghost" onClick={() => void setAccountArchived(account.id, !account.archived).then(() => onOpenChange(false))}>
                {account.archived ? "Unarchive" : "Archive"}
              </Button>
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() =>
                  void deleteAccount(account.id)
                    .then(() => {
                      toast.success("Account deleted");
                      onOpenChange(false);
                    })
                    .catch((err: Error) => toast.error(err.message))
                }
              >
                Delete
              </Button>
            </div>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()}>{account ? "Save" : "Add account"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
