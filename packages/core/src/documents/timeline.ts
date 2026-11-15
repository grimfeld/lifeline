import { lastDayCovered } from "../contracts/timed";
import { diffDays, todayStr, type DateStr } from "../dates";
import type { LinkIndex, Reach } from "./links";
import { DAY_TYPE, isDateStr } from "./sourceDays";

/** One thing on a Document's timeline (#422: a Person's, ADR 0119: a Place's): a Document that links to it, on its own day. */
export interface TimelineEntry {
  sourceId: string;
  type: string;
  title: string;
  /** The Document's own day: its date, a Day's title, else the day it last changed; null when it has none. */
  day: DateStr | null;
  /** Whether `day` is the Document's own (its date, a Day's title), not the last-changed fallback; only an own day can be ahead. */
  ownDay: boolean;
  /** The last day of an own-dated entry that runs over several (an Event's End day); it is ahead until this day has passed. */
  endDay?: DateStr;
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

/** Where an entry sits on the line: its day, whether that day is its own, and the last day it covers. */
type EntryDays = Pick<TimelineEntry, "day" | "ownDay" | "endDay">;

/** The last day a Document dated `own` covers, from its End day; one ending at 00:00 only reaches midnight (ADR 0090). */
function lastDayOf(d: Record<string, unknown>, own: DateStr): DateStr | undefined {
  const end = localDay(d.endDate);
  if (!end || end <= own) return undefined;
  return d.end === "00:00" ? lastDayCovered({ date: own, endDate: end, end: "00:00" }) : end;
}

function dayOf(d: { type: string; title: string } & Record<string, unknown>): EntryDays {
  const own = localDay(d.type === DAY_TYPE ? d.title : d.date);
  if (own) {
    const end = d.type === DAY_TYPE ? undefined : lastDayOf(d, own);
    return { day: own, ownDay: true, ...(end && end > own ? { endDay: end } : {}) };
  }
  for (const v of [d.updatedAt, d.createdAt]) {
    const day = localDay(v);
    if (day) return { day, ownDay: false };
  }
  return { day: null, ownDay: false };
}

/**
 * Whether a reach takes the place of the entry already kept for its source:
 * a direct link through a Link field over one that is not. A direct link
 * already beats one through a Household, because `reaches` lists direct links
 * first and a source through a Household only when it names no one directly.
 */
const outranks = (r: Reach, kept: TimelineEntry): boolean => !r.via && !!r.field && !kept.field;

/**
 * What links to a Document, newest first: for a Person, Events with them,
 * Tasks for them, notes and Days that name them, and what links to a
 * Household they were a member of then (ADR 0117); for a Place, Events At it
 * and what names it (ADR 0119). Each Document once, by its Link field when it
 * has one (a Day naming it by name and by alias is one entry), and by a direct
 * link over one through a Household.
 */
export function timelineOf(index: LinkIndex, docId: string): TimelineEntry[] {
  const byId = new Map<string, TimelineEntry>();
  for (const b of index.reaches(docId)) {
    const d = index.byId.get(b.sourceId);
    if (!d) continue;
    const had = byId.get(b.sourceId);
    if (had && !outranks(b, had)) continue;
    const how = b.via ? { via: b.via } : b.field ? { field: b.field } : {};
    byId.set(b.sourceId, { sourceId: b.sourceId, type: d.type, title: d.title, ...dayOf(d), ...how });
  }
  return [...byId.values()].sort((a, b) => (b.day ?? "").localeCompare(a.day ?? "") || a.title.localeCompare(b.title));
}

/** What a timeline's owner adds above the Today line besides what links in: a Person's Occasions (#449). */
export interface TimelineOccasion {
  label: string;
  date: DateStr;
  /** Days from today. */
  inDays: number;
}

/** A stop above the Today line: an Occasion, or a Document dated today or later, or one still under way. */
export type AheadStop<O extends TimelineOccasion = TimelineOccasion> = { day: DateStr } & (
  | { kind: "occasion"; occasion: O; /** Days from today. */ inDays: number }
  | { kind: "entry"; entry: TimelineEntry; /** Days from today; null for an Event under way, begun before today. */ inDays: number | null }
);

/** A stop below the Today line: a Document that is past, or has no day; it says nothing of how soon. */
export interface PastStop {
  kind: "entry";
  day: DateStr | null;
  entry: TimelineEntry;
  inDays: null;
}

/** One stop on the line: an Occasion ahead, or a Document that links in. */
export type TimelineStop<O extends TimelineOccasion = TimelineOccasion> = AheadStop<O> | PastStop;

export interface TimelineMonth<O extends TimelineOccasion = TimelineOccasion> {
  /** "2026-11"; null for what has no day. */
  month: string | null;
  stops: TimelineStop<O>[];
}

/** Groups stops by month, in the order given; stops with no day go in a month that is null. */
export function timelineMonths<O extends TimelineOccasion = TimelineOccasion>(stops: readonly TimelineStop<O>[]): TimelineMonth<O>[] {
  const months: TimelineMonth<O>[] = [];
  for (const s of stops) {
    const month = s.day?.slice(0, 7) ?? null;
    const last = months.at(-1);
    if (last?.month === month) last.stops.push(s);
    else months.push({ month, stops: [s] });
  }
  return months;
}

const stopTitle = (s: TimelineStop<TimelineOccasion>) => (s.kind === "occasion" ? s.occasion.label : s.entry.title);
/** On a shared day, an Occasion comes before a Document. */
const kindRank = (s: TimelineStop<TimelineOccasion>) => (s.kind === "occasion" ? 0 : 1);

/**
 * The two sides of the Today line, each by month, newest first. Ahead:
 * Occasions and what links in from today on, one order, the furthest at the
 * top and the soonest just above the line; an Event still under way (begun,
 * its End day not passed) is ahead too, by its first day, with no "how soon".
 * Below: what is past, then what has no day. A Person's page passes their
 * Occasions (#449); a Place's (ADR 0119) and a Household's pass none.
 */
export function timelineSides<O extends TimelineOccasion = TimelineOccasion>(
  entries: readonly TimelineEntry[],
  occasions: readonly O[],
  today: DateStr,
): { ahead: TimelineMonth<O>[]; past: TimelineMonth<O>[] } {
  const ahead: AheadStop<O>[] = occasions.map((occasion) => ({ kind: "occasion", day: occasion.date, occasion, inDays: occasion.inDays }));
  const past: PastStop[] = [];
  for (const entry of entries) {
    if (entry.ownDay && entry.day !== null && (entry.endDay ?? entry.day) >= today)
      ahead.push({ kind: "entry", day: entry.day, entry, inDays: entry.day >= today ? diffDays(today, entry.day) : null });
    else past.push({ kind: "entry", day: entry.day, entry, inDays: null });
  }
  ahead.sort((a, b) => b.day.localeCompare(a.day) || kindRank(a) - kindRank(b) || stopTitle(a).localeCompare(stopTitle(b)));
  return { ahead: timelineMonths<O>(ahead), past: timelineMonths<O>(past) };
}
