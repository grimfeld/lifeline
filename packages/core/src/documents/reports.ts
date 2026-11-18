import { useMemo } from "react";
import { addDays, diffDays, formatHuman, type DateStr } from "../dates";
import { mentionable, type Backlink, type LinkIndex, type Reach } from "./links";
import { dayOf, eventSpan, exchangeDay, MAX_SPAN } from "./sourceDays";
import type { Document, DocumentTypeDef, ReportKind, ReportSetting, SeenAs } from "./types";
import { PERSON_TYPE } from "../people";

/**
 * Reports (CONTEXT.md, ADR 0076): read-only figures about the Documents of one
 * type, derived from the link index and never stored. A Report counts the
 * **Days that link** to a Document, once per Day however often the name comes
 * up: a Day *is* a date, so "Anna ×6 this month" means six days with Anna in
 * them. Periods, other Documents and unlinked mentions never count.
 */

export { DAY_TYPE, EVENT_TYPE, EXCHANGE_TYPE, dayOf, isDateStr } from "./sourceDays";

export type ReportFamily = "ranking" | "document";
/** What a Report counts (ADR 0112, ADR 0131): Days that link (Mentioned), Events that link (Seen), or Exchanges with it (Talked). */
export type ReportSource = "mentioned" | "seen" | "talked";
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
  { kind: "topTalked", label: "Top talked", family: "ranking", source: "talked", shape: "top", description: "Who is on the most days of Exchanges with them", params: { n: 5 } },
  { kind: "quietTalked", label: "Not talked lately", family: "ranking", source: "talked", shape: "quiet", description: "Talked with before, but on no Exchange's day for a while", params: { n: 5, days: 90 } },
  { kind: "lastTalked", label: "Last talked", family: "document", source: "talked", shape: "last", description: "The last day of an Exchange with it", params: {} },
  { kind: "talkedCount", label: "Talked count", family: "document", source: "talked", shape: "count", description: "Days of Exchanges with it, this year and in all", params: {} },
  { kind: "talkedHeatmap", label: "Talked heatmap", family: "document", source: "talked", shape: "heatmap", description: "The days of Exchanges with it over the last 12 months", params: {} },
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

/**
 * What a Journal period rolls up for a type (ADR 0076, ADR 0128): its Top
 * mentioned, then its Top seen (a Place's Top visited) — never added together.
 */
export function periodReportsOf(def: DocumentTypeDef | undefined): ReportSetting[] {
  const chosen = reportsOf(def);
  return (["top", "topSeen"] as const).flatMap((kind) => chosen.filter((r) => r.kind === kind));
}

/** A stretch of days, both ends included; an open end runs on. */
export interface ReportWindow {
  from?: DateStr;
  to?: DateStr;
}

const inWindow = (d: DateStr, w: ReportWindow) => (!w.from || d >= w.from) && (!w.to || d <= w.to);

/**
 * The distinct dates of the Days that reach one Document, oldest first: that
 * link to it, or to a Household it was a member of that day (ADR 0117).
 */
export function mentionDays(index: LinkIndex, docId: string): DateStr[] {
  const days = new Set<DateStr>();
  for (const b of index.reaches(docId)) {
    const src = index.byId.get(b.sourceId);
    const day = dayOf(src);
    if (day) days.add(day);
  }
  return [...days].sort();
}

/**
 * Where a Report's dates come from: the distinct dates (oldest first) on which
 * one Document counts. The kinds below only rank and summarise these dates, so
 * a new family is a new source beside `mentionDays`, not new kind code.
 */
export type DaysSource = (index: LinkIndex, docId: string) => DateStr[];

/** The Event's At field (ADR 0128): where it happens, a Place or a Person's home. */
export const EVENT_AT_FIELD = "at";

/**
 * Whether an Event's link counts its target as Seen (ADR 0128): every link
 * does, but an At on a Person — being at Marc's home is not seeing Marc. With,
 * and a wikilink in the notes, still count; At on a Place counts (Visited).
 */
export const countsAsSeen = (b: Backlink, target: Document | undefined): boolean => !(b.field === EVENT_AT_FIELD && target?.type === PERSON_TYPE);

/** The days a reach counts on, first to last, when it counts at all: what tells Seen from Talked. */
type CountedSpan = (b: Reach, src: Document | undefined) => { from: DateStr; to: DateStr } | undefined;

/**
 * The distinct days (oldest first, none after `today`) a family counts for one
 * Document: once per day however many sources, each day of a span, nothing in
 * the future. Through a Household (ADR 0117), only the days they were a member.
 */
function countedDays(index: LinkIndex, docId: string, today: DateStr, spanOf: CountedSpan): DateStr[] {
  const days = new Set<DateStr>();
  for (const b of index.reaches(docId)) {
    const span = spanOf(b, index.byId.get(b.sourceId));
    if (!span) continue;
    if (b.via) {
      for (const d of b.days ?? []) if (d <= today) days.add(d);
      continue;
    }
    const last = span.to < today ? span.to : today;
    for (let d = span.from, i = 0; d <= last && i < MAX_SPAN; d = addDays(d, 1), i++) days.add(d);
  }
  return [...days].sort();
}

/**
 * The distinct days (oldest first, none after `today`) on which Events that
 * reach one Document are on: once per day however many Events, each day of a
 * multi-day Event, nothing in the future. Markers and Tasks are not Events,
 * and an Event's At on a Person is no sighting (`countsAsSeen`). Through a
 * Household (ADR 0117), only the days they were a member.
 */
export function seenDays(index: LinkIndex, docId: string, today: DateStr): DateStr[] {
  const target = index.byId.get(docId);
  return countedDays(index, docId, today, (b, src) => (countsAsSeen(b, target) ? eventSpan(src) : undefined));
}

