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

/** What an Event dialog holds that a template fills: its title, when, notes and Tags. */
export interface TemplateFillable {
  title: string;
  notes: string;
  tags: string[];
  date: string;
  endDate: string;
  allDay: boolean;
  start: string;
  end: string;
}

/**
 * The dialog's draft with a template picked into it (#535), nothing saved: the
 * template's title, all day or its length from the start. The start is the one
 * given (the hour the dialog was opened from) when there is one, else the
 * template's usual start, else what the draft had. Its notes join the draft's,
 * its Tags are added. The day stays the draft's.
 */
export function fillFromTemplate<D extends TemplateFillable>(t: EventTemplate, draft: D, givenStart?: string): D {
  const notes = [draft.notes.trim(), (t.notes ?? "").trim()].filter(Boolean).join("\n");
  const tags = [...draft.tags, ...(t.tags ?? []).filter((x) => !draft.tags.includes(x))];
  const common = { ...draft, title: t.title, notes, tags, endDate: "" };
  if (t.allDay) return { ...common, allDay: true };
  const start = givenStart || t.defaultStart || draft.start;
  const { endDate, end } = endOf(t, draft.date, start);
  return { ...common, allDay: false, start, end, endDate: endDate === draft.date ? "" : endDate };
}
