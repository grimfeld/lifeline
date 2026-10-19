import { useMemo } from "react";
import { addAttachment, documentsOf, documentsWhere, normalizeTags, patchDocument, putDocument, removeDocument, removeDocumentsWhere, todayStr, useDocument, useDocuments, type DateStr } from "@lifeline/core";
import { LINE, PRODUCT, RECEIPT, SHOP, isMeasure, type LabelMemory, type Line, type Measure, type Product, type Receipt, type Shop } from "../domain/types";
import { receiptTitle, relabel, withLabel, withoutLabel, type LineMatch } from "../domain/derive";

/** PocketBase returns absent fields as "" / undefined; re-establish shapes on read. */
function normalizeProduct(p: Product): Product {
  const labels = Array.isArray(p.labels) ? p.labels.filter((l): l is LabelMemory => !!l && typeof l === "object" && typeof l.shopId === "string" && typeof l.label === "string") : [];
  return { ...p, measure: isMeasure(p.measure) ? p.measure : "piece", labels, tags: p.tags ?? [] };
}
function normalizeShop(s: Shop): Shop {
  return { ...s, note: s.note ?? "", tags: s.tags ?? [] };
}
function normalizeReceipt(r: Receipt): Receipt {
  return { ...r, shopId: r.shopId ?? "", date: r.date || r.createdAt, branch: r.branch ?? "", total: Math.max(0, Math.round(Number(r.total) || 0)), noticed: !!r.noticed, tags: r.tags ?? [] };
}
function normalizeLine(l: Line): Line {
  return { ...l, receiptId: l.receiptId ?? "", productId: l.productId ?? "", label: l.label ?? "", amount: Number(l.amount) > 0 ? Number(l.amount) : 1, price: Math.round(Number(l.price) || 0), promo: !!l.promo, tags: l.tags ?? [] };
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
  measure: Measure;
  tags?: string[];
}

export async function addProduct(input: ProductInput): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new Error("Give the product a name");
  if (!isMeasure(input.measure)) throw new Error("Pick a measure");
  if ((await allProducts()).some((p) => sameName(p.title, title))) throw new Error(`There is already a product called “${title}”`);
  const row = await putDocument<Product>({ type: PRODUCT, title, measure: input.measure, labels: [], folder: "", tags: normalizeTags(input.tags ?? []) } as unknown as Product);
  return row.id;
}

/** The measure is fixed after creation (CONTEXT.md "Product"): only the name and tags move. */
export async function updateProduct(product: Product, input: Pick<ProductInput, "title" | "tags">): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error("Give the product a name");
  if ((await allProducts()).some((p) => p.id !== product.id && sameName(p.title, title))) throw new Error(`There is already a product called “${title}”`);
  await putDocument<Product>({ ...product, title, tags: normalizeTags(input.tags ?? product.tags) });
}

/** Blocked while Lines reference it — merge instead (ADR 0082). */
export async function deleteProduct(id: string): Promise<void> {
  if ((await documentsWhere<Line>(LINE, "productId", id)).length > 0) throw new Error("Product has prices — merge it into another instead");
  await removeDocument(id);
}

/** Merge: Lines repoint, remembered labels carry over, the source goes. Same measure only — the unit prices would be nonsense otherwise. */
export async function mergeProduct(from: Product, into: Product): Promise<void> {
  if (from.id === into.id) throw new Error("Pick a different product to merge into");
  if (from.measure !== into.measure) throw new Error("Only products of the same measure merge");
  for (const l of await documentsWhere<Line>(LINE, "productId", from.id)) await patchDocument(l.id, { productId: into.id });
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
  for (const l of input.lines) {
    const row = { receiptId: receipt.id, productId: l.productId, label: l.label.trim(), amount: l.amount, price: Math.round(l.price), promo: !!l.promo, title: "" };
    const old = l.id ? oldById.get(l.id) : undefined;
    if (l.id) await patchDocument(l.id, row);
    else await putDocument<Line>({ type: LINE, ...row, folder: "", tags: [] } as unknown as Line);
    matches.push({ productId: row.productId, label: row.label, before: old && { productId: old.productId, label: old.label } });
  }
  // One write per Product, built from every Line — patching each Line's label
  // from the same snapshot let the second overwrite the first.
  for (const [id, labels] of relabel(products, existing?.receipt.shopId ?? input.shopId, input.shopId, matches)) await patchDocument(id, { labels });
  return receipt.id;
}

/** A Receipt takes its Lines with it; the photo stays an Attachment until a clean-up (ADR 0037). */
export async function deleteReceipt(id: string): Promise<void> {
  await removeDocumentsWhere(LINE, (d) => (d as Line).receiptId === id);
  await removeDocument(id);
}

/** Clear one Line from the inbox: point it at a Product and teach the Product its label at this Shop. */
export async function matchLine(line: Line, product: Product, receipt: Receipt): Promise<void> {
  await patchDocument(line.id, { productId: product.id });
  await rememberLabel(product, receipt.shopId, line.label);
}

/** Back to the inbox, and the Product forgets that label at that Shop. */
export async function unmatchLine(line: Line, product: Product | undefined, receipt: Receipt): Promise<void> {
  await patchDocument(line.id, { productId: "" });
  if (product) await forgetLabel(product, receipt.shopId, line.label);
}

export interface PriceInput {
  productId: string;
  shopId: string;
  amount: number;
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
  return saveReceipt({ shopId: input.shopId, date: input.date || todayStr(), total: 0, noticed: !input.bought, lines: [{ productId: product.id, label: product.title, amount: input.amount, price: input.price, promo: input.promo }] }, shops, products);
}

export { todayStr };
