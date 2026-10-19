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
 * The one thing a Product fixes (CONTEXT.md "Product", ADR 0082): the
 * measure every Line of it is expressed in. Pack size is *not* here — a
 * litre and a six-pack are one Product with different amounts on the Line.
 */
export type Measure = "kg" | "l" | "piece";
export const MEASURES: Measure[] = ["kg", "l", "piece"];
export const MEASURE_LABEL: Record<Measure, string> = { kg: "Kilogram", l: "Litre", piece: "Piece" };
/** Short unit for amounts — "0.42 kg", "6 L", "12 pc". */
export const MEASURE_UNIT: Record<Measure, string> = { kg: "kg", l: "L", piece: "pc" };
/** The unit price's suffix — "€/kg". */
export const MEASURE_PER: Record<Measure, string> = { kg: "/kg", l: "/L", piece: "/pc" };

export function isMeasure(v: unknown): v is Measure {
  return typeof v === "string" && (MEASURES as string[]).includes(v);
}

/** A printed label a Shop uses for a Product, remembered so the next import resolves on its own. */
export interface LabelMemory {
  shopId: string;
  /** Normalised (see normalizeLabel). */
  label: string;
}

/**
 * A Product (ADR 0082): a thing bought again. Title is its name; `measure`
 * is fixed after creation; `labels` is the App's memory of what each Shop
 * prints for it (guarded — written only by matching and unmatching Lines).
 */
export interface Product extends Document {
  type: typeof PRODUCT;
  measure: Measure;
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
 * `amount` is in the matched Product's measure (6 for six litres, 0.42 for
 * 420 g, 12 for a dozen); `price` is what was paid, in cents, after any
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
}

/** A Line joined with its Receipt's Shop, day and noticed mark — what every reading works on. */
export interface Observation {
  line: Line;
  shopId: string;
  date: DateStr;
  /** From a Sighting: say what it cost, never that it was spent (see countsAsSpent). */
  noticed: boolean;
}
