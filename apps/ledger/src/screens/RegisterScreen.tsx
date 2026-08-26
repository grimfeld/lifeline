import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Badge, Button, Card, CardContent, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TagChips, Tabs, TabsContent, TabsList, TabsTrigger, toast } from "@lifeline/ui";
import { formatHuman, todayStr } from "@lifeline/core";
import { ArrowLeftRight, Import, Landmark, Pencil, Plus, Scale, Wand2 } from "lucide-react";
import type { Due, LedgerAccount, Recurring, Transaction } from "../domain/types";
import { balanceOf, formatMonth, monthOf } from "../domain/derive";
import { formatCents, formatSigned, parseAmount } from "../domain/money";
import { describeDueDay, isOverdue, openDues } from "../domain/recur";
import { payeeCategoryIndex, suggestCategory } from "../domain/suggest";
import { looksLikePaypal } from "../domain/paypal";
import { categorizeTransaction, confirmDue, dismissDue, useAccounts, useCategories, useRecurrings, useTransactions } from "../data/repo";
import { TransactionEditorDialog } from "../components/TransactionEditorDialog";
import { AccountEditorDialog } from "../components/AccountEditorDialog";
import { RecurringEditorDialog } from "../components/RecurringEditorDialog";
import { ReconcileDialog } from "../components/ReconcileDialog";
import { ImportDialog } from "../components/ImportDialog";
import { PaypalSweepDialog } from "../components/PaypalSweepDialog";

const PAGE = 100;

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "payee";

