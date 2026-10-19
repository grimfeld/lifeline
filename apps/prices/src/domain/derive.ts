import { addDays, diffDays, formatHuman, type DateStr } from "@lifeline/core";
import type { LabelMemory, Line, Observation, Product, Receipt } from "./types";

/**
 * Every reading of Prices (ADR 0082) lives here, pure: unit price, history
 * per Shop, cheapest Shop, the price change, the receipt's sum. Nothing
 * below is ever stored.
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
 * included — but never a Line that needs an amount.
 */
export function countsPerUnit(o: Observation): boolean {
  return !o.line.needsAmount;
}

/**
 * The Lines a change of the Product's dimension sends to the needs-amount
 * inbox — every Line of it, since no factor turns pieces into kilograms;
 * none when the dimension stays (ADR 0084).
 */
export function linesToRetype<L extends Pick<Line, "productId">>(lines: readonly L[], product: Pick<Product, "id" | "dimension">, dimension: Product["dimension"]): L[] {
  return dimension === product.dimension ? [] : lines.filter((l) => l.productId === product.id);
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

const byDate = (a: PricePoint, b: PricePoint) => a.date.localeCompare(b.date) || a.lineId.localeCompare(b.lineId);

function pointOf(o: Observation): PricePoint {
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

/** First day of a span ending today: N months back, same day of month (clamped by the calendar). */
export function spanStart(months: number, today: DateStr): DateStr {
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 - months, 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(d, last));
  return date.toISOString().slice(0, 10);
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

export { addDays };

/**
 * The span every figure on a screen shares (ADR 0084): from its first day
 * to its last, both inclusive. `from` "" is "All" — no first day.
 */
export interface Span {
  from: DateStr | "";
  to: DateStr;
}

/** The span of a picker's months ending today; 0 = All. */
export function spanOf(months: number, today: DateStr): Span {
  return { from: months > 0 ? spanStart(months, today) : "", to: today };
}

export function inSpan(o: Pick<Observation, "date">, span: Span): boolean {
  return (!span.from || o.date >= span.from) && o.date <= span.to;
}

export interface Spend {
  /** Cents paid for the Product in the span. */
  spent: number;
  /** Cents paid for every bought Line in the span, unmatched included. */
  total: number;
  /** spent / total; null when nothing was bought. */
  share: number | null;
}

/**
 * What a Product cost me over the span, and its share of everything bought
 * (CONTEXT.md "Sighting": never a Sighting). Takes observeAll, so an
 * uncleared unmatched inbox can't inflate the share.
 */
export function spendOf(productId: string, all: readonly Observation[], span: Span): Spend {
  let spent = 0;
  let total = 0;
  for (const o of all) {
    if (!countsAsSpent(o) || !inSpan(o, span)) continue;
    total += o.line.price;
    if (o.line.productId === productId) spent += o.line.price;
  }
  return { spent, total, share: total > 0 ? spent / total : null };
}

export interface Rhythm {
  /** Buying occasions: Receipts with the Product on them — two Lines on one Receipt are one time. */
  times: number;
  /** Mean days between consecutive occasions; null under two. */
  avgGapDays: number | null;
  last: DateStr | null;
  /** Amount bought per month, in the measure's base unit; null when nothing was. */
  perMonth: number | null;
}

const DAYS_PER_MONTH = 365.25 / 12;

/**
 * How I buy a Product over the span (CONTEXT.md "Sighting": never a
 * Sighting). Amount per month is a per-unit reading, so needs-amount Lines
 * stay out of it; "All" runs from the first purchase.
 */
export function rhythmOf(productId: string, obs: readonly Observation[], span: Span): Rhythm {
  const bought = obs.filter((o) => o.line.productId === productId && countsAsSpent(o) && inSpan(o, span));
  if (bought.length === 0) return { times: 0, avgGapDays: null, last: null, perMonth: null };
  const occasions = new Map<string, DateStr>();
  for (const o of bought) occasions.set(o.line.receiptId, o.date);
  const days = [...occasions.values()].sort();
  const first = days[0];
  const last = days[days.length - 1];
  const amount = bought.filter(countsPerUnit).reduce((s, o) => s + (o.line.amount > 0 ? o.line.amount : 0), 0);
  const months = (diffDays(span.from || first, span.to) + 1) / DAYS_PER_MONTH;
  return {
    times: days.length,
    avgGapDays: days.length > 1 ? diffDays(first, last) / (days.length - 1) : null,
    last,
    perMonth: months > 0 ? amount / months : null,
  };
}

/** Unit prices summed up, in cents per base unit. */
export interface PriceStats {
  n: number;
  min: number;
  max: number;
  avg: number;
  median: number;
}

function statsOf(units: readonly number[]): PriceStats | null {
  if (units.length === 0) return null;
  return { n: units.length, min: Math.min(...units), max: Math.max(...units), avg: units.reduce((a, b) => a + b, 0) / units.length, median: median(units)! };
}

export interface Spread {
  overall: PriceStats | null;
  /** Cheapest median first, then lowest min. */
  perShop: { shopId: string; stats: PriceStats }[];
}

/**
 * How wide a Product's unit price swings over the span, per Shop and across
 * them — every price seen, promos and Sightings included, so it says what a
 * good price is.
 */
export function spreadOf(productId: string, obs: readonly Observation[], span: Span): Spread {
  const all: number[] = [];
  const byShop = new Map<string, number[]>();
  for (const o of obs) {
    if (o.line.productId !== productId || !countsPerUnit(o) || !inSpan(o, span)) continue;
    const u = unitPrice(o.line);
    all.push(u);
    const list = byShop.get(o.shopId);
    if (list) list.push(u);
    else byShop.set(o.shopId, [u]);
  }
  const perShop = [...byShop].map(([shopId, units]) => ({ shopId, stats: statsOf(units)! }));
  perShop.sort((a, b) => a.stats.median - b.stats.median || a.stats.min - b.stats.min || a.shopId.localeCompare(b.shopId));
  return { overall: statsOf(all), perShop };
}

/** The latest usual (non-promo) point on or before a day — what a promo that day is measured against. */
export function usualOn(points: readonly PricePoint[], day: DateStr): PricePoint | undefined {
  for (let i = points.length - 1; i >= 0; i--) if (!points[i].promo && points[i].date <= day) return points[i];
  return undefined;
}

export interface PromoStats {
  /** Prices seen in the span (per unit — Sightings in, needs-amount out). */
  n: number;
  promos: number;
  /** promos / n; null when nothing was seen. */
  frequency: number | null;
  /** Mean fraction off the usual price, over promos that have one; null when none does. */
  avgDiscount: number | null;
  /** Promo saving (CONTEXT.md) over bought promo Lines, in cents. */
  saving: number;
}

/**
 * How often a Product is on promo, by how much, and what promos saved me
 * over the span. Each promo is measured against the latest usual price at
 * its *own* Shop on or before its day — a promo with none says nothing.
 */
export function promoOf(productId: string, obs: readonly Observation[], span: Span): PromoStats {
  const history = historyOf(productId, obs);
  let n = 0;
  let promos = 0;
  let saving = 0;
  const discounts: number[] = [];
  for (const o of obs) {
    if (o.line.productId !== productId || !countsPerUnit(o) || !inSpan(o, span)) continue;
    n++;
    if (!o.line.promo) continue;
    promos++;
    const usual = usualOn(history.get(o.shopId) ?? [], o.date);
    if (!usual || usual.unit <= 0) continue;
    discounts.push((usual.unit - unitPrice(o.line)) / usual.unit);
    if (countsAsSpent(o)) saving += Math.round(usual.unit * (o.line.amount > 0 ? o.line.amount : 1) - o.line.price);
  }
  return {
    n,
    promos,
    frequency: n > 0 ? promos / n : null,
    avgDiscount: discounts.length ? discounts.reduce((a, b) => a + b, 0) / discounts.length : null,
    saving,
  };
}
