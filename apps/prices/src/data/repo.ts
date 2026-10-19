import { useMemo } from "react";
import { addAttachment, documentsOf, documentsWhere, normalizeTags, patchDocument, putDocument, removeDocument, removeDocumentsWhere, todayStr, useDocument, useDocuments, type DateStr } from "@lifeline/core";
import { LINE, PRODUCT, RECEIPT, SHOP, isDimension, isSecondaryDimension, isUnitOf, type Basis, type Dimension, type LabelMemory, type Line, type Product, type Receipt, type SecondaryDimension, type Shop, type Unit } from "../domain/types";
import { fromAmount, matchedAmount, readMeasure, readSecondary, secondaryMeasure } from "../domain/measure";
import { clearsSecondAmounts, lastSecondAmount, linesToRetype, observe, receiptTitle, relabel, withLabel, withoutLabel, type LineMatch } from "../domain/derive";

/**
 * PocketBase returns absent fields as "" / undefined; re-establish shapes on
 * read. A Product written before ADR 0084 carries `measure: "kg" | "l" |
 * "piece"` — read as mass/kg, volume/L, count/pc until a sync brings the
 * migrated row.
 */
function normalizeProduct(p: Product): Product {
  const labels = Array.isArray(p.labels) ? p.labels.filter((l): l is LabelMemory => !!l && typeof l === "object" && typeof l.shopId === "string" && typeof l.label === "string") : [];
  const { measure: _old, ...rest } = p as Product & { measure?: unknown };
  const measure = readMeasure(p as Product & { measure?: unknown });
  return { ...rest, ...measure, ...readSecondary(p, measure.dimension), labels, tags: p.tags ?? [] };
}
function normalizeShop(s: Shop): Shop {
  return { ...s, note: s.note ?? "", tags: s.tags ?? [] };
}
function normalizeReceipt(r: Receipt): Receipt {
  return { ...r, shopId: r.shopId ?? "", date: r.date || r.createdAt, branch: r.branch ?? "", total: Math.max(0, Math.round(Number(r.total) || 0)), noticed: !!r.noticed, tags: r.tags ?? [] };
}
function normalizeLine(l: Line): Line {
  return { ...l, receiptId: l.receiptId ?? "", productId: l.productId ?? "", label: l.label ?? "", amount: Number(l.amount) > 0 ? Number(l.amount) : 1, price: Math.round(Number(l.price) || 0), promo: !!l.promo, needsAmount: !!l.needsAmount, secondAmount: Number(l.secondAmount) > 0 ? Number(l.secondAmount) : 0, tags: l.tags ?? [] };
}

// ---- Reads ----

export function useProducts(): Product[] {
  const rows = useDocuments<Product>(PRODUCT);
  return useMemo(() => rows.map(normalizeProduct).sort((a, b) => a.title.localeCompare(b.title)), [rows]);
}
export function useProduct(id: string | undefined): Product | undefined {
  const row = useDocument<Product>(id);
  return useMemo(() => (row ? normalizeProduct(row) : undefined), [row]);
}
export async function allProducts(): Promise<Product[]> {
  return (await documentsOf<Product>(PRODUCT)).map(normalizeProduct);
}

export async function allShops(): Promise<Shop[]> {
  return (await documentsOf<Shop>(SHOP)).map(normalizeShop);
}

export async function allReceipts(): Promise<Receipt[]> {
  return (await documentsOf<Receipt>(RECEIPT)).map(normalizeReceipt);
}

export async function allLines(): Promise<Line[]> {
  return (await documentsOf<Line>(LINE)).map(normalizeLine);
}

export function useShops(): Shop[] {
  const rows = useDocuments<Shop>(SHOP);
  return useMemo(() => rows.map(normalizeShop).sort((a, b) => a.title.localeCompare(b.title)), [rows]);
}
export function useReceipts(): Receipt[] {
  const rows = useDocuments<Receipt>(RECEIPT);
  return useMemo(() => rows.map(normalizeReceipt), [rows]);
}
export function useLines(): Line[] {
  const rows = useDocuments<Line>(LINE);
  return useMemo(() => rows.map(normalizeLine), [rows]);
}

/** One thing per name (CONTEXT.md "Command"): adding or renaming onto a name already taken is refused, case and outer spaces aside. */
function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// ---- Shops ----

export interface ShopInput {
  title: string;
  note?: string;
}

