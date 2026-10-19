import { BASE_UNIT, DIMENSION_LABEL, UNITS_OF, isDimension, isUnitOf, type Dimension, type Measure, type Unit } from "./types";

/**
 * A Product's Measure, read and written (ADR 0084). Amounts and unit prices
 * are kept per the dimension's base unit — kg, L, count, m — and only shown
 * and typed in the reading unit, so nothing stored ever depends on it.
 */

/** How many base units one amount unit is: a gram is 0.001 kg. */
const AMOUNT_SIZE: Record<Unit, number> = { g: 0.001, kg: 1, "100g": 0.001, ml: 0.001, L: 1, m: 1, pc: 1 };
/** How many base units a unit price is quoted per: €/100 g is per 0.1 kg. */
const PRICE_SIZE: Record<Unit, number> = { g: 0.001, kg: 1, "100g": 0.1, ml: 0.001, L: 1, m: 1, pc: 1 };
const PER_LABEL: Record<Unit, string> = { g: "g", kg: "kg", "100g": "100 g", ml: "ml", L: "L", m: "m", pc: "pc" };

/** Drop the float noise a conversion leaves (0.42 / 0.001 = 419.99999999999994). */
const clean = (n: number) => Number(n.toFixed(9));

/** The unit amounts are shown and typed in — "g" for a per-100 g Product, a count's own name. */
export function amountUnit(m: Measure): string {
  if (m.dimension === "count") return m.countName || "pc";
  return m.unit === "100g" ? "g" : m.unit;
}

/** The unit price's suffix — "/kg", "/100 g", "/wash". */
export function perUnit(m: Measure): string {
  return `/${m.dimension === "count" ? m.countName || "pc" : PER_LABEL[m.unit]}`;
}

/** A stored (base-unit) amount in the Product's reading unit: 0.42 kg → 420 on a gram Product. */
export function amountIn(base: number, m: Measure): number {
  return clean(base / AMOUNT_SIZE[m.unit]);
}

/** An amount typed in the Product's reading unit, as stored: 420 on a gram Product → 0.42. */
export function fromAmount(n: number, m: Measure): number {
  return clean(n * AMOUNT_SIZE[m.unit]);
}

/** "420 g", "0.42 kg", "12 pc", "40 wash". */
export function formatAmount(base: number, m: Measure): string {
  const n = amountIn(base, m);
  return `${Number.isInteger(n) ? n : Number(n.toFixed(3))} ${amountUnit(m)}`;
}

/** Cents per base unit → cents per the unit the Product's prices are read in. */
export function unitPriceIn(centsPerBase: number, m: Measure): number {
  return centsPerBase * PRICE_SIZE[m.unit];
}

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" });
const fineMoney = new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumSignificantDigits: 3 });

/** "€1.23/kg", "€0.12/100 g", "€0.015/g" — a price under ten cents keeps its digits. */
export function formatUnitPrice(centsPerBase: number, m: Measure): string {
  const euros = unitPriceIn(centsPerBase, m) / 100;
  return `${(Math.abs(euros) < 0.1 && euros !== 0 ? fineMoney : money).format(euros)}${perUnit(m)}`;
}

/** "Mass · per 100 g", "Count · per wash". */
export function measureLabel(m: Measure): string {
  return `${DIMENSION_LABEL[m.dimension]} · per ${perUnit(m).slice(1)}`;
}

/** Every spelling of a unit a caller may type, to the unit and dimension it means. */
const SPELLINGS: Record<string, { dimension: Dimension; size: number }> = {
  g: { dimension: "mass", size: 0.001 },
  gram: { dimension: "mass", size: 0.001 },
  grams: { dimension: "mass", size: 0.001 },
  "100g": { dimension: "mass", size: 0.1 },
  kg: { dimension: "mass", size: 1 },
  kilo: { dimension: "mass", size: 1 },
  kilogram: { dimension: "mass", size: 1 },
  kilograms: { dimension: "mass", size: 1 },
  ml: { dimension: "volume", size: 0.001 },
  cl: { dimension: "volume", size: 0.01 },
  l: { dimension: "volume", size: 1 },
  litre: { dimension: "volume", size: 1 },
  litres: { dimension: "volume", size: 1 },
  liter: { dimension: "volume", size: 1 },
  liters: { dimension: "volume", size: 1 },
  m: { dimension: "length", size: 1 },
  cm: { dimension: "length", size: 0.01 },
  metre: { dimension: "length", size: 1 },
  metres: { dimension: "length", size: 1 },
  meter: { dimension: "length", size: 1 },
  meters: { dimension: "length", size: 1 },
  pc: { dimension: "count", size: 1 },
  pcs: { dimension: "count", size: 1 },
  piece: { dimension: "count", size: 1 },
  pieces: { dimension: "count", size: 1 },
};

/**
 * An amount stated in a named unit — "500 g" for a kg Product — as stored.
 * No unit means the Product's own reading unit; a count also answers to its
 * own name. A unit of another dimension is refused: no number turns pieces
 * into kilograms.
 */
export function toBase(n: number, unit: string | undefined, m: Measure): number {
  const key = (unit ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!key) return fromAmount(n, m);
  if (m.dimension === "count" && m.countName && key === m.countName.trim().toLowerCase().replace(/\s+/g, "")) return n;
  const known = SPELLINGS[key];
  if (!known) throw new Error(`Unknown unit “${unit}”; this product is ${DIMENSION_LABEL[m.dimension].toLowerCase()}, in ${UNITS_OF[m.dimension].map((u) => PER_LABEL[u]).join(", ")}`);
  if (known.dimension !== m.dimension) throw new Error(`“${unit}” is ${DIMENSION_LABEL[known.dimension].toLowerCase()}; this product is ${DIMENSION_LABEL[m.dimension].toLowerCase()}`);
  return clean(n * known.size);
}

/** ADR 0082's three measures in the new shape: kg → mass/kg, l → volume/L, piece → count/pc. */
export function legacyMeasure(v: unknown): Measure | undefined {
  if (v === "kg") return { dimension: "mass", unit: "kg", countName: "" };
  if (v === "l") return { dimension: "volume", unit: "L", countName: "" };
  if (v === "piece") return { dimension: "count", unit: "pc", countName: "" };
  return undefined;
}

/**
 * A stored Product's Measure, whichever shape it was written in: the new
 * fields, else the old `measure` value, else pieces. A unit outside its
 * dimension reads as the dimension's base; a count name only on a count.
 */
export function readMeasure(raw: { dimension?: unknown; unit?: unknown; countName?: unknown; measure?: unknown }): Measure {
  if (!isDimension(raw.dimension)) return legacyMeasure(raw.measure) ?? { dimension: "count", unit: "pc", countName: "" };
  const dimension = raw.dimension;
  const unit = isUnitOf(dimension, raw.unit) ? raw.unit : BASE_UNIT[dimension];
  const countName = dimension === "count" && typeof raw.countName === "string" ? raw.countName.trim() : "";
  return { dimension, unit, countName };
}
