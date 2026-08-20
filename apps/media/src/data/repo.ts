import { useMemo } from "react";
import { documentsOf, getDocument, normalizeTags, putDocument, removeDocument, todayStr, useDocument, useLiveQuery } from "@lifeline/core";
import { MEDIA_SETTINGS, MEDIA_SETTINGS_ID, MEDIA_TYPE_IDS, type Acquisition, type MediaItem, type MediaSettings } from "../domain/types";
import type { MediaTypeId } from "../domain/mediaTypes";
import type { Patch } from "../domain/rules";
import { deleteQuotesOf } from "./quotes";

/**
 * PocketBase stores absent text/number fields as ""/0 and hands them back
 * that way, so every read re-establishes the domain's defaults.
 */
export function normalize(m: MediaItem): MediaItem {
  return {
    ...m,
    creator: m.creator ?? "",
    externalKey: m.externalKey ?? "",
    coverUrl: m.coverUrl ?? "",
    size: m.size || 0,
    year: m.year || 0,
    reason: m.reason ?? "",
    slot: m.slot || 0,
    studied: !!m.studied,
    acquiredOn: m.acquiredOn ?? "",
    slottedOn: m.slottedOn ?? "",
    startedOn: m.startedOn ?? "",
    finishedOn: m.finishedOn ?? "",
    tags: m.tags ?? [],
  };
}

/** Every media item, across all six medium types (one query per type, flattened). */
export function useMedia(): MediaItem[] {
  const rows = useLiveQuery(
    async () => (await Promise.all(MEDIA_TYPE_IDS.map((t) => documentsOf<MediaItem>(t)))).flat(),
    [],
    [] as MediaItem[],
  );
  return useMemo(() => rows.map(normalize), [rows]);
}

export function useMediaItem(id: string | undefined): MediaItem | undefined {
  const row = useDocument<MediaItem>(id);
  return useMemo(() => (row ? normalize(row) : undefined), [row]);
}

export async function addMedia(input: {
  medium: MediaTypeId;
  title: string;
  creator?: string;
  externalKey?: string;
  coverUrl?: string;
  size?: number;
  year?: number;
  acquisition: Acquisition;
  reason: string;
  tags?: string[];
}): Promise<string> {
  const today = todayStr();
  const row = await putDocument<MediaItem>({
    type: input.medium,
    title: input.title.trim(),
    creator: input.creator?.trim() ?? "",
    externalKey: input.externalKey ?? "",
    coverUrl: input.coverUrl ?? "",
    size: input.size || 0,
    year: input.year || 0,
    acquisition: input.acquisition,
    engagement: "UNSTARTED",
    studied: false,
    reason: input.reason.trim(),
    slot: 0,
    addedOn: today,
    acquiredOn: input.acquisition === "OWNED" || input.acquisition === "BORROWED" ? today : "",
    slottedOn: "",
    startedOn: "",
    finishedOn: "",
    tags: normalizeTags(input.tags),
  });
  return row.id;
}

/** Apply a transition patch (or an edit) to an item. */
export async function patchMedia(item: MediaItem, patch: Patch): Promise<void> {
  const next = { ...item, ...patch };
  await putDocument<MediaItem>({ ...next, tags: normalizeTags(next.tags) });
}

export async function deleteMedia(id: string): Promise<void> {
  await removeDocument(id);
  // A Quote cannot outlive its item (CONTEXT.md).
  await deleteQuotesOf(id);
}

/** Existing item with the same external identity, if any ("do I already own this?"). */
export function findByExternalKey(items: MediaItem[], key: string): MediaItem | undefined {
  return key ? items.find((m) => m.externalKey === key) : undefined;
}

/**
 * Quick add (ADR 0006 amendment): title, optional creator, medium — straight
 * onto the To… shelf, nothing else asked. Optional lookup hit attaches
 * cover/year/external key. Returns the id (for Undo).
 */
export async function quickAddMedia(input: { medium: MediaTypeId; title: string; creator?: string; hit?: { externalKey: string; coverUrl: string; year: number; size: number; creator: string } }): Promise<string> {
  return addMedia({
    medium: input.medium,
    title: input.title,
    creator: input.creator || input.hit?.creator || "",
    externalKey: input.hit?.externalKey ?? "",
    coverUrl: input.hit?.coverUrl ?? "",
    year: input.hit?.year ?? 0,
    size: input.hit?.size ?? 0,
    acquisition: "WANTED",
    reason: "",
  });
}

/** Parse "Title — Creator" / "Title - Creator" / "Title by Creator" typed in a quick-add box. */
export function parseQuickTitle(raw: string): { title: string; creator: string } {
  const t = raw.trim();
  const m = /^(.*?)\s+(?:—|–|-|by)\s+(.+)$/.exec(t);
  if (m && m[1].trim() && m[2].trim()) return { title: m[1].trim(), creator: m[2].trim() };
  return { title: t, creator: "" };
}

/* ---------- Lookup settings (one internal Document, id "default") ---------- */

const EMPTY_SETTINGS: MediaSettings = {
  id: MEDIA_SETTINGS_ID, type: MEDIA_SETTINGS, title: "Media lookup settings", tags: [], folder: "", createdAt: "",
  tmdbKey: "", rawgKey: "", comicvineKey: "", googleBooksKey: "", updatedAt: "", deleted: 0,
};

function normalizeSettings(s: Partial<MediaSettings> | undefined): MediaSettings {
  return { ...EMPTY_SETTINGS, ...(s ?? {}), tmdbKey: s?.tmdbKey ?? "", rawgKey: s?.rawgKey ?? "", comicvineKey: s?.comicvineKey ?? "", googleBooksKey: s?.googleBooksKey ?? "" };
}

/** The lookup settings record (empty keys until saved). */
export function useMediaSettings(): MediaSettings {
  const row = useDocument<MediaSettings>(MEDIA_SETTINGS_ID);
  // Stable identity between live-query results: effects depend on it.
  return useMemo(() => normalizeSettings(row), [row]);
}

export async function saveMediaSettings(patch: Partial<Omit<MediaSettings, "id" | "updatedAt" | "deleted">>): Promise<void> {
  const cur = normalizeSettings(await getDocument<MediaSettings>(MEDIA_SETTINGS_ID));
  const trimmed = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
  await putDocument<MediaSettings>({ ...cur, ...trimmed, id: MEDIA_SETTINGS_ID, type: MEDIA_SETTINGS });
}
