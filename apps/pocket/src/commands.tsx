import type { CommandDef } from "@lifeline/core";
import { Plus, Wallet } from "lucide-react";
import { POCKET_HREF } from "./domain/types";
import { SpendDialog } from "./components/SpendDialog";
import { AllowanceEditorDialog } from "./components/AllowanceEditorDialog";

function SpendCommandDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <SpendDialog {...props} />;
}

function NewAllowanceDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <AllowanceEditorDialog {...props} />;
}

export const pocketCommands: CommandDef[] = [
  { id: "pocket.spend", title: "Spend…", keywords: ["pocket", "allowance", "spent", "money", "eating out", "left"], icon: Wallet, dialog: SpendCommandDialog, capture: true },
  { id: "pocket.allowance", title: "New allowance", keywords: ["pocket", "allowance", "budget", "month", "week"], icon: Plus, dialog: NewAllowanceDialog },
  { id: "pocket.open", title: "Go to Pocket", keywords: ["pocket", "allowances", "money", "left"], icon: Wallet, run: ({ navigate }) => navigate(POCKET_HREF) },
];
