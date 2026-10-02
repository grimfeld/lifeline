import { todayStr, type CommandDef } from "@lifeline/core";
import { Camera, Plus, Tag } from "lucide-react";
import { PRICES_HREF, PRODUCT, SHOP } from "./domain/types";
import { formatUnitPrice, unitPrice } from "./domain/derive";
import { addPrice, allProducts, allShops } from "./data/repo";
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
  {
    id: "prices.add",
    title: "Add price…",
    keywords: ["prices", "price", "shelf", "product", "shop", "groceries"],
    icon: Plus,
    dialog: PriceDialog,
    capture: true,
    args: [
      { key: "product", label: "Product", kind: "link", linkType: PRODUCT, required: true, hint: "An existing Product; new ones are made in the App." },
      { key: "shop", label: "Shop", kind: "link", linkType: SHOP, required: true },
      { key: "price", label: "Price paid", kind: "number", required: true, hint: "In the currency's units, e.g. 2.49." },
      { key: "amount", label: "Amount", kind: "number", hint: "How much of the Product's measure the price buys (kg, l, pieces…). Defaults to 1." },
      { key: "promo", label: "Promotion", kind: "boolean" },
      { key: "date", label: "Day", kind: "date", hint: "Defaults to today." },
    ],
    async invoke(a) {
      const cents = Math.round((a.price as number) * 100);
      if (!(cents >= 0)) throw new Error("Type the price paid");
      const amount = (a.amount as number | undefined) ?? 1;
      if (!(amount > 0)) throw new Error("Amount must be above zero");
      const products = await allProducts();
      const id = await addPrice({ productId: a.product as string, shopId: a.shop as string, amount, price: cents, promo: !!a.promo, date: (a.date as string | undefined) ?? todayStr() }, await allShops(), products);
      const product = products.find((p) => p.id === a.product)!;
      return { id, message: `${product.title}: ${formatUnitPrice(unitPrice({ price: cents, amount }), product.measure)}` };
    },
  },
  { id: "prices.open", title: "Go to Prices", keywords: ["prices", "receipts", "products", "shops", "inflation"], icon: Tag, run: ({ navigate }) => navigate(PRICES_HREF) },
];
