import type { CommandDef } from "@lifeline/core";
import { Camera, Plus, Tag } from "lucide-react";
import { PRICES_HREF } from "./domain/types";
import { ScanReceiptDialog } from "./components/ScanReceiptDialog";
import { AddPriceDialog } from "./components/AddPriceDialog";

function ScanDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <ScanReceiptDialog {...props} />;
}
function PriceDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <AddPriceDialog {...props} />;
}

/** Two capture Commands (ADR 0045): the receipt at the kitchen table, the price spotted on a shelf. */
export const pricesCommands: CommandDef[] = [
  { id: "prices.scan", title: "Scan receipt…", keywords: ["prices", "receipt", "ticket", "ocr", "photo", "groceries", "shop"], icon: Camera, dialog: ScanDialog, capture: true },
  { id: "prices.add", title: "Add price…", keywords: ["prices", "price", "shelf", "product", "shop", "groceries"], icon: Plus, dialog: PriceDialog, capture: true },
  { id: "prices.open", title: "Go to Prices", keywords: ["prices", "receipts", "products", "shops", "inflation"], icon: Tag, run: ({ navigate }) => navigate(PRICES_HREF) },
];
