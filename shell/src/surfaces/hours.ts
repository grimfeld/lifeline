import { toHours } from "@lifeline/core";

/** The Schedule's grid: every drag, nudge and new block lands on a quarter hour. */
export const SNAP_MIN = 15;

/** Hours since midnight → "HH:MM", clamped to the day. */
export function toClock(hours: number): string {
  const h = Math.max(0, Math.min(24, hours));
  const total = Math.round(h * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function snap(hours: number): number {
  return Math.round((hours * 60) / SNAP_MIN) * (SNAP_MIN / 60);
}

/** Whole minutes between two clock times, at least one grid step. */
export function minutesBetween(start: string, end: string | null | undefined, fallbackMin: number): number {
  if (!end) return fallbackMin;
  return Math.max(SNAP_MIN, Math.round((toHours(end) - toHours(start)) * 60));
}

export function addMinutes(start: string, min: number): string {
  return toClock(toHours(start) + min / 60);
}