export async function addShop(input: ShopInput): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new Error("Give the shop a name");
  if ((await allShops()).some((s) => sameName(s.title, title))) throw new Error(`There is already a shop called “${title}”`);
  const row = await putDocument<Shop>({ type: SHOP, title, note: input.note?.trim() ?? "", folder: "", tags: [] } as unknown as Shop);
  return row.id;
}

/** Renaming a Shop retitles its Receipts — the title is written, not derived from a join. */
export async function updateShop(shop: Shop, input: ShopInput): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error("Give the shop a name");
  if ((await allShops()).some((s) => s.id !== shop.id && sameName(s.title, title))) throw new Error(`There is already a shop called “${title}”`);
  await putDocument<Shop>({ ...shop, title, note: input.note?.trim() ?? "" });
  if (title !== shop.title) for (const r of await documentsWhere<Receipt>(RECEIPT, "shopId", shop.id)) await patchDocument(r.id, { title: receiptTitle(title, r.date) });
}

/** Blocked while Receipts reference it (ADR 0082). */
export async function deleteShop(id: string): Promise<void> {
  if ((await documentsWhere<Receipt>(RECEIPT, "shopId", id)).length > 0) throw new Error("Shop has receipts — it stays");
  await removeDocument(id);
}

// ---- Products ----

export interface ProductInput {
  title: string;
  dimension: Dimension;
  /** Defaults to the dimension's base unit. */
  unit?: Unit;
  /** A count's own name — "roll", "wash"; ignored off a count. */
  countName?: string;
  /** A counted Product's second Measure (ADR 0084); "" = none. */
  secondaryDimension?: SecondaryDimension | "";
  /** Defaults to the secondary dimension's base unit. */
  secondaryUnit?: Unit;
  /** Defaults to primary; secondary only with a secondary Measure. */
  compareBy?: Basis;
  tags?: string[];
}

/** The secondary Measure fields as written: only on a count, a unit of its own dimension. */
function secondaryFields(dimension: Dimension, secondaryDimension: SecondaryDimension | "" | undefined, secondaryUnit: Unit | undefined, compareBy: Basis | undefined) {
  if (secondaryDimension && !isSecondaryDimension(secondaryDimension)) throw new Error("A secondary measure is mass or volume");
  if (secondaryDimension && dimension !== "count") throw new Error("Only a count product has a secondary measure");
  if (secondaryDimension && secondaryUnit !== undefined && !isUnitOf(secondaryDimension, secondaryUnit)) throw new Error(`“${secondaryUnit}” is not a unit of ${secondaryDimension}`);
  return readSecondary({ secondaryDimension, secondaryUnit, compareBy }, dimension);
}

/** The Measure fields as written: the unit checked against the dimension, a count name only on a count. */
function measureFields(dimension: Dimension, unit: Unit | undefined, countName: string | undefined) {
  if (!isDimension(dimension)) throw new Error("Pick a dimension: mass, volume, count or length");
  const u = unit ?? readMeasure({ dimension }).unit;
  if (!isUnitOf(dimension, u)) throw new Error(`“${u}” is not a unit of ${dimension}`);
  return { dimension, unit: u, countName: dimension === "count" ? (countName ?? "").trim() : "" };
}

export async function addProduct(input: ProductInput): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new Error("Give the product a name");
  const measure = measureFields(input.dimension, input.unit, input.countName);
  const secondary = secondaryFields(measure.dimension, input.secondaryDimension, input.secondaryUnit, input.compareBy);
  if ((await allProducts()).some((p) => sameName(p.title, title))) throw new Error(`There is already a product called “${title}”`);
  const row = await putDocument<Product>({ type: PRODUCT, title, ...measure, ...secondary, labels: [], folder: "", tags: normalizeTags(input.tags ?? []) } as unknown as Product);
  return row.id;
}

/**
 * Rename, retag, or change the Measure (ADR 0084). Amounts are kept in the
 * dimension's base unit, so a new reading unit or count name rewrites no
 * Line. A new dimension applies at once and sends every Line of the Product
 * to the needs-amount inbox (see linesToRetype) — nothing is converted.
 * Second amounts go when the secondary Measure is removed or changes
 * dimension, or the primary leaves count (taking the secondary with it); a
 * new secondary reading unit or compare-by rewrites no Line.
 */
