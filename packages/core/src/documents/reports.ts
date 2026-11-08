import { useMemo } from "react";
import { addDays, diffDays, type DateStr } from "../dates";
import { mentionable, type LinkIndex } from "./links";
import type { Document, DocumentTypeDef, ReportKind, ReportSetting } from "./types";

/**
 * Reports (CONTEXT.md, ADR 0076): read-only figures about the Documents of one
 * type, derived from the link index and never stored. A Report counts the
 * **Days that link** to a Document, once per Day however often the name comes
 * up: a Day *is* a date, so "Anna ×6 this month" means six days with Anna in
 * them. Periods, other Documents and unlinked mentions never count.
 */

/** The Day's type: its Documents are titled by their date. */
export const DAY_TYPE = "daily";

/**
 * The Event's type id. Core may not import Apps, so — like `DAY_TYPE` — the one
 * type the Seen family reads is named here. Seen reads only what any dated
 * Document has: a `date` and an optional `endDate` (ADR 0112).
 */
export const EVENT_TYPE = "event";

export type ReportFamily = "ranking" | "document";
/** What a Report counts (ADR 0112): Days that link (Mentioned) or Events that link (Seen). */
export type ReportSource = "mentioned" | "seen";
/** What a kind shows, whatever it counts. */
export type ReportShape = "top" | "quiet" | "last" | "count" | "heatmap";

export interface ReportKindDef {
  kind: ReportKind;
  label: string;
  family: ReportFamily;
  source: ReportSource;
  shape: ReportShape;
  description: string;
  /** The parameters the kind takes, with their defaults. */
  params: { n?: number; days?: number };
}

/** The fixed catalogue, in the order the type editor offers it. */
export const REPORT_KINDS: ReportKindDef[] = [
  { kind: "top", label: "Top mentioned", family: "ranking", source: "mentioned", shape: "top", description: "Who comes up on the most Days", params: { n: 5 } },
  { kind: "quiet", label: "Not mentioned lately", family: "ranking", source: "mentioned", shape: "quiet", description: "Mentioned before, but on no Day for a while", params: { n: 5, days: 90 } },
  { kind: "last", label: "Last mentioned", family: "document", source: "mentioned", shape: "last", description: "The last Day that links to it", params: {} },
  { kind: "count", label: "Mention count", family: "document", source: "mentioned", shape: "count", description: "Days that link to it, this year and in all", params: {} },
  { kind: "heatmap", label: "Heatmap", family: "document", source: "mentioned", shape: "heatmap", description: "The Days that link to it over the last 12 months", params: {} },
  { kind: "topSeen", label: "Top seen", family: "ranking", source: "seen", shape: "top", description: "Who is on the most days of Events that link to them", params: { n: 5 } },
  { kind: "quietSeen", label: "Not seen lately", family: "ranking", source: "seen", shape: "quiet", description: "Seen before, but on no Event's day for a while", params: { n: 5, days: 90 } },
  { kind: "lastSeen", label: "Last seen", family: "document", source: "seen", shape: "last", description: "The last day of an Event that links to it", params: {} },
  { kind: "seenCount", label: "Seen count", family: "document", source: "seen", shape: "count", description: "Days of Events that link to it, this year and in all", params: {} },
  { kind: "seenHeatmap", label: "Seen heatmap", family: "document", source: "seen", shape: "heatmap", description: "The days of Events that link to it over the last 12 months", params: {} },
];

export function reportKind(kind: ReportKind): ReportKindDef {
  return REPORT_KINDS.find((k) => k.kind === kind)!;
}

/** What every type starts with: enough to work with no setup. */
export const DEFAULT_REPORTS: ReportSetting[] = [{ kind: "top", n: 5 }, { kind: "last" }];

/**
 * A type's Reports, in its order: its own choice, else the defaults. Only a
 * type whose Documents can be named in a Day has any — not the Day itself, not
 * a period, not a type kept out of mentions.
 */
export function reportsOf(def: DocumentTypeDef | undefined): ReportSetting[] {
  if (!def || !mentionable(def)) return [];
  const chosen = def.reports ?? DEFAULT_REPORTS;
  return chosen.filter((r) => REPORT_KINDS.some((k) => k.kind === r.kind));
}

/** The type's chosen Reports of one family. */
export function reportsIn(def: DocumentTypeDef | undefined, family: ReportFamily): ReportSetting[] {
  return reportsOf(def).filter((r) => reportKind(r.kind).family === family);
}

/** A stretch of days, both ends included; an open end runs on. */
export interface ReportWindow {
  from?: DateStr;
  to?: DateStr;
}

const inWindow = (d: DateStr, w: ReportWindow) => (!w.from || d >= w.from) && (!w.to || d <= w.to);

/** The distinct dates of the Days that link to one Document, oldest first. */
export function mentionDays(index: LinkIndex, docId: string): DateStr[] {
  const days = new Set<DateStr>();
  for (const b of index.backlinksTo(docId)) {
    const src = index.byId.get(b.sourceId);
    if (src?.type === DAY_TYPE && /^\d{4}-\d{2}-\d{2}$/.test(src.title)) days.add(src.title);
  }
  return [...days].sort();
}

