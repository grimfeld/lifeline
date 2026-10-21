import { todayStr, type CommandDef, type CommandDialogProps } from "@lifeline/core";
import { Package, Plus, ReceiptText, Store, Tag } from "lucide-react";
import { DIMENSIONS, DIMENSION_LABEL, PRICES_HREF, PRODUCT, SECONDARY_DIMENSIONS, SHOP, UNIT_LABEL, isDimension, isSecondaryDimension, isUnitOf, type Product, type Unit } from "./domain/types";
import { matchProduct, receiptTitle, unitPrice } from "./domain/derive";
import { amountUnit, defaultAmount, formatUnitPrice, legacyMeasure, measureLabel, measureOf, secondaryMeasure, toBase } from "./domain/measure";
import { formatCents } from "./domain/money";
import { addPrice, addProduct, addShop, allLines, allProducts, allShops, saveReceipt, type LineInput } from "./data/repo";
import { ReceiptDialog } from "./components/ReceiptDialog";
import { AddPriceDialog } from "./components/AddPriceDialog";
import { ProductDialog } from "./components/ProductDialog";
import { ShopDialog } from "./components/ShopDialog";

function NewReceiptDialog(props: CommandDialogProps) {
  return <ReceiptDialog {...props} />;
}
function PriceDialog(props: CommandDialogProps) {
  return <AddPriceDialog {...props} />;
}
function NewProductDialog(props: CommandDialogProps) {
  return <ProductDialog {...props} />;
}
function NewShopDialog(props: CommandDialogProps) {
  return <ShopDialog {...props} />;
}

/** Currency units as a caller types them ("2.49") to cents; undefined when absent. */
function toCents(v: unknown, what: string): number | undefined {
  if (v === undefined) return undefined;
  const cents = Math.round((v as number) * 100);
  if (!(cents >= 0)) throw new Error(`${what} cannot be below zero`);
  return cents;
}

/** What every amount hint says about units (ADR 0084). */
const AMOUNT_UNITS =
  "A number without a unit is read in the unit the Product is shown in: 420 for 420 g of a Product read in grams, 0.42 for one read in kg, 6 for six litres, 12 for a dozen pieces. Give a unit to say it another way.";
const AMOUNT_DEFAULT = "Defaults to 1 for a Product counted in pieces (or its own count name); required for anything weighed, poured or measured, and for a row with no Product yet.";
const UNIT_HINT = "The unit the amount is in, when it is not the Product's own: g, kg, 100g, ml, cl, L, cm, m, pc or the Product's count name. Must be of the Product's dimension — pieces never turn into kilograms.";

/** A row's amount as stored: typed in `unit`, else the Product's reading unit; an unmatched row's amount stays as typed. One by default, for a count only. */
function storedAmount(typed: number | undefined, unit: string | undefined, product: Product | undefined, what: string): number {
  const amount = typed ?? defaultAmount(product);
  if (amount === undefined) throw new Error(`${what}: give the amount — ${product ? `${product.title} is by ${DIMENSION_LABEL[product.dimension].toLowerCase()}, in ${amountUnit(product)}` : "a row with no product has no amount to default to"}`);
  if (!(amount > 0)) throw new Error(`${what}: amount must be above zero`);
  if (!product) return amount;
  try {
    return toBase(amount, unit, product);
  } catch (e) {
    throw new Error(`${what}: ${(e as Error).message}`);
  }
}

const SECOND_AMOUNT_HINT =
  "For a Product with a secondary Measure only (croissants counted and weighed): the second amount. A number without a unit is read in the unit that Measure is shown in — 240 for a 240 g pack when it is shown in grams. Omit to reuse the Product's last pack at this Shop; 0 records none.";
const SECOND_UNIT_HINT = "The unit the second amount is in, when it is not the secondary Measure's own: g, kg, ml, cl or L, of the secondary Measure's dimension.";