export async function updateProduct(product: Product, input: Partial<Omit<ProductInput, "title">> & { title: string }): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error("Give the product a name");
  const dimension = input.dimension ?? product.dimension;
  const moved = dimension !== product.dimension;
  const measure = measureFields(dimension, input.unit ?? (moved ? undefined : product.unit), input.countName ?? (moved ? "" : product.countName));
  const secondDimension = measure.dimension === "count" ? (input.secondaryDimension ?? product.secondaryDimension) : "";
  const secondMoved = secondDimension !== product.secondaryDimension;
  const secondary = secondaryFields(measure.dimension, secondDimension, input.secondaryUnit ?? (secondMoved ? undefined : product.secondaryUnit), input.compareBy ?? product.compareBy);
  if ((await allProducts()).some((p) => p.id !== product.id && sameName(p.title, title))) throw new Error(`There is already a product called “${title}”`);
  // Lines first: cut short, the inbox holds a few Lines too many — never an
  // old-dimension amount read as a price in the new one, nor a second amount
  // read in a secondary Measure it was never typed in.
  const clearSeconds = clearsSecondAmounts(product, { dimension: measure.dimension, secondaryDimension: secondary.secondaryDimension });
  if (moved || clearSeconds) {
    const lines = await documentsWhere<Line>(LINE, "productId", product.id);
    const retype = new Set(linesToRetype(lines, product, dimension).map((l) => l.id));
    const changed = lines.filter((l) => retype.has(l.id) || (clearSeconds && Number(l.secondAmount) > 0));
    await Promise.all(changed.map((l) => patchDocument(l.id, { ...(retype.has(l.id) && { needsAmount: true }), ...(clearSeconds && { secondAmount: 0 }) })));
  }
  await putDocument<Product>({ ...product, title, ...measure, ...secondary, tags: normalizeTags(input.tags ?? product.tags) });
}

/** Blocked while Lines reference it — merge instead (ADR 0082). */
export async function deleteProduct(id: string): Promise<void> {
  if ((await documentsWhere<Line>(LINE, "productId", id)).length > 0) throw new Error("Product has prices — merge it into another instead");
  await removeDocument(id);
}

/**
 * Merge, whatever the two Measures (ADR 0084): Lines repoint, remembered
 * labels carry over, the source goes. Within one dimension amounts are in its
 * base unit and carry over meaning the same; across dimensions the source's
 * Lines arrive needing an amount in the target's Measure (see linesToRetype).
 * Second amounts carry over only into the same secondary Measure; otherwise
 * they are cleared, as a Measure change would (see clearsSecondAmounts).
 */
export async function mergeProduct(from: Product, into: Product): Promise<void> {
  if (from.id === into.id) throw new Error("Pick a different product to merge into");
  const lines = await documentsWhere<Line>(LINE, "productId", from.id);
  const retype = new Set(linesToRetype(lines, from, into.dimension).map((l) => l.id));
  const clearSeconds = clearsSecondAmounts(from, into);
  for (const l of lines) await patchDocument(l.id, { productId: into.id, ...(retype.has(l.id) && { needsAmount: true }), ...(clearSeconds && { secondAmount: 0 }) });
  const labels = [...into.labels];
  for (const l of from.labels) if (!labels.some((x) => x.shopId === l.shopId && x.label === l.label)) labels.push(l);
  await patchDocument(into.id, { labels });
  await removeDocument(from.id);
}

// ---- Label memory ----

async function rememberLabel(product: Product, shopId: string, label: string): Promise<void> {
  const labels = withLabel(product, shopId, label);
  if (labels !== product.labels) await patchDocument(product.id, { labels });
}

async function forgetLabel(product: Product, shopId: string, label: string): Promise<void> {
  const labels = withoutLabel(product, shopId, label);
  if (labels !== product.labels) await patchDocument(product.id, { labels });
}

// ---- Receipts and Lines ----

export interface LineInput {
  /** Present = an existing Line to update; absent = create. */
  id?: string;
  productId: string;
  label: string;
  amount: number;
  price: number;
  promo: boolean;
  /**
   * The second amount (ADR 0084), in the secondary dimension's base unit; 0
   * = none recorded. Absent keeps an existing Line's, and on a new Line is
   * prefilled from the Product's last Line at the same Shop. Dropped for a
   * Product with no secondary Measure.
   */
  secondAmount?: number;
  /** The amount was typed afresh: clears a needs-amount mark. Absent keeps an existing Line's mark. */
  retyped?: boolean;
}

