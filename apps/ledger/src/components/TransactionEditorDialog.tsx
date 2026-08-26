import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TagInput, Tabs, TabsList, TabsTrigger, Textarea, toast } from "@lifeline/ui";
import { normalizeTag, todayStr, useTagVocabulary } from "@lifeline/core";
import { KIND_LABEL, type LedgerAccount, type Transaction, type TransactionKind } from "../domain/types";
import { payeeIndex, transferCounterparts } from "../domain/derive";
import { editAmount, formatCents, parseAmount } from "../domain/money";
import { addTransaction, deleteTransaction, mergeIntoTransfer, updateTransaction, useAccounts, useCategories, useTransactions } from "../data/repo";

const KINDS: TransactionKind[] = ["expense", "income", "transfer"];

/**
 * The entry form (ADR 0033). Entry speed is the whole game: payee
 * autocomplete from ledger history prefills category, account and amount
 * from that payee's last Transaction. "Save & add another" is the split
 * helper — a receipt across two Categories is two Transactions.
 */
export function TransactionEditorDialog({
  open,
  onOpenChange,
  transaction,
  initialKind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  transaction?: Transaction;
  initialKind?: TransactionKind;
}) {
  const accounts = useAccounts().filter((a) => !a.archived || a.id === transaction?.accountId);
  const categories = useCategories();
  const transactions = useTransactions();
  const suggestions = useTagVocabulary().map((v) => v.tag);
  const payees = useMemo(() => payeeIndex(transactions), [transactions]);

  const [kind, setKind] = useState<TransactionKind>("expense");
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [payee, setPayee] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [mergeCounterpartId, setMergeCounterpartId] = useState("");

  useEffect(() => {
    if (!open) return;
    setKind(transaction?.kind ?? initialKind ?? "expense");
    setDate(transaction?.date ?? todayStr());
    setAmount(transaction ? editAmount(transaction.amount) : "");
    setAccountId(transaction?.accountId ?? accounts[0]?.id ?? "");
    setFromAccountId(transaction?.fromAccountId || transaction?.accountId || accounts[0]?.id || "");
    setToAccountId(transaction?.toAccountId ?? "");
    setCategoryId(transaction?.categoryId ?? "");
    setPayee(transaction?.payee ?? "");
    setNote(transaction?.note ?? "");
    setTags(transaction?.tags ?? []);
    setMergeCounterpartId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction, initialKind]);

  /** Picking a known payee prefills the rest of the form from its last Transaction. */
  function pickPayee(text: string) {
    setPayee(text);
    const hit = payees.find((p) => p.payee.toLowerCase() === text.trim().toLowerCase());
    if (!hit || transaction) return;
    if (kind !== "transfer") setKind(hit.kind);
    if (!categoryId) setCategoryId(hit.categoryId);
    setAccountId((cur) => cur || hit.accountId);
    setAmount((cur) => cur || editAmount(hit.amount));
  }

  /** Re-kinding an imported row to transfer may have its other side in the ledger too (ADR 0033). */
  const counterparts = useMemo(() => {
    if (!transaction || kind !== "transfer" || transaction.kind === "transfer") return [];
    return transferCounterparts(transaction.kind === "income" ? { ...transaction, kind: "expense" } : transaction, transactions).filter((t) => t.kind !== transaction.kind);
  }, [transaction, kind, transactions]);

  const catsOf = (k: TransactionKind) => categories.filter((c) => c.kind === (k === "income" ? "income" : "expense"));

  async function save(addAnother: boolean) {
    const cents = parseAmount(amount);
    if (cents === null || cents <= 0) return void toast.error("Amount must be above zero");
    if ((kind === "expense" || kind === "income") && !categoryId && !transaction?.importId) return void toast.error("Pick a category");
    const input = {
      kind,
      date,
      amount: Math.abs(cents),
      accountId,
      fromAccountId,
      toAccountId,
      categoryId: kind === "transfer" ? "" : categoryId,
      payee,
      note,
      tags,
    };
    try {
      if (transaction) {
        if (kind === "transfer" && mergeCounterpartId) {
          const counterpart = transactions.find((t) => t.id === mergeCounterpartId);
          if (counterpart) {
            const out = transaction.kind === "expense" ? transaction : counterpart;
            const inn = transaction.kind === "expense" ? counterpart : transaction;
            await mergeIntoTransfer(out, inn);
            toast.success("Merged into one transfer");
            onOpenChange(false);
            return;
          }
        }
        await updateTransaction(transaction, input);
        toast.success("Transaction updated");
      } else {
        await addTransaction(input);
        toast.success(`${KIND_LABEL[kind]} added`);
      }
    } catch (err) {
      return void toast.error((err as Error).message);
    }
    if (addAnother) {
      // Split helper: keep day, account and payee; clear amount and category for the next line.
      setAmount("");
      setCategoryId("");
      setNote("");
    } else onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{transaction ? "Edit transaction" : "Add transaction"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Tabs value={kind === "adjustment" ? "expense" : kind} onValueChange={(v) => setKind(v as TransactionKind)}>
            <TabsList className="w-full">
              {KINDS.map((k) => (
                <TabsTrigger key={k} value={k} className="flex-1" disabled={kind === "adjustment"}>
                  {KIND_LABEL[k]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {kind === "adjustment" && <p className="text-muted-foreground text-xs">An adjustment — made by reconciling, category-less, excluded from reports.</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="tx-amount">Amount</Label>
              <Input id="tx-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="12,50" inputMode="decimal" autoFocus onKeyDown={(e) => e.key === "Enter" && void save(false)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tx-date">Day</Label>
              <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          {kind !== "transfer" && (
            <div className="grid gap-2">
              <Label htmlFor="tx-payee">Payee</Label>
              <Input id="tx-payee" value={payee} onChange={(e) => pickPayee(e.target.value)} placeholder="Albert Heijn" list="ledger-payees" />
              <datalist id="ledger-payees">
                {payees.map((p) => (
                  <option key={p.payee} value={p.payee} />
                ))}
              </datalist>
              {transaction?.bankPayee && (
                <p className="text-muted-foreground text-xs">
                  The bank called this <span className="text-foreground">{transaction.bankPayee}</span> — PayPal named the merchant.{" "}
                  <button type="button" className="underline" onClick={() => setPayee(transaction.bankPayee)}>
                    Put it back
                  </button>
                </p>
              )}
            </div>
          )}
          {kind === "transfer" ? (
            <div className="grid grid-cols-2 gap-3">
              <AccountSelect label="From" accounts={accounts} value={fromAccountId} onChange={setFromAccountId} />
              <AccountSelect label="To" accounts={accounts} value={toAccountId} onChange={setToAccountId} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <AccountSelect label="Account" accounts={accounts} value={accountId} onChange={setAccountId} />
              {kind !== "adjustment" && (
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Uncategorized" />
                    </SelectTrigger>
                    <SelectContent>
                      {catsOf(kind).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.group ? `${c.group} · ${c.title}` : c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          {counterparts.length > 0 && (
            <div className="grid gap-2 rounded-md border p-2">
              <Label>Other side found — merge into one transfer?</Label>
              {counterparts.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="counterpart" checked={mergeCounterpartId === c.id} onChange={() => setMergeCounterpartId(c.id)} />
                  <span className="min-w-0 flex-1 truncate">
                    {accountName(accounts, c.accountId)} · {c.payee || c.note || c.date}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{formatCents(c.amount)}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="counterpart" checked={mergeCounterpartId === ""} onChange={() => setMergeCounterpartId("")} />
                Keep as a plain transfer, no merge
              </label>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="tx-note">Note</Label>
            <Textarea id="tx-note" rows={1} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tx-tags">Tags</Label>
            <TagInput id="tx-tags" value={tags} onChange={setTags} suggestions={suggestions} normalize={normalizeTag} />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {transaction ? (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                void deleteTransaction(transaction.id).then(() => {
                  toast.success("Transaction deleted");
                  onOpenChange(false);
                });
              }}
            >
              Delete
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void save(true)}>
              Save & add another
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save(false)}>{transaction ? "Save" : "Add"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function accountName(accounts: LedgerAccount[], id: string): string {
  return accounts.find((a) => a.id === id)?.title ?? "?";
}

function AccountSelect({ label, accounts, value, onChange }: { label: string; accounts: LedgerAccount[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
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
  );
}