/** A second amount as stored, in the secondary Measure's base unit; undefined when absent (prefilled by the repo). */
function storedSecond(amount: unknown, unit: string | undefined, product: Product | undefined, what: string): number | undefined {
  if (amount === undefined) return undefined;
  if (!(Number(amount) >= 0)) throw new Error(`${what}: the second amount cannot be below zero`);
  if (!product) return undefined;
  const second = secondaryMeasure(product);
  if (!second) throw new Error(`${what}: ${product.title} has no secondary measure`);
  try {
    return toBase(Number(amount), unit, second);
  } catch (e) {
    throw new Error(`${what}: ${(e as Error).message}`);
  }
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
          { key: "amount", label: "Amount", kind: "number", hint: `How much the price bought. ${AMOUNT_UNITS} ${AMOUNT_DEFAULT}` },
          { key: "unit", label: "Unit", kind: "text", hint: UNIT_HINT },
          { key: "second_amount", label: "Second amount", kind: "number", hint: SECOND_AMOUNT_HINT },
          { key: "second_unit", label: "Second unit", kind: "text", hint: SECOND_UNIT_HINT },
          { key: "promo", label: "Promotion", kind: "boolean" },
          { key: "product", label: "Product", kind: "link", linkType: PRODUCT, hint: "Omit to let the Shop's remembered labels match it; still unmatched, it waits in the App's inbox." },
        ],
      },
    ],
    returnsDocument: true,
    async invoke(a) {
      const shops = await allShops();
      const products = await allProducts();
      const shopId = a.shop as string;
      const date = (a.date as string | undefined) ?? todayStr();
      const lines: LineInput[] = (a.lines as Record<string, unknown>[]).map((r, i) => {
        const label = r.label as string;
        const productId = (r.product as string | undefined) ?? matchProduct(products, shopId, label)?.id ?? "";
        const product = products.find((p) => p.id === productId);
        const amount = storedAmount(r.amount as number | undefined, r.unit as string | undefined, product, `Lines, row ${i + 1}`);
        const secondAmount = storedSecond(r.second_amount, r.second_unit as string | undefined, product, `Lines, row ${i + 1}`);
        return { label, amount, secondAmount, price: toCents(r.price, `Lines, row ${i + 1}: the price`)!, promo: !!r.promo, productId };
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
      { key: "amount", label: "Amount", kind: "number", hint: `How much the price buys. ${AMOUNT_UNITS} ${AMOUNT_DEFAULT}` },
      { key: "unit", label: "Unit", kind: "text", hint: UNIT_HINT },
      { key: "second_amount", label: "Second amount", kind: "number", hint: SECOND_AMOUNT_HINT },
      { key: "second_unit", label: "Second unit", kind: "text", hint: SECOND_UNIT_HINT },
      { key: "promo", label: "Promotion", kind: "boolean" },
      { key: "bought", label: "Bought it", kind: "boolean", hint: "True only when the user bought it. Defaults to false: a price noticed on a shelf or a flyer, kept as a Sighting that never counts as spending." },
      { key: "date", label: "Day", kind: "date", hint: "Defaults to today." },
    ],
    returnsDocument: true,
    async invoke(a) {
      const cents = toCents(a.price, "The price")!;
      const products = await allProducts();
      const product = products.find((p) => p.id === a.product);
      if (!product) throw new Error("Pick a product");
      const amount = storedAmount(a.amount as number | undefined, a.unit as string | undefined, product, "Amount");
      const secondAmount = storedSecond(a.second_amount, a.second_unit as string | undefined, product, "Second amount");
      const id = await addPrice({ productId: product.id, shopId: a.shop as string, amount, secondAmount, price: cents, promo: !!a.promo, bought: !!a.bought, date: (a.date as string | undefined) ?? todayStr() }, await allShops(), products);
      // Read back in the Product's compared-by unit, from the Line as saved (its second amount may be prefilled).
      const saved = (await allLines()).find((l) => l.receiptId === id);
      const per = product.compareBy === "secondary" && secondaryMeasure(product) ? (saved?.secondAmount ?? 0) : amount;
      const reading = per > 0 ? formatUnitPrice(unitPrice({ price: cents, amount: per }), measureOf(product)) : `${formatCents(cents)}, no second amount`;
      return { id, message: `${product.title}: ${reading}${a.bought ? "" : " (noticed, not bought)"}` };
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
        key: "dimension",
        label: "Dimension",
        kind: "select",
        options: DIMENSIONS.map((d) => ({ value: d, label: DIMENSION_LABEL[d] })),
        hint: "What every price of it is per. Sold by weight → mass, by volume → volume, by the unit, pack or use → count, by the metre (cling film, foil) → length. A pack size is not a new Product. Required, unless the older `measure` is given.",
      },
      {
        key: "measure",
        label: "Measure (older form)",
        kind: "select",
        options: [
          { value: "kg", label: "Per kg" },
          { value: "l", label: "Per litre" },
          { value: "piece", label: "Per piece" },
        ],
        hint: "The older way to say the dimension, still understood: kg = mass read in kg, l = volume read in L, piece = count. Prefer dimension and unit.",
      },
      {
        key: "unit",
        label: "Read in",
        kind: "select",
        options: (Object.keys(UNIT_LABEL) as Unit[]).map((u) => ({ value: u, label: UNIT_LABEL[u] })),
        hint: "The unit it is shown and typed in, of its dimension: mass g, kg or 100g (spices read per 100 g); volume ml or L; length m; count pc. Defaults to kg, L, m or pc. Can be changed later without touching any price.",
      },
      { key: "count_name", label: "Count name", kind: "text", hint: "For a count only: what one is called — roll, wash, sheet, capsule. Omit for pieces." },
      {
        key: "secondary_dimension",
        label: "Secondary measure",
        kind: "select",
        options: SECONDARY_DIMENSIONS.map((d) => ({ value: d, label: DIMENSION_LABEL[d] })),
        hint: "For a count only, when each pack is also weighed or measured (croissants: 4 pc · 240 g): mass or volume. Each line may then carry a second amount.",
      },
      { key: "secondary_unit", label: "Secondary read in", kind: "select", options: (Object.keys(UNIT_LABEL) as Unit[]).map((u) => ({ value: u, label: UNIT_LABEL[u] })), hint: "The secondary Measure's unit: g, kg or 100g for mass; ml or L for volume. Defaults to kg or L." },
      { key: "compare_by", label: "Compare by", kind: "select", options: [{ value: "primary", label: "Primary" }, { value: "secondary", label: "Secondary" }], hint: "Which unit price decides the cheapest shop and the price change: primary (€/pc, eggs) or secondary (€/kg, croissants). Defaults to primary." },
    ],
    returnsDocument: true,
    async invoke(a) {
      // The older `measure` arg (ADR 0082) stands in for a dimension and unit, so agents written before ADR 0084 still work.
      const legacy = a.dimension === undefined ? legacyMeasure(a.measure) : undefined;
      if (a.dimension === undefined && a.measure !== undefined && !legacy) throw new Error(`Unknown measure “${String(a.measure)}”; give a dimension: mass, volume, count or length`);
      const dimension = legacy?.dimension ?? a.dimension;
      if (!isDimension(dimension)) throw new Error("Pick a dimension: mass, volume, count or length");
      const unit = (a.unit as string | undefined) ?? legacy?.unit;
      if (unit !== undefined && !isUnitOf(dimension, unit)) throw new Error(`“${unit}” is not a unit of ${dimension}`);
      const secondaryDimension = a.secondary_dimension as string | undefined;
      if (secondaryDimension !== undefined && !isSecondaryDimension(secondaryDimension)) throw new Error("A secondary measure is mass or volume");
      const id = await addProduct({
        title: a.name as string,
        dimension,
        unit,
        countName: a.count_name as string | undefined,
        secondaryDimension,
        secondaryUnit: a.secondary_unit as Unit | undefined,
        compareBy: a.compare_by === "secondary" ? "secondary" : "primary",
      });
      const product = (await allProducts()).find((p) => p.id === id)!;
      return { id, message: `Product ${product.title}, ${measureLabel(product).toLowerCase()}` };
    },
  },
  {
    id: "prices.shop-add",
    title: "New shop…",
    keywords: ["prices", "shop", "store"],
    icon: Store,
    dialog: NewShopDialog,
    args: [{ key: "name", label: "Name", kind: "text", required: true, hint: "The chain, never the branch: \"Lidl\"." }],
    returnsDocument: true,
    async invoke(a) {
      const id = await addShop({ title: a.name as string });
      return { id, message: `Shop ${a.name as string}` };
    },
  },
  { id: "prices.open", title: "Go to Prices", keywords: ["prices", "receipts", "products", "shops", "inflation"], icon: Tag, run: ({ navigate }) => navigate(PRICES_HREF) },
];
