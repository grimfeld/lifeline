import type { DateStr, Weekday, Document } from "@lifeline/core";

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

/** A Chore is a Document of type `chore` (ADR 0018); its name is the Document title. */
export interface Chore extends Document {
  type: typeof CHORE;
  status: ChoreStatus;
  schedule: Schedule;
  /**
   * Interval chores only: the date the cycle is measured from while it has
   * priority over the last completion. Due = anchor when anchor > last
   * completion (covers both a fresh chore and a resume re-anchor);
   * otherwise due = last completion + interval.
   */
  anchorDate: DateStr | null;
}

/** Internal Document type: one completion of a Chore on a day. */
export interface Completion extends Document {
  type: typeof COMPLETION;
  choreId: string;
  doneOn: DateStr;
  recordedAt: string; // ISO timestamp
}

/** Document type ids (ADR 0019). */
export const CHORE = "chore";
export const COMPLETION = "chore_completion";
