import type { Weekday } from "@lifeline/core";
import type { Schedule } from "./types";

/** How a Schedule is written by a caller with no dialog (ADR 0062) — the hint on `chores.add`. */
export const SCHEDULE_HINT =
  'Weekly: {"kind":"weekly","weekdays":[6]} (0 = Sunday … 6 = Saturday). Monthly: {"kind":"monthly","dayOfMonth":1}. ' +
  'Yearly: {"kind":"yearly","month":4,"day":1}. Every N days after the last completion: {"kind":"interval","days":14}.';

const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** A Schedule from untrusted input, or a readable error. */
export function readSchedule(v: unknown): Schedule {
  const s = v as { kind?: unknown; weekdays?: unknown; dayOfMonth?: unknown; month?: unknown; day?: unknown; days?: unknown };
  const bad = (what: string) => new Error(`Schedule: ${what}. ${SCHEDULE_HINT}`);
  switch (s?.kind) {
    case "weekly": {
      const w = Array.isArray(s.weekdays) ? s.weekdays : [];
      if (w.length === 0 || !w.every((d) => int(d, 0, 6))) throw bad("weekdays must be a non-empty list of 0–6");
      return { kind: "weekly", weekdays: Array.from(new Set(w as Weekday[])).sort((a, b) => a - b) };
    }
    case "monthly":
      if (!int(s.dayOfMonth, 1, 31)) throw bad("dayOfMonth must be 1–31");
      return { kind: "monthly", dayOfMonth: s.dayOfMonth as number };
    case "yearly":
      if (!int(s.month, 1, 12) || !int(s.day, 1, 31)) throw bad("month must be 1–12 and day 1–31");
      return { kind: "yearly", month: s.month as number, day: s.day as number };
    case "interval":
      if (!int(s.days, 1, 3650)) throw bad("days must be a whole number of at least 1");
      return { kind: "interval", days: s.days as number };
    default:
      throw bad("kind must be weekly, monthly, yearly or interval");
  }
}
