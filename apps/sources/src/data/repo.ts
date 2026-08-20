import { useMemo } from "react";
import { newId, normalizeTags, putDocument, removeDocument, useDocuments } from "@lifeline/core";
import { COLOR_SLOTS, DEFAULT_REFRESH, SOURCE_TYPE, type CalendarSub, type Embed, type Feed, type LiveValue, type Source, type SourceKind } from "../domain/types";
import { normalizeEmbedUrl } from "../domain/url";

function normalize(s: Source): Source {
  return { ...s, tags: s.tags ?? [], refreshMinutes: s.refreshMinutes || null, headers: s.headers ?? undefined };
}

export function useSources(): Source[] {
  const rows = useDocuments<Source>(SOURCE_TYPE);
  // Stable identity between live-query results: effects and memos depend on it.
  return useMemo(() => rows.map(normalize), [rows]);
}

function useOfKind<T extends Source>(kind: SourceKind): T[] {
  const all = useSources();
  return useMemo(() => all.filter((s): s is T => s.kind === kind), [all, kind]);
}
export function useEmbeds(): Embed[] {
  return useOfKind<Embed>("embed");
}
export function useFeeds(): Feed[] {
  return useOfKind<Feed>("feed");
}
export function useCalendarSubs(): CalendarSub[] {
  return useOfKind<CalendarSub>("ical");
}
export function useLiveValues(): LiveValue[] {
  return useOfKind<LiveValue>("value");
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
    title: input.name.trim() || hostFallback(url),
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
  await putDocument<Embed>({ type: SOURCE_TYPE, id, kind: "embed", ...scrubBase("embed", input) });
  return id;
}
export async function updateEmbed(embed: Embed, input: EmbedInput): Promise<void> {
  await putDocument<Embed>({ ...embed, ...scrubBase("embed", input) });
}

// ---- Feed
export type FeedInput = SourceInputBase;
export async function addFeed(input: FeedInput): Promise<string> {
  const id = newId();
  await putDocument<Feed>({ type: SOURCE_TYPE, id, kind: "feed", ...scrubBase("feed", input), seenUpTo: null });
  return id;
}
export async function updateFeed(feed: Feed, input: FeedInput): Promise<void> {
  await putDocument<Feed>({ ...feed, ...scrubBase("feed", input) });
}
/** "Seen up to now": items published after this are new. */
export async function markFeedSeen(feed: Feed, upTo: string = new Date().toISOString()): Promise<void> {
  if (feed.seenUpTo && feed.seenUpTo >= upTo) return;
  await putDocument<Feed>({ ...feed, seenUpTo: upTo });
}

// ---- Calendar subscription
export interface CalendarSubInput extends SourceInputBase {
  color: string;
}
export async function addCalendarSub(input: CalendarSubInput): Promise<string> {
  const id = newId();
  await putDocument<CalendarSub>({ type: SOURCE_TYPE, id, kind: "ical", ...scrubBase("ical", input), color: slot(input.color) });
  return id;
}
export async function updateCalendarSub(sub: CalendarSub, input: CalendarSubInput): Promise<void> {
  await putDocument<CalendarSub>({ ...sub, ...scrubBase("ical", input), color: slot(input.color) });
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
  await putDocument<LiveValue>({ type: SOURCE_TYPE, id, kind: "value", ...scrubBase("value", input), ...scrubValue(input) });
  return id;
}
export async function updateLiveValue(v: LiveValue, input: LiveValueInput): Promise<void> {
  await putDocument<LiveValue>({ ...v, ...scrubBase("value", input), ...scrubValue(input) });
}

export async function deleteSource(id: string): Promise<void> {
  await removeDocument(id);
}
