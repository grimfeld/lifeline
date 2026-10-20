import { todayStr, type CommandDef, type CommandDialogProps } from "@lifeline/core";
import { Plus, Wallet } from "lucide-react";
import { POCKET_HREF } from "./domain/types";
import { allowanceFor } from "./domain/spend";
import { allowanceRows } from "./domain/derive";
import { formatCents } from "./domain/money";
import { addSpend, allAllowances, allSpends } from "./data/repo";
import { SpendDialog } from "./components/SpendDialog";
import { AllowanceEditorDialog } from "./components/AllowanceEditorDialog";

function SpendCommandDialog(props: CommandDialogProps) {
  return <SpendDialog {...props} />;
}

function NewAllowanceDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <AllowanceEditorDialog {...props} />;
}

export const pocketCommands: CommandDef[] = [
  {
    id: "pocket.spend",
    title: "Spend…",
    keywords: ["pocket", "allowance", "spent", "money", "eating out", "left"],
    icon: Wallet,
    dialog: SpendCommandDialog,
    capture: true,
    args: [
      { key: "allowance", label: "Allowance", kind: "text", required: true, hint: "Id, or the Allowance's name (e.g. Eating out): the one whose period covers the day." },
      { key: "amount", label: "Amount", kind: "number", required: true, hint: "In the currency's units, e.g. 12.5; above zero." },
      { key: "date", label: "Day", kind: "date", hint: "Defaults to today." },
      { key: "label", label: "Label", kind: "text", hint: "What it was, e.g. Pizza." },
    ],
    async invoke(a) {
      const date = (a.date as string | undefined) ?? todayStr();
      const cents = Math.round((a.amount as number) * 100);
      if (!(cents > 0)) throw new Error("Amount must be above zero");
      const allowance = allowanceFor(a.allowance as string, await allAllowances(), date);
      const id = await addSpend({ allowanceId: allowance.id, amount: cents, date, label: a.label as string | undefined });
      const row = allowanceRows([allowance], await allSpends(), todayStr())[0];
      return { id, message: `${formatCents(cents)} from ${allowance.name}: ${formatCents(row.left)} left` };
    },
  },
  { id: "pocket.allowance", title: "New allowance", keywords: ["pocket", "allowance", "budget", "month", "week"], icon: Plus, dialog: NewAllowanceDialog },
  { id: "pocket.open", title: "Go to Pocket", keywords: ["pocket", "allowances", "money", "left"], icon: Wallet, run: ({ navigate }) => navigate(POCKET_HREF) },
];
