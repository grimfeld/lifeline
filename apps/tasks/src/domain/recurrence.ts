import type { Weekday } from "@lifeline/core";
import type { Recurrence } from "./types";

/** How a Recurrence is written by a caller with no dialog (ADR 0062) — the hint on `tasks.add`. */
export const RECURRENCE_HINT =
  'Omit for a one-time task. Weekly: {"kind":"weekly","weekdays":[1,3]} (0 = Sunday … 6 = Saturday). ' +
  'Monthly: {"kind":"monthly","days":[1,15]}. Yearly: {"kind":"yearly","dates":[{"month":3,"day":14}]}.';

function ints(v: unknown, min: number, max: number): number[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out = v.map(Number);
  return out.every((n) => Number.isInteger(n) && n >= min && n <= max) ? Array.from(new Set(out)).sort((a, b) => a - b) : null;
}

/** A Recurrence from untrusted input, or a readable error. */
export function readRecurrence(v: unknown): Recurrence {
  const r = v as { kind?: unknown; weekdays?: unknown; days?: unknown; dates?: unknown };
  const bad = (what: string) => new Error(`Recurrence: ${what}. ${RECURRENCE_HINT}`);
  switch (r?.kind) {
    case "weekly": {
      const weekdays = ints(r.weekdays, 0, 6);
      if (!weekdays) throw bad("weekdays must be a non-empty list of 0–6");
      return { kind: "weekly", weekdays: weekdays as Weekday[] };
    }
    case "monthly": {
      const days = ints(r.days, 1, 31);
      if (!days) throw bad("days must be a non-empty list of 1–31");
      return { kind: "monthly", days };
    }
    case "yearly": {
      const dates = Array.isArray(r.dates) ? r.dates : [];
      const ok = dates.length > 0 && dates.every((d) => {
        const { month, day } = (d ?? {}) as { month?: unknown; day?: unknown };
        return Number.isInteger(month) && Number.isInteger(day) && (month as number) >= 1 && (month as number) <= 12 && (day as number) >= 1 && (day as number) <= 31;
      });
      if (!ok) throw bad("dates must be a non-empty list of {month 1–12, day 1–31}");
      return { kind: "yearly", dates: dates.map((d) => ({ month: (d as { month: number }).month, day: (d as { day: number }).day })) };
    }
    default:
      throw bad("kind must be weekly, monthly or yearly");
  }
}
