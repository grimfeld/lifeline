import { lazy } from "react";
import type { AppManifest, DocumentTypeDef } from "@lifeline/core";
import { Package, Receipt as ReceiptIcon, Store, Tag } from "lucide-react";
import { ProductPriceCard, useProductCardTitle, useProductOptions } from "./cards/ProductPriceCard";
import { pricesCommands } from "./commands";
import { pricesDaylog } from "./daylog";
import { formatCents } from "./domain/money";
import { receiptTitle } from "./domain/derive";
import { APP_ID, DIMENSIONS, DIMENSION_LABEL, SECONDARY_DIMENSIONS, LINE, PRICES_COLOR, PRICES_HREF, PRODUCT, RECEIPT, SHOP, productHref, UNIT_LABEL, type Line, type Product, type Receipt, type Shop, type Unit } from "./domain/types";
import { cascadeReceiptDelete, refuseDeletingUsedProduct, refuseDeletingUsedShop } from "./data/repo";
import { measureOf, perUnit, readMeasure, readSecondary } from "./domain/measure";

/** A stored Product's compared-by Measure, whichever shape it was written in. */
function readProductMeasure(d: Product) {
  const m = readMeasure(d);
  return measureOf({ ...m, ...readSecondary(d, m.dimension) });
}
import { ProductPeek, ReceiptPeek, ShopPeek } from "./components/PricesPeeks";

// Screens load on first visit (ADR 0099); the rest of the manifest stays eager.
const PricesScreen = lazy(() => import("./screens/PricesScreen").then((m) => ({ default: m.PricesScreen })));
const ProductScreen = lazy(() => import("./screens/ProductScreen").then((m) => ({ default: m.ProductScreen })));

/**
 * The `price_product` type (ADR 0082, 0084): a thing bought again — a name
 * and a Measure: a dimension, the unit it is read in, and a count's own
 * name. Dimension and unit are guarded: a unit must belong to its
 * dimension, and a new dimension goes through the Product dialog, which
 * sends the Product's Lines to the needs-amount inbox; the count name is free.
 * A count may also be measured — a secondary dimension and unit, guarded the
 * same way since a change clears second amounts — and compared by either. `labels` is the App's memory of what
 * each Shop prints for it (guarded, hidden).
 */
const productType: DocumentTypeDef = {
  id: PRODUCT,
  label: "Products",
  icon: Package,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "dimension", label: "Dimension", kind: "select", options: DIMENSIONS.map((d) => ({ value: d, label: DIMENSION_LABEL[d] })), guarded: true, required: true, column: true },
    { key: "unit", label: "Read in", kind: "select", options: (Object.keys(UNIT_LABEL) as Unit[]).map((u) => ({ value: u, label: UNIT_LABEL[u] })), guarded: true, required: true, column: true },
    { key: "countName", label: "Count name", kind: "text" },
    { key: "secondaryDimension", label: "Also measured", kind: "select", options: SECONDARY_DIMENSIONS.map((d) => ({ value: d, label: DIMENSION_LABEL[d] })), guarded: true },
    { key: "secondaryUnit", label: "Also measured in", kind: "select", options: (Object.keys(UNIT_LABEL) as Unit[]).map((u) => ({ value: u, label: UNIT_LABEL[u] })), guarded: true },
    { key: "compareBy", label: "Compare by", kind: "select", options: [{ value: "primary", label: "Primary" }, { value: "secondary", label: "Secondary" }] },
    { key: "labels", label: "Remembered labels", kind: "json", guarded: true, hidden: true },
  ],
  linkable: { subtitle: (d) => `Product · €${perUnit(readProductMeasure(d as Product))}` },
  href: (d) => productHref(d.id),
  peekEdit: ProductPeek,
  onDelete: refuseDeletingUsedProduct,
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
  peekEdit: ShopPeek,
  onDelete: refuseDeletingUsedShop,
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
  peekEdit: ReceiptPeek,
  onDelete: cascadeReceiptDelete,
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
    { key: "amount", label: "Amount (kg, L, m or count)", kind: "number", column: true },
    { key: "price", label: "Paid (cents)", kind: "number", column: true },
    { key: "promo", label: "Promo", kind: "boolean", column: true },
    { key: "needsAmount", label: "Needs amount", kind: "boolean", guarded: true, column: true },
    { key: "secondAmount", label: "Second amount (kg or L)", kind: "number" },
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
