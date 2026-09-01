import type { CommandDef } from "@lifeline/core";
import { Plus, ShoppingBasket } from "lucide-react";
import { ProvisionDialog } from "./components/ProvisionDialog";
import { PANTRY_HREF } from "./constants";

function AddProvisionCommandDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <ProvisionDialog {...props} />;
}

export const pantryCommands: CommandDef[] = [
  { id: "pantry.add", title: "Add provision…", keywords: ["pantry", "stock", "food", "freezer", "fridge", "grocery", "restock"], icon: Plus, dialog: AddProvisionCommandDialog, capture: true },
  { id: "pantry.open", title: "Go to Pantry", keywords: ["pantry", "stocks", "freezer", "fridge", "food", "provisions"], icon: ShoppingBasket, run: ({ navigate }) => navigate(PANTRY_HREF) },
];
