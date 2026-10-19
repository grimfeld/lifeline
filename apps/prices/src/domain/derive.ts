import { formatHuman, type DateStr } from "@lifeline/core";
import type { Basis, LabelMemory, Line, Observation, Product, Receipt, SecondaryMeasure } from "./types";
import { amountIn, basisOf, secondaryMeasure } from "./measure";

/**
 * Every reading of Prices (ADR 0082) lives here, pure: unit price, history
 * per Shop, cheapest Shop, the price change, the receipt's sum. The
 * statistics over a span — spend, rhythm, spread, promos, Overpaid, the
 * Overview — are stats.ts. Nothing below is ever stored.
 */

/** Label as compared: accents stripped, upper-cased, whitespace collapsed. */
export function normalizeLabel(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Cents per base unit of the dimension (per kg, L, m, count) — price paid over amount. A missing amount counts as one. Read it in the Product's unit with formatUnitPrice (measure.ts). */
export function unitPrice(line: Pick<Line, "price" | "amount">): number {
  const amount = line.amount > 0 ? line.amount : 1;
  return line.price / amount;
}

/**
 * The Product a printed label stands for at one Shop: the Shop's remembered
 * label first, then a Product whose name is the label itself. Nothing fuzzy.
 */
export function matchProduct(products: readonly Product[], shopId: string, label: string): Product | undefined {
  const key = normalizeLabel(label);
  if (!key) return undefined;
  return products.find((p) => p.labels.some((l) => l.shopId === shopId && l.label === key)) ?? products.find((p) => normalizeLabel(p.title) === key);
}

/** The labels with this one remembered at this Shop — the same array when there is nothing to learn (no Shop, an empty label, or the Product's own name). */
export function withLabel(product: Pick<Product, "title" | "labels">, shopId: string, label: string): LabelMemory[] {
  const key = normalizeLabel(label);
  if (!shopId || !key || key === normalizeLabel(product.title)) return product.labels;
  if (product.labels.some((l) => l.shopId === shopId && l.label === key)) return product.labels;
  return [...product.labels, { shopId, label: key }];
}

/** The labels with this one forgotten at this Shop — the same array when it was never remembered. */
export function withoutLabel(product: Pick<Product, "labels">, shopId: string, label: string): LabelMemory[] {
  const key = normalizeLabel(label);
  const labels = product.labels.filter((l) => !(l.shopId === shopId && l.label === key));
  return labels.length === product.labels.length ? product.labels : labels;
}

/** A Line as saved, and as it was before (absent for a new Line). */
export interface LineMatch {
  productId: string;
  label: string;
  before?: { productId: string; label: string };
}

/**
 * What saving a Receipt's Lines teaches its Products, batched per Product:
 * the new labels for every Product that changes. Each Line builds on the
 * previous ones, so two Lines matching one Product both stick. A Line moved
 * off a Product forgets its old label at the Shop the Receipt *was* at.
 */
export function relabel(products: readonly Product[], oldShopId: string, newShopId: string, lines: readonly LineMatch[]): Map<string, LabelMemory[]> {
  const byId = new Map(products.map((p) => [p.id, p]));
  const out = new Map<string, LabelMemory[]>();
  const current = (id: string) => {
    const p = byId.get(id);
    return p ? { ...p, labels: out.get(id) ?? p.labels } : undefined;
  };
  for (const l of lines) {
    // Unmatching forgets the label; matching (or re-matching) teaches it.
    const before = l.before?.productId ? current(l.before.productId) : undefined;
    if (before && before.id !== l.productId) {
      const labels = withoutLabel(before, oldShopId, l.before!.label || l.label);
      if (labels !== before.labels) out.set(before.id, labels);
    }
    const p = l.productId ? current(l.productId) : undefined;
    if (p) {
      const labels = withLabel(p, newShopId, l.label);
      if (labels !== p.labels) out.set(p.id, labels);
    }
  }
  return out;
}

/** Matched Lines joined with their Receipt's Shop and day; a Line whose Receipt is gone is dropped. */
export function observe(lines: readonly Line[], receipts: readonly Receipt[]): Observation[] {
  return observeAll(lines, receipts).filter((o) => !isUnmatched(o.line));
}

/** observe, unmatched Lines kept — the whole that a share is taken of. */
export function observeAll(lines: readonly Line[], receipts: readonly Receipt[]): Observation[] {
  const byId = new Map(receipts.map((r) => [r.id, r]));
  const out: Observation[] = [];
  for (const line of lines) {
    const r = byId.get(line.receiptId);
    if (r) out.push({ line, shopId: r.shopId, date: r.date, noticed: !!r.noticed });
  }
  return out;
}

/**
 * The one place that decides what a reading may count (ADR 0084), so no
 * reading re-decides it. Spending readings (spend, share, rhythm, visits,
 * basket, being judged Overpaid) take only what was bought — never a
 * Sighting.
 */
export function countsAsSpent(o: Observation): boolean {
  return !o.noticed;
}

/**
 * Per-unit readings (unit price, history, cheapest, Price change, spread,
 * amount per month, the Overpaid baseline) take every price seen, Sightings
 * included — but never a Line that needs an amount, nor one missing the
 * amount its Product is compared by (see comparedBy).
 */
export function countsPerUnit(o: Observation): boolean {
  return !o.line.needsAmount && !o.noAmount;
}

/**
 * Observations read by each Product's compared-by unit (ADR 0084), so every
 * per-unit reading downstream — history, cheapest, Price change, spread,
 * promos, Overpaid — compares the one the Product chose. A Product compared
 * by its secondary Measure has its Lines' second amount stand as the amount;
 * a Line without one is marked noAmount: still spent, never per unit.
 * `basis` reads every Product that has two Measures by that one instead —
 * the Product page's other figure. Lines of other Products pass unchanged.
 */
export function comparedBy(obs: readonly Observation[], products: readonly (Pick<Product, "id" | "dimension"> & SecondaryMeasure)[], basis?: Basis): Observation[] {
  const secondary = new Set(products.filter((p) => basisOf(p, basis) === "secondary").map((p) => p.id));
  if (secondary.size === 0) return [...obs];
  return obs.map((o) => {
    if (!secondary.has(o.line.productId)) return o;
    const second = Number(o.line.secondAmount) || 0;
    return second > 0 ? { ...o, line: { ...o.line, amount: second } } : { ...o, noAmount: true };
  });
}

/**
 * One Line's unit price on a basis, in cents per base unit — the compared-by
 * one when none is asked; null when the Line says nothing per unit on it
 * (it needs an amount, or lacks the second amount). Read as comparedBy and
 * countsPerUnit decide, so the Product page's list agrees with its readings.
 */
export function unitPriceOn(o: Observation, product: Pick<Product, "id" | "dimension"> & SecondaryMeasure, basis?: Basis): number | null {
  const [read] = comparedBy([o], [product], basisOf(product, basis));
  return countsPerUnit(read) ? unitPrice(read.line) : null;
}

/**
 * The Lines a change of the Product's dimension sends to the needs-amount
 * inbox — every Line of it, since no factor turns pieces into kilograms;
 * none when the dimension stays (ADR 0084).
 */
export function linesToRetype<L extends Pick<Line, "productId">>(lines: readonly L[], product: Pick<Product, "id" | "dimension">, dimension: Product["dimension"]): L[] {
  return dimension === product.dimension ? [] : lines.filter((l) => l.productId === product.id);
}

/**
 * The second amount a new Line of this Product at this Shop starts from
 * (ADR 0084): the latest one recorded there — a pack's weight rarely
 * changes, so it is typed only when it did. 0 when there is none.
 */
export function lastSecondAmount(obs: readonly Observation[], productId: string, shopId: string): number {
  let best: Observation | undefined;
  for (const o of obs) {
    if (o.line.productId !== productId || o.shopId !== shopId || !((o.line.secondAmount ?? 0) > 0)) continue;
    if (!best || o.date > best.date || (o.date === best.date && o.line.createdAt > best.line.createdAt)) best = o;
  }
  return best?.line.secondAmount ?? 0;
}

/**
 * Whether Lines of a Product lose their second amounts when it takes this
 * Measure (ADR 0084): its secondary Measure goes or changes dimension — a
 * primary leaving count takes the secondary with it. Never when it had none.
 */
export function clearsSecondAmounts(product: Pick<Product, "secondaryDimension">, next: Pick<Product, "dimension" | "secondaryDimension">): boolean {
  const after = next.dimension === "count" ? next.secondaryDimension : "";
  return !!product.secondaryDimension && after !== product.secondaryDimension;
}

/**
 * What giving a Product this Measure — or merging it into a Product that has
 * it — does to its Lines, counted to be said beforehand (ADR 0084): how many
 * will need an amount (linesToRetype) and how many second amounts go
 * (clearsSecondAmounts).
 */
export function measureChange(product: Pick<Product, "id" | "dimension" | "secondaryDimension">, next: Pick<Product, "dimension" | "secondaryDimension">, lines: readonly Pick<Line, "productId" | "secondAmount">[]): { retype: number; cleared: number } {
  const retype = linesToRetype(lines, product, next.dimension).length;
  const cleared = clearsSecondAmounts(product, next) ? lines.filter((l) => l.productId === product.id && (l.secondAmount ?? 0) > 0).length : 0;
  return { retype, cleared };
}

/**
 * The second amount a new Line of this Product at this Shop is shown with,
 * in the secondary Measure's reading unit (lastSecondAmount); undefined when
 * the Product has no secondary Measure or none was recorded there.
 */
export function secondPrefill(obs: readonly Observation[], product: Product | undefined, shopId: string): number | undefined {
  const m = product && secondaryMeasure(product);
  const last = m ? lastSecondAmount(obs, product.id, shopId) : 0;
  return m && last > 0 ? amountIn(last, m) : undefined;
}

/** The needs-amount inbox: matched Lines waiting for their amount in the Product's new dimension. */
export function needingAmount<L extends Pick<Line, "productId" | "needsAmount">>(lines: readonly L[]): L[] {
  return lines.filter((l) => !!l.productId && l.needsAmount);
}

export function isUnmatched(line: Pick<Line, "productId">): boolean {
  return !line.productId;
}

export interface PricePoint {
  date: DateStr;
  /** Cents per unit. */
  unit: number;
  promo: boolean;
  lineId: string;
  receiptId: string;
}

/** Oldest first; one day's points in Line order. */
export const byDate = (a: PricePoint, b: PricePoint) => a.date.localeCompare(b.date) || a.lineId.localeCompare(b.lineId);

/** An Observation as a point of its Product's history. */
export function pointOf(o: Observation): PricePoint {
  return { date: o.date, unit: unitPrice(o.line), promo: o.line.promo, lineId: o.line.id, receiptId: o.line.receiptId };
}

/** A Product's points per Shop, oldest first. */
export function historyOf(productId: string, obs: readonly Observation[]): Map<string, PricePoint[]> {
  const out = new Map<string, PricePoint[]>();
  for (const o of obs) {
    if (o.line.productId !== productId || !countsPerUnit(o)) continue;
    const list = out.get(o.shopId) ?? [];
    list.push(pointOf(o));
    out.set(o.shopId, list);
  }
  for (const list of out.values()) list.sort(byDate);
  return out;
}

/** Every Product's history (see historyOf) in one pass — for screens that read them all. */
export function historiesByProduct(obs: readonly Observation[]): Map<string, Map<string, PricePoint[]>> {
  const out = new Map<string, Map<string, PricePoint[]>>();
  for (const o of obs) {
    if (!countsPerUnit(o)) continue;
    let h = out.get(o.line.productId);
    if (!h) out.set(o.line.productId, (h = new Map()));
    const list = h.get(o.shopId);
    if (list) list.push(pointOf(o));
    else h.set(o.shopId, [pointOf(o)]);
  }
  for (const h of out.values()) for (const list of h.values()) list.sort(byDate);
  return out;
}

/** The latest non-promo point — the "usual price"; a promo-only history yields nothing. */
export function latestUsual(points: readonly PricePoint[]): PricePoint | undefined {
  for (let i = points.length - 1; i >= 0; i--) if (!points[i].promo) return points[i];
  return undefined;
}

/** The Shop whose usual price is lowest; ties go to the most recent point. */
export function cheapest(history: ReadonlyMap<string, PricePoint[]>): { shopId: string; point: PricePoint } | undefined {
  let best: { shopId: string; point: PricePoint } | undefined;
  for (const [shopId, points] of history) {
    const p = latestUsual(points);
    if (!p) continue;
    if (!best || p.unit < best.point.unit || (p.unit === best.point.unit && p.date > best.point.date)) best = { shopId, point: p };
  }
  return best;
}

export interface ShopChange {
  shopId: string;
  first: PricePoint;
  last: PricePoint;
  /** (last − first) / first, in percent. */
  pct: number;
}

/**
 * The price change reading (CONTEXT.md): per Shop, earliest to latest
 * non-promo point inside [from, to]. A Shop with fewer than two such points
 * says nothing. No cross-Shop figure — a switch of Shop is not inflation.
 */
export function shopChanges(productId: string, obs: readonly Observation[], from: DateStr, to: DateStr): ShopChange[] {
  return changesIn(historyOf(productId, obs), from, to);
}

/** shopChanges over a history already in hand. */
export function changesIn(history: ReadonlyMap<string, PricePoint[]>, from: DateStr, to: DateStr): ShopChange[] {
  const out: ShopChange[] = [];
  for (const [shopId, points] of history) {
    const usual = points.filter((p) => !p.promo && p.date >= from && p.date <= to);
    if (usual.length < 2) continue;
    const first = usual[0];
    const last = usual[usual.length - 1];
    if (first.unit <= 0) continue;
    out.push({ shopId, first, last, pct: ((last.unit - first.unit) / first.unit) * 100 });
  }
  return out;
}

export function median(nums: readonly number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** The all-Products figure: the median of every per-Shop change over the span, and how many went in. */
export function overallChange(productIds: readonly string[], obs: readonly Observation[], from: DateStr, to: DateStr): { median: number | null; n: number } {
  return overallOf(productIds.map((id) => shopChanges(id, obs, from, to)));
}

/** overallChange over per-Product changes already in hand. */
export function overallOf(changes: readonly (readonly ShopChange[])[]): { median: number | null; n: number } {
  const pcts = changes.flatMap((cs) => cs.map((c) => c.pct));
  return { median: median(pcts), n: pcts.length };
}

export function sumOfLines(lines: readonly Pick<Line, "price">[]): number {
  return lines.reduce((s, l) => s + (Number(l.price) || 0), 0);
}

/** The printed total disagrees with the Lines — a warning, never a block (ADR 0082). */
export function totalMismatch(receipt: Pick<Receipt, "total">, lines: readonly Pick<Line, "price">[]): boolean {
  return receipt.total > 0 && sumOfLines(lines) !== receipt.total;
}

/** "Lidl · Thu, Sep 4" — the Receipt's title, written on every save. */
export function receiptTitle(shopName: string, date: DateStr): string {
  return `${shopName || "Receipt"} · ${date ? formatHuman(date) : ""}`.trim();
}

/** Lines of one Receipt, in creation order. */
const byCreated = (a: Line, b: Line) => a.createdAt.localeCompare(b.createdAt) || a.updatedAt.localeCompare(b.updatedAt);

export function linesOf(lines: readonly Line[], receiptId: string): Line[] {
  return lines.filter((l) => l.receiptId === receiptId).sort(byCreated);
}

/** linesOf for every Receipt in one pass. */
export function linesByReceipt(lines: readonly Line[]): Map<string, Line[]> {
  const out = new Map<string, Line[]>();
  for (const l of lines) {
    const list = out.get(l.receiptId);
    if (list) list.push(l);
    else out.set(l.receiptId, [l]);
  }
  for (const list of out.values()) list.sort(byCreated);
  return out;
}
