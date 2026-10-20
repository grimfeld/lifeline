import { pickLinked, todayStr, type CommandDef, type CommandDialogProps } from "@lifeline/core";
import { ArrowLeftRight, ChartLine, Landmark, ListChecks, PiggyBank, Plus, Wand2 } from "lucide-react";
import { ACCOUNT, BUDGET_HREF, CATEGORY, REGISTER_HREF, REPORTS_HREF, RULES_HREF } from "./domain/types";
import { completeEntry } from "./domain/entry";
import { formatCents } from "./domain/money";
import { addTransaction, allAccounts, allCategories, allTransactions } from "./data/repo";
import { TransactionEditorDialog } from "./components/TransactionEditorDialog";
import { PaypalSweepDialog } from "./components/PaypalSweepDialog";

function AddTransactionDialog(props: CommandDialogProps) {
  return <TransactionEditorDialog {...props} />;
}

function AddTransferDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <TransactionEditorDialog {...props} initialKind="transfer" />;
}

export const ledgerCommands: CommandDef[] = [
  {
    id: "ledger.add",
    title: "Add transaction",
    keywords: ["expense", "income", "spend", "money", "buy", "paid"],
    icon: Plus,
    dialog: AddTransactionDialog,
    capture: true,
    args: [
      { key: "amount", label: "Amount", kind: "number", required: true, hint: "In the currency's units, e.g. 12.5; always positive." },
      { key: "kind", label: "Kind", kind: "select", options: [{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }], hint: "Defaults to expense." },
      { key: "date", label: "Day", kind: "date", hint: "Defaults to today; never after today — the ledger records what happened." },
      { key: "account", label: "Account", kind: "link", linkType: ACCOUNT, hint: "Required unless the payee is known, whose last account is then used." },
      { key: "category", label: "Category", kind: "text", hint: "Id or exact name. Required unless the payee is known." },
      { key: "payee", label: "Payee", kind: "text" },
      { key: "note", label: "Note", kind: "longtext" },
      { key: "tags", label: "Tags", kind: "list" },
    ],
    async invoke(a) {
      const kind = (a.kind as "expense" | "income" | undefined) ?? "expense";
      const accounts = await allAccounts();
      const named = accounts.find((x) => x.id === a.account);
      if (named?.archived) throw new Error(`${named.title} is archived`);
      const categories = (await allCategories()).filter((c) => c.kind === kind);
      const categoryId = a.category === undefined ? undefined : pickLinked({ key: "category", label: "Category", kind: "link", linkType: CATEGORY }, a.category as string, categories);
      const entry = completeEntry(
        { kind, date: (a.date as string | undefined) ?? todayStr(), amount: Math.round((a.amount as number) * 100), accountId: a.account as string | undefined, categoryId, payee: a.payee as string | undefined },
        await allTransactions(),
      );
      if (accounts.find((x) => x.id === entry.accountId)?.archived) throw new Error("The payee's last account is archived; name the account");
      const id = await addTransaction({ ...entry, payee: entry.payee ?? "", note: (a.note as string | undefined) ?? "", tags: a.tags as string[] | undefined });
      const category = categories.find((c) => c.id === entry.categoryId)?.title ?? "";
      return { id, message: `Added ${kind} of ${formatCents(entry.amount)} on ${entry.date}${category ? ` (${category})` : ""}` };
    },
  },
  { id: "ledger.transfer", title: "Add transfer", keywords: ["transfer", "move money", "savings"], icon: ArrowLeftRight, dialog: AddTransferDialog },
  { id: "ledger.open", title: "Go to Ledger", keywords: ["money", "transactions", "register", "accounts"], icon: Landmark, run: ({ navigate }) => navigate(REGISTER_HREF) },
  { id: "ledger.budget", title: "Go to Budget", keywords: ["budget", "targets", "categories", "envelope"], icon: PiggyBank, run: ({ navigate }) => navigate(BUDGET_HREF) },
  { id: "ledger.rules", title: "Go to Categorize rules", keywords: ["rules", "auto categorize", "never", "blacklist", "payee", "amazon"], icon: ListChecks, run: ({ navigate }) => navigate(RULES_HREF) },
  { id: "ledger.paypal", title: "Name PayPal payees…", keywords: ["paypal", "payee", "merchant", "import", "activity", "resolve"], icon: Wand2, dialog: PaypalSweepDialog },
  { id: "ledger.reports", title: "Go to Money reports", keywords: ["reports", "spending", "net worth"], icon: ChartLine, run: ({ navigate }) => navigate(REPORTS_HREF) },
];
