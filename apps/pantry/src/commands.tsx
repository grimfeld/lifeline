import type { CommandDef, CommandDialogProps } from "@lifeline/core";
import { STORAGE } from "./domain/types";
import { matchByTitle } from "./domain/rules";
import { addProvision, allProvisions } from "./data/repo";
import { Plus, ShoppingBasket } from "lucide-react";
import { ProvisionDialog } from "./components/ProvisionDialog";
import { PANTRY_HREF } from "./constants";

function AddProvisionCommandDialog(props: CommandDialogProps) {
  return <ProvisionDialog {...props} />;
}

export const pantryCommands: CommandDef[] = [
  {
    id: "pantry.add",
    title: "Add provision…",
    keywords: ["pantry", "stock", "food", "freezer", "fridge", "grocery", "restock"],
    icon: Plus,
    dialog: AddProvisionCommandDialog,
    capture: true,
    args: [
      { key: "title", label: "Provision", kind: "text", required: true },
      { key: "storage", label: "Storage", kind: "link", linkType: STORAGE, required: true, hint: "The freezer, fridge or shelf it is kept in." },
      { key: "quantity", label: "Quantity", kind: "number", hint: "Defaults to 1." },
      { key: "unit", label: "Unit", kind: "text", hint: "e.g. bags, jars." },
      { key: "minimum", label: "Minimum", kind: "number", hint: "Running low below this." },
      { key: "expires", label: "Expires", kind: "date" },
      { key: "frozenOn", label: "Frozen on", kind: "date" },
      { key: "tags", label: "Tags", kind: "list" },
    ],
    async invoke(a) {
      const title = (a.title as string).trim();
      const storageId = a.storage as string;
      const hit = matchByTitle(await allProvisions(), storageId, title);
      if (hit) throw new Error(`“${hit.title}” is already in that storage (${hit.quantity}${hit.unit ? ` ${hit.unit}` : ""}); tell the user — nothing was changed`);
      const id = await addProvision({
        title,
        storageId,
        quantity: a.quantity as number | undefined,
        unit: a.unit as string | undefined,
        minimum: a.minimum as number | undefined,
        expires: a.expires as string | undefined,
        frozenOn: a.frozenOn as string | undefined,
        tags: a.tags as string[] | undefined,
      });
      return { id, message: `${title} added to the pantry` };
    },
  },
  { id: "pantry.open", title: "Go to Pantry", keywords: ["pantry", "stocks", "freezer", "fridge", "food", "provisions"], icon: ShoppingBasket, run: ({ navigate }) => navigate(PANTRY_HREF) },
];
