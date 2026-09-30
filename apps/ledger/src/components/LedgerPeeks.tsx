import { useMemo, useState } from "react";
import { Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn, toast } from "@lifeline/ui";
import { todayStr, type Document } from "@lifeline/core";
import { KIND_LABEL, type LedgerAccount, type LedgerCategory, type Transaction } from "../domain/types";
import { balanceOf, formatMonth, spentByCategory, targetFor, thisMonth } from "../domain/derive";
import { touchesAccount } from "../domain/report";
import { formatCents, formatSigned } from "../domain/money";
import { categorizeTransaction, useAccounts, useAllocations, useCategories, useTransactions } from "../data/repo";
import { TransactionEditorDialog } from "./TransactionEditorDialog";

/**
 * The Ledger's Peeks (ADR 0057): a Transaction, an Account or a Category seen
 * from wherever a link to it was followed — the Vault, a Base, another Module
 * — with the operations worth doing without leaving: file a Transaction under
 * a Category, open it in the entry form. Core frames them with the title and
 * the way through to Money.
 */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function TransactionPeek({ doc }: { doc: Document }) {
  const t = doc as Transaction;
  const accounts = useAccounts();
  const categories = useCategories();
  const [editing, setEditing] = useState(false);
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.title ?? "—";
  const categorizable = t.kind === "expense" || t.kind === "income";
  const choices = categories.filter((c) => c.kind === t.kind);
  const amount = t.kind === "adjustment" ? formatSigned(t.amount) : formatCents(t.amount);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <span className={cn("text-2xl font-semibold tabular-nums", t.kind === "income" && "text-emerald-500")}>
          {t.kind === "expense" ? "−" : t.kind === "income" ? "+" : ""}
          {amount}
        </span>
        <Badge variant="secondary">{KIND_LABEL[t.kind]}</Badge>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        <Row label="Day">{t.date}</Row>
        {t.payee && <Row label="Payee">{t.payee}</Row>}
        {t.kind === "transfer" ? (
          <Row label="Accounts">
            {accountName(t.fromAccountId)} → {accountName(t.toAccountId)}
          </Row>
        ) : (
          <Row label="Account">{accountName(t.accountId)}</Row>
        )}
        {t.note && <Row label="Note">{t.note}</Row>}
      </dl>
      {categorizable && (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">Category</span>
          <Select
            value={t.categoryId || undefined}
            onValueChange={(v) =>
              void categorizeTransaction(t.id, v).then(() => toast.success(`Filed under ${categories.find((c) => c.id === v)?.title ?? "category"}`))
            }
          >
            <SelectTrigger className={cn("w-full", !t.categoryId && "border-amber-500/60")}>
              <SelectValue placeholder="Uncategorized — choose one" />
            </SelectTrigger>
            <SelectContent>
              {choices.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.group ? `${c.group} · ${c.title}` : c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Edit…
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
                <span className="tabular-nums">{t.kind === "adjustment" ? formatSigned(t.amount) : formatCents(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
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
        {c.group && <span>{c.group}</span>}
        {c.accumulating && <Badge variant="outline">accumulating</Badge>}
      </div>
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