export interface ReceiptInput {
  shopId: string;
  date: DateStr;
  branch?: string;
  /** Cents; 0 = no printed total. */
  total: number;
  /** A Sighting: noticed, not bought. Absent keeps an existing Receipt's mark (a new one is bought). */
  noticed?: boolean;
  /** A photo to keep: stored as an Attachment and embedded in the body (ADR 0082). */
  photo?: Blob & { name?: string };
  lines: LineInput[];
  tags?: string[];
}

function checkReceipt(input: ReceiptInput): void {
  if (!input.shopId) throw new Error("Pick a shop");
  if (!input.date) throw new Error("Pick a day");
  for (const l of input.lines) {
    if (!(l.amount > 0)) throw new Error(`"${l.label || "A line"}" needs an amount above zero`);
    if (!(l.price >= 0)) throw new Error(`"${l.label || "A line"}" needs a price`);
    if (l.secondAmount !== undefined && !(l.secondAmount >= 0)) throw new Error(`"${l.label || "A line"}" needs a second amount of zero or more`);
  }
}

/**
 * The one Receipt that collides (CONTEXT.md "Receipt"): the same Shop, day
 * and printed total is the same receipt added twice. One with no printed
 * total never is, and a Sighting never is nor is ever the twin (ADR 0084).
 */
async function sameReceipt(input: ReceiptInput, noticed: boolean, except?: string): Promise<Receipt | undefined> {
  const total = Math.max(0, Math.round(input.total));
  if (total === 0 || noticed) return undefined;
  return (await documentsWhere<Receipt>(RECEIPT, "shopId", input.shopId)).map(normalizeReceipt).find((r) => r.id !== except && !r.noticed && r.date === input.date && r.total === total);
}

/**
 * Save a Receipt and its Lines in one go — the Receipt dialog's save, by
 * hand or over an existing Receipt, and "Add receipt…" run headless. Lines
 * not in `input.lines` are deleted; matched Lines teach the Product their
 * label at this Shop.
 */
export async function saveReceipt(input: ReceiptInput, shops: readonly Shop[], products: readonly Product[], existing?: { receipt: Receipt; lines: Line[] }): Promise<string> {
  checkReceipt(input);
  const noticed = input.noticed ?? !!existing?.receipt.noticed;
  const twin = await sameReceipt(input, noticed, existing?.receipt.id);
  if (twin) throw new Error(`Already added: ${twin.title} has the same printed total (${twin.id})`);
  const shopName = shops.find((s) => s.id === input.shopId)?.title ?? "";
  let body = existing?.receipt.body ?? "";
  if (input.photo) {
    const att = await addAttachment(input.photo);
    body = `${body.trim()}\n\n![[${att.name}]]`.trim();
  }
  const base = { shopId: input.shopId, date: input.date, branch: input.branch?.trim() ?? "", total: Math.max(0, Math.round(input.total)), noticed, title: receiptTitle(shopName, input.date), tags: normalizeTags(input.tags ?? existing?.receipt.tags ?? []) };
  const receipt = existing ? await putDocument<Receipt>({ ...existing.receipt, ...base, body }) : await putDocument<Receipt>({ type: RECEIPT, ...base, body, folder: "" } as unknown as Receipt);

  const keep = new Set(input.lines.map((l) => l.id).filter(Boolean));
  for (const old of existing?.lines ?? []) if (!keep.has(old.id)) await removeDocument(old.id);
  const oldById = new Map((existing?.lines ?? []).map((l) => [l.id, l]));
  const matches: LineMatch[] = [];
  const prefill = prefiller(input.shopId);
  for (const l of input.lines) {
    const old = l.id ? oldById.get(l.id) : undefined;
    const product = products.find((p) => p.id === l.productId);
    const secondAmount = !product || !secondaryMeasure(product) ? 0 : (l.secondAmount ?? (old ? Number(old.secondAmount) || 0 : await prefill(product.id)));
    const row = { receiptId: receipt.id, productId: l.productId, label: l.label.trim(), amount: l.amount, secondAmount, price: Math.round(l.price), promo: !!l.promo, needsAmount: !l.retyped && !!old?.needsAmount, title: "" };
    if (l.id) await patchDocument(l.id, row);
    else await putDocument<Line>({ type: LINE, ...row, folder: "", tags: [] } as unknown as Line);
    matches.push({ productId: row.productId, label: row.label, before: old && { productId: old.productId, label: old.label } });
  }
  // One write per Product, built from every Line — patching each Line's label
  // from the same snapshot let the second overwrite the first.
  for (const [id, labels] of relabel(products, existing?.receipt.shopId ?? input.shopId, input.shopId, matches)) await patchDocument(id, { labels });
  return receipt.id;
}

