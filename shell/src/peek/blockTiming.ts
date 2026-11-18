import { BLOCK_DEFAULT_MIN, blockEndAt, DAY_MIN, nudgeClock, SNAP_MIN, type DateStr, type TimeStr, type WorkOnHours } from "@lifeline/core";
import { minutesBetween } from "../surfaces/hours";

/**
 * A Time block's timing as the Peek's timing section holds it (#537): its
 * day, its start (null for an untimed chip not yet given one) and its length.
 * A block stays inside its day (ADR 0028).
 */
export interface BlockTime {
  date: DateStr;
  start: TimeStr | null;
  len: number;
}

/** What was tapped, as a timing: a block's own; a chip's day (else `defaultDay`), no start, its Estimate as the length. */
export function blockOfTapped(item: WorkOnHours, defaultDay: DateStr): BlockTime {
  const date = item.displayDate ?? item.date ?? defaultDay;
  if (item.placementId && item.start) return { date, start: item.start, len: minutesBetween(item.start, item.end, BLOCK_DEFAULT_MIN) };
  return { date, start: null, len: item.estimateMin && item.estimateMin > 0 ? item.estimateMin : BLOCK_DEFAULT_MIN };
}

/** The start moved by `min` minutes, the length kept, inside the day. */
export function blockNudged(b: BlockTime, min: number): BlockTime {
  const start = b.start && nudgeClock(b.start, min, DAY_MIN - b.len);
  return start ? { ...b, start } : b;
}

/** Another length, at least one grid step and at most the day. */
export function blockLasting(b: BlockTime, min: number): BlockTime {
  return { ...b, len: Math.max(SNAP_MIN, Math.min(DAY_MIN, Math.round(min))) };
}

/** Where it ends: its length after its start, at most midnight. */
export function blockEnd(b: BlockTime & { start: TimeStr }): TimeStr {
  return blockEndAt(b.start, b.len);
}
