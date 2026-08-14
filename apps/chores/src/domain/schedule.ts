import {
  addDays,
  clampedDate,
  diffDays,
  parts,
  weekdayOf,
  type DateStr,
} from "@lifeline/core";
import type { Chore, Schedule } from "./types";

type CalendarSchedule = Exclude<Schedule, { kind: "interval" }>;

/** Earliest date matching the calendar pattern on or after `from`. */
export function nextPatternDateOnOrAfter(
  s: CalendarSchedule,
  from: DateStr,
): DateStr {
  switch (s.kind) {
    case "weekly": {
      const want = new Set(s.weekdays);
      for (let i = 0; i < 7; i++) {
        const d = addDays(from, i);
        if (want.has(weekdayOf(d))) return d;
      }
      throw new Error("weekly schedule has no weekdays");
    }
    case "monthly": {
      const { y, m } = parts(from);
      const thisMonth = clampedDate(y, m, s.dayOfMonth);
      if (thisMonth >= from) return thisMonth;
      const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
      return clampedDate(next.y, next.m, s.dayOfMonth);
    }
    case "yearly": {
      const { y } = parts(from);
      const thisYear = clampedDate(y, s.month, s.day);
      if (thisYear >= from) return thisYear;
      return clampedDate(y + 1, s.month, s.day);
    }
  }
}

/**
 * The single next due date of a chore — always computed, never stored.
 * Missed occurrences collapse: a result in the past means "overdue since
 * that date". Returns null for paused/archived chores: they are never due.
 */
export function dueDate(chore: Chore, lastDoneOn: DateStr | null): DateStr | null {
  if (chore.status !== "active") return null;

  const s = chore.schedule;
  if (s.kind === "interval") {
    // Anchor wins while it is newer than the last completion: covers a
    // fresh chore (due on its anchor date) and a resume re-anchor.
    if (chore.anchorDate && (!lastDoneOn || chore.anchorDate > lastDoneOn)) {
      return chore.anchorDate;
    }
    if (lastDoneOn) return addDays(lastDoneOn, s.days);
    // Interval chore with neither anchor nor completions: due from creation.
    return chore.createdAt;
  }

  // Calendar: earliest pattern date strictly after the last completion,
  // or on/after creation when never completed.
  const from = lastDoneOn ? addDays(lastDoneOn, 1) : chore.createdAt;
  return nextPatternDateOnOrAfter(s, from);
}

export type DueState =
  | { state: "overdue"; dueOn: DateStr; daysLate: number }
  | { state: "due-today"; dueOn: DateStr }
  | { state: "upcoming"; dueOn: DateStr; daysUntil: number }
  | { state: "not-scheduled" };

export function dueState(
  chore: Chore,
  lastDoneOn: DateStr | null,
  today: DateStr,
): DueState {
  const due = dueDate(chore, lastDoneOn);
  if (!due) return { state: "not-scheduled" };
  if (due < today) {
    return { state: "overdue", dueOn: due, daysLate: diffDays(due, today) };
  }
  if (due === today) return { state: "due-today", dueOn: due };
  return { state: "upcoming", dueOn: due, daysUntil: diffDays(today, due) };
}

/**
 * For each day in [start, start + days), how many chores would need doing
 * that day if the user takes no action — i.e. chores whose due date is on
 * or before that day.
 */
export function dueCountsByDay(
  chores: { chore: Chore; lastDoneOn: DateStr | null }[],
  start: DateStr,
  days: number,
): { date: DateStr; count: number }[] {
  const dues = chores
    .map(({ chore, lastDoneOn }) => dueDate(chore, lastDoneOn))
    .filter((d): d is DateStr => d !== null);
  const out: { date: DateStr; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    out.push({ date, count: dues.filter((d) => d <= date).length });
  }
  return out;
}

export function describeSchedule(s: Schedule): string {
  switch (s.kind) {
    case "weekly": {
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `Weekly on ${s.weekdays.map((d) => names[d]).join(", ")}`;
    }
    case "monthly":
      return `Monthly on day ${s.dayOfMonth}`;
    case "yearly":
      return `Yearly on ${s.month}/${s.day}`;
    case "interval":
      return s.days === 1 ? "Every day" : `Every ${s.days} days`;
  }
}
