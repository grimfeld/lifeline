import { addDays, diffDays, type DateStr } from "@lifeline/core";
import type { Due, Series } from "./types";
import { coveredDate, nextOccurrence } from "./series";

/**
 * Dues derive (ADR 0034): a Recurring series is projected forward from the
 * anchor day its newest occurrence covered, so a day already paid can never be due — coverage is
 * the ledger itself, not bookkeeping on the Transaction. A dormant series
 * (nothing for two whole periods) is over and surfaces nothing; a muted one
 * has been waved off by hand. Nothing here is stored.
 */

/** How far ahead the forecast looks. The overdue side needs no window: dormancy ends it. */
export const DUE_LOOKAHEAD_DAYS = 31;

/**
 * Every open Due, overdue first. The upcoming stretch *is* the forecast —
 * no separate concept (ADR 0033).
 */
export function openDues(series: Series[], today: DateStr): Due[] {
  const horizon = addDays(today, DUE_LOOKAHEAD_DAYS);
  const out: Due[] = [];
  for (const s of series) {
    if (s.muted || s.dormant) continue;
    let date = nextOccurrence(s, coveredDate(s));
    while (date <= horizon) {
      if (!s.skipped.includes(date)) out.push({ series: s, date });
      const next = nextOccurrence(s, date);
      // A rule that fails to advance would loop forever; nothing does today.
      if (next <= date) break;
      date = next;
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.series.payee.localeCompare(b.series.payee));
}

export function isOverdue(due: Due, today: DateStr): boolean {
  return due.date < today;
}

/** "today" / "in 3 days" / "5 days ago". */
export function describeDueDay(date: DateStr, today: DateStr): string {
  const n = diffDays(today, date);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