const SORTS: Record<SortKey, (a: Transaction, b: Transaction) => number> = {
  "date-desc": (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  "date-asc": (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  "amount-desc": (a, b) => Math.abs(b.amount) - Math.abs(a.amount) || b.date.localeCompare(a.date),
  "amount-asc": (a, b) => Math.abs(a.amount) - Math.abs(b.amount) || b.date.localeCompare(a.date),
  payee: (a, b) => a.payee.localeCompare(b.payee) || b.date.localeCompare(a.date),
};

/**
 * Free search over one Transaction: payee/note/bank-payee text, the day — "2026-03",
 * "03-10", "10-03" and "10.03" all find the 10th of March — or an exact
 * amount ("12,50" and "12.50" both find €12.50 either direction).
 */
function matchesSearch(t: Transaction, q: string): boolean {
  // bankPayee too: a PayPal row renamed to its merchant is still findable by what the bank called it.
  if (`${t.payee} ${t.note} ${t.bankPayee}`.toLowerCase().includes(q)) return true;
  const dateQ = q.replace(/[./]/g, "-");
  if (/^[\d-]+$/.test(dateQ) && dateQ.includes("-")) {
    if (t.date.includes(dateQ)) return true;
    const flipped = dateQ.split("-").reverse().join("-");
    if (flipped !== dateQ && t.date.includes(flipped)) return true;
  }
  const cents = parseAmount(q);
  if (cents !== null && Math.abs(cents) === Math.abs(t.amount)) return true;
  return false;
}

const SORT_LABEL: Record<SortKey, string> = {
  "date-desc": "Newest first",
  "date-asc": "Oldest first",
  "amount-desc": "Largest first",
  "amount-asc": "Smallest first",
  payee: "Payee A–Z",
};

/**
 * The Register (ADR 0033): the workhorse — per-account transaction list,
 * filters, the uncategorized inbox, accounts with derived balances,
 * recurring definitions and their Dues.
 */
export function RegisterScreen() {
  const transactions = useTransactions();
  const accounts = useAccounts();
  const categories = useCategories();
  const recurrings = useRecurrings();

  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const [editing, setEditing] = useState<Transaction | undefined>();
  const [addOpen, setAddOpen] = useState(false);
  const [accountEditing, setAccountEditing] = useState<LedgerAccount | undefined>();
  const [accountAddOpen, setAccountAddOpen] = useState(false);
  const [recurringEditing, setRecurringEditing] = useState<Recurring | undefined>();
  const [recurringAddOpen, setRecurringAddOpen] = useState(false);
  const [reconciling, setReconciling] = useState<LedgerAccount | undefined>();
  const [importing, setImporting] = useState<LedgerAccount | undefined>();
  const [paypalOpen, setPaypalOpen] = useState(false);
  /** The PayPal nudge, hidden for this visit — rows no activity file covers would otherwise nag forever. */
  const [paypalHidden, setPaypalHidden] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "transactions";

  const byAccount = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const byCategory = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const today = todayStr();
  const dues = useMemo(() => openDues(recurrings, transactions, today), [recurrings, transactions, today]);
  const uncategorized = useMemo(() => transactions.filter((t) => (t.kind === "expense" || t.kind === "income") && !t.categoryId), [transactions]);
  /** Still wearing the bank's one PayPal name — one merchant as far as the suggester can tell. */
  const unnamedPaypal = useMemo(() => transactions.filter((t) => (t.kind === "expense" || t.kind === "income") && !t.paypalId && looksLikePaypal(t.payee)), [transactions]);

  /** Every month the ledger touches, newest first — the month filter's options. */
  const months = useMemo(() => Array.from(new Set(transactions.map((t) => monthOf(t.date)))).sort().reverse(), [transactions]);

  /**
   * The sweep behind the Auto-categorize button: run the history-derived
   * suggester over the inbox and apply what it knows; the rest stay loud.
   */
  async function autoCategorize() {
    const index = payeeCategoryIndex(transactions);
    let n = 0;
    for (const t of uncategorized) {
      const s = suggestCategory(t.payee, t.kind as "expense" | "income", index);
      if (!s) continue;
      await categorizeTransaction(t.id, s.categoryId);
      n++;
    }
    if (n === 0) toast.info("History knows none of these payees — categorize a few by hand first");
    else toast.success(`Categorized ${n} of ${uncategorized.length}${n < uncategorized.length ? " — the rest need a hand" : ""}`);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = transactions.filter((t) => {
      if (accountFilter === "uncategorized") {
        if (!((t.kind === "expense" || t.kind === "income") && !t.categoryId)) return false;
      } else if (accountFilter !== "all" && t.accountId !== accountFilter && t.fromAccountId !== accountFilter && t.toAccountId !== accountFilter) return false;
      if (categoryFilter !== "all" && t.categoryId !== categoryFilter) return false;
      if (monthFilter !== "all" && monthOf(t.date) !== monthFilter) return false;
      if (kindFilter !== "all" && t.kind !== kindFilter) return false;
      if (q && !matchesSearch(t, q)) return false;
      return true;
    });
    return out.sort(SORTS[sort]);
  }, [transactions, accountFilter, categoryFilter, monthFilter, kindFilter, sort, search]);

  function describe(t: Transaction): { what: string; sign: string } {
    switch (t.kind) {
      case "expense":
        return { what: byCategory.get(t.categoryId)?.title ?? "Uncategorized", sign: `−${formatCents(t.amount)}` };
      case "income":
        return { what: byCategory.get(t.categoryId)?.title ?? "Uncategorized", sign: `+${formatCents(t.amount)}` };
      case "transfer":
        return { what: `${byAccount.get(t.fromAccountId)?.title ?? "?"} → ${byAccount.get(t.toAccountId)?.title ?? "?"}`, sign: formatCents(t.amount) };
      case "adjustment":
        return { what: "Adjustment", sign: formatSigned(t.amount) };
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4 p-4">
      <div className="flex items-center gap-2">
        <Landmark className="size-5" />
        <h1 className="flex-1 text-lg font-semibold">Ledger</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus /> Add transaction
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setSearchParams(v === "transactions" ? {} : { tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="recurring">
            Recurring
            {dues.filter((d) => isOverdue(d, today) || d.date === today).length > 0 && (
              <Badge variant="destructive" className="ml-1.5 px-1.5">
                {dues.filter((d) => isOverdue(d, today) || d.date === today).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="grid gap-3">
          {uncategorized.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm">
              <button className="min-w-0 flex-1 text-left" onClick={() => setAccountFilter("uncategorized")}>
                {uncategorized.length} uncategorized transaction{uncategorized.length === 1 ? "" : "s"} — the import inbox. Click to clear it.
              </button>
              <Button size="sm" variant="outline" onClick={() => void autoCategorize()}>
                <Wand2 /> Auto-categorize
              </Button>
            </div>
          )}
          {unnamedPaypal.length > 0 && !paypalHidden && (
            <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              <span className="text-muted-foreground min-w-0 flex-1">
                {unnamedPaypal.length} transaction{unnamedPaypal.length === 1 ? "" : "s"} the bank filed under PayPal — one payee for every merchant, so categorizing one categorizes them all.
              </span>
              <Button size="sm" variant="outline" onClick={() => setPaypalOpen(true)}>
                <Wand2 /> Name PayPal payees
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPaypalHidden(true)}>
                Not now
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
                {accounts
                  .filter((a) => !a.archived)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.group ? `${c.group} · ${c.title}` : c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMonth(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kinds</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="transfer">Transfers</SelectItem>
                <SelectItem value="adjustment">Adjustments</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SORT_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Search payee, note, amount (12,50) or date (10-03)…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="text-muted-foreground text-xs">
            {filtered.length} transaction{filtered.length === 1 ? "" : "s"}
            {" · "}−{formatCents(filtered.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0))}
            {" · "}+{formatCents(filtered.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0))}
          </div>
          <Card className="py-1">
            <CardContent className="px-0">
              {filtered.length === 0 && <p className="text-muted-foreground px-4 py-6 text-center text-sm">No transactions.</p>}
              <ul>
                {filtered.slice(0, limit).map((t) => {
                  const d = describe(t);
                  return (
                    <li key={t.id}>
                      <button className="hover:bg-accent/50 flex w-full items-center gap-3 px-4 py-1.5 text-left text-sm" onClick={() => setEditing(t)}>
                        <span className="text-muted-foreground w-24 shrink-0 text-xs">{formatHuman(t.date)}</span>
                        {t.kind === "transfer" && <ArrowLeftRight className="text-muted-foreground size-3.5 shrink-0" />}
                        {t.kind === "adjustment" && <Scale className="text-muted-foreground size-3.5 shrink-0" />}
                        <span className="min-w-0 flex-1 truncate">
                          {t.payee || d.what}
                          {t.payee && <span className="text-muted-foreground"> · {d.what}</span>}
                          {(t.kind === "expense" || t.kind === "income") && !t.categoryId && (
                            <Badge variant="outline" className="ml-2 border-amber-500/60 text-amber-600">
                              uncategorized
                            </Badge>
                          )}
                          <TagChips tags={t.tags} size="xs" className="ml-1 inline-flex" />
                        </span>
                        <span className="text-muted-foreground hidden w-28 shrink-0 truncate text-right text-xs sm:block">{t.kind === "transfer" ? "" : (byAccount.get(t.accountId)?.title ?? "")}</span>
                        <span className={`w-28 shrink-0 text-right tabular-nums ${t.kind === "expense" ? "" : t.kind === "income" ? "text-green-600 dark:text-green-500" : "text-muted-foreground"}`}>{d.sign}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {filtered.length > limit && (
                <div className="px-4 py-2">
                  <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
                    Show more ({filtered.length - limit} left)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="grid gap-3">
          <div>
            <Button variant="outline" onClick={() => setAccountAddOpen(true)}>
              <Plus /> New account
            </Button>
          </div>
          {accounts.map((a) => {
            const balance = balanceOf(a, transactions);
            return (
              <Card key={a.id} className={`py-3 ${a.archived ? "opacity-60" : ""}`}>
                <CardContent className="flex items-center gap-3 px-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {a.title}
                      {a.archived && (
                        <Badge variant="outline" className="ml-2">
                          archived
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs">{a.flavor}</div>
                  </div>
                  <span className={`tabular-nums ${balance < 0 ? "text-destructive" : ""}`}>{formatCents(balance)}</span>
                  <Button size="sm" variant="outline" onClick={() => setReconciling(a)}>
                    <Scale /> Reconcile
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setImporting(a)}>
                    <Import /> Import
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => setAccountEditing(a)}>
                    <Pencil />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {accounts.length === 0 && <p className="text-muted-foreground text-sm">No accounts yet — money needs a place to live.</p>}
        </TabsContent>

        <TabsContent value="recurring" className="grid gap-3">
          <DuesList dues={dues} today={today} />
          <div>
            <Button variant="outline" onClick={() => setRecurringAddOpen(true)}>
              <Plus /> New recurring
            </Button>
          </div>
          {recurrings.map((r) => (
            <Card key={r.id} className={`py-3 ${r.paused ? "opacity-60" : ""}`}>
              <CardContent className="flex items-center gap-3 px-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {r.payee}
                    {r.paused && (
                      <Badge variant="outline" className="ml-2">
                        paused
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {r.rule.kind === "monthly" ? `monthly on the ${r.rule.days.join(", ")}` : r.rule.kind === "weekly" ? "weekly" : "yearly"} · {byCategory.get(r.categoryId)?.title ?? "?"} · {byAccount.get(r.accountId)?.title ?? "?"}
                  </div>
                </div>
                <span className="tabular-nums">{formatCents(r.amount)}</span>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => setRecurringEditing(r)}>
                  <Pencil />
                </Button>
              </CardContent>
            </Card>
          ))}
          {recurrings.length === 0 && <p className="text-muted-foreground text-sm">No recurring transactions — rent, salary, subscriptions save retyping here.</p>}
        </TabsContent>
      </Tabs>

      <TransactionEditorDialog open={addOpen} onOpenChange={setAddOpen} />
      <TransactionEditorDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} transaction={editing} />
      <AccountEditorDialog open={accountAddOpen} onOpenChange={setAccountAddOpen} />
      <AccountEditorDialog open={!!accountEditing} onOpenChange={(o) => !o && setAccountEditing(undefined)} account={accountEditing} />
      <RecurringEditorDialog open={recurringAddOpen} onOpenChange={setRecurringAddOpen} />
      <RecurringEditorDialog open={!!recurringEditing} onOpenChange={(o) => !o && setRecurringEditing(undefined)} recurring={recurringEditing} />
      {reconciling && <ReconcileDialog open onOpenChange={(o) => !o && setReconciling(undefined)} account={reconciling} currentBalance={balanceOf(reconciling, transactions)} />}
      {importing && <ImportDialog open onOpenChange={(o) => !o && setImporting(undefined)} account={importing} />}
      {paypalOpen && <PaypalSweepDialog open onOpenChange={setPaypalOpen} />}
    </div>
  );
}

/** Open Dues, overdue loud — confirm posts the fact, dismiss remembers the skip (ADR 0033). */
export function DuesList({ dues, today, compact }: { dues: Due[]; today: string; compact?: boolean }) {
  if (dues.length === 0) return compact ? <p className="text-muted-foreground p-3 text-sm">Nothing due.</p> : null;
  return (
    <ul className={compact ? "grid content-start gap-1 overflow-y-auto p-2" : "grid gap-1"}>
      {dues.map((due) => (
        <li key={`${due.recurring.id}/${due.date}`} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
          <span className="min-w-0 flex-1 truncate">
            {due.recurring.payee}
            <span className={`ml-2 text-xs ${isOverdue(due, today) ? "text-destructive" : "text-muted-foreground"}`}>{describeDueDay(due.date, today)}</span>
          </span>
          <span className="text-muted-foreground shrink-0 tabular-nums">{formatCents(due.recurring.amount)}</span>
          <Button
            size="sm"
            onClick={() =>
              void confirmDue(due)
                .then(() => toast.success(`${due.recurring.payee} posted`))
                .catch((err: Error) => toast.error(err.message))
            }
          >
            Confirm
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void dismissDue(due)}>
            Skip
          </Button>
        </li>
      ))}
    </ul>
  );
}
