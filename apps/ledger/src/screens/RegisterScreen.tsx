import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Badge, Button, Card, CardContent, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TagChips, Tabs, TabsContent, TabsList, TabsTrigger, toast } from "@lifeline/ui";
import { formatHuman, todayStr } from "@lifeline/core";
import { ArrowLeftRight, Bell, BellOff, Import, Inbox, Landmark, ListChecks, Pencil, Plus, Scale, Search, Wand2 } from "lucide-react";
import type { Due, LedgerAccount, Series, Transaction } from "../domain/types";
import { balanceOf, formatMonth, isUncategorized, monthOf } from "../domain/derive";
import { formatCents, formatSigned, parseAmount } from "../domain/money";
import { describeDueDay, isOverdue, openDues } from "../domain/recur";
import { describeCadence, nextOccurrence } from "../domain/series";
import { matchRule, payeeCategoryIndex, suggestCategory } from "../domain/suggest";
import { looksLikePaypal } from "../domain/paypal";
import { categorizeTransaction, confirmDue, dismissDue, setSeriesMuted, useAccounts, useCategories, useCategorizeRules, useSeries, useTransactions } from "../data/repo";
import { TransactionEditorDialog } from "../components/TransactionEditorDialog";
import { AccountEditorDialog } from "../components/AccountEditorDialog";
import { ReconcileDialog } from "../components/ReconcileDialog";
import { ImportDialog } from "../components/ImportDialog";
import { PaypalSweepDialog } from "../components/PaypalSweepDialog";
import { RulesPanel } from "../components/RulesPanel";

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
 * filters with the uncategorized inbox one tap away, accounts with derived
 * balances, and the Recurring series the ledger reads off itself (ADR
 * 0034) with their Dues.
 */
export function RegisterScreen() {
  const transactions = useTransactions();
  const accounts = useAccounts();
  const categories = useCategories();
  const rules = useCategorizeRules();
  const series = useSeries();

  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  /** The quick filter: the import inbox alone, composing with every other filter. */
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const [editing, setEditing] = useState<Transaction | undefined>();
  const [addOpen, setAddOpen] = useState(false);
  const [accountEditing, setAccountEditing] = useState<LedgerAccount | undefined>();
  const [accountAddOpen, setAccountAddOpen] = useState(false);
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
  const dues = useMemo(() => openDues(series, today), [series, today]);
  const uncategorized = useMemo(() => transactions.filter(isUncategorized), [transactions]);
  /** Still wearing the bank's one PayPal name — one merchant as far as the suggester can tell. */
  const unnamedPaypal = useMemo(() => transactions.filter((t) => (t.kind === "expense" || t.kind === "income") && !t.paypalId && looksLikePaypal(t.payee)), [transactions]);

  /** Every month the ledger touches, newest first — the month filter's options. */
  const months = useMemo(() => Array.from(new Set(transactions.map((t) => monthOf(t.date)))).sort().reverse(), [transactions]);

  /**
   * The sweep behind the Auto-categorize button: run the suggester — rules
   * first, then the ledger's own history (ADR 0040) — over the inbox and
   * apply what it knows; the rest stay loud, never-ruled payees included.
   */
  async function autoCategorize() {
    const index = payeeCategoryIndex(transactions);
    let n = 0;
    let vetoed = 0;
    for (const t of uncategorized) {
      const kind = t.kind as "expense" | "income";
      if (matchRule(t.payee, kind, rules)?.never) {
        vetoed++;
        continue;
      }
      const s = suggestCategory(t.payee, kind, index, rules);
      if (!s) continue;
      await categorizeTransaction(t.id, s.categoryId);
      n++;
    }
    const left = vetoed > 0 ? ` — ${vetoed} left alone by a never rule` : n < uncategorized.length ? " — the rest need a hand" : "";
    if (n === 0) toast.info(`Nothing to go on for these payees${vetoed > 0 ? `, and ${vetoed} are never auto-categorized` : " — categorize a few by hand first"}`);
    else toast.success(`Categorized ${n} of ${uncategorized.length}${left}`);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = transactions.filter((t) => {
      if (onlyUncategorized && !isUncategorized(t)) return false;
      if (accountFilter !== "all" && t.accountId !== accountFilter && t.fromAccountId !== accountFilter && t.toAccountId !== accountFilter) return false;
      if (categoryFilter !== "all" && t.categoryId !== categoryFilter) return false;
      if (monthFilter !== "all" && monthOf(t.date) !== monthFilter) return false;
      if (kindFilter !== "all" && t.kind !== kindFilter) return false;
      if (q && !matchesSearch(t, q)) return false;
      return true;
    });
    return out.sort(SORTS[sort]);
  }, [transactions, onlyUncategorized, accountFilter, categoryFilter, monthFilter, kindFilter, sort, search]);

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
          <TabsTrigger value="rules">
            <ListChecks className="size-3.5" /> Rules
            {rules.length > 0 && (
              <Badge variant="outline" className="ml-1.5 px-1.5">
                {rules.length}
              </Badge>
            )}
          </TabsTrigger>
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
              <button className="min-w-0 flex-1 text-left" onClick={() => setOnlyUncategorized(true)}>
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
            <Button variant={onlyUncategorized ? "default" : "outline"} onClick={() => setOnlyUncategorized((v) => !v)} aria-pressed={onlyUncategorized} title="Show only transactions with no category">
              <Inbox /> Uncategorized
              {uncategorized.length > 0 && (
                <Badge variant={onlyUncategorized ? "secondary" : "outline"} className="ml-1 px-1.5">
                  {uncategorized.length}
                </Badge>
              )}
            </Button>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
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
              {filtered.length === 0 && <p className="text-muted-foreground px-4 py-6 text-center text-sm">{onlyUncategorized && uncategorized.length === 0 ? "Inbox clear — every transaction has a category." : "No transactions."}</p>}
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
                          {isUncategorized(t) && (
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

        <TabsContent value="rules">
          <RulesPanel />
        </TabsContent>

        <TabsContent value="recurring" className="grid gap-3">
          <DuesList dues={dues} today={today} />
          <p className="text-muted-foreground text-xs">
            Recurring series read themselves off the ledger (ADR 0034): a payee whose transactions keep coming at one cadence for near enough one amount. Nothing to add here — post the transactions and the series shows up.
          </p>
          {series.map((s) => (
            <SeriesCard
              key={s.key}
              series={s}
              today={today}
              category={byCategory.get(s.categoryId)?.title}
              account={byAccount.get(s.accountId)?.title}
              onShow={() => {
                setSearch(s.payee);
                setOnlyUncategorized(false);
                setSearchParams({}, { replace: true });
              }}
            />
          ))}
          {series.length === 0 && <p className="text-muted-foreground text-sm">No recurring series yet — three regular payments to the same payee and rent, salary or Netflix appears here on its own.</p>}
        </TabsContent>
      </Tabs>

      <TransactionEditorDialog open={addOpen} onOpenChange={setAddOpen} />
      <TransactionEditorDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} transaction={editing} />
      <AccountEditorDialog open={accountAddOpen} onOpenChange={setAccountAddOpen} />
      <AccountEditorDialog open={!!accountEditing} onOpenChange={(o) => !o && setAccountEditing(undefined)} account={accountEditing} />
      {reconciling && <ReconcileDialog open onOpenChange={(o) => !o && setReconciling(undefined)} account={reconciling} currentBalance={balanceOf(reconciling, transactions)} />}
      {importing && <ImportDialog open onOpenChange={(o) => !o && setImporting(undefined)} account={importing} />}
      {paypalOpen && <PaypalSweepDialog open onOpenChange={setPaypalOpen} />}
    </div>
  );
}

