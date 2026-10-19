import { useId, useMemo, useState } from "react";
import { Badge, Button, Checkbox, CommitField, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn, toast } from "@lifeline/ui";
import { todayStr, type Document } from "@lifeline/core";
import { ACCOUNT_FLAVORS, KIND_LABEL, type AccountFlavor, type LedgerAccount, type LedgerCategory, type Transaction } from "../domain/types";
import { balanceOf, formatMonth, spentByCategory, targetFor, thisMonth } from "../domain/derive";
import { touchesAccount } from "../domain/report";
import { editAmount, formatCents, formatSigned, parseAmount } from "../domain/money";
import { categorizeTransaction, editAccount, editCategory, editTransaction, setAccountArchived, useAccounts, useAllocations, useCategories, useTransactions } from "../data/repo";
import { TransactionEditorDialog } from "./TransactionEditorDialog";

/**
 * The Ledger's Peeks (ADR 0057, editable by ADR 0085): a Transaction, an
 * Account or a Category seen from wherever a link to it was followed — the
 * Vault, a Base, another Module — its own Fields edited in place through the
 * Ledger's operations, which check them as the entry form does. What is the
 * Ledger's alone (a Transaction's kind, a Category's kind) is shown, and moves
 * only through the entry form or an operation. Core frames them with the
 * title and the way through to Money.
 */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** A labelled pick from a list, written as soon as it is picked. */
