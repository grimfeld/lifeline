import type { DateStr, Document } from "@lifeline/core";

export const APP_ID = "prices";
export const PRODUCT = "price_product";
export const SHOP = "price_shop";
export const RECEIPT = "price_receipt";
export const LINE = "price_line";

export const PRICES_HREF = "/app/prices";
export const productHref = (id: string) => `${PRICES_HREF}/p/${id}`;

/** Prices' own colour on shared surfaces. */
export const PRICES_COLOR = "var(--chart-green)";

/**
 * A Product's Measure (CONTEXT.md "Measure (Prices)", ADR 0084): a
 * dimension and the unit it is read in. Amounts are always kept in the
 * dimension's base unit (kg, L, count, m); the reading unit changes only how
 * they are shown and typed, so changing it — or a count's name — rewrites no
 * Line. Pack size is *not* here: a litre and a six-pack are one Product with
 * different amounts on the Line.
 */
export type Dimension = "mass" | "volume" | "count" | "length";
export const DIMENSIONS: Dimension[] = ["mass", "volume", "count", "length"];
export const DIMENSION_LABEL: Record<Dimension, string> = { mass: "Mass", volume: "Volume", count: "Count", length: "Length" };

/** A reading unit; "100g" reads amounts in grams and prices per 100 g. */
export type Unit = "g" | "kg" | "100g" | "ml" | "L" | "m" | "pc";
export const UNITS_OF: Record<Dimension, readonly Unit[]> = { mass: ["g", "kg", "100g"], volume: ["ml", "L"], count: ["pc"], length: ["m"] };
/** The unit each dimension's amounts are stored in. */
export const BASE_UNIT: Record<Dimension, Unit> = { mass: "kg", volume: "L", count: "pc", length: "m" };
export const UNIT_LABEL: Record<Unit, string> = { g: "Grams (g)", kg: "Kilograms (kg)", "100g": "Per 100 g", ml: "Millilitres (ml)", L: "Litres (L)", m: "Metres (m)", pc: "Pieces" };

export interface Measure {
  dimension: Dimension;
  unit: Unit;
  /** A count's own name — "roll", "wash"; "" = pieces. Always "" off a count. */
  countName: string;
}

export function isDimension(v: unknown): v is Dimension {
  return typeof v === "string" && (DIMENSIONS as string[]).includes(v);
}

export function isUnitOf(dimension: Dimension, v: unknown): v is Unit {
  return typeof v === "string" && (UNITS_OF[dimension] as readonly string[]).includes(v);
}

/** A printed label a Shop uses for a Product, remembered so the next import resolves on its own. */
export interface LabelMemory {
  shopId: string;
  /** Normalised (see normalizeLabel). */
  label: string;
}

/**
 * A Product (ADR 0082, 0084): a thing bought again. Title is its name; its
 * Measure is `dimension` (fixed for now), `unit` and `countName`; `labels`
 * is the App's memory of what each Shop prints for it (guarded — written
 * only by matching and unmatching Lines).
 */
export interface Product extends Document, Measure {
  type: typeof PRODUCT;
  labels: LabelMemory[];
}

/** A Shop (ADR 0082): a chain, never a branch. Title is its name. */
export interface Shop extends Document {
  type: typeof SHOP;
  note: string;
}

/**
 * A Receipt (ADR 0082): one buying occasion at one Shop on one day. The
 * printed total is kept as read (0 = none printed); the sum of its Lines
 * is derived beside it. `noticed` marks a Sighting (CONTEXT.md, ADR 0084):
 * a price read on a shelf, not bought — it counts for what things cost,
 * never for what was spent. The photo it was read
 * from, when kept, is an Attachment embedded in the optional body.
 */
export interface Receipt extends Document {
  type: typeof RECEIPT;
  shopId: string;
  date: DateStr;
  /** Free text from the printed header — "Rue de la Paix". */
  branch: string;
  /** Integer cents as printed; 0 = no printed total. */
  total: number;
  /** A Sighting: noticed, not bought. */
  noticed: boolean;
}

/**
 * A Line (ADR 0082, internal): one priced entry on a Receipt — the only
 * fact price history is made of. `productId` "" = unmatched (the inbox).
 * `amount` is in the base unit of the matched Product's dimension (6 for six
 * litres, 0.42 for 420 g whatever unit the Product reads in, 12 for a dozen); `price` is what was paid, in cents, after any
 * discount; `promo` marks a point every "usual price" reading skips.
 */
export interface Line extends Document {
  type: typeof LINE;
  receiptId: string;
  productId: string;
  /** As printed on the receipt (or the Product's name when typed by hand). */
  label: string;
  amount: number;
  price: number;
  promo: boolean;
  /**
   * Needs an amount (ADR 0084): the Product changed dimension since this
   * Line was typed, so its amount means nothing until retyped. Still spent;
   * never per unit (see countsPerUnit).
   */
  needsAmount?: boolean;
}

/** A Line joined with its Receipt's Shop, day and noticed mark — what every reading works on. */
export interface Observation {
  line: Line;
  shopId: string;
  date: DateStr;
  /** From a Sighting: say what it cost, never that it was spent (see countsAsSpent). */
  noticed: boolean;
}
