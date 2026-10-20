/**
 * Skipping the gaps (spec #204): from a date, the nearest written Day before
 * and after it; from a period, the nearest period of the same kind whose
 * review exists. "Written" is the shared rule (`written.ts`), so a Day holding
 * only its Template is skipped like a date with no Day.
 */

import type { DateStr } from "@lifeline/core";
import { kindOfKey } from "./periods";
import { writtenDates, type DayLike } from "./written";

/** The nearest key strictly before and strictly after `at`, or undefined in a direction with none. */
export type Nearest<K extends string = string> = { before?: K; after?: K };

/** The largest key below `at` and the smallest above it. Keys of one kind order as strings (zero-padded, four-digit years). */
function around(keys: Iterable<string>, at: string): Nearest {
  let before: string | undefined;
  let after: string | undefined;
  for (const k of keys) {
    if (k < at && (before === undefined || k > before)) before = k;
    if (k > at && (after === undefined || k < after)) after = k;
  }
  return { before, after };
}

/** The nearest written Day strictly before and after `date`, by date. Template-only Days are skipped. */
export function nearestWrittenDay(notes: readonly DayLike[], date: DateStr): Nearest<DateStr> {
  return around(writtenDates(notes), date);
}

/** The nearest period of `key`'s kind, strictly before and after it, whose review exists. Nothing when `key` is no period. */
export function nearestReview(notes: readonly DayLike[], key: string): Nearest {
  const kind = kindOfKey(key);
  if (!kind) return { before: undefined, after: undefined };
  return around(
    notes.filter((n) => n.type === kind && kindOfKey(n.title) === kind).map((n) => n.title),
    key,
  );
}
