import type { DateStr, SyncedRecord } from "@lifeline/core";

export const STAT_KINDS = ["additive", "measurement", "boolean", "collection"] as const;
export type StatKind = (typeof STAT_KINDS)[number];

export const COLOR_SLOTS = ["blue", "orange", "aqua", "yellow", "magenta", "green", "violet", "red"] as const;
export type ColorSlot = (typeof COLOR_SLOTS)[number];

export function colorVar(slot: string): string {
  return `var(--chart-${slot})`;
}

/**
 * A named series (notch's Stat). Defines what is tracked and how values are
 * read; holds no totals — those are always derived from Entries. Kind is
 * fixed after creation (entries would mean something else). Goals/targets
 * are out of scope; `universeSize` is a fact shown as a denominator.
 */
export interface Stat extends SyncedRecord {
  name: string;
  kind: StatKind;
  /** additive/measurement only. */
  unit: string;
  color: ColorSlot;
  /** additive only: the one-tap quick-log amount. 0 = open the dialog. */
  defaultIncrement: number;
  /** collection only. 0 = unknown. */
  universeSize: number;
  createdAt: DateStr;
}

/**
 * One logged event of a Stat. `ts` is when it happened (user-settable,
 * backdating allowed), an ISO instant. Boolean/collection values are 1 and
 * ignored; duplicates are collapsed at derivation, never rejected (ADR-0002
 * of notch, kept).
 */
export interface Entry extends SyncedRecord {
  statId: string;
  value: number;
  /** collection only: the item collected. */
  item: string;
  ts: string;
}

export type Period = "week" | "month" | "year" | "all";

export const STATS = "stats";
export const ENTRIES = "stat_entries";
