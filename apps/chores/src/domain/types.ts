import type { DateStr, Weekday, SyncedRecord } from "@lifeline/core";

/**
 * The rule that determines when a chore becomes due. See CONTEXT.md.
 * Calendar variants (weekly/monthly/yearly) are due on fixed dates;
 * interval is due N days after the last completion.
 */
export type Schedule =
  | { kind: "weekly"; weekdays: Weekday[] }
  | { kind: "monthly"; dayOfMonth: number } // 1–31, clamped to month length
  | { kind: "yearly"; month: number; day: number } // month 1–12, day clamped
  | { kind: "interval"; days: number }; // >= 1

export type ChoreStatus = "active" | "paused" | "archived";

export interface Chore extends SyncedRecord {
  name: string;
  /** Normalised tags (ADR 0014); may be undefined on old records — read with `?? []`. */
  tags?: string[];
  /** @deprecated Folded into `tags` (ADR 0014). Only present on unmigrated local records; read via the repo fallback. */
  category?: string | null;
  status: ChoreStatus;
  schedule: Schedule;
  /**
   * Interval chores only: the date the cycle is measured from while it has
   * priority over the last completion. Due = anchor when anchor > last
   * completion (covers both a fresh chore and a resume re-anchor);
   * otherwise due = last completion + interval.
   */
  anchorDate: DateStr | null;
  createdAt: DateStr;
}

export interface Completion extends SyncedRecord {
  choreId: string;
  doneOn: DateStr;
  recordedAt: string; // ISO timestamp
}

export const CHORES = "chores";
export const COMPLETIONS = "chore_completions";
