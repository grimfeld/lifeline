import { todayStr, type CommandDef } from "@lifeline/core";
import { Package, Plus, ReceiptText, Store, Tag } from "lucide-react";
import { MEASURES, MEASURE_LABEL, PRICES_HREF, PRODUCT, SHOP, isMeasure } from "./domain/types";
import { formatUnitPrice, matchProduct, receiptTitle, unitPrice } from "./domain/derive";
import { formatCents } from "./domain/money";
import { addPrice, addProduct, addShop, allProducts, allShops, saveReceipt, type LineInput } from "./data/repo";
import { ReceiptDialog } from "./components/ReceiptDialog";
import { AddPriceDialog } from "./components/AddPriceDialog";
import { ProductDialog } from "./components/ProductDialog";
import { ShopDialog } from "./components/ShopDialog";

function NewReceiptDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <ReceiptDialog {...props} />;
}
function PriceDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <AddPriceDialog {...props} />;
}
function NewProductDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <ProductDialog {...props} />;
}
function NewShopDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <ShopDialog {...props} />;
}

/** Currency units as a caller types them ("2.49") to cents; undefined when absent. */
function toCents(v: unknown, what: string): number | undefined {
  if (v === undefined) return undefined;
  const cents = Math.round((v as number) * 100);
  if (!(cents >= 0)) throw new Error(`${what} cannot be below zero`);
  return cents;
}

/**
 * Two capture Commands (ADR 0082): the receipt at the kitchen table, the price spotted on a shelf.
 * Lifeline reads no photo (ADR 0075): an agent reads the receipt and runs "Add receipt…" headless,
 * making the Products and Shops it is missing first.
 */
