import { addDays, clampedDate, diffDays, weekdayOf, type DateStr } from "@lifeline/core";
import type { Due, RecurRule, Recurring, Transaction } from "./types";

/**
 * Dues derive (ADR 0033): a Recurring definition's rule produces due days;
 * a day already covered by a posted Transaction (recurringId + dueDate) or
 * dismissed (skipped) stops surfacing. Nothing here is stored.
 */

/** Due days the rule produces in [from, to], inclusive. Month-length days clamp (the 31st in Feb → 28/29), deduped. */
export function ruleDays(rule: RecurRule, from: DateStr, to: DateStr): DateStr[] {
  if (from > to) return [];
  const out = new Set<DateStr>();
  if (rule.kind === "weekly") {
    if (rule.weekdays.length > 0) {
      for (let d = from; d <= to; d = addDays(d, 1)) if (rule.weekdays.includes(weekdayOf(d))) out.add(d);
    }
  } else if (rule.kind === "monthly") {
    const [fy, fm] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    for (let ym = fy * 12 + fm - 1; ym <= ty * 12 + tm - 1; ym++) {
      const y = Math.floor(ym / 12);
      const m = (ym % 12) + 1;
      for (const day of rule.days) {
        const d = clampedDate(y, m, day);
        if (d >= from && d <= to) out.add(d);
      }
    }
  } else {
    const fy = Number(from.slice(0, 4));
    const ty = Number(to.slice(0, 4));
    for (let y = fy; y <= ty; y++) {
      for (const { month, day } of rule.dates) {
        const d = clampedDate(y, month, day);
        if (d >= from && d <= to) out.add(d);
      }
    }
  }
  return Array.from(out).sort();
}

/** How far back an unconfirmed Due keeps surfacing, and how far ahead the forecast looks. */
export const DUE_LOOKBACK_DAYS = 62;
export const DUE_LOOKAHEAD_DAYS = 31;

/**
 * Every open Due, overdue first: rule days in the window, minus the ones a
 * posted Transaction covers, minus the dismissed. The upcoming stretch *is*
 * the forecast — no separate concept.
 */
export function openDues(recurrings: Recurring[], transactions: Transaction[], today: DateStr): Due[] {
  const covered = new Set<string>();
  for (const t of transactions) if (t.recurringId && t.dueDate) covered.add(`${t.recurringId}/${t.dueDate}`);
  const out: Due[] = [];
  for (const r of recurrings) {
    if (r.paused) continue;
    const from = addDays(today, -DUE_LOOKBACK_DAYS) > r.startDate ? addDays(today, -DUE_LOOKBACK_DAYS) : r.startDate;
    for (const date of ruleDays(r.rule, from, addDays(today, DUE_LOOKAHEAD_DAYS))) {
      if (covered.has(`${r.id}/${date}`)) continue;
      if (r.skipped.includes(date)) continue;
      out.push({ recurring: r, date });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.recurring.payee.localeCompare(b.recurring.payee));
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
