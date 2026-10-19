import type { AppManifest, DocumentTypeDef } from "@lifeline/core";
import { Package, Receipt as ReceiptIcon, Store, Tag } from "lucide-react";
import { PricesScreen } from "./screens/PricesScreen";
import { ProductScreen } from "./screens/ProductScreen";
import { ProductPriceCard, useProductCardTitle, useProductOptions } from "./cards/ProductPriceCard";
import { pricesCommands } from "./commands";
import { pricesDaylog } from "./daylog";
import { formatCents } from "./domain/money";
import { receiptTitle } from "./domain/derive";
import { APP_ID, LINE, MEASURES, MEASURE_LABEL, MEASURE_PER, PRICES_COLOR, PRICES_HREF, PRODUCT, RECEIPT, SHOP, productHref, type Line, type Product, type Receipt, type Shop } from "./domain/types";
import { ProductPeek } from "./components/ProductPeek";

/**
 * The `price_product` type (ADR 0082): a thing bought again — a name and a
 * measure fixed at creation. `labels` is the App's memory of what each Shop
 * prints for it (guarded, hidden).
 */
const productType: DocumentTypeDef = {
  id: PRODUCT,
  label: "Products",
  icon: Package,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "measure", label: "Measure", kind: "select", options: MEASURES.map((m) => ({ value: m, label: MEASURE_LABEL[m] })), guarded: true, required: true, column: true },
    { key: "labels", label: "Remembered labels", kind: "json", guarded: true, hidden: true },
  ],
  linkable: { subtitle: (d) => `Product · €${MEASURE_PER[(d as Product).measure] ?? ""}` },
  href: (d) => productHref(d.id),
  peek: ProductPeek,
  order: 87,
  builtIn: true,
};

/** The `price_shop` type: a chain, never a branch. */
const shopType: DocumentTypeDef = {
  id: SHOP,
  label: "Shops",
  icon: Store,
  titleRule: "name",
  body: "none",
  fields: [{ key: "note", label: "Note", kind: "text", column: true }],
  linkable: { subtitle: () => "Shop" },
  href: () => `${PRICES_HREF}?tab=shops`,
  order: 88,
  builtIn: true,
};

/** The `price_receipt` type: one buying occasion — or, marked noticed, a Sighting (ADR 0084); the photo lives in the optional body as an Attachment embed. */
const receiptType: DocumentTypeDef = {
  id: RECEIPT,
  label: "Receipts",
  icon: ReceiptIcon,
  titleRule: "derived",
  titleOf: (d) => receiptTitle("", (d as Receipt).date),
  body: "optional",
  fields: [
    { key: "shopId", label: "Shop", kind: "link", linkType: SHOP, guarded: true, required: true, column: true },
    { key: "date", label: "Day", kind: "date", required: true, column: true },
    { key: "branch", label: "Branch", kind: "text", column: true },
    { key: "total", label: "Printed total (cents)", kind: "number", column: true },
    { key: "noticed", label: "Noticed, not bought", kind: "boolean", column: true },
  ],
  indexes: ["shopId", "date"],
  href: () => `${PRICES_HREF}?tab=receipts`,
  order: 89,
  builtIn: true,
};

/** The `price_line` internal type: one priced entry on a Receipt — the only fact price history is made of. */
const lineType: DocumentTypeDef = {
  id: LINE,
  label: "Receipt lines",
  icon: Tag,
  internal: true,
  titleRule: "derived",
  titleOf: (d) => {
    const l = d as Line;
    return `${l.label || "Line"} · ${formatCents(Number(l.price) || 0)}`;
  },
  body: "none",
  fields: [
    { key: "receiptId", label: "Receipt", kind: "link", linkType: RECEIPT, guarded: true, required: true, column: true },
    { key: "productId", label: "Product", kind: "link", linkType: PRODUCT, guarded: true, column: true },
    { key: "label", label: "Label", kind: "text", column: true },
    { key: "amount", label: "Amount", kind: "number", column: true },
    { key: "price", label: "Paid (cents)", kind: "number", column: true },
    { key: "promo", label: "Promo", kind: "boolean", column: true },
  ],
  indexes: ["receiptId", "productId"],
  href: () => `${PRICES_HREF}?tab=receipts`,
  order: 90,
  builtIn: true,
};

/** Prices App (ADR 0082): what regular purchases cost, where, and over time — apart from the Ledger's bank facts and Pantry's stock. */
export const pricesApp: AppManifest = {
  id: APP_ID,
  module: "money",
  title: "Prices",
  icon: Tag,
  color: PRICES_COLOR,
  types: [productType, shopType, receiptType, lineType],
  screens: [
    { id: "prices.home", title: "Prices", path: "prices", icon: Tag, component: PricesScreen },
    { id: "prices.product", title: "Product", path: "prices/p/:id", component: ProductScreen, hidden: true },
  ],
  cards: [
    {
      id: "prices.product",
      title: "Product price",
      description: "One product: its cheapest shop's usual price, every shop beside it, and the trend",
      component: ProductPriceCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: { product: { kind: "entity", label: "Product", required: true, useOptions: useProductOptions } },
      instanceTitle: useProductCardTitle,
    },
  ],
  commands: pricesCommands,
  daylog: pricesDaylog,
};

export { LINE, PRODUCT, RECEIPT, SHOP };
export type { Line, Product, Receipt, Shop };
