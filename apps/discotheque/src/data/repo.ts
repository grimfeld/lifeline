import { useMemo } from "react";
import { documentsOf, normalizeTags, putDocument, removeDocument, todayStr, useDocument, useDocuments, useLiveQuery } from "@lifeline/core";
import { PLAYLIST, WORK_TYPE_IDS, type Playlist, type Work } from "../domain/types";
import { removeFromPlaylist } from "../domain/playlist";
import type { WorkTypeId } from "../domain/workTypes";
import type { Patch } from "../domain/rules";

/**
 * PocketBase stores absent text/number fields as ""/0 and hands them back
 * that way, so every read re-establishes the domain's defaults.
 */
export function normalize(m: Work): Work {
  return {
    ...m,
    creator: m.creator ?? "",
    externalKey: m.externalKey ?? "",
    coverUrl: m.coverUrl ?? "",
    size: m.size || 0,
    year: m.year || 0,
    reason: m.reason ?? "",
    startedOn: m.startedOn ?? "",
    finishedOn: m.finishedOn ?? "",
    liked: m.liked === true,
    rating: m.rating || 0,
    tags: m.tags ?? [],
  };
}

/** Every media item, across all six medium types (one query per type, flattened). */
export function useWorks(): Work[] {
  const rows = useLiveQuery(
    async () => (await Promise.all(WORK_TYPE_IDS.map((t) => documentsOf<Work>(t)))).flat(),
    [],
    [] as Work[],
  );
  return useMemo(() => rows.map(normalize), [rows]);
}

export function useMediaItem(id: string | undefined): Work | undefined {
  const row = useDocument<Work>(id);
  return useMemo(() => (row ? normalize(row) : undefined), [row]);
}

export async function addWork(input: {
  medium: WorkTypeId;
  title: string;
  creator?: string;
  externalKey?: string;
  coverUrl?: string;
  size?: number;
  year?: number;
  reason: string;
  tags?: string[];
}): Promise<string> {
  const today = todayStr();
  const row = await putDocument<Work>({
    type: input.medium,
    title: input.title.trim(),
    creator: input.creator?.trim() ?? "",
    externalKey: input.externalKey ?? "",
    coverUrl: input.coverUrl ?? "",
    size: input.size || 0,
    year: input.year || 0,
    engagement: "UNSTARTED",
    reason: input.reason.trim(),
    addedOn: today,
    startedOn: "",
    finishedOn: "",
    liked: false,
    rating: 0,
    tags: normalizeTags(input.tags),
  });
  return row.id;
}

/** Apply a transition patch (or an edit) to an item. */
export async function patchWork(item: Work, patch: Patch): Promise<void> {
  const next = { ...item, ...patch };
  await putDocument<Work>({ ...next, tags: normalizeTags(next.tags) });
}

/** Delete an album; it leaves every Playlist it sat in (membership is the Playlist's — ADR 0035). */
export async function deleteWork(id: string): Promise<void> {
  for (const p of await documentsOf<Playlist>(PLAYLIST)) {
    const ids = Array.isArray(p.workIds) ? p.workIds : [];
    if (ids.includes(id)) await putDocument<Playlist>({ ...p, workIds: removeFromPlaylist(ids, id) });
  }
  await removeDocument(id);
}

/* ---------- Playlists (ADR 0035) ---------- */

function normalizePlaylist(p: Playlist): Playlist {
  return { ...p, workIds: Array.isArray(p.workIds) ? p.workIds : [], ranked: p.ranked === true, body: p.body ?? "" };
}

export function usePlaylists(): Playlist[] {
  const rows = useDocuments<Playlist>(PLAYLIST);
  return useMemo(() => rows.map(normalizePlaylist), [rows]);
}

export async function addPlaylist(input: { title: string; body: string; ranked: boolean; workIds?: string[] }): Promise<string> {
  const row = await putDocument<Playlist>({ type: PLAYLIST, title: input.title.trim(), body: input.body, ranked: input.ranked, workIds: input.workIds ?? [], tags: [] });
  return row.id;
}

export async function patchPlaylist(playlist: Playlist, patch: Partial<Pick<Playlist, "title" | "body" | "ranked" | "workIds">>): Promise<void> {
  await putDocument<Playlist>({ ...playlist, ...patch });
}

export async function deletePlaylist(id: string): Promise<void> {
  await removeDocument(id);
}

/** Existing item with the same external identity, if any ("do I already own this?"). */
export function findByExternalKey(items: Work[], key: string): Work | undefined {
  return key ? items.find((m) => m.externalKey === key) : undefined;
}

/**
 * Quick add (ADR 0006 amendment): title, optional creator, medium — straight
 * onto the To… shelf, nothing else asked. Optional lookup hit attaches
 * cover/year/external key. Returns the id (for Undo).
 */
export async function quickAddWork(input: { medium: WorkTypeId; title: string; creator?: string; hit?: { externalKey: string; coverUrl: string; year: number; size: number; creator: string } }): Promise<string> {
  return addWork({
    medium: input.medium,
    title: input.title,
    creator: input.creator || input.hit?.creator || "",
    externalKey: input.hit?.externalKey ?? "",
    coverUrl: input.hit?.coverUrl ?? "",
    year: input.hit?.year ?? 0,
    size: input.hit?.size ?? 0,
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
