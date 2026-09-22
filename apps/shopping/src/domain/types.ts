import type { DateStr, Document } from "@lifeline/core";

/**
 * A Need (CONTEXT.md, ADR 0055): one thing to buy — a title in my own words
 * and an optional note, nothing structured. No day, never Schedulable. One
 * Need per thing: ticking it makes it Bought (dated, kept), and the same
 * title typed again brings the same Need back to the list.
 */
export interface Need extends Document {
  /** Link to the `aisle` Document; "" = buyable anywhere. */
  aisleId: string;
  /** How many, which brand, "the blue one". "" = none. */
  note: string;
  /** Day it was ticked in the shop; "" = still on the list. */
  boughtOn: DateStr;
  /** ISO instant it last came onto the list — made or brought back. The list reads oldest first. */
  listedAt: string;
}

/**
 * An Aisle (CONTEXT.md): a loose, user-defined heading the list is grouped
 * under, in my own order. Says nothing about which Shop.
 */
export interface Aisle extends Document {
  /** Position in the walk; lower first. */
  rank: number;
}

export const NEED = "need";
export const AISLE = "aisle";
