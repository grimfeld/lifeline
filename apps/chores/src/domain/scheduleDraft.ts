import type { Weekday } from "@lifeline/core";
import type { Schedule } from "./types";

/**
 * A Schedule as its form holds it while it is edited — the Chore dialog and
 * the Chore's Peek alike: every kind's numbers at once, so switching kind and
 * back loses nothing, and a half-typed value is not yet a Schedule.
 */
export interface ScheduleDraft {
  kind: Schedule["kind"];
  weekdays: Weekday[];
  dayOfMonth: number;
  month: number;
  day: number;
  intervalDays: number;
}

export function draftOf(s: Schedule | undefined): ScheduleDraft {
  return {
    kind: s?.kind ?? "weekly",
    weekdays: s?.kind === "weekly" ? s.weekdays : [1],
    dayOfMonth: s?.kind === "monthly" ? s.dayOfMonth : 1,
    month: s?.kind === "yearly" ? s.month : 1,
    day: s?.kind === "yearly" ? s.day : 1,
    intervalDays: s?.kind === "interval" ? s.days : 7,
  };
}

const within = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

/** The Schedule a draft stands for, or what is still wrong with it. */
export function scheduleOf(d: ScheduleDraft): { ok: true; schedule: Schedule } | { ok: false; error: string } {
  switch (d.kind) {
    case "weekly":
      return d.weekdays.length
        ? { ok: true, schedule: { kind: "weekly", weekdays: [...d.weekdays].sort((a, b) => a - b) } }
        : { ok: false, error: "Pick at least one weekday" };
    case "monthly":
      return within(d.dayOfMonth, 1, 31) ? { ok: true, schedule: { kind: "monthly", dayOfMonth: d.dayOfMonth } } : { ok: false, error: "Day of month is 1–31" };
    case "yearly":
      return within(d.month, 1, 12) && within(d.day, 1, 31)
        ? { ok: true, schedule: { kind: "yearly", month: d.month, day: d.day } }
        : { ok: false, error: "Month is 1–12, day 1–31" };
    case "interval":
      return within(d.intervalDays, 1, 3650) ? { ok: true, schedule: { kind: "interval", days: d.intervalDays } } : { ok: false, error: "Every at least 1 day" };
  }
}
