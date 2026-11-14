import { DAY_TYPE, diffDays, todayStr, type DateStr, type LinkIndex } from "@lifeline/core";
import type { UpcomingOccasion } from "./occasions";

/** One thing on a Person's timeline (#422): a Document that links to them, on its own day. */
export interface TimelineEntry {
  sourceId: string;
  type: string;
  title: string;
  /** The Document's own day: its date, a Day's title, else the day it last changed; null when it has none. */
  day: DateStr | null;
  /** The Link field it links through (an Event's With); none when it names them in its text. */
  field?: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A date-only value as is; a timestamp as the local day it falls on (what todayStr says). */
function localDay(v: unknown): DateStr | undefined {
  if (typeof v !== "string") return undefined;
  if (DAY.test(v)) return v;
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
  return [...byId.values()].sort((a, b) => (b.day ?? "").localeCompare(a.day ?? "") || a.title.localeCompare(b.title));
}

/** One stop on the line: an Occasion ahead, or a Document that links in. */
export type TimelineStop =
  | { kind: "occasion"; day: DateStr; occasion: UpcomingOccasion }
  | { kind: "entry"; day: DateStr | null; entry: TimelineEntry; /** Days from today, for what is today or later. */ inDays?: number };

export interface TimelineMonth {
  /** "2026-11"; null for what has no day. */
  month: string | null;
  stops: TimelineStop[];
}

/** Stops by month, in the order given; what has no day in a month of its own, null. */
export function timelineMonths(stops: readonly TimelineStop[]): TimelineMonth[] {
  const months: TimelineMonth[] = [];
  for (const s of stops) {
    const month = s.day?.slice(0, 7) ?? null;
    const last = months.at(-1);
    if (last?.month === month) last.stops.push(s);
    else months.push({ month, stops: [s] });
  }
  return months;
}

const stopTitle = (s: TimelineStop) => (s.kind === "occasion" ? s.occasion.label : s.entry.title);

/**
 * The two sides of the Today line, each by month, newest first. Ahead:
 * Occasions and what links in from today on, one order, the furthest at the
 * top and the soonest just above the line. Below: what is past, then what has
 * no day.
 */
export function timelineSides(
  entries: readonly TimelineEntry[],
  occasions: readonly UpcomingOccasion[],
  today: DateStr,
): { ahead: TimelineMonth[]; past: TimelineMonth[] } {
  const ahead: TimelineStop[] = occasions.map((occasion) => ({ kind: "occasion", day: occasion.date, occasion }));
  const past: TimelineStop[] = [];
  for (const entry of entries) {
    if (entry.day !== null && entry.day >= today) ahead.push({ kind: "entry", day: entry.day, entry, inDays: diffDays(today, entry.day) });
    else past.push({ kind: "entry", day: entry.day, entry });
  }
  ahead.sort((a, b) => (b.day ?? "").localeCompare(a.day ?? "") || (a.kind === b.kind ? 0 : a.kind === "occasion" ? -1 : 1) || stopTitle(a).localeCompare(stopTitle(b)));
  return { ahead: timelineMonths(ahead), past: timelineMonths(past) };
}
