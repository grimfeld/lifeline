import { BLOCK_DEFAULT_MIN, toHours, type DateStr, type WorkOnHours } from "@lifeline/core";
import { addMinutes, minutesBetween, SNAP_MIN, toClock } from "../surfaces/hours";

/**
 * A Time block's timing as the Peek's timing section holds it (#537): its
 * day, its start (null for an untimed chip not yet given one) and its length.
 * A block stays inside its day (ADR 0028).
 */
export interface BlockTime {
  date: DateStr;
  start: string | null;
  len: number;
}

/** What was tapped, as a timing: a block's own; a chip's day (else `defaultDay`), no start, its Estimate as the length. */
export function blockOfTapped(item: WorkOnHours, defaultDay: DateStr): BlockTime {
  if (item.placementId && item.start) return { date: item.displayDate ?? item.date ?? defaultDay, start: item.start, len: minutesBetween(item.start, item.end, BLOCK_DEFAULT_MIN) };
  return { date: item.displayDate ?? item.date ?? defaultDay, start: null, len: item.estimateMin && item.estimateMin > 0 ? item.estimateMin : BLOCK_DEFAULT_MIN };
}

/** The start moved by `min` minutes, the length kept, inside the day. */
export function blockNudged(b: BlockTime, min: number): BlockTime {
  if (!b.start) return b;
  const latest = 24 - b.len / 60;
  return { ...b, start: toClock(Math.max(0, Math.min(latest, toHours(b.start) + min / 60))) };
}

/** Another length, at least one grid step and at most the day. */
export function blockLasting(b: BlockTime, min: number): BlockTime {
  return { ...b, len: Math.max(SNAP_MIN, Math.min(24 * 60, Math.round(min))) };
}

/** Where it ends: its length after its start, at most midnight. */
export function blockEnd(b: BlockTime & { start: string }): string {
  return addMinutes(b.start, b.len);
}
