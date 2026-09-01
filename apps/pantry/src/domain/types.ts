import type { DateStr, Document } from "@lifeline/core";

/**
 * A Storage (CONTEXT.md): a place food lives, user-defined — "Chest
 * freezer", "Spice rack" — of exactly one kind. A Provision sits in exactly
 * one Storage; the same product in two places is two Provisions (ADR 0043).
 */
export const STORAGE_KINDS = ["freezer", "fridge", "shelf"] as const;
export type StorageKind = (typeof STORAGE_KINDS)[number];

export interface Storage extends Document {
  kind: StorageKind;
}

/**
 * A Provision (CONTEXT.md, ADR 0043): a food product held in stock — one
 * Document per product per Storage. A plain counter, no batches: `expires`
 * is a check-by hint (the earliest unit you own), never an inventory.
 * `minimum` 0 means no threshold; quantity 0 keeps the row — a catalog
 * entry that is out of stock.
 */
export interface Provision extends Document {
  /** Link to the `storage` Document. */
  storageId: string;
  /** Count of units, never negative. */
  quantity: number;
  /** Free-text unit label — "500g pack", "bottle". "" = plain count. */
  unit: string;
  /** Running-low threshold; 0 = none (quantity 0 is always running low). */
  minimum: number;
  /** Check-by hint, "" = none. */
  expires: DateStr;
  /** Day the oldest unit went into the freezer, "" = none. */
  frozenOn: DateStr;
}

export const PROVISION = "provision";
export const STORAGE = "storage";
