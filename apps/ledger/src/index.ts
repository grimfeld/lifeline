import type { AppManifest, DocumentTypeDef } from "@lifeline/core";
import { ChartLine, Landmark, PiggyBank, Repeat, Tags, Wallet, Wand2 } from "lucide-react";
import { RegisterScreen } from "./screens/RegisterScreen";
import { BudgetScreen } from "./screens/BudgetScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { BalancesCard, BudgetMonthCard, DuesCard, QuickAddCard } from "./cards/LedgerCards";
import { ledgerCommands } from "./commands";
import { ledgerDaylog } from "./daylog";
import { AccountPeek, CategoryPeek, TransactionPeek } from "./components/LedgerPeeks";
import { formatCents, formatSigned } from "./domain/money";
import {
  ACCOUNT,
  ALLOCATION,
  APP_ID,
  ACCOUNT_FLAVORS,
  BUDGET_HREF,
  CATEGORY,
  KIND_LABEL,
  REGISTER_HREF,
  RULE,
  RULES_HREF,
  SERIES,
  TRANSACTION,
  type CategorizeRule,
  type LedgerAccount,
  type LedgerCategory,
  type Series,
  type Transaction,
} from "./domain/types";

/**
 * The `ledger_transaction` Document type (ADR 0033): one movement of money
 * on a day. Bodiless, so Transactions never clutter the Vault; not Linkable
 * — thousands of derived titles are noise in completion. The kind and the
 * import id are the App's (guarded); day, amount, category, payee stay
 * plain so Bases can bulk-recategorize.
 */
const transactionType: DocumentTypeDef = {
  id: TRANSACTION,
  label: "Transactions",
  icon: Landmark,
  titleRule: "derived",
  titleOf: (d) => {
    const t = d as Transaction;
    const amount = t.kind === "adjustment" ? formatSigned(t.amount) : formatCents(t.amount);
    return `${amount} · ${t.payee || KIND_LABEL[t.kind] || "?"} · ${t.date}`;
  },
  body: "none",
  fields: [
    { key: "kind", label: "Kind", kind: "select", options: (Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((k) => ({ value: k, label: KIND_LABEL[k] })), guarded: true, required: true, column: true },
    { key: "date", label: "Day", kind: "date", required: true, column: true },
    { key: "amount", label: "Amount (cents)", kind: "number", required: true, column: true },
    { key: "accountId", label: "Account", kind: "link", linkType: ACCOUNT, column: true },
    { key: "fromAccountId", label: "From", kind: "link", linkType: ACCOUNT, hidden: true },
    { key: "toAccountId", label: "To", kind: "link", linkType: ACCOUNT, hidden: true },
    { key: "categoryId", label: "Category", kind: "link", linkType: CATEGORY, column: true },
    { key: "payee", label: "Payee", kind: "text", column: true },
    { key: "note", label: "Note", kind: "longtext" },
    { key: "importId", label: "Import id", kind: "text", guarded: true, hidden: true },
    { key: "paypalId", label: "PayPal id", kind: "text", guarded: true, hidden: true },
    { key: "bankPayee", label: "Bank payee", kind: "text", guarded: true, hidden: true },
  ],
  indexes: ["date", "categoryId", "accountId"],
  href: () => REGISTER_HREF,
  peek: TransactionPeek,
  order: 80,
  builtIn: true,
};

/** The `ledger_account` Document type (ADR 0033): a named place money lives. Balance always derives. */
const accountType: DocumentTypeDef = {
  id: ACCOUNT,
  label: "Accounts",
  icon: Wallet,
  titleRule: "name",
  body: "optional",
  fields: [
    { key: "flavor", label: "Kind", kind: "select", options: ACCOUNT_FLAVORS.map((f) => ({ value: f, label: f })), required: true, column: true },
    { key: "openingBalance", label: "Opening (cents)", kind: "number", guarded: true, column: true },
    { key: "archived", label: "Archived", kind: "boolean", guarded: true, column: true },
    { key: "importMapping", label: "Import mapping", kind: "json", guarded: true, hidden: true },
  ],
  linkable: { subtitle: (d) => (d as LedgerAccount).flavor },
  href: () => `${REGISTER_HREF}?tab=accounts`,
  peek: AccountPeek,
  order: 81,
  builtIn: true,
};

/** The `ledger_category` Document type (ADR 0033): classification + budget policy. */
const categoryType: DocumentTypeDef = {
  id: CATEGORY,
  label: "Categories",
  singular: "Category",
  icon: Tags,
  titleRule: "name",
  body: "optional",
  fields: [
    { key: "kind", label: "Kind", kind: "select", options: [{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }], guarded: true, required: true, column: true },
    { key: "group", label: "Group", kind: "text", column: true },
    { key: "target", label: "Target (cents)", kind: "number", column: true },
    { key: "accumulating", label: "Accumulating", kind: "boolean", column: true },
  ],
  linkable: { subtitle: (d) => ((d as LedgerCategory).group ? `${(d as LedgerCategory).group} · ${(d as LedgerCategory).kind}` : (d as LedgerCategory).kind) },
  href: () => BUDGET_HREF,
  peek: CategoryPeek,
  order: 82,
  builtIn: true,
};

/**
 * The `ledger_series` internal type (ADR 0034): the user's word over a
 * *derived* Recurring series — muted, and the due days waved off. The
 * series itself is never stored; only what cannot derive is.
 */
const seriesOverrideType: DocumentTypeDef = {
  id: SERIES,
  label: "Series overrides",
  singular: "Series override",
  icon: Repeat,
  internal: true,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "key", label: "Series", kind: "text", guarded: true, required: true, column: true },
    { key: "muted", label: "Muted", kind: "boolean", column: true },
    { key: "skipped", label: "Skipped days", kind: "json", guarded: true, hidden: true },
  ],
  href: () => `${REGISTER_HREF}?tab=recurring`,
  order: 83,
  builtIn: true,
};