function PickField({ label, value, options, placeholder, onPick, className }: { label: string; value: string; options: { value: string; label: string }[]; placeholder?: string; onPick: (v: string) => Promise<unknown>; className?: string }) {
  const id = useId();
  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || undefined} onValueChange={(v) => void onPick(v).catch((err: Error) => toast.error(`Couldn’t change the ${label.toLowerCase()}: ${err.message}`))}>
        <SelectTrigger id={id} className={cn("w-full min-w-0", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** A typed amount in cents — `empty` when nothing is typed and that is allowed — or the reason it is not one. */
function cents(text: string, { signed = false, empty }: { signed?: boolean; empty?: number } = {}): number {
  if (!text.trim() && empty !== undefined) return empty;
  const c = parseAmount(text);
  if (c === null) throw new Error("Type an amount, like 12,50");
  if (!signed && c < 0) throw new Error("The amount can’t be negative");
  return c;
}

export function TransactionPeek({ doc }: { doc: Document }) {
  const t = doc as Transaction;
  const accounts = useAccounts();
  const categories = useCategories();
  const [editing, setEditing] = useState(false);
  const categorizable = t.kind === "expense" || t.kind === "income";
  const choices = categories.filter((c) => c.kind === t.kind);
  const amount = t.kind === "adjustment" ? formatSigned(t.amount) : formatCents(t.amount);
  const accountOptions = accounts.filter((a) => !a.archived || [t.accountId, t.fromAccountId, t.toAccountId].includes(a.id)).map((a) => ({ value: a.id, label: a.title }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <span className={cn("text-2xl font-semibold tabular-nums", t.kind === "income" && "text-success")}>
          {t.kind === "expense" ? "−" : t.kind === "income" ? "+" : ""}
          {amount}
        </span>
        <Badge variant="secondary">{KIND_LABEL[t.kind]}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CommitField label="Amount" inputMode="decimal" value={editAmount(Number(t.amount) || 0)} onCommit={(text) => editTransaction(t, { amount: cents(text, { signed: t.kind === "adjustment" }) })} />
        <CommitField label="Day" type="date" value={t.date ?? ""} onCommit={(date) => editTransaction(t, { date })} />
      </div>
      {t.kind !== "transfer" && <CommitField label="Payee" value={t.payee ?? ""} placeholder="Albert Heijn" onCommit={(payee) => editTransaction(t, { payee })} />}
      {t.kind === "transfer" ? (
        <div className="grid grid-cols-2 gap-3">
          <PickField label="From" value={t.fromAccountId} options={accountOptions} placeholder="Account" onPick={(fromAccountId) => editTransaction(t, { fromAccountId })} />
          <PickField label="To" value={t.toAccountId} options={accountOptions} placeholder="Account" onPick={(toAccountId) => editTransaction(t, { toAccountId })} />
        </div>
      ) : (
        <PickField label="Account" value={t.accountId} options={accountOptions} placeholder="Account" onPick={(accountId) => editTransaction(t, { accountId })} />
      )}
      {categorizable && (
        <PickField
          label="Category"
          value={t.categoryId}
          options={choices.map((c) => ({ value: c.id, label: c.group ? `${c.group} · ${c.title}` : c.title }))}
          placeholder="Uncategorized — choose one"
          className={cn(!t.categoryId && "border-warning")}
          onPick={(v) => categorizeTransaction(t.id, v).then(() => toast.success(`Filed under ${categories.find((c) => c.id === v)?.title ?? "category"}`))}
        />
      )}
      <CommitField label="Note" multiline value={t.note ?? ""} onCommit={(note) => editTransaction(t, { note })} />
      <div>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Kind, tags, delete…
        </Button>
      </div>
      <TransactionEditorDialog open={editing} onOpenChange={setEditing} transaction={t} />
    </div>
  );
}

export function AccountPeek({ doc }: { doc: Document }) {
  const a = doc as LedgerAccount;
  const transactions = useTransactions();
  const balance = balanceOf(a, transactions);
  const recent = useMemo(
    () =>
      transactions
        .filter((t) => touchesAccount(t, a.id))
        .sort((x, y) => y.date.localeCompare(x.date))
        .slice(0, 5),
    [transactions, a.id],
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <span className={cn("text-2xl font-semibold tabular-nums", balance < 0 && "text-destructive")}>{formatSigned(balance)}</span>
        <Badge variant="secondary" className="capitalize">
          {a.flavor}
        </Badge>
        {a.archived && <Badge variant="outline">archived</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <PickField label="Kind" value={a.flavor} options={ACCOUNT_FLAVORS.map((f) => ({ value: f, label: f }))} className="capitalize" onPick={(flavor) => editAccount(a, { flavor: flavor as AccountFlavor })} />
        <CommitField label="Opening balance" inputMode="decimal" value={editAmount(Number(a.openingBalance) || 0)} onCommit={(text) => editAccount(a, { openingBalance: cents(text, { signed: true, empty: 0 }) })} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">Latest</span>
        {recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">No transactions yet.</p>
        ) : (
          <ul className="flex flex-col text-sm">
            {recent.map((t) => (
              <li key={t.id} className="flex justify-between gap-3 border-b py-1 last:border-0">
                <span className="text-muted-foreground w-20 shrink-0 tabular-nums">{t.date}</span>
                <span className="min-w-0 flex-1 truncate">{t.payee || KIND_LABEL[t.kind]}</span>
                <span className="shrink-0 tabular-nums">{t.kind === "adjustment" ? formatSigned(t.amount) : formatCents(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        {/* Archived is the Ledger's (guarded): it moves only through this operation. */}
        <Button size="sm" variant="outline" onClick={() => void setAccountArchived(a.id, !a.archived).then(() => toast.success(a.archived ? "Account back in use" : "Account archived"))}>
          {a.archived ? "Unarchive" : "Archive"}
        </Button>
      </div>
    </div>
  );
}

export function CategoryPeek({ doc }: { doc: Document }) {
  const c = doc as LedgerCategory;
  const transactions = useTransactions();
  const allocations = useAllocations();
  const month = thisMonth(todayStr());
  const target = c.kind === "expense" ? targetFor(c, allocations, month) : 0;
  const spent = spentByCategory(transactions, month).get(c.id) ?? 0;
  const left = target - spent;
  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Badge variant="secondary" className="capitalize">
          {c.kind}
        </Badge>
        {c.accumulating && <Badge variant="outline">accumulating</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CommitField label="Group" value={c.group ?? ""} placeholder="Fixed costs" onCommit={(group) => editCategory(c, { group })} />
        <CommitField label="Monthly target" inputMode="decimal" value={c.target ? editAmount(Number(c.target) || 0) : ""} placeholder="400" onCommit={(text) => editCategory(c, { target: cents(text, { empty: 0 }) })} />
      </div>
      {c.kind === "expense" && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={!!c.accumulating} onCheckedChange={(v) => void editCategory(c, { accumulating: v === true })} />
          Accumulating — unspent target rolls into next month
        </label>
      )}
      {c.kind === "expense" && (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium capitalize">{formatMonth(month)}</span>
          {target > 0 ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <Row label="Target">{formatCents(target)}</Row>
              <Row label="Spent">{formatCents(spent)}</Row>
              <Row label={left < 0 ? "Over" : "Left"}>
                <span className={cn("font-medium tabular-nums", left < 0 && "text-destructive")}>{formatCents(Math.abs(left))}</span>
              </Row>
            </dl>
          ) : (
            <p className="text-sm">
              {formatCents(spent)} spent — <span className="text-muted-foreground">no target, so the Budget claims nothing about it.</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
