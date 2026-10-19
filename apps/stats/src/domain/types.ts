import type { Document } from "@lifeline/core";
import type { ColorSlot } from "@lifeline/ui";

export const STAT_KINDS = ["additive", "measurement", "boolean", "collection"] as const;
export type StatKind = (typeof STAT_KINDS)[number];

export { COLOR_SLOTS, colorVar, type ColorSlot } from "@lifeline/ui";

/**
 * A named series (notch's Stat), a Document of type "stat" whose `title` is
 * the name. Defines what is tracked and how values are read; holds no totals — those are always derived from Entries. Kind is
 * fixed after creation (entries would mean something else). Goals/targets
 * are out of scope; `universeSize` is a fact shown as a denominator. A
 * Collection may preset its `items`: then they are the denominator and logging
 * is ticking them off a checklist.
 */
export interface Stat extends Document {
  type: typeof STAT;
  kind: StatKind;
  /** additive/measurement only. */
  unit: string;
  color: ColorSlot;
  /** additive only: the one-tap quick-log amount. 0 = open the dialog. */
  defaultIncrement: number;
  /** collection only. 0 = unknown. Ignored while `items` is non-empty. */
  universeSize: number;
  /** collection only: the preset items to collect, in the user's order. Empty = free-text logging. */
  items: string[];
}

/**
 * One logged event of a Stat. `ts` is when it happened (user-settable,
 * backdating allowed), an ISO instant. Boolean/collection values are 1 and
 * ignored; duplicates are collapsed at derivation, never rejected (ADR-0002
 * of notch, kept).
 */
export interface Entry extends Document {
  type: typeof STAT_ENTRY;
  statId: string;
  value: number;
  /** collection only: the item collected. */
  item: string;
  ts: string;
}

export type Period = "week" | "month" | "year" | "all";

/** Document type ids (ADR 0019). */
export const STAT = "stat";
export const STAT_ENTRY = "stat_entry";
/** @deprecated aliases of the type ids (old collection names). */
export const STATS = STAT;
export const ENTRIES = STAT_ENTRY;