/**
 * The `ledger_rule` internal type (ADR 0040): the user's own word over the
 * history-derived auto-categorization — a payee that always means one
 * Category, or a payee that is never guessed at all. The kind is stamped
 * from the Category and guarded; nothing here decides anything on its own,
 * it only shapes what the import preview and the sweep suggest.
 */
const ruleType: DocumentTypeDef = {
  id: RULE,
  label: "Categorize rules",
  singular: "Categorize rule",
  icon: Wand2,
  internal: true,
  titleRule: "derived",
  titleOf: (d) => {
    const r = d as CategorizeRule;
    return r.never ? `${r.match || "?"} · never` : r.match || "?";
  },
  body: "none",
  fields: [
    { key: "match", label: "Payee text", kind: "text", required: true, column: true },
    { key: "mode", label: "Match", kind: "select", options: [{ value: "contains", label: "Contains" }, { value: "exact", label: "Exact" }], required: true, column: true },
    { key: "never", label: "Never categorize", kind: "boolean", column: true },
    { key: "categoryId", label: "Category", kind: "link", linkType: CATEGORY, column: true },
    { key: "kind", label: "Applies to", kind: "select", options: [{ value: "expense", label: "Expenses" }, { value: "income", label: "Income" }, { value: "both", label: "Both" }], guarded: true, column: true },
  ],
  href: () => RULES_HREF,
  order: 85,
  builtIn: true,
};

/** The `ledger_allocation` internal type (ADR 0033): one month's Target override for one Category. */
const allocationType: DocumentTypeDef = {
  id: ALLOCATION,
  label: "Allocation overrides",
  internal: true,
  titleRule: "derived",
  titleOf: (d) => `${(d as { month?: string }).month ?? "?"} · ${formatCents(Number((d as { amount?: number }).amount) || 0)}`,
  body: "none",
  fields: [
    { key: "categoryId", label: "Category", kind: "link", linkType: CATEGORY, guarded: true, required: true, column: true },
    { key: "month", label: "Month", kind: "text", guarded: true, required: true, column: true },
    { key: "amount", label: "Amount (cents)", kind: "number", guarded: true, required: true, column: true },
  ],
  indexes: ["categoryId"],
  order: 84,
  builtIn: true,
};

/** Ledger App (ADR 0033): a flat fact ledger, the Budget a derived lens over it. */
export const ledgerApp: AppManifest = {
  id: APP_ID,
  module: "money",
  title: "Ledger",
  icon: Landmark,
  color: "var(--chart-teal, #14b8a6)",
  types: [transactionType, accountType, categoryType, seriesOverrideType, allocationType, ruleType],
  screens: [
    { id: "ledger.register", title: "Ledger", path: "ledger", icon: Landmark, component: RegisterScreen },
    { id: "ledger.budget", title: "Budget", path: "ledger/budget", icon: PiggyBank, component: BudgetScreen },
    { id: "ledger.reports", title: "Money reports", path: "ledger/reports", icon: ChartLine, component: ReportsScreen },
  ],
  cards: [
    {
      id: "ledger.quickadd",
      title: "Add transaction",
      description: "The entry form one tap away",
      component: QuickAddCard,
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 2, h: 2 },
    },
    {
      id: "ledger.balances",
      title: "Balances",
      description: "Every account's balance, net worth on top",
      component: BalancesCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
    },
    {
      id: "ledger.budget-month",
      title: "Budget this month",
      description: "Available per category, worst first",
      component: BudgetMonthCard,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
    },
    {
      id: "ledger.dues",
      title: "Upcoming bills",
      description: "Open dues — the upcoming bills, read off the ledger",
      component: DuesCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
    },
  ],
  commands: ledgerCommands,
  daylog: ledgerDaylog,
};

export { TRANSACTION, ACCOUNT, CATEGORY, SERIES, ALLOCATION, RULE };
export type { Transaction, LedgerAccount, LedgerCategory, Series, CategorizeRule };
