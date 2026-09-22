import type { CommandDef } from "@lifeline/core";
import { Plus, ShoppingCart } from "lucide-react";
import { AddNeedDialog } from "./components/AddNeedDialog";
import { SHOPPING_HREF } from "./constants";

function AddNeedCommandDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <AddNeedDialog {...props} />;
}

export const shoppingCommands: CommandDef[] = [
  { id: "shopping.add", title: "Add need…", keywords: ["shopping", "buy", "shop", "list", "need", "groceries", "errand"], icon: Plus, dialog: AddNeedCommandDialog, capture: true },
  { id: "shopping.open", title: "Go to Shopping list", keywords: ["shopping", "list", "buy", "needs", "aisles"], icon: ShoppingCart, run: ({ navigate }) => navigate(SHOPPING_HREF) },
];
