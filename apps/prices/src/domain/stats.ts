import { diffDays, type DateStr } from "@lifeline/core";
import type { Line, Observation, Product, Receipt } from "./types";
import { byDate, cheapest, comparedBy, countsAsSpent, countsPerUnit, historyOf, isUnmatched, linesByReceipt, median, observeAll, pointOf, sumOfLines, unitPrice, type PricePoint } from "./derive";

/**
 * The statistics of Prices (spec #161, ADR 0084), pure: what a Product cost
 * me over a span, how I buy it, how wide its price swings, its promos, what I
 * overpaid, and the Overview across every Product. Built on the readings in
 * derive.ts; nothing here is stored.
 */

/** First day of a span ending today: N months back, same day of month (clamped by the calendar). */
function spanStart(months: number, today: DateStr): DateStr {
  const [y = 0, m = 1, d = 1] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 - months, 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(d, last));
  return date.toISOString().slice(0, 10);
}


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
  // bought is not empty, so neither is days.
  const first = days[0]!;
  const last = days[days.length - 1]!;
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
  for (let i = points.length - 1; i >= 0; i--) if (!points[i]!.promo && points[i]!.date <= day) return points[i];
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

/** How far back a price may lie and still say what another Shop asked (CONTEXT.md "Overpaid"); a constant, not a setting. */
export const OVERPAID_WINDOW_DAYS = 90;

/** The price an Overpaid Line is measured against: another Shop's usual unit price, and the day it was seen. */
export interface Baseline {
  shopId: string;
  /** Cents per base unit of the compared-by dimension. */
  unit: number;
  date: DateStr;
}

export interface Overpaid {
  /** Cents paid beyond the baseline over the span, rounded per Line. */
  total: number;
  /** Where it was cheapest: the baseline behind the latest overpaid Line; undefined when nothing was overpaid. */
  cheapest?: Baseline;
}

/**
 * What I paid for a Product over the span beyond the cheapest usual unit
 * price any *other* Shop asked on or before each Line's day (CONTEXT.md
 * "Overpaid"). Each other Shop offers its latest usual price by that day,
 * and none older than OVERPAID_WINDOW_DAYS, so a stale price accuses no one
 * — the same "latest usual" the cheapest-Shop reading uses. Bought Lines are
 * judged, promos included (what was paid was paid); Sightings are baseline
 * only; promos never are; needs-amount Lines and Lines without the
 * compared-by amount are skipped both ways — pass observations read by
 * comparedBy, so it compares the unit the Product chose. Baselines may lie
 * before the span; only the Lines judged must lie in it.
 */
export function overpaidOf(productId: string, obs: readonly Observation[], span: Span): Overpaid {
  const priced: { o: Observation; amount: number }[] = [];
  const usual = new Map<string, PricePoint[]>();
  for (const o of obs) {
    if (o.line.productId !== productId || !countsPerUnit(o)) continue;
    const amount = o.line.amount > 0 ? o.line.amount : 1;
    priced.push({ o, amount });
    if (o.line.promo) continue;
    const list = usual.get(o.shopId) ?? [];
    list.push({ ...pointOf(o), unit: o.line.price / amount });
    usual.set(o.shopId, list);
  }
  for (const list of usual.values()) list.sort(byDate);

  let total = 0;
  let cheapest: Baseline | undefined;
  let latest = "";
  for (const { o, amount } of priced) {
    if (!countsAsSpent(o) || !inSpan(o, span)) continue;
    let best: Baseline | undefined;
    for (const [shopId, points] of usual) {
      if (shopId === o.shopId) continue;
      const p = usualOn(points, o.date);
      if (!p || diffDays(p.date, o.date) > OVERPAID_WINDOW_DAYS) continue;
      if (!best || p.unit < best.unit) best = { shopId, unit: p.unit, date: p.date };
    }
    if (!best) continue;
    const over = Math.round(o.line.price - best.unit * amount);
    if (over <= 0) continue;
    total += over;
    if (o.date >= latest) {
      latest = o.date;
      cheapest = best;
    }
  }
  return { total, cheapest };
}

