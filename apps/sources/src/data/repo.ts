import { db, newId, normalizeTags, put, remove, todayStr, useLiveQuery } from "@lifeline/core";
import { COLOR_SLOTS, DEFAULT_REFRESH, SOURCES, type CalendarSub, type Embed, type Feed, type LiveValue, type Source, type SourceKind } from "../domain/types";
import { normalizeEmbedUrl } from "../domain/url";

function normalize(s: Source): Source {
  return { ...s, tags: s.tags ?? [], refreshMinutes: s.refreshMinutes || null, headers: s.headers ?? undefined };
}

export function useSources(): Source[] {
  return useLiveQuery(
    async () => (await db().collection<Source>(SOURCES).where("deleted").equals(0).toArray()).map(normalize),
    [],
    [] as Source[],
  );
}

export function useEmbeds(): Embed[] {
  return useSources().filter((s): s is Embed => s.kind === "embed");
}
export function useFeeds(): Feed[] {
  return useSources().filter((s): s is Feed => s.kind === "feed");
}
export function useCalendarSubs(): CalendarSub[] {
  return useSources().filter((s): s is CalendarSub => s.kind === "ical");
}
export function useLiveValues(): LiveValue[] {
  return useSources().filter((s): s is LiveValue => s.kind === "value");
}
export function useSource(id: string | undefined): Source | undefined {
  return useSources().find((e) => e.id === id);
}
export function useEmbed(id: string | undefined): Embed | undefined {
  const s = useSource(id);
  return s?.kind === "embed" ? s : undefined;
}

/** Fields every kind shares in its dialog. */
export interface SourceInputBase {
  name: string;
  url: string;
  tags?: string[];
  refreshMinutes?: number | null;
  headers?: Record<string, string> | null;
}

function scrubBase(kind: SourceKind, input: SourceInputBase) {
  const url = normalizeEmbedUrl(input.url);
  if (!url) throw new Error("Not a valid http(s) URL");
  const r = input.refreshMinutes;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.headers ?? {})) if (k.trim() && v.trim()) headers[k.trim()] = v.trim();
  return {
    name: input.name.trim() || hostFallback(url),
    url,
    tags: normalizeTags(input.tags ?? []),
    refreshMinutes: typeof r === "number" && Number.isFinite(r) && r > 0 ? Math.round(r) : kind === "embed" ? null : DEFAULT_REFRESH[kind],
    headers: Object.keys(headers).length ? headers : undefined,
  };
}

function hostFallback(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ---- Embed
export type EmbedInput = SourceInputBase;
export async function addEmbed(input: EmbedInput): Promise<string> {
  const id = newId();
  await put<Embed>(SOURCES, { id, kind: "embed", ...scrubBase("embed", input), createdAt: todayStr() });
  return id;
}
export async function updateEmbed(embed: Embed, input: EmbedInput): Promise<void> {
  await put<Embed>(SOURCES, { ...embed, ...scrubBase("embed", input) });
}

// ---- Feed
export type FeedInput = SourceInputBase;
export async function addFeed(input: FeedInput): Promise<string> {
  const id = newId();
  await put<Feed>(SOURCES, { id, kind: "feed", ...scrubBase("feed", input), seenUpTo: null, createdAt: todayStr() });
  return id;
}
export async function updateFeed(feed: Feed, input: FeedInput): Promise<void> {
  await put<Feed>(SOURCES, { ...feed, ...scrubBase("feed", input) });
}
/** "Seen up to now": items published after this are new. */
export async function markFeedSeen(feed: Feed, upTo: string = new Date().toISOString()): Promise<void> {
  if (feed.seenUpTo && feed.seenUpTo >= upTo) return;
  await put<Feed>(SOURCES, { ...feed, seenUpTo: upTo });
}

// ---- Calendar subscription
export interface CalendarSubInput extends SourceInputBase {
  color: string;
}
export async function addCalendarSub(input: CalendarSubInput): Promise<string> {
  const id = newId();
  await put<CalendarSub>(SOURCES, { id, kind: "ical", ...scrubBase("ical", input), color: slot(input.color), createdAt: todayStr() });
  return id;
}
export async function updateCalendarSub(sub: CalendarSub, input: CalendarSubInput): Promise<void> {
  await put<CalendarSub>(SOURCES, { ...sub, ...scrubBase("ical", input), color: slot(input.color) });
}
const slot = (c: string) => (COLOR_SLOTS.includes(c as (typeof COLOR_SLOTS)[number]) ? c : "blue");

// ---- Live value
export interface LiveValueInput extends SourceInputBase {
  mode: "json" | "regex";
  path: string;
  unit?: string;
  prefix?: string;
  decimals?: number | null;
}
function scrubValue(input: LiveValueInput) {
  const d = input.decimals;
  return {
    mode: input.mode === "regex" ? ("regex" as const) : ("json" as const),
    path: input.path.trim(),
    unit: input.unit?.trim() || undefined,
    prefix: input.prefix?.trim() || undefined,
    decimals: typeof d === "number" && Number.isFinite(d) && d >= 0 ? Math.min(6, Math.round(d)) : null,
  };
}
export async function addLiveValue(input: LiveValueInput): Promise<string> {
  const id = newId();
  await put<LiveValue>(SOURCES, { id, kind: "value", ...scrubBase("value", input), ...scrubValue(input), createdAt: todayStr() });
  return id;
}
export async function updateLiveValue(v: LiveValue, input: LiveValueInput): Promise<void> {
  await put<LiveValue>(SOURCES, { ...v, ...scrubBase("value", input), ...scrubValue(input) });
}

export async function deleteSource(id: string): Promise<void> {
  await remove(SOURCES, id);
}
