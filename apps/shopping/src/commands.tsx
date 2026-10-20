import type { CommandDef, CommandDialogProps } from "@lifeline/core";
import { AISLE } from "./domain/types";
import { addOutcome } from "./domain/rules";
import { addNeed, allNeeds } from "./data/repo";
import { Plus, ShoppingCart } from "lucide-react";
import { AddNeedDialog } from "./components/AddNeedDialog";
import { SHOPPING_HREF } from "./constants";

function AddNeedCommandDialog(props: CommandDialogProps) {
  return <AddNeedDialog {...props} />;
}

export const shoppingCommands: CommandDef[] = [
  {
    id: "shopping.add",
    title: "Add need…",
    keywords: ["shopping", "buy", "shop", "list", "need", "groceries", "errand"],
    icon: Plus,
    dialog: AddNeedCommandDialog,
    capture: true,
    args: [
      { key: "title", label: "Thing", kind: "text", required: true, hint: "One thing to buy, e.g. Milk. A thing bought before comes back onto the list." },
      { key: "note", label: "Note", kind: "text", hint: "e.g. the big pack." },
      { key: "aisle", label: "Aisle", kind: "link", linkType: AISLE },
    ],
    async invoke(a) {
      const title = a.title as string;
      const out = addOutcome(await allNeeds(), title);
      if (out.kind === "listed") throw new Error(`“${out.need.title}” is already on the shopping list; tell the user — nothing was changed`);
      const res = await addNeed({ title, note: a.note as string | undefined, aisleId: a.aisle as string | undefined });
      if (!res) throw new Error("Name the thing to buy");
      return { id: res.id, message: res.kind === "revive" ? `${title} — back on the list` : `${title} added to the shopping list` };
    },
  },
  { id: "shopping.open", title: "Go to Shopping list", keywords: ["shopping", "list", "buy", "needs", "aisles"], icon: ShoppingCart, run: ({ navigate }) => navigate(SHOPPING_HREF) },
];
