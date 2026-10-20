/**
 * Keyboard paging through the Journal (#213, spec #204): Alt+←/→ steps a Day
 * by a calendar day and a period by one of its kind; Alt+Shift+←/→ skips to
 * the nearest written Day, or the nearest period of the kind whose review
 * exists (`nearest.ts`).
 */

import { addDays, type DateStr } from "@lifeline/core";
import { isCalendarDay, kindOfKey, shiftPeriod } from "./periods";
import { nearestReview, nearestWrittenDay } from "./nearest";
import type { DayLike } from "./written";

/** One page back or forward; `skip` passes over the unwritten ones. */
export type PagingStep = { by: -1 | 1; skip: boolean };

type KeyLike = Pick<KeyboardEvent, "key" | "altKey" | "shiftKey" | "ctrlKey" | "metaKey" | "defaultPrevented">;

/** The step Alt(+Shift)+←/→ asks for, or undefined for any other key (or one something nearer the focus already took). */
export function pagingStep(e: KeyLike): PagingStep | undefined {
  if (e.defaultPrevented || !e.altKey || e.ctrlKey || e.metaKey) return undefined;
  const by = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : undefined;
  return by && { by, skip: e.shiftKey };
}

/**
 * Where a step leads from the page at `key` — a Day's date or a period key —
 * or undefined when nothing lies that way (no written Day or review past it).
 */
export function pageTo(notes: readonly DayLike[], key: string, step: PagingStep): string | undefined {
  const dir = step.by < 0 ? "before" : "after";
  if (isCalendarDay(key)) return step.skip ? nearestWrittenDay(notes, key as DateStr)[dir] : addDays(key, step.by);
  if (!kindOfKey(key)) return undefined;
  return step.skip ? nearestReview(notes, key)[dir] : shiftPeriod(key, step.by);
}
