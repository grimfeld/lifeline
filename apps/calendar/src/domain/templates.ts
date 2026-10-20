import { formatTime, spanLasting, type DateStr, type TimeStr } from "@lifeline/core";
import type { EventTemplate } from "./types";

/** A template with no length of its own lasts an hour. */
export const DEFAULT_DURATION_MIN = 60;

export function durationOf(t: Pick<EventTemplate, "durationMin">): number {
  const n = Number(t.durationMin);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_DURATION_MIN;
}

/**
 * Where a template started at `start` on `date` ends: its length on, into the
 * next day when it runs past midnight, and at 00:00 there rather than "24:00"
 * (ADR 0090).
 */
export function endOf(t: Pick<EventTemplate, "durationMin">, date: DateStr, start: TimeStr): { endDate: DateStr; end: TimeStr } {
  const { endDate, end } = spanLasting(date, start, durationOf(t));
  return { endDate, end };
}

/** "1 h 30", "45 min", "2 h". */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** "All day" or "1 h · from 9:00 AM" — what the template will make. */
export function describeTemplate(t: EventTemplate): string {
  if (t.allDay) return "All day";
  const len = formatDuration(durationOf(t));
  return t.defaultStart ? `${len} · from ${formatTime(t.defaultStart)}` : len;
}

export function compareTemplates(a: EventTemplate, b: EventTemplate): number {
  return a.title.localeCompare(b.title);
}