/** Open Dues, overdue loud — confirm posts the fact, skip waves that one day off (ADR 0034). */
export function DuesList({ dues, today, compact }: { dues: Due[]; today: string; compact?: boolean }) {
  if (dues.length === 0) return compact ? <p className="text-muted-foreground p-3 text-sm">Nothing due.</p> : null;
  return (
    <ul className={compact ? "grid content-start gap-1 overflow-y-auto p-2" : "grid gap-1"}>
      {dues.map((due) => (
        <li key={`${due.series.key}/${due.date}`} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
          <span className="min-w-0 flex-1 truncate">
            {due.series.payee}
            <span className={`ml-2 text-xs ${isOverdue(due, today) ? "text-destructive" : "text-muted-foreground"}`}>{describeDueDay(due.date, today)}</span>
          </span>
          <span className="text-muted-foreground shrink-0 tabular-nums">{formatCents(due.series.amount)}</span>
          <Button
            size="sm"
            onClick={() =>
              void confirmDue(due)
                .then(() => toast.success(`${due.series.payee} posted`))
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

/**
 * One derived Recurring series: what the ledger reads, and the two things
 * the reading cannot decide — whether it is a bill at all (mute) and where
 * to look at its transactions.
 */
function SeriesCard({ series, today, category, account, onShow }: { series: Series; today: string; category?: string; account?: string; onShow: () => void }) {
  const next = nextOccurrence(series, series.lastDate);
  const quiet = series.muted || series.dormant;
  return (
    <Card className={`py-3 ${quiet ? "opacity-60" : ""}`}>
      <CardContent className="flex items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">
            {series.payee}
            {series.kind === "income" && (
              <Badge variant="outline" className="ml-2">
                income
              </Badge>
            )}
            {series.muted && (
              <Badge variant="outline" className="ml-2">
                muted
              </Badge>
            )}
            {series.dormant && !series.muted && (
              <Badge variant="outline" className="ml-2">
                over
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground text-xs">
            {describeCadence(series)} · {category ?? "Uncategorized"} · {account ?? "?"} · {series.occurrences.length} since {formatHuman(series.firstDate)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tabular-nums">{formatCents(series.amount)}</div>
          <div className="text-muted-foreground text-xs">{quiet ? `last ${formatHuman(series.lastDate)}` : next < today ? `overdue since ${formatHuman(next)}` : `next ${describeDueDay(next, today)}`}</div>
        </div>
        <Button size="icon" variant="ghost" className="size-8" title="Show these transactions in the register" onClick={onShow}>
          <Search />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          title={series.muted ? "Unmute — let it surface Dues again" : "Mute — keep it listed, surface no Dues"}
          onClick={() =>
            void setSeriesMuted(series, !series.muted).then(() => toast.success(series.muted ? `${series.payee} unmuted` : `${series.payee} muted — no more dues`))
          }
        >
          {series.muted ? <Bell /> : <BellOff />}
        </Button>
      </CardContent>
    </Card>
  );
}