/** The Exchange's With field (ADR 0131): its People, the one link Talked counts. */
const EXCHANGE_WITH_FIELD = "with";

const withIds = (src: Document | undefined): unknown[] => (Array.isArray(src?.[EXCHANGE_WITH_FIELD]) ? (src[EXCHANGE_WITH_FIELD] as unknown[]) : []);

/**
 * Whether a reach is an Exchange talking to its target (ADR 0131): through its
 * With, directly or through a Household in it. A wikilink in its body is a
 * Backlink and nothing more: being told about Lucie is not talking to her.
 */
const talkedThrough = (b: Reach, src: Document | undefined): boolean => (b.via ? withIds(src).includes(b.via) : b.field === EXCHANGE_WITH_FIELD);

/**
 * The distinct days (oldest first, none after `today`) of the Exchanges whose
 * With reaches one Document (ADR 0131): once per day however many Exchanges,
 * nothing in the future. Through a Household in With (ADR 0117), only the days
 * they were a member.
 */
export function talkedDays(index: LinkIndex, docId: string, today: DateStr): DateStr[] {
  return countedDays(index, docId, today, (b, src) => {
    const day = exchangeDay(src);
    return day && talkedThrough(b, src) ? { from: day, to: day } : undefined;
  });
}

/**
 * The newest Exchange that counts as Talked for one Document (ADR 0131), none
 * after `today`: on the last talked day, the one logged last. What says how
 * someone was last in touch ("call · 120 days ago"); nothing when never.
 */
export function lastTalkedExchange(index: LinkIndex, docId: string, today: DateStr): Document | undefined {
  let best: { doc: Document; day: DateStr } | undefined;
  for (const b of index.reaches(docId)) {
    const src = index.byId.get(b.sourceId);
    const day = exchangeDay(src);
    if (!src || !day || day > today || !talkedThrough(b, src)) continue;
    if (b.via && !b.days?.includes(day)) continue;
    if (!best || day > best.day || (day === best.day && src.createdAt > best.doc.createdAt)) best = { doc: src, day };
  }
  return best?.doc;
}

/**
 * An Event's last day: its end day, the day before when it ends at 00:00
 * (`lastDayCovered`, ADR 0090), its first when it has no later end; none for
 * any other Document or an undated Event. What Seen counts to, and what says
 * an Event has happened (ADR 0128).
 */
export const eventLastDay = (doc: Document | undefined): DateStr | undefined => eventSpan(doc)?.to;

/** The days source of a Report family, as of `today`. */
export function sourceOf(source: ReportSource, today: DateStr): DaysSource {
  if (source === "seen") return (index, docId) => seenDays(index, docId, today);
  if (source === "talked") return (index, docId) => talkedDays(index, docId, today);
  return mentionDays;
}

/** The words a Report of one source uses: what its count is of, what its heatmap counts, and what links. */
export interface ReportWords {
  count: string;
  heatmap: string;
  linker: string;
}

const WORDS: Record<ReportSource, ReportWords> = {
  mentioned: { count: "Days", heatmap: "Days", linker: "Day" },
  seen: { count: "Seen", heatmap: "days seen", linker: "Event" },
  talked: { count: "Talked", heatmap: "days talked", linker: "Exchange" },
};

/** The words a Report of one source uses, in the type's own words for Seen (a Place's Visits). */
export function reportWords(source: ReportSource, def?: DocumentTypeDef): ReportWords {
  if (source !== "seen" || !def?.seenAs) return WORDS[source];
  return { count: capital(def.seenAs.many), heatmap: `days ${def.seenAs.verb}`, linker: WORDS.seen.linker };
}

/** A kind's label for one type: the Seen kinds in its own words (a Place's "Last visited", ADR 0128). */
export function reportLabel(kind: ReportKind, def?: DocumentTypeDef): string {
  const k = reportKind(kind);
  const w = def?.seenAs;
  if (k.source !== "seen" || !w) return k.label;
  const labels: Record<ReportShape, string> = {
    top: `Top ${w.verb}`,
    quiet: `Not ${w.verb} lately`,
    last: `Last ${w.verb}`,
    count: capital(w.many),
    heatmap: `${capital(w.verb)} heatmap`,
  };
  return labels[k.shape];
}

/** How long ago, said in days. */
export function agoText(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** The Seen family's words when a type gives none: seen, in days. */
const SEEN: SeenAs = { verb: "seen", one: "day", many: "days" };
const seenAs = (def: DocumentTypeDef | undefined): SeenAs => def?.seenAs ?? SEEN;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * One Document's Seen in a line, in its type's words: "Last visited 10 Nov ·
 * 1 visit" for a Place (ADR 0128), "Last seen … · 3 days" for a Person.
 */
export function seenSummary(f: Pick<DocumentFigures, "last" | "allTime">, def: DocumentTypeDef | undefined): string {
  const w = seenAs(def);
  if (!f.last) return `Not ${w.verb} yet`;
  return `Last ${w.verb} ${formatHuman(f.last)} · ${f.allTime} ${f.allTime === 1 ? w.one : w.many}`;
}

/** A "Last …" Report's value: the last day and how long ago, or never. */
export function lastText(f: Pick<DocumentFigures, "last" | "sinceLast">): string {
  return f.last ? `${formatHuman(f.last)} · ${agoText(f.sinceLast ?? 0)}` : "never";
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
export function rankingRows(index: LinkIndex, typeId: string, setting: ReportSetting, window: ReportWindow, today: DateStr, source?: DaysSource): RankRow[] {
  const def = reportKind(setting.kind);
  source ??= sourceOf(def.source, today);
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
