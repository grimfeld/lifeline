import { DAY_TYPE, isDateStr, todayStr, type DateStr, type LinkIndex } from "@lifeline/core";

/** One thing on a Person's timeline (#422): a Document that links to them, on its own day. */
export interface TimelineEntry {
  sourceId: string;
  type: string;
  title: string;
  /** The Document's own day: its date, a Day's title, else the day it last changed; null when it has none. */
  day: DateStr | null;
  /** The Link field it links through (an Event's With); none when it names them in its text. */
  field?: string;
  /** The Household it links to, when it reaches them through one they were a member of then (ADR 0117). */
  via?: string;
}

/** A date-only value as is; a timestamp as the local day it falls on (what todayStr says). */
function localDay(v: unknown): DateStr | undefined {
  if (typeof v !== "string") return undefined;
  if (isDateStr(v)) return v;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? undefined : todayStr(t);
}

function dayOf(d: { type: string; title: string } & Record<string, unknown>): DateStr | null {
  const own = d.type === DAY_TYPE ? d.title : d.date;
  for (const v of [own, d.updatedAt, d.createdAt]) {
    const day = localDay(v);
    if (day) return day;
  }
  return null;
}

/**
 * What links to a Person, newest first: Events with them, Tasks for them,
 * notes and Days that name them, and what links to a Household they were a
 * member of then (ADR 0117). Each Document once, by its Link field when it has
 * one (a Day naming them by name and by alias is one entry), and by a direct
 * link over one through their Household.
 */
export function timelineOf(index: LinkIndex, personId: string): TimelineEntry[] {
  const byId = new Map<string, TimelineEntry>();
  for (const b of index.reaches(personId)) {
    const d = index.byId.get(b.sourceId);
    if (!d) continue;
    const had = byId.get(b.sourceId);
    if (had && (b.via || had.field || !b.field)) continue;
    byId.set(b.sourceId, { sourceId: b.sourceId, type: d.type, title: d.title, day: dayOf(d), ...(b.field && !b.via ? { field: b.field } : {}), ...(b.via ? { via: b.via } : {}) });
  }
  return [...byId.values()].sort((a, b) => (b.day ?? "").localeCompare(a.day ?? "") || a.title.localeCompare(b.title));
}

/** The timeline by month ("2026-11"; null for what has no day), newest month first, as `timelineOf` orders it. */
export function timelineMonths(entries: readonly TimelineEntry[]): { month: string | null; entries: TimelineEntry[] }[] {
  const months: { month: string | null; entries: TimelineEntry[] }[] = [];
  for (const e of entries) {
    const month = e.day?.slice(0, 7) ?? null;
    const last = months.at(-1);
    if (last?.month === month) last.entries.push(e);
    else months.push({ month, entries: [e] });
  }
  return months;
}