/**
 * A Receipt's own Fields edited in place (its Peek, ADR 0085): the day, the
 * branch and the printed total. Its Shop and Lines stay; the title follows
 * the day; refused when the edit makes it the twin of another Receipt.
 */
export async function editReceipt(receipt: Receipt, patch: Partial<Pick<Receipt, "date" | "branch" | "total">>, shops: readonly Shop[]): Promise<void> {
  const next = { shopId: receipt.shopId, date: patch.date ?? receipt.date, branch: (patch.branch ?? receipt.branch).trim(), total: Math.max(0, Math.round(patch.total ?? receipt.total)), lines: [] };
  checkReceipt(next);
  const twin = await sameReceipt(next, !!receipt.noticed, receipt.id);
  if (twin) throw new Error(`${twin.title} already has this printed total`);
  const shopName = shops.find((s) => s.id === receipt.shopId)?.title ?? "";
  await patchDocument(receipt.id, { date: next.date, branch: next.branch, total: next.total, title: receiptTitle(shopName, next.date) });
}

/** The second amount a new Line takes when none is given: the Product's last at this Shop (lastSecondAmount), read once per Product. */
function prefiller(shopId: string): (productId: string) => Promise<number> {
  let receipts: Receipt[] | undefined;
  const memo = new Map<string, number>();
  return async (productId) => {
    if (!memo.has(productId)) {
      receipts ??= (await documentsWhere<Receipt>(RECEIPT, "shopId", shopId)).map(normalizeReceipt);
      const lines = (await documentsWhere<Line>(LINE, "productId", productId)).map(normalizeLine);
      memo.set(productId, lastSecondAmount(observe(lines, receipts), productId, shopId));
    }
    return memo.get(productId)!;
  };
}

/** A Receipt takes its Lines with it; the photo stays an Attachment until a clean-up (ADR 0037). */
export async function deleteReceipt(id: string): Promise<void> {
  await removeDocumentsWhere(LINE, (d) => (d as Line).receiptId === id);
  await removeDocument(id);
}

/**
 * Clear one Line from the inbox: point it at a Product and teach the Product
 * its label at this Shop. The amount typed while unmatched is read in the
 * Product's reading unit and stored in its base unit (matchedAmount).
 */
export async function matchLine(line: Line, product: Product, receipt: Receipt): Promise<void> {
  await patchDocument(line.id, { productId: product.id, amount: matchedAmount(line, product) });
  await rememberLabel(product, receipt.shopId, line.label);
}

/** Back to the inbox, and the Product forgets that label at that Shop. */
export async function unmatchLine(line: Line, product: Product | undefined, receipt: Receipt): Promise<void> {
  await patchDocument(line.id, { productId: "" });
  if (product) await forgetLabel(product, receipt.shopId, line.label);
}

/**
 * Clear one Line from the needs-amount inbox: its amount typed in the
 * Product's reading unit, stored in the base unit (ADR 0084).
 */
export async function setLineAmount(line: Line, typed: number, product: Product): Promise<void> {
  if (!(typed > 0)) throw new Error(`"${line.label || "A line"}" needs an amount above zero`);
  await patchDocument(line.id, { amount: fromAmount(typed, product), needsAmount: false });
}

export interface PriceInput {
  productId: string;
  shopId: string;
  amount: number;
  /** As on LineInput: absent is prefilled, 0 is none. */
  secondAmount?: number;
  price: number;
  promo: boolean;
  date?: DateStr;
  /** Ticked "Bought it"; absent or false makes a Sighting. */
  bought?: boolean;
}

/** "Add price…": a one-Line Receipt with no printed total — a Sighting unless it was bought (ADR 0084). */
export async function addPrice(input: PriceInput, shops: readonly Shop[], products: readonly Product[]): Promise<string> {
  const product = products.find((p) => p.id === input.productId);
  if (!product) throw new Error("Pick a product");
  return saveReceipt({ shopId: input.shopId, date: input.date || todayStr(), total: 0, noticed: !input.bought, lines: [{ productId: product.id, label: product.title, amount: input.amount, secondAmount: input.secondAmount, price: input.price, promo: input.promo }] }, shops, products);
}

export { todayStr };
