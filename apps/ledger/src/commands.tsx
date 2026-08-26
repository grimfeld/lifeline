import type { CommandDef } from "@lifeline/core";
import { ArrowLeftRight, ChartLine, Landmark, PiggyBank, Plus, Wand2 } from "lucide-react";
import { BUDGET_HREF, REGISTER_HREF, REPORTS_HREF } from "./domain/types";
import { TransactionEditorDialog } from "./components/TransactionEditorDialog";
import { PaypalSweepDialog } from "./components/PaypalSweepDialog";

function AddTransactionDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <TransactionEditorDialog {...props} />;
}

function AddTransferDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <TransactionEditorDialog {...props} initialKind="transfer" />;
}

export const ledgerCommands: CommandDef[] = [
  { id: "ledger.add", title: "Add transaction", keywords: ["expense", "income", "spend", "money", "buy", "paid"], icon: Plus, dialog: AddTransactionDialog, capture: true },
  { id: "ledger.transfer", title: "Add transfer", keywords: ["transfer", "move money", "savings"], icon: ArrowLeftRight, dialog: AddTransferDialog },
  { id: "ledger.open", title: "Go to Ledger", keywords: ["money", "transactions", "register", "accounts"], icon: Landmark, run: ({ navigate }) => navigate(REGISTER_HREF) },
  { id: "ledger.budget", title: "Go to Budget", keywords: ["budget", "targets", "categories", "envelope"], icon: PiggyBank, run: ({ navigate }) => navigate(BUDGET_HREF) },
  { id: "ledger.paypal", title: "Name PayPal payees…", keywords: ["paypal", "payee", "merchant", "import", "activity", "resolve"], icon: Wand2, dialog: PaypalSweepDialog },
  { id: "ledger.reports", title: "Go to Money reports", keywords: ["reports", "spending", "net worth"], icon: ChartLine, run: ({ navigate }) => navigate(REPORTS_HREF) },
];
