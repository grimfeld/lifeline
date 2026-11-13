import type { DateStr, LinkIndex } from "@lifeline/core";

/** One thing on a Person's timeline (#422): a Document that links to them, on its own day. */
export interface TimelineEntry {
  sourceId: string;
  type: string;
  title: string;
  /** The Document's own day: its date, a Day's title, else the day it last changed. */
  day: DateStr;
  /** The Link field it links through (an Event's With); none when it names them in its text. */
  field?: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}/;

function dayOf(d: Record<string, unknown>): DateStr {
  for (const v of [d.date, d.title, d.updatedAt, d.createdAt]) if (typeof v === "string" && DAY.test(v)) return v.slice(0, 10) as DateStr;
  return "" as DateStr;
}

/**
 * What links to a Person, newest first: Events with them, Tasks for them,
 * notes and Days that name them. Each Document once, by its Link field when
 * it has one (a Day naming them by name and by alias is one entry).
 */
export function timelineOf(index: LinkIndex, personId: string): TimelineEntry[] {
  const byId = new Map<string, TimelineEntry>();
  for (const b of index.backlinksTo(personId)) {
    const d = index.byId.get(b.sourceId);
    if (!d) continue;
    const had = byId.get(b.sourceId);
    if (had && (had.field || !b.field)) continue;
    byId.set(b.sourceId, { sourceId: b.sourceId, type: d.type, title: d.title, day: dayOf(d), ...(b.field ? { field: b.field } : {}) });
  }
  return [...byId.values()].sort((a, b) => b.day.localeCompare(a.day) || a.title.localeCompare(b.title));
}

/** The timeline by month ("2026-11"), newest month first, as `timelineOf` orders it. */
export function timelineMonths(entries: readonly TimelineEntry[]): { month: string; entries: TimelineEntry[] }[] {
  const months: { month: string; entries: TimelineEntry[] }[] = [];
  for (const e of entries) {
    const month = e.day.slice(0, 7);
    const last = months.at(-1);
    if (last?.month === month) last.entries.push(e);
    else months.push({ month, entries: [e] });
  }
  return months;
}
