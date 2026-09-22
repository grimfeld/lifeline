import type { CommandDef } from "@lifeline/core";
import { Gavel, PiggyBank, Plus } from "lucide-react";
import { SWEARJAR_HREF } from "./domain/types";
import { FineDialog } from "./components/FineDialog";
import { OffenceEditorDialog } from "./components/OffenceEditorDialog";

function FineCommandDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <FineDialog {...props} />;
}

function NewOffenceDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <OffenceEditorDialog {...props} />;
}

export const swearjarCommands: CommandDef[] = [
  { id: "swearjar.fine", title: "Log a fine…", keywords: ["swear jar", "fine", "offence", "jar", "swore", "penalty"], icon: Gavel, dialog: FineCommandDialog, capture: true },
  { id: "swearjar.offence", title: "New offence", keywords: ["swear jar", "offence", "fine", "price"], icon: Plus, dialog: NewOffenceDialog },
  { id: "swearjar.open", title: "Go to Swear Jar", keywords: ["swear jar", "jar", "fines", "offences"], icon: PiggyBank, run: ({ navigate }) => navigate(SWEARJAR_HREF) },
];