export const pricesCommands: CommandDef[] = [
  {
    id: "prices.receipt",
    title: "Add receipt…",
    keywords: ["prices", "receipt", "ticket", "groceries", "shop", "scan"],
    icon: ReceiptText,
    dialog: NewReceiptDialog,
    capture: true,
    args: [
      { key: "shop", label: "Shop", kind: "link", linkType: SHOP, required: true, hint: "The chain, never the branch. A missing one is made with prices_shop_add first." },
      { key: "date", label: "Day", kind: "date", hint: "The day printed on the receipt. Defaults to today." },
      { key: "total", label: "Printed total", kind: "number", hint: "The total as printed, in the currency's units, e.g. 54.20. Omit when none is printed." },
      { key: "branch", label: "Branch", kind: "text", hint: "Free text from the header, e.g. the street." },
      {
        key: "lines",
        label: "Lines",
        kind: "rows",
        required: true,
        hint: "One row per priced entry. A discount printed on its own line is folded into the line it belongs to, which is then a promo.",
        of: [
          { key: "label", label: "Label", kind: "text", required: true, hint: "As printed." },
          { key: "price", label: "Price paid", kind: "number", required: true, hint: "After any discount, in the currency's units." },
          { key: "amount", label: "Amount", kind: "number", hint: "In the Product's measure: 0.42 for 420 g of a kg Product, 6 for six litres, 12 for a dozen pieces. Defaults to 1." },
          { key: "promo", label: "Promotion", kind: "boolean" },
          { key: "product", label: "Product", kind: "link", linkType: PRODUCT, hint: "Omit to let the Shop's remembered labels match it; still unmatched, it waits in the App's inbox." },
        ],
      },
    ],
    async invoke(a) {
      const shops = await allShops();
      const products = await allProducts();
      const shopId = a.shop as string;
      const date = (a.date as string | undefined) ?? todayStr();
      const lines: LineInput[] = (a.lines as Record<string, unknown>[]).map((r, i) => {
        const label = r.label as string;
        const amount = (r.amount as number | undefined) ?? 1;
        if (!(amount > 0)) throw new Error(`Lines, row ${i + 1}: amount must be above zero`);
        const productId = (r.product as string | undefined) ?? matchProduct(products, shopId, label)?.id ?? "";
        return { label, amount, price: toCents(r.price, `Lines, row ${i + 1}: the price`)!, promo: !!r.promo, productId };
      });
      const total = toCents(a.total, "The printed total") ?? 0;
      const id = await saveReceipt({ shopId, date, branch: a.branch as string | undefined, total, lines }, shops, products);
      const sum = lines.reduce((s, l) => s + l.price, 0);
      const unmatched = lines.filter((l) => !l.productId).length;
      const parts = [`${lines.length} line${lines.length === 1 ? "" : "s"}`, unmatched ? `${unmatched} unmatched` : "all matched"];
      const gap = total > 0 && sum !== total ? `; lines sum to ${formatCents(sum)}, printed total ${formatCents(total)}` : "";
      return { id, message: `${receiptTitle(shops.find((s) => s.id === shopId)?.title ?? "", date)}: ${parts.join(", ")}${gap}` };
    },
  },
  {
    id: "prices.add",
    title: "Add price…",
    keywords: ["prices", "price", "shelf", "product", "shop", "groceries"],
    icon: Plus,
    dialog: PriceDialog,
    capture: true,
    args: [
      { key: "product", label: "Product", kind: "link", linkType: PRODUCT, required: true, hint: "An existing Product; a missing one is made with prices_product_add first." },
      { key: "shop", label: "Shop", kind: "link", linkType: SHOP, required: true },
      { key: "price", label: "Price paid", kind: "number", required: true, hint: "In the currency's units, e.g. 2.49." },
      { key: "amount", label: "Amount", kind: "number", hint: "How much of the Product's measure the price buys (kg, l, pieces…). Defaults to 1." },
      { key: "promo", label: "Promotion", kind: "boolean" },
      { key: "date", label: "Day", kind: "date", hint: "Defaults to today." },
    ],
    async invoke(a) {
      const cents = toCents(a.price, "The price")!;
      const amount = (a.amount as number | undefined) ?? 1;
      if (!(amount > 0)) throw new Error("Amount must be above zero");
      const products = await allProducts();
      const id = await addPrice({ productId: a.product as string, shopId: a.shop as string, amount, price: cents, promo: !!a.promo, date: (a.date as string | undefined) ?? todayStr() }, await allShops(), products);
      const product = products.find((p) => p.id === a.product)!;
      return { id, message: `${product.title}: ${formatUnitPrice(unitPrice({ price: cents, amount }), product.measure)}` };
    },
  },
  {
    id: "prices.product-add",
    title: "New product…",
    keywords: ["prices", "product"],
    icon: Package,
    dialog: NewProductDialog,
    args: [
      { key: "name", label: "Name", kind: "text", required: true, hint: "What the user calls it, not the printed label: \"Semi-skimmed milk\"." },
      {
        key: "measure",
        label: "Measure",
        kind: "select",
        required: true,
        options: MEASURES.map((m) => ({ value: m, label: MEASURE_LABEL[m] })),
        hint: "Fixed for good: every price of it is per this. Sold by weight → kg, by volume → l, by the unit or pack → piece. A pack size is not a new Product.",
      },
    ],
    async invoke(a) {
      if (!isMeasure(a.measure)) throw new Error("Pick a measure");
      const id = await addProduct({ title: a.name as string, measure: a.measure });
      return { id, message: `Product ${a.name as string}, per ${MEASURE_LABEL[a.measure].toLowerCase()}` };
    },
  },
  {
    id: "prices.shop-add",
    title: "New shop…",
    keywords: ["prices", "shop", "store"],
    icon: Store,
    dialog: NewShopDialog,
    args: [{ key: "name", label: "Name", kind: "text", required: true, hint: "The chain, never the branch: \"Lidl\"." }],
    async invoke(a) {
      const id = await addShop({ title: a.name as string });
      return { id, message: `Shop ${a.name as string}` };
    },
  },
  { id: "prices.open", title: "Go to Prices", keywords: ["prices", "receipts", "products", "shops", "inflation"], icon: Tag, run: ({ navigate }) => navigate(PRICES_HREF) },
];
