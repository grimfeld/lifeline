import { useMemo } from "react";
import { addDays, diffDays, type DateStr } from "../dates";
import { mentionable, type LinkIndex } from "./links";
import type { DocumentTypeDef, ReportKind, ReportSetting } from "./types";

/**
 * Reports (CONTEXT.md, ADR 0076): read-only figures about the Documents of one
 * type, derived from the link index and never stored. A Report counts the
 * **Days that link** to a Document, once per Day however often the name comes
 * up: a Day *is* a date, so "Anna ×6 this month" means six days with Anna in
 * them. Periods, other Documents and unlinked mentions never count.
 */

/** The Day's type: its Documents are titled by their date. */
export const DAY_TYPE = "daily";

export type ReportFamily = "ranking" | "document";

export interface ReportKindDef {
  kind: ReportKind;
  label: string;
  family: ReportFamily;
  description: string;
  /** The parameters the kind takes, with their defaults. */
  params: { n?: number; days?: number };
}

/** The fixed catalogue, in the order the type editor offers it. */
export const REPORT_KINDS: ReportKindDef[] = [
  { kind: "top", label: "Top mentioned", family: "ranking", description: "Who comes up on the most Days", params: { n: 5 } },
  { kind: "quiet", label: "Not mentioned lately", family: "ranking", description: "Mentioned before, but on no Day for a while", params: { n: 5, days: 90 } },
  { kind: "last", label: "Last mentioned", family: "document", description: "The last Day that links to it", params: {} },
  { kind: "count", label: "Mention count", family: "document", description: "Days that link to it, this year and in all", params: {} },
  { kind: "heatmap", label: "Heatmap", family: "document", description: "The Days that link to it over the last 12 months", params: {} },
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

export interface RankRow {
  docId: string;
  /** Days in the window that link to it. */
  count: number;
  /** The latest of them (for "quiet": the last Day ever). */
  last: DateStr;
}

/** "Top mentioned": a type's Documents by the Days in the window that link to them; none-mentioned left out. */
export function topMentioned(index: LinkIndex, typeId: string, window: ReportWindow = {}): RankRow[] {
  const rows: RankRow[] = [];
  for (const d of index.docs) {
    if (d.type !== typeId) continue;
    const days = mentionDays(index, d.id).filter((x) => inWindow(x, window));
    const last = days.at(-1);
    if (last) rows.push({ docId: d.id, count: days.length, last });
  }
  const title = (id: string) => index.byId.get(id)?.title ?? "";
  return rows.sort((a, b) => b.count - a.count || b.last.localeCompare(a.last) || title(a.docId).localeCompare(title(b.docId)));
}

/** "Not mentioned lately": a type's Documents some Day linked to, but none in the last `days` days — longest silence first. */
export function notMentionedSince(index: LinkIndex, typeId: string, days: number, today: DateStr): RankRow[] {
  const cutoff = addDays(today, -days);
  const rows: RankRow[] = [];
  for (const d of index.docs) {
    if (d.type !== typeId) continue;
    const all = mentionDays(index, d.id);
    const last = all[all.length - 1];
    if (last && last <= cutoff) rows.push({ docId: d.id, count: all.length, last });
  }
  return rows.sort((a, b) => a.last.localeCompare(b.last));
}

/** A ranking Report's rows, cut to its N. */
export function rankingRows(index: LinkIndex, typeId: string, setting: ReportSetting, window: ReportWindow, today: DateStr): RankRow[] {
  const def = reportKind(setting.kind);
  const n = setting.n ?? def.params.n ?? 5;
  if (setting.kind === "quiet") return notMentionedSince(index, typeId, setting.days ?? def.params.days ?? 90, today).slice(0, n);
  return topMentioned(index, typeId, window).slice(0, n);
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
export function documentFigures(index: LinkIndex, docId: string, today: DateStr): DocumentFigures {
  const all = mentionDays(index, docId);
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