/** One Shop over the span (CONTEXT.md "Sighting": visits and basket never count one). */
export interface ShopFigures {
  shopId: string;
  /** Cents: each bought Receipt's printed total, else the sum of its Lines (unmatched included). */
  spent: number;
  /** Bought Receipts. */
  visits: number;
  /** spent / visits; null with no visit. */
  basket: number | null;
  /** Products whose cheapest Shop over the span this is. */
  cheapestFor: number;
}

/** A Product's part of what was bought (see Spend). */
export interface ProductSpend {
  productId: string;
  spent: number;
  /** spent / the span's total. */
  share: number;
}

export interface Overview {
  spend: {
    /** Cents paid for every bought Line in the span, unmatched included — what a share is of. */
    total: number;
    /** Every Product bought in the span, most spent first. */
    top: ProductSpend[];
  };
  /** Most spent first. */
  shops: ShopFigures[];
  overpaid: {
    /** Cents, every Product's Overpaid summed. */
    total: number;
    /** Each Product overpaid for, most first, with where it was cheapest. */
    top: { productId: string; total: number; cheapest: Baseline }[];
  };
  /** Cents, every Product's Promo saving summed. */
  promoSaved: number;
}

/** A Product's prices per Shop inside the span — what its cheapest Shop over the span is decided on. */
function historyInSpan(productId: string, obs: readonly Observation[], span: Span): Map<string, PricePoint[]> {
  return historyOf(productId, obs.filter((o) => inSpan(o, span)));
}

/**
 * The Prices screen's Overview reading (ADR 0084) over one span: what was
 * spent and on which Products (as spendOf, every Product at once); per Shop,
 * what was spent, how often I went, the average basket and how many Products
 * it is cheapest for; what I overpaid (overpaidOf) and what promos saved
 * (promoOf), summed over Products. Spending figures never take a Sighting;
 * the cheapest Shop takes every price seen, as everywhere. Cheapest and
 * every per-unit figure reads each Product by its compared-by unit
 * (comparedBy), a Line without that amount saying nothing per unit.
 */
export function overviewOf(products: readonly Product[], receipts: readonly Receipt[], lines: readonly Line[], span: Span): Overview {
  const all = observeAll(lines, receipts);
  const obs = comparedBy(all.filter((o) => !isUnmatched(o.line)), products);
  let total = 0;
  const spentOn = new Map<string, number>();
  for (const o of all) {
    if (!countsAsSpent(o) || !inSpan(o, span)) continue;
    total += o.line.price;
    if (o.line.productId) spentOn.set(o.line.productId, (spentOn.get(o.line.productId) ?? 0) + o.line.price);
  }
  const top = [...spentOn]
    .map(([productId, spent]) => ({ productId, spent, share: total > 0 ? spent / total : 0 }))
    .sort((a, b) => b.spent - a.spent || a.productId.localeCompare(b.productId));
  const byReceipt = linesByReceipt(lines);
  const shops = new Map<string, ShopFigures>();
  const shop = (shopId: string) => {
    let s = shops.get(shopId);
    if (!s) shops.set(shopId, (s = { shopId, spent: 0, visits: 0, basket: null, cheapestFor: 0 }));
    return s;
  };
  for (const r of receipts) {
    if (r.noticed || !inSpan(r, span)) continue;
    const s = shop(r.shopId);
    s.spent += r.total > 0 ? r.total : sumOfLines(byReceipt.get(r.id) ?? []);
    s.visits++;
  }
  const overpaid: Overview["overpaid"] = { total: 0, top: [] };
  let promoSaved = 0;
  for (const p of products) {
    const best = cheapest(historyInSpan(p.id, obs, span));
    if (best) shop(best.shopId).cheapestFor++;
    const o = overpaidOf(p.id, obs, span);
    if (o.total > 0 && o.cheapest) {
      overpaid.total += o.total;
      overpaid.top.push({ productId: p.id, total: o.total, cheapest: o.cheapest });
    }
    promoSaved += promoOf(p.id, obs, span).saving;
  }
  overpaid.top.sort((a, b) => b.total - a.total || a.productId.localeCompare(b.productId));
  for (const s of shops.values()) s.basket = s.visits > 0 ? s.spent / s.visits : null;
  const list = [...shops.values()].sort((a, b) => b.spent - a.spent || b.visits - a.visits || a.shopId.localeCompare(b.shopId));
  return { spend: { total, top }, shops: list, overpaid, promoSaved };
}