/**
 * Where a Report's dates come from: the distinct dates (oldest first) on which
 * one Document counts. The kinds below only rank and summarise these dates, so
 * a new family is a new source beside `mentionDays`, not new kind code.
 */
export type DaysSource = (index: LinkIndex, docId: string) => DateStr[];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** An Event spanning more days than this is not counted past it (a typo's endDate must not spin). */
const MAX_SPAN = 3660;

/**
 * The distinct days (oldest first, none after `today`) on which Events that
 * link to one Document are on: once per day however many Events, each day of a
 * multi-day Event, nothing in the future. Markers and Tasks are not Events.
 */
export function seenDays(index: LinkIndex, docId: string, today: DateStr): DateStr[] {
  const days = new Set<DateStr>();
  for (const b of index.backlinksTo(docId)) {
    const src = index.byId.get(b.sourceId) as (Document & { date?: unknown; endDate?: unknown }) | undefined;
    if (src?.type !== EVENT_TYPE || typeof src.date !== "string" || !DATE.test(src.date)) continue;
    const end = typeof src.endDate === "string" && DATE.test(src.endDate) && src.endDate > src.date ? src.endDate : src.date;
    const last = end < today ? end : today;
    for (let d = src.date, i = 0; d <= last && i < MAX_SPAN; d = addDays(d, 1), i++) days.add(d);
  }
  return [...days].sort();
}

/** The days source of a Report family, as of `today`. */
export function sourceOf(source: ReportSource, today: DateStr): DaysSource {
  return source === "seen" ? (index, docId) => seenDays(index, docId, today) : mentionDays;
}

export interface RankRow {
  docId: string;
  /** Days in the window that link to it. */
  count: number;
  /** The latest of them (for "quiet": the last Day ever). */
  last: DateStr;
}

/** "Top mentioned": a type's Documents by the Days in the window that link to them; none-mentioned left out. */
export function topMentioned(index: LinkIndex, typeId: string, window: ReportWindow = {}, source: DaysSource = mentionDays): RankRow[] {
  const rows: RankRow[] = [];
  for (const d of index.docs) {
    if (d.type !== typeId) continue;
    const days = source(index, d.id).filter((x) => inWindow(x, window));
    const last = days.at(-1);
    if (last) rows.push({ docId: d.id, count: days.length, last });
  }
  const title = (id: string) => index.byId.get(id)?.title ?? "";
  return rows.sort((a, b) => b.count - a.count || b.last.localeCompare(a.last) || title(a.docId).localeCompare(title(b.docId)));
}

/** "Not mentioned lately": a type's Documents some Day linked to, but none in the last `days` days — longest silence first. */
export function notMentionedSince(index: LinkIndex, typeId: string, days: number, today: DateStr, source: DaysSource = mentionDays): RankRow[] {
  const cutoff = addDays(today, -days);
  const rows: RankRow[] = [];
  for (const d of index.docs) {
    if (d.type !== typeId) continue;
    const all = source(index, d.id);
    const last = all[all.length - 1];
    if (last && last <= cutoff) rows.push({ docId: d.id, count: all.length, last });
  }
  return rows.sort((a, b) => a.last.localeCompare(b.last));
}

/** A ranking Report's rows, cut to its N. */
export function rankingRows(index: LinkIndex, typeId: string, setting: ReportSetting, window: ReportWindow, today: DateStr, source: DaysSource = sourceOf(reportKind(setting.kind).source, today)): RankRow[] {
  const def = reportKind(setting.kind);
  const n = setting.n ?? def.params.n ?? 5;
  if (def.shape === "quiet") return notMentionedSince(index, typeId, setting.days ?? def.params.days ?? 90, today, source).slice(0, n);
  return topMentioned(index, typeId, window, source).slice(0, n);
}

export interface DocumentFigures {
  /** The last Day that links to it. */
  last?: DateStr;
  /** Days since then (0 = today). */
  sinceLast?: number;
  thisYear: number;
  allTime: number;
  /** Every linking Day, for a heatmap. */
  days: Set<DateStr>;
}

/** The per-Document figures: last mentioned, counts, and the Days for a heatmap. */
export function documentFigures(index: LinkIndex, docId: string, today: DateStr, source: DaysSource = mentionDays): DocumentFigures {
  const all = source(index, docId);
  const last = all[all.length - 1];
  const year = today.slice(0, 4);
  return {
    last,
    sinceLast: last ? diffDays(last, today) : undefined,
    thisYear: all.filter((d) => d.startsWith(year)).length,
    allTime: all.length,
    days: new Set(all),
  };
}

/** React hooks over the live index — recomputed only when the index is rebuilt. */
export function useTopMentioned(index: LinkIndex, typeId: string, window: ReportWindow = {}): RankRow[] {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the window is keyed by its dates: callers pass a new object each render
  return useMemo(() => topMentioned(index, typeId, window), [index, typeId, window.from, window.to]);
}
export function useDocumentFigures(index: LinkIndex, docId: string, today: DateStr): DocumentFigures {
  return useMemo(() => documentFigures(index, docId, today), [index, docId, today]);
}
